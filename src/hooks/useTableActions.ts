import { useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Connection, PendingChange, QueryResult, Tab } from '../types/index';
import { buildDeleteSql, buildUpdateSql } from '../utils/dataHandlers';
import * as api from '../api';

interface UseTableActionsProps {
    activeTab: Tab | undefined;
    results: Record<string, { data: QueryResult | null, loading: boolean, error: string | null }>;
    pendingChanges: Record<string, PendingChange[]>;
    setPendingChanges: React.Dispatch<React.SetStateAction<Record<string, PendingChange[]>>>;
    selectedIndices: Set<number>;
    setSelectedIndices: (action: Set<number> | ((prev: Set<number>) => Set<number>)) => void;
    connection: Connection;
    enableChangeLog: boolean;
    addLog: (query: string, status: 'Success' | 'Error', table?: string, error?: string, rows?: number, user?: string) => void;
    fetchTableData: (tableId: string, tableName: string) => Promise<void>;
}

export const useTableActions = ({
    activeTab,
    results,
    pendingChanges,
    setPendingChanges,
    selectedIndices,
    setSelectedIndices,
    connection,
    enableChangeLog,
    addLog,
    fetchTableData
}: UseTableActionsProps) => {

    const connectionStringRef = useRef<string | null>(null);

    const getConnectionString = useCallback(async (): Promise<string> => {
        if (connectionStringRef.current) return connectionStringRef.current;
        const connStr = await invoke<string>('get_connection_string', { connectionId: connection.id });
        connectionStringRef.current = connStr;
        return connStr;
    }, [connection.id]);

    const handleInsertRow = useCallback(() => {
        if (!activeTab || activeTab.type !== 'table') return;
        const currentData = results[activeTab.id]?.data!;
        if (!currentData) return;

        const newRowArray = currentData.columns.map(() => '');

        const newChange: PendingChange = {
            type: 'INSERT',
            tableName: activeTab.title,
            rowIndex: currentData.rows.length + (pendingChanges[activeTab.id]?.filter(p => p.type === 'INSERT').length || 0),
            rowData: newRowArray
        };

        setPendingChanges(prev => ({
            ...prev,
            [activeTab.id]: [...(prev[activeTab.id] || []), newChange]
        }));

        // Select the new virtual row
        const newIdx = currentData.rows.length + (pendingChanges[activeTab.id]?.filter(p => p.type === 'INSERT').length || 0);
        setSelectedIndices((prev: Set<number>) => new Set([...prev, newIdx]));
    }, [activeTab, results, pendingChanges, setPendingChanges, setSelectedIndices]);

    const handleCellEdit = useCallback(async (rowIndex: number, column: string, value: any) => {
        if (!activeTab || activeTab.type !== 'table') return;
        const currentData = results[activeTab.id]?.data;
        if (!currentData) return;

        const colIdx = currentData.columns.indexOf(column);
        if (colIdx === -1) return;

        const tabId = activeTab.id;
        const existingRows = currentData.rows;

        // Check if this is a virtual INSERT row
        if (rowIndex >= existingRows.length) {
            const insertRowOffset = rowIndex - existingRows.length;
            setPendingChanges(prev => {
                const tabChanges = [...(prev[tabId] || [])];
                const insertChanges = tabChanges.filter(c => c.type === 'INSERT');
                if (insertRowOffset < insertChanges.length) {
                    const insertChange = insertChanges[insertRowOffset];
                    const newRowData = [...(insertChange.rowData as any[])];
                    newRowData[colIdx] = value;
                    const actualIdx = tabChanges.findIndex(c => c === insertChange);
                    if (actualIdx !== -1) {
                        tabChanges[actualIdx] = { ...insertChange, rowData: newRowData };
                    }
                }
                return { ...prev, [tabId]: tabChanges };
            });
            return;
        }

        // UPDATE logic
        const row = existingRows[rowIndex];
        const oldValue = row[colIdx];

        if (String(oldValue) === String(value)) return;

        const isMysql = connection.db_type === 'mysql';
        const generatedSql = buildUpdateSql(activeTab.title, column, value, row, currentData.columns, isMysql);

        if (!enableChangeLog) {
            // Execute Immediately
            try {
                const connectionString = await getConnectionString();
                await api.executeQuery(connectionString, generatedSql);
                addLog(generatedSql, 'Success', activeTab.title, undefined, 1);
                await fetchTableData(activeTab.id, activeTab.title);
            } catch (e) {
                const errorMsg = String(e);
                console.error("Immediate update failed:", e);
                addLog(generatedSql, 'Error', activeTab.title, errorMsg, 0);
                alert(`Update failed: ${errorMsg}`);
            }
            return;
        }

        // Add to Pending Changes
        setPendingChanges(prev => {
            const tabChanges = prev[tabId] || [];
            const existingIdx = tabChanges.findIndex(c => c.type === 'UPDATE' && c.rowIndex === rowIndex && c.column === column);
            let newChanges = [...tabChanges];

            if (String(oldValue) === String(value)) {
                if (existingIdx !== -1) {
                    newChanges.splice(existingIdx, 1);
                }
                return { ...prev, [tabId]: newChanges };
            }

            if (existingIdx !== -1) {
                newChanges[existingIdx] = {
                    ...newChanges[existingIdx],
                    newValue: value
                };
            } else {
                newChanges.push({
                    type: 'UPDATE',
                    tableName: activeTab.title,
                    rowIndex,
                    rowData: row,
                    column,
                    oldValue,
                    newValue: value,
                    generatedSql
                });
            }
            return { ...prev, [tabId]: newChanges };
        });
    }, [activeTab, results, connection.id, connection.db_type, setPendingChanges, enableChangeLog, addLog, fetchTableData, getConnectionString]);

    const handleRowDelete = useCallback(async (rowIndex: number) => {
        if (!activeTab || activeTab.type !== 'table') return;
        const existRows = results[activeTab.id]?.data?.rows?.length || 0;

        // Check if this is an INSERT (virtual) row
        if (rowIndex >= existRows) {
            const insertRowOffset = rowIndex - existRows;
            setPendingChanges(prev => {
                const tabChanges = [...(prev[activeTab.id] || [])];
                const insertChanges = tabChanges.filter(c => c.type === 'INSERT');
                if (insertRowOffset < insertChanges.length) {
                    const insertToRemove = insertChanges[insertRowOffset];
                    return {
                        ...prev,
                        [activeTab.id]: tabChanges.filter(c => c !== insertToRemove)
                    };
                }
                return prev;
            });
            setSelectedIndices(prev => {
                const newSet = new Set(prev);
                newSet.delete(rowIndex);
                return newSet;
            });
            return;
        }

        // Existing row - DELETE logic
        const displayRows = [...(results[activeTab.id]?.data?.rows || [])];
        const rowData = displayRows[rowIndex];

        if (rowData) {
            const isMysql = connection.db_type === 'mysql';
            const data = results[activeTab.id]?.data!;
            const generatedSql = buildDeleteSql(activeTab.title, rowData, data.columns, isMysql);

            if (!enableChangeLog) {
                // Execute Immediately
                if (confirm(`Are you sure you want to delete this row directly from ${activeTab.title}?`)) {
                    try {
                        const connectionString = await getConnectionString();
                        await api.executeQuery(connectionString, generatedSql);
                        addLog(generatedSql, 'Success', activeTab.title, undefined, 1);
                        await fetchTableData(activeTab.id, activeTab.title);
                        setSelectedIndices(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(rowIndex);
                            return newSet;
                        });
                    } catch (e) {
                        const errorMsg = String(e);
                        console.error("Immediate delete failed:", e);
                        addLog(generatedSql, 'Error', activeTab.title, errorMsg, 0);
                        alert(`Delete failed: ${errorMsg}`);
                    }
                }
                return;
            }

            const newChange: PendingChange = {
                type: 'DELETE',
                tableName: activeTab.title,
                rowIndex,
                rowData,
                generatedSql
            };
            setPendingChanges(prev => ({
                ...prev,
                [activeTab.id]: [...(prev[activeTab.id] || []), newChange]
            }));
        }
    }, [activeTab, results, pendingChanges, setPendingChanges, setSelectedIndices, enableChangeLog, connection.id, connection.db_type, addLog, fetchTableData, getConnectionString]);

    const handleDeleteRows = useCallback(async () => {
        if (!activeTab || activeTab.type !== 'table' || !results[activeTab.id]?.data) return;
        const currentData = results[activeTab.id].data!;

        const cols = currentData.columns;
        const isMysql = connection.db_type === 'mysql';
        const existingRowsCount = currentData.rows.length;
        const newChanges: PendingChange[] = [];
        const insertIndicesToRemove: number[] = [];
        const queriesToExecute: string[] = [];

        selectedIndices.forEach(idx => {
            if (idx >= existingRowsCount) {
                insertIndicesToRemove.push(idx);
                return;
            }

            const row = currentData.rows[idx];
            const existing = pendingChanges[activeTab.id]?.find(c => c.type === 'DELETE' && c.rowIndex === idx);
            if (!existing && row) {
                const generatedSql = buildDeleteSql(activeTab.title, row, cols, isMysql);

                if (!enableChangeLog) {
                    queriesToExecute.push(generatedSql);
                } else {
                    newChanges.push({
                        type: 'DELETE',
                        tableName: activeTab.title,
                        rowIndex: idx,
                        rowData: row,
                        generatedSql
                    });
                }
            }
        });

        if (!enableChangeLog && queriesToExecute.length > 0) {
            if (confirm(`Are you sure you want to delete ${queriesToExecute.length} rows directly from ${activeTab.title}?`)) {
                let successCount = 0;
                const connectionString = await getConnectionString();
                for (const sql of queriesToExecute) {
                    try {
                        await api.executeQuery(connectionString, sql);
                        addLog(sql, 'Success', activeTab.title, undefined, 1);
                        successCount++;
                    } catch (e) {
                        const errorMsg = String(e);
                        addLog(sql, 'Error', activeTab.title, errorMsg, 0);
                        console.error("Immediate delete error:", e);
                    }
                }
                if (successCount > 0) {
                    await fetchTableData(activeTab.id, activeTab.title);
                }
                setSelectedIndices(new Set());
            }
        }

        // Always handle insert removals locally
        if (insertIndicesToRemove.length > 0) {
            setPendingChanges(prev => {
                let tabChanges = [...(prev[activeTab.id] || [])];
                const insertChanges = tabChanges.filter(c => c.type === 'INSERT');
                const insertOffsetsToRemove = insertIndicesToRemove.map(idx => idx - existingRowsCount);
                const insertsToRemove = insertOffsetsToRemove
                    .filter(offset => offset >= 0 && offset < insertChanges.length)
                    .map(offset => insertChanges[offset]);
                tabChanges = tabChanges.filter(c => !insertsToRemove.includes(c));

                // Add new delete changes if log enabled
                return {
                    ...prev,
                    [activeTab.id]: [...tabChanges, ...newChanges]
                };
            });
            if (enableChangeLog) {
                setSelectedIndices(new Set());
            } else {
                if (queriesToExecute.length === 0) setSelectedIndices(new Set());
            }
        } else if (enableChangeLog && newChanges.length > 0) {
            setPendingChanges(prev => ({
                ...prev,
                [activeTab.id]: [...(prev[activeTab.id] || []), ...newChanges]
            }));
            setSelectedIndices(new Set());
        }

    }, [activeTab, results, connection.id, connection.db_type, selectedIndices, pendingChanges, setPendingChanges, setSelectedIndices, enableChangeLog, addLog, fetchTableData, getConnectionString]);

    return {
        handleInsertRow,
        handleCellEdit,
        handleRowDelete,
        handleDeleteRows
    };
};
