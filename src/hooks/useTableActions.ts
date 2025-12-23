import { useCallback } from 'react';
import { Connection, PendingChange, QueryResult, Tab } from '../types';
import { buildDeleteSql, buildUpdateSql } from '../helpers/dataHandlers';

interface UseTableActionsProps {
    activeTab: Tab | undefined;
    results: Record<string, { data: QueryResult | null, loading: boolean, error: string | null }>;
    pendingChanges: Record<string, PendingChange[]>;
    setPendingChanges: React.Dispatch<React.SetStateAction<Record<string, PendingChange[]>>>;
    selectedIndices: Set<number>;
    setSelectedIndices: (action: Set<number> | ((prev: Set<number>) => Set<number>)) => void;
    connection: Connection;
}

export const useTableActions = ({
    activeTab,
    results,
    pendingChanges,
    setPendingChanges,
    selectedIndices,
    setSelectedIndices,
    connection
}: UseTableActionsProps) => {

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

    const handleCellEdit = useCallback((rowIndex: number, column: string, value: any) => {
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
                const isMysql = connection.connection_string.startsWith('mysql:');
                const generatedSql = buildUpdateSql(activeTab.title, column, value, row, currentData.columns, isMysql);

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
    }, [activeTab, results, connection, setPendingChanges]);

    const handleRowDelete = useCallback((rowIndex: number) => {
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

        // Existing row - add DELETE change
        const displayRows = [...(results[activeTab.id]?.data?.rows || []), ...(pendingChanges[activeTab.id] || []).filter(c => c.type === 'INSERT').map(c => c.rowData)];
        const rowData = displayRows[rowIndex];
        if (rowData) {
            const newChange: PendingChange = { type: 'DELETE', tableName: activeTab.title, rowIndex, rowData };
            setPendingChanges(prev => ({
                ...prev,
                [activeTab.id]: [...(prev[activeTab.id] || []), newChange]
            }));
        }
    }, [activeTab, results, pendingChanges, setPendingChanges, setSelectedIndices]);

    const handleDeleteRows = useCallback(async () => {
        if (!activeTab || activeTab.type !== 'table' || !results[activeTab.id]?.data) return;
        const currentData = results[activeTab.id].data!;

        const cols = currentData.columns;
        const isMysql = connection.connection_string.startsWith('mysql:');
        const existingRowsCount = currentData.rows.length;
        const newChanges: PendingChange[] = [];
        const insertIndicesToRemove: number[] = [];

        selectedIndices.forEach(idx => {
            if (idx >= existingRowsCount) {
                insertIndicesToRemove.push(idx);
                return;
            }

            const row = currentData.rows[idx];
            const existing = pendingChanges[activeTab.id]?.find(c => c.type === 'DELETE' && c.rowIndex === idx);
            if (!existing && row) {
                const generatedSql = buildDeleteSql(activeTab.title, row, cols, isMysql);

                newChanges.push({
                    type: 'DELETE',
                    tableName: activeTab.title,
                    rowIndex: idx,
                    rowData: row,
                    generatedSql
                });
            }
        });

        setPendingChanges(prev => {
            let tabChanges = [...(prev[activeTab.id] || [])];
            if (insertIndicesToRemove.length > 0) {
                const insertChanges = tabChanges.filter(c => c.type === 'INSERT');
                const insertOffsetsToRemove = insertIndicesToRemove.map(idx => idx - existingRowsCount);
                const insertsToRemove = insertOffsetsToRemove
                    .filter(offset => offset >= 0 && offset < insertChanges.length)
                    .map(offset => insertChanges[offset]);
                tabChanges = tabChanges.filter(c => !insertsToRemove.includes(c));
            }
            return {
                ...prev,
                [activeTab.id]: [...tabChanges, ...newChanges]
            };
        });
        setSelectedIndices(new Set());
    }, [activeTab, results, connection, selectedIndices, pendingChanges, setPendingChanges, setSelectedIndices]);

    return {
        handleInsertRow,
        handleCellEdit,
        handleRowDelete,
        handleDeleteRows
    };
};
