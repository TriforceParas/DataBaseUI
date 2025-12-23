import React from 'react';
import { InsertRowModal } from './InsertRowModal';
import { TabResult, PendingChange } from '../../types';

interface TableEditRowModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeTabId: string;
    activeTabType?: string;
    activeTabTitle: string;
    results: Record<string, TabResult>;
    selectedIndices: Set<number>;
    setSelectedIndices: (indices: Set<number>) => void;
    pendingChanges: Record<string, PendingChange[]>;
    setPendingChanges: React.Dispatch<React.SetStateAction<Record<string, PendingChange[]>>>;
    panelColumns: string[];
    onInsert: (data: Record<string, any>[]) => void;
    onAddRow: () => void;
    onCellEdit: (rowIndex: number, column: string, value: any) => void;
}

export const TableEditRowModal: React.FC<TableEditRowModalProps> = ({
    isOpen,
    onClose,
    activeTabId,
    activeTabType,
    activeTabTitle,
    results,
    selectedIndices,
    setSelectedIndices,
    pendingChanges,
    setPendingChanges,
    panelColumns,
    onInsert,
    onAddRow,
    onCellEdit
}) => {
    if (!isOpen) return null;

    // Logic to prepare initialData for Edit Pane based on Selection
    let initialDataForPane: Record<string, any>[] = [];
    const currentData = activeTabId && results[activeTabId]?.data;

    if (activeTabId && currentData && selectedIndices.size > 0) {
        // Populate from selection
        const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);
        initialDataForPane = sortedIndices.map(idx => {
            const rowObj: Record<string, any> = {};
            // Check if it's an existing row or a pending insert
            if (idx < currentData.rows.length) {
                currentData.columns.forEach((col, cIdx) => {
                    rowObj[col] = currentData.rows[idx][cIdx];
                });
            } else {
                // It's a pending insert
                const pendingList = pendingChanges[activeTabId] || [];
                const inserts = pendingList.filter(c => c.type === 'INSERT');
                // The 'idx' relative to INSERTs is (idx - data.rows.length)
                const insertIdx = idx - currentData.rows.length;
                const pending = inserts[insertIdx];
                if (pending) {
                    currentData.columns.forEach((col, cIdx) => {
                        rowObj[col] = pending.rowData[cIdx];
                    });
                }
            }
            return rowObj;
        });
    } else {
        // Empty state (user will see "No rows selected")
        initialDataForPane = [];
    }

    return (
        <InsertRowModal
            isOpen={isOpen}
            onClose={onClose}
            columns={panelColumns.length > 0 ? panelColumns : (activeTabId && results[activeTabId]?.data?.columns ? results[activeTabId].data!.columns : [])}
            onInsert={onInsert}
            tableName={activeTabType === 'table' ? activeTabTitle : ''}
            initialData={initialDataForPane}
            onAddRow={onAddRow}
            onUpdateRow={(formRowIdx, col, val) => {
                if (!activeTabId) return;
                // Map formRowIdx back to actual rowIndex
                const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);
                const actualRowIndex = sortedIndices[formRowIdx];
                if (actualRowIndex !== undefined) {
                    onCellEdit(actualRowIndex, col, val);
                }
            }}
            onRemoveRow={(formRowIdx) => {
                if (!activeTabId) return;
                const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);
                const actualRowIndex = sortedIndices[formRowIdx];
                if (actualRowIndex !== undefined) {
                    // If it's a pending insert, remove it entirely
                    const currentData = results[activeTabId]?.data;
                    if (currentData && actualRowIndex >= currentData.rows.length) {
                        // It's an INSERT change
                        // Find the specific change object
                        const changes = pendingChanges[activeTabId] || [];
                        const change = changes.find(c => c.type === 'INSERT' && c.rowIndex === actualRowIndex);
                        if (change) {
                            setPendingChanges(prev => ({
                                ...prev,
                                [activeTabId]: prev[activeTabId].filter(c => c !== change)
                            }));
                            const newSet = new Set(selectedIndices);
                            newSet.delete(actualRowIndex);
                            setSelectedIndices(newSet);
                        }
                    } else {
                        // Existing row - Just remove from selection
                        const newSet = new Set(selectedIndices);
                        newSet.delete(actualRowIndex);
                        setSelectedIndices(newSet);
                    }
                }
            }}
        />
    );
};
