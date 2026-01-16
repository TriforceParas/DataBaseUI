/**
 * Change Manager Hook
 * 
 * Manages pending database changes (INSERT, UPDATE, DELETE) with support for:
 * - Batch operations with transactional execution
 * - Error handling with foreign key constraint detection
 * - Selective confirm/discard of changes
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Connection, PendingChange, QueryResult, Tab, BatchChange } from '../types/index';
import * as api from '../api';

export interface ChangeError {
    change: PendingChange;
    error: string;
    isForeignKeyError?: boolean;
}

interface UseChangeManagerOptions {
    onSuccess?: () => void;
    onErrors?: (errors: ChangeError[]) => void;
    sessionId?: string | null;
}

interface SelectedChange {
    tabId: string;
    indices: number[];
}

interface UseChangeManagerReturn {
    pendingChanges: Record<string, PendingChange[]>;
    setPendingChanges: React.Dispatch<React.SetStateAction<Record<string, PendingChange[]>>>;
    showChangelog: boolean;
    setShowChangelog: React.Dispatch<React.SetStateAction<boolean>>;
    changelogConfirm: { type: 'confirm' | 'discard' } | null;
    setChangelogConfirm: React.Dispatch<React.SetStateAction<{ type: 'confirm' | 'discard' } | null>>;
    highlightRowIndex: number | null;
    setHighlightRowIndex: React.Dispatch<React.SetStateAction<number | null>>;
    handleRevertChange: (tabId: string, changeIndex: number) => void;
    handleConfirmChanges: () => void;
    executeConfirmChanges: (tabs: Tab[], results: Record<string, { data: QueryResult | null }>, addLog: (query: string, status: 'Success' | 'Error', table?: string, error?: string, rows?: number, user?: string) => void, fetchTableData: (tabId: string, tableName: string) => Promise<void>) => Promise<void>;
    handleDiscardChanges: () => void;
    executeDiscardChanges: (setSelectedIndices: (val: Set<number>) => void) => void;
    executeConfirmSelected: (selected: SelectedChange[], tabs: Tab[], results: Record<string, { data: QueryResult | null }>, addLog: (query: string, status: 'Success' | 'Error', table?: string, error?: string, rows?: number, user?: string) => void, fetchTableData: (tabId: string, tableName: string) => Promise<void>) => Promise<void>;
    executeDiscardSelected: (selected: SelectedChange[]) => void;
    handleNavigateToChange: (tabId: string, rowIndex: number) => void;
    retryWithFKDisabled: (errors: ChangeError[], addLog: (query: string, status: 'Success' | 'Error', table?: string, error?: string, rows?: number, user?: string) => void) => Promise<void>;
}

/** Detects if an error message indicates a foreign key constraint violation */
const isForeignKeyError = (errorMsg: string): boolean => {
    const msg = errorMsg.toLowerCase();
    return msg.includes('foreign key') ||
        msg.includes('fk_') ||
        msg.includes('constraint') ||
        msg.includes('violates') ||
        msg.includes('referenced') ||
        msg.includes('references');
};

export const useChangeManager = (
    connection: Connection,
    options?: UseChangeManagerOptions
): UseChangeManagerReturn => {
    const [pendingChanges, setPendingChanges] = useState<Record<string, PendingChange[]>>({});
    const [showChangelog, setShowChangelog] = useState(false);
    const [changelogConfirm, setChangelogConfirm] = useState<{ type: 'confirm' | 'discard' } | null>(null);
    const [highlightRowIndex, setHighlightRowIndex] = useState<number | null>(null);

    const connectionStringRef = useRef<string | null>(null);

    // Reset connection cache when connection changes
    useEffect(() => {
        connectionStringRef.current = null;
    }, [connection.id, connection.database_name]);

    const getConnectionString = useCallback(async (): Promise<string> => {
        if (options?.sessionId) return options.sessionId;
        if (connectionStringRef.current) return connectionStringRef.current;
        const connStr = await invoke<string>('get_connection_string', {
            connectionId: connection.id,
            databaseName: connection.database_name
        });
        connectionStringRef.current = connStr;
        return connStr;
    }, [connection.id, connection.database_name, options?.sessionId]);

    const handleRevertChange = useCallback((tabId: string, changeIndex: number) => {
        setPendingChanges(prev => {
            const list = prev[tabId] || [];
            if (changeIndex < 0 || changeIndex >= list.length) return prev;
            const newList = [...list];
            newList.splice(changeIndex, 1);
            return { ...prev, [tabId]: newList };
        });
    }, []);

    const handleConfirmChanges = useCallback(() => {
        setChangelogConfirm({ type: 'confirm' });
    }, []);

    const executeConfirmChanges = useCallback(async (
        tabs: Tab[],
        results: Record<string, { data: QueryResult | null }>,
        addLog: (query: string, status: 'Success' | 'Error', table?: string, error?: string, rows?: number, user?: string) => void,
        fetchTableData: (tabId: string, tableName: string) => Promise<void>
    ) => {

        const connectionString = await getConnectionString();
        const errors: ChangeError[] = [];
        const successfulTabIds: Set<string> = new Set();

        for (const [tabId, changes] of Object.entries(pendingChanges)) {
            if (changes.length === 0) continue;

            // Handle schema changes first - per-change try/catch
            const schemaChanges = changes.filter(c => c.type === 'ADD_COLUMN' || c.type === 'DROP_COLUMN');
            for (const change of schemaChanges) {
                if (change.generatedSql) {
                    try {
                        await api.executeQuery(connectionString, change.generatedSql);
                        addLog(change.generatedSql, 'Success', change.tableName, undefined, 1);
                        successfulTabIds.add(tabId);
                    } catch (e) {
                        const errorMsg = String(e);
                        errors.push({
                            change,
                            error: errorMsg,
                            isForeignKeyError: isForeignKeyError(errorMsg)
                        });
                        addLog(change.generatedSql, 'Error', change.tableName, errorMsg, 0);
                    }
                }
            }

            // Handle row changes - Use Batch API
            const rowChanges = changes.filter(c => c.type !== 'ADD_COLUMN' && c.type !== 'DROP_COLUMN');
            if (rowChanges.length === 0) continue;

            const batchChanges: BatchChange[] = rowChanges.map(c => {
                if (c.type === 'UPDATE') {
                    return {
                        operation: 'UPDATE',
                        table_name: c.tableName,
                        identifier: c.identifier,
                        updates: (c.updates || []).map(u => ({ ...u, column: u.column.trim() }))
                    };
                } else if (c.type === 'DELETE') {
                    return {
                        operation: 'DELETE',
                        table_name: c.tableName,
                        identifier: c.identifier
                    };
                } else {
                    // INSERT: Convert rowData array to column->value map
                    const res = results[tabId];
                    const cols = res?.data?.columns || [];
                    const values: Record<string, string | null> = {};
                    cols.forEach((col, idx) => {
                        const val = c.rowData[idx];
                        values[col.trim()] = val === '' ? null : String(val);
                    });

                    return {
                        operation: 'INSERT',
                        table_name: c.tableName,
                        insert_values: values
                    };
                }
            });

            if (batchChanges.length > 0) {
                try {
                    const affected = await api.applyBatchChanges(connectionString, batchChanges);
                    addLog(`Batch Applied ${affected} changes`, 'Success', batchChanges[0].table_name, undefined, Number(affected));
                    successfulTabIds.add(tabId);
                } catch (e) {
                    const errorMsg = String(e);
                    // Batch operations are transactional - all fail together
                    rowChanges.forEach(c => {
                        errors.push({
                            change: c,
                            error: errorMsg,
                            isForeignKeyError: isForeignKeyError(errorMsg)
                        });
                    });
                    addLog('Batch Execution Failed', 'Error', batchChanges[0].table_name, errorMsg, 0);
                }
            }
        }

        // Refresh data for successful tabs
        for (const tabId of successfulTabIds) {
            const tab = tabs.find(t => t.id === tabId);
            if (tab) await fetchTableData(tabId, tab.title);
        }

        // Handle partial success: keep failed changes, clear successful ones
        if (errors.length > 0) {
            setPendingChanges(prev => {
                const updated = { ...prev };
                for (const [tabId, changes] of Object.entries(prev)) {
                    const errorChanges = changes.filter(c =>
                        errors.some(e =>
                            e.change.tableName === c.tableName &&
                            e.change.type === c.type &&
                            e.change.rowIndex === c.rowIndex &&
                            e.change.column === c.column
                        )
                    );
                    if (errorChanges.length > 0) {
                        updated[tabId] = errorChanges;
                    } else {
                        delete updated[tabId];
                    }
                }
                return updated;
            });

            options?.onErrors?.(errors);
        } else {
            // All successful
            setPendingChanges({});
            setShowChangelog(false);
            options?.onSuccess?.();
        }

        setChangelogConfirm(null);
    }, [connection.id, connection.db_type, pendingChanges, options, getConnectionString]);

    // Retry failed changes with FK checks disabled (MySQL only)
    const retryWithFKDisabled = useCallback(async (
        errors: ChangeError[],
        addLog: (query: string, status: 'Success' | 'Error', table?: string, error?: string, rows?: number, user?: string) => void
    ) => {
        const isMysql = connection.db_type === 'mysql';
        if (!isMysql) {
            alert('Foreign key bypass is only supported for MySQL databases.');
            return;
        }

        const connectionString = await getConnectionString();
        const newErrors: ChangeError[] = [];

        try {
            // Disable FK checks
            await api.executeQuery(connectionString, 'SET FOREIGN_KEY_CHECKS=0');
            addLog('SET FOREIGN_KEY_CHECKS=0', 'Success', undefined, undefined, 0);

            for (const { change } of errors) {
                const query = change.generatedSql || '';
                if (!query) continue;

                try {
                    await api.executeQuery(connectionString, query);
                    addLog(query, 'Success', change.tableName, undefined, 1);
                } catch (e) {
                    const errorMsg = String(e);
                    newErrors.push({
                        change,
                        error: errorMsg,
                        isForeignKeyError: isForeignKeyError(errorMsg)
                    });
                    addLog(query, 'Error', change.tableName, errorMsg, 0);
                }
            }

            // Re-enable FK checks
            await api.executeQuery(connectionString, 'SET FOREIGN_KEY_CHECKS=1');
            addLog('SET FOREIGN_KEY_CHECKS=1', 'Success', undefined, undefined, 0);

            if (newErrors.length > 0 && options?.onErrors) {
                options.onErrors(newErrors);
            } else if (options?.onSuccess) {
                options.onSuccess();
            }
        } catch (e) {
            addLog(`Error during FK bypass: ${e}`, 'Error', undefined, String(e));
            // Try to re-enable FK checks even on error
            try {
                const connectionString = await getConnectionString();
                await api.executeQuery(connectionString, 'SET FOREIGN_KEY_CHECKS=1');
            } catch { /* ignore */ }
        }
    }, [connection.id, connection.db_type, options, getConnectionString]);

    // Execute confirm for selected changes only
    const executeConfirmSelected = useCallback(async (
        selected: { tabId: string; indices: number[] }[],
        tabs: Tab[],
        results: Record<string, { data: QueryResult | null }>,
        addLog: (query: string, status: 'Success' | 'Error', table?: string, error?: string, rows?: number, user?: string) => void,
        fetchTableData: (tabId: string, tableName: string) => Promise<void>
    ) => {
        const connectionString = await getConnectionString();
        const errors: ChangeError[] = [];
        const successfulIndices: Map<string, Set<number>> = new Map();

        for (const { tabId, indices } of selected) {
            const changes = pendingChanges[tabId] || [];
            const selectedChanges = indices.map(i => changes[i]).filter(Boolean);

            // Handle schema changes first
            const schemaChanges = selectedChanges.filter(c => c.type === 'ADD_COLUMN' || c.type === 'DROP_COLUMN');
            for (let i = 0; i < schemaChanges.length; i++) {
                const change = schemaChanges[i];
                const originalIdx = indices[selectedChanges.indexOf(change)];
                if (change.generatedSql) {
                    try {
                        await api.executeQuery(connectionString, change.generatedSql);
                        addLog(change.generatedSql, 'Success', change.tableName, undefined, 1);
                        if (!successfulIndices.has(tabId)) successfulIndices.set(tabId, new Set());
                        successfulIndices.get(tabId)!.add(originalIdx);
                    } catch (e) {
                        const errorMsg = String(e);
                        errors.push({
                            change,
                            error: errorMsg,
                            isForeignKeyError: isForeignKeyError(errorMsg)
                        });
                        addLog(change.generatedSql, 'Error', change.tableName, errorMsg, 0);
                    }
                }
            }

            // Handle row changes - Batch
            const rowChanges = selectedChanges.filter(c => c.type !== 'ADD_COLUMN' && c.type !== 'DROP_COLUMN');
            if (rowChanges.length > 0) {
                const batchChanges: BatchChange[] = rowChanges.map(c => {
                    if (c.type === 'UPDATE') {
                        return {
                            operation: 'UPDATE',
                            table_name: c.tableName,
                            identifier: c.identifier,
                            updates: c.updates
                        };
                    } else if (c.type === 'DELETE') {
                        return {
                            operation: 'DELETE',
                            table_name: c.tableName,
                            identifier: c.identifier
                        };
                    } else {
                        // INSERT
                        const res = results[tabId];
                        const cols = res?.data?.columns || [];
                        const values: Record<string, string | null> = {};
                        cols.forEach((col, idx) => {
                            const val = c.rowData[idx];
                            values[col] = val === '' ? null : String(val);
                        });
                        return {
                            operation: 'INSERT',
                            table_name: c.tableName,
                            insert_values: values
                        };
                    }
                });

                try {
                    const affected = await api.applyBatchChanges(connectionString, batchChanges);
                    addLog(`Batch Applied ${affected} selected changes`, 'Success', batchChanges[0].table_name, undefined, Number(affected));

                    if (!successfulIndices.has(tabId)) successfulIndices.set(tabId, new Set());
                    // Mark all selected indices as success
                    rowChanges.forEach(c => {
                        const originalIdx = indices[selectedChanges.indexOf(c)];
                        successfulIndices.get(tabId)!.add(originalIdx);
                    });

                } catch (e) {
                    const errorMsg = String(e);
                    rowChanges.forEach(c => {
                        errors.push({
                            change: c,
                            error: errorMsg,
                            isForeignKeyError: isForeignKeyError(errorMsg)
                        });
                    });
                    addLog('Batch Selected Execution Failed', 'Error', batchChanges[0].table_name, errorMsg, 0);
                }
            }

            const tab = tabs.find(t => t.id === tabId);
            if (tab && successfulIndices.has(tabId)) {
                await fetchTableData(tabId, tab.title);
            }
        }

        // Remove successful changes from pendingChanges (indices sorted descending)
        setPendingChanges(prev => {
            const newChanges = { ...prev };
            for (const [tabId, successSet] of successfulIndices) {
                const list = [...(newChanges[tabId] || [])];
                // Remove from highest index first to avoid shifting
                const sortedIndices = Array.from(successSet).sort((a, b) => b - a);
                for (const i of sortedIndices) {
                    list.splice(i, 1);
                }
                if (list.length === 0) {
                    delete newChanges[tabId];
                } else {
                    newChanges[tabId] = list;
                }
            }
            return newChanges;
        });

        if (errors.length > 0 && options?.onErrors) {
            options.onErrors(errors);
        } else if (options?.onSuccess) {
            options.onSuccess();
        }
    }, [connection.id, connection.db_type, pendingChanges, options, getConnectionString]);

    const handleDiscardChanges = useCallback(() => {
        setChangelogConfirm({ type: 'discard' });
    }, []);

    const executeDiscardChanges = useCallback((setSelectedIndices: (val: Set<number>) => void) => {
        setPendingChanges({});
        setShowChangelog(false);
        setSelectedIndices(new Set());
        setChangelogConfirm(null);
    }, []);

    // Discard only selected changes
    const executeDiscardSelected = useCallback((
        selected: { tabId: string; indices: number[] }[]
    ) => {
        setPendingChanges(prev => {
            const newChanges = { ...prev };
            for (const { tabId, indices } of selected) {
                const list = [...(newChanges[tabId] || [])];
                // Remove from highest index first to avoid shifting
                const sortedIndices = [...indices].sort((a, b) => b - a);
                for (const i of sortedIndices) {
                    list.splice(i, 1);
                }
                if (list.length === 0) {
                    delete newChanges[tabId];
                } else {
                    newChanges[tabId] = list;
                }
            }
            return newChanges;
        });
    }, []);

    const handleNavigateToChange = useCallback((_tabId: string, rowIndex: number) => {
        setHighlightRowIndex(rowIndex);
        setTimeout(() => setHighlightRowIndex(null), 2000);
    }, []);

    return {
        pendingChanges,
        setPendingChanges,
        showChangelog,
        setShowChangelog,
        changelogConfirm,
        setChangelogConfirm,
        highlightRowIndex,
        setHighlightRowIndex,
        handleRevertChange,
        handleConfirmChanges,
        executeConfirmChanges,
        executeConfirmSelected,
        handleDiscardChanges,
        executeDiscardChanges,
        executeDiscardSelected,
        handleNavigateToChange,
        retryWithFKDisabled
    };
};
