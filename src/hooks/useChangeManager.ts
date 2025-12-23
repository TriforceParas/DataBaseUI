import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Connection, PendingChange, QueryResult, Tab } from '../types';
import { generateRowChangeSql } from '../helpers/sqlHelpers';

interface UseChangeManagerOptions {
    onSuccess?: () => void;
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
    handleNavigateToChange: (tabId: string, rowIndex: number) => void;
}

export const useChangeManager = (
    connection: Connection,
    options?: UseChangeManagerOptions
): UseChangeManagerReturn => {
    const [pendingChanges, setPendingChanges] = useState<Record<string, PendingChange[]>>({});
    const [showChangelog, setShowChangelog] = useState(false);
    const [changelogConfirm, setChangelogConfirm] = useState<{ type: 'confirm' | 'discard' } | null>(null);
    const [highlightRowIndex, setHighlightRowIndex] = useState<number | null>(null);

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
        const isMysql = connection.connection_string.startsWith('mysql:');

        try {
            for (const [tabId, changes] of Object.entries(pendingChanges)) {
                if (changes.length === 0) continue;

                // Handle schema changes first
                const schemaChanges = changes.filter(c => c.type === 'ADD_COLUMN' || c.type === 'DROP_COLUMN');
                for (const change of schemaChanges) {
                    if (change.generatedSql) {
                        await invoke('execute_query', { connectionString: connection.connection_string, query: change.generatedSql });
                        addLog(change.generatedSql, 'Success', change.tableName, undefined, 1);
                    }
                }

                // Handle row changes
                const rowChanges = changes.filter(c => c.type !== 'ADD_COLUMN' && c.type !== 'DROP_COLUMN');
                if (rowChanges.length === 0) continue;

                const res = results[tabId];
                if (!res || !res.data) continue;

                const cols = res.data.columns;

                for (const change of rowChanges) {
                    const query = generateRowChangeSql(change, cols, isMysql);

                    if (query) {
                        await invoke('execute_query', { connectionString: connection.connection_string, query });
                        addLog(query, 'Success', change.tableName, undefined, 1);
                    }
                }
                const tab = tabs.find(t => t.id === tabId);
                if (tab) await fetchTableData(tabId, tab.title);
            }

            setPendingChanges({});
            setShowChangelog(false);
            setChangelogConfirm(null);

            // Call onSuccess callback if provided
            if (options?.onSuccess) {
                options.onSuccess();
            }
        } catch (e) {
            alert(`Failed to apply changes: ${e}`);
            addLog(`Error applying changes: ${e}`, 'Error', undefined, String(e));
            setChangelogConfirm(null);
        }
    }, [connection, pendingChanges, options]);

    const handleDiscardChanges = useCallback(() => {
        setChangelogConfirm({ type: 'discard' });
    }, []);

    const executeDiscardChanges = useCallback((setSelectedIndices: (val: Set<number>) => void) => {
        setPendingChanges({});
        setShowChangelog(false);
        setSelectedIndices(new Set());
        setChangelogConfirm(null);
    }, []);

    const handleNavigateToChange = useCallback((tabId: string, rowIndex: number) => {
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
        handleDiscardChanges,
        executeDiscardChanges,
        handleNavigateToChange
    };
};
