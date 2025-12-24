import { useCallback } from 'react';
import * as api from '../api';
import { Connection, PendingChange, TabItem, TableDataState } from '../types/index';

interface UseDataMutationProps {
    activeTab: TabItem | undefined;
    results: Record<string, TableDataState>;
    selectedIndices: Set<number>;
    editData: Record<string, any>[] | undefined;
    connection: Connection;
    setPendingChanges: React.Dispatch<React.SetStateAction<Record<string, PendingChange[]>>>;
    setShowEditWindow: (show: boolean) => void;
    setEditData: (data: Record<string, any>[] | undefined) => void;
    setSelectedIndices: (indices: Set<number>) => void;
    fetchTableData: (tableId: string, tableName: string) => Promise<void>;
    addLog: (query: string, status: 'Success' | 'Error', table?: string, error?: string, rows?: number, user?: string) => void;
}

export const useDataMutation = ({
    activeTab,
    results,
    selectedIndices,
    editData,
    connection,
    setPendingChanges,
    setShowEditWindow,
    setEditData,
    setSelectedIndices,
    fetchTableData,
    addLog
}: UseDataMutationProps) => {

    const handlePanelSubmit = useCallback(async (data: Record<string, any>[]) => {
        if (!activeTab || activeTab.type !== 'table') return;

        // PENDING UPDATE Logic
        if (selectedIndices.size > 0 && editData) {
            const indices = Array.from(selectedIndices).sort((a, b) => a - b);
            const currentData = results[activeTab.id]?.data;
            if (!currentData) return;

            const cols = currentData.columns;
            const idColIdx = cols.findIndex(c => c.toLowerCase() === 'id');
            const idColName = idColIdx !== -1 ? cols[idColIdx] : null;
            const isMysql = connection.connection_string.startsWith('mysql:');
            const q = isMysql ? '`' : '"';

            const safeVal = (v: any) => {
                if (v === null || v === 'NULL') return 'NULL';
                if (!isNaN(Number(v)) && v !== '') return v;
                return `'${String(v).replace(/'/g, "''")}'`;
            };

            const newChanges: PendingChange[] = [];

            data.forEach((newRow, i) => {
                const rowIndex = indices[i];
                if (rowIndex === undefined || !currentData.rows[rowIndex]) return;
                const oldRow = currentData.rows[rowIndex];

                Object.keys(newRow).forEach(col => {
                    const colIdx = currentData.columns.indexOf(col);
                    if (colIdx === -1) return;
                    const oldVal = oldRow[colIdx];
                    const newVal = newRow[col];

                    if (String(oldVal) !== String(newVal)) {
                        let generatedSql = '';
                        if (idColName) {
                            const idVal = oldRow[idColIdx];
                            generatedSql = `UPDATE ${q}${activeTab.title}${q} SET ${q}${col}${q} = ${safeVal(newVal)} WHERE ${q}${idColName}${q} = ${safeVal(idVal)}`;
                        } else {
                            // Where fallback
                            const whereClause = cols.map((c, idx) => {
                                const val = oldRow[idx];
                                return `${q}${c}${q} ${val === null ? 'IS NULL' : `= ${safeVal(val)}`}`;
                            }).join(' AND ');
                            generatedSql = `UPDATE ${q}${activeTab.title}${q} SET ${q}${col}${q} = ${safeVal(newVal)} WHERE ${whereClause}`;
                        }

                        newChanges.push({
                            type: 'UPDATE',
                            tableName: activeTab.title,
                            rowIndex: rowIndex,
                            rowData: oldRow,
                            column: col,
                            oldValue: oldVal,
                            newValue: newVal,
                            generatedSql
                        });
                    }
                });
            });

            setPendingChanges(prev => {
                const current = prev[activeTab.id] || [];
                const filtered = current.filter(c =>
                    !(c.type === 'UPDATE' && newChanges.some(nc => nc.rowIndex === c.rowIndex && nc.column === c.column))
                );
                return { ...prev, [activeTab.id]: [...filtered, ...newChanges] };
            });

            setShowEditWindow(false);
            setEditData(undefined);
            setSelectedIndices(new Set());
            return;
        }

        // INSERT (Immediate)
        const isMysql = connection.connection_string.startsWith('mysql:');
        const q = isMysql ? '`' : '"';
        const tableName = activeTab.title;

        const keys = Object.keys(data[0] || {}).filter(k => k);
        if (keys.length === 0) return;
        const allKeys = Array.from(new Set(data.flatMap(d => Object.keys(d))));
        const validKeys = allKeys.filter(k => k && k !== '');
        if (validKeys.length === 0) return;
        const cols = validKeys.map(k => `${q}${k}${q}`).join(', ');
        const valueGroups = data.map(d => {
            return `(${validKeys.map(k => {
                const val = d[k];
                if (val === null || val === undefined || val === 'NULL') return 'NULL';
                if (!isNaN(Number(val)) && val !== '') return val;
                return `'${String(val).replace(/'/g, "''")}'`;
            }).join(', ')})`;
        });
        const query = `INSERT INTO ${q}${tableName}${q} (${cols}) VALUES ${valueGroups.join(', ')}`;

        try {
            await api.executeQuery(connection.connection_string, query);
            setShowEditWindow(false);
            setEditData(undefined);
            fetchTableData(activeTab.id, activeTab.title);
            addLog(query, 'Success', activeTab.title, undefined, valueGroups.length);
        } catch (e) {
            alert(`Insert failed: ${e}`);
            addLog(`Insert failed: ${e}`, 'Error', activeTab.title, String(e));
        }
    }, [activeTab, results, selectedIndices, editData, connection, setPendingChanges, setShowEditWindow, setEditData, setSelectedIndices, fetchTableData, addLog]);

    return {
        handlePanelSubmit
    };
};
