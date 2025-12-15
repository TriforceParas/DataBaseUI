import React from 'react';
import { QueryResult, PendingChange } from '../types';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface DataGridProps {
    data: QueryResult | null;
    loading: boolean;
    error: string | null;
    selectedIndices?: Set<number>;
    onSelectionChange?: (indices: Set<number>) => void;
    onSort?: (column: string) => void;
    pendingChanges?: PendingChange[];
}

export const DataGrid: React.FC<DataGridProps> = ({
    data,
    loading,
    error,
    selectedIndices = new Set(),
    onSelectionChange,
    onSort,
    pendingChanges = []
}) => {
    if (loading) {
        return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading...</div>;
    }

    if (error) {
        return <div style={{ padding: '1rem', color: '#ff4d4d', border: '1px solid #ff4d4d', borderRadius: '4px', margin: '1rem' }}>
            Error: {error}
        </div>;
    }

    if (!data || data.columns.length === 0) {
        return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No data to display</div>;
    }

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!onSelectionChange) return;
        if (e.target.checked) {
            const all = new Set(data.rows.map((_, i) => i));
            onSelectionChange(all);
        } else {
            onSelectionChange(new Set());
        }
    };

    const handleSelectRow = (idx: number) => {
        if (!onSelectionChange) return;
        const newSet = new Set(selectedIndices);
        if (newSet.has(idx)) {
            newSet.delete(idx);
        } else {
            newSet.add(idx);
        }
        onSelectionChange(newSet);
    };

    return (
        <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
            {/* Debug log */}
            {console.log('DataGrid Rendering:', { columns: data?.columns, firstRow: data?.rows?.[0] })}
            <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.9rem',
                color: 'var(--text-primary)',
            }}>
                <thead>
                    <tr>
                        <th style={{
                            width: '50px',
                            textAlign: 'center',
                            borderBottom: '1px solid var(--border-color)',
                            borderRight: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-secondary)',
                            position: 'sticky', top: 0, zIndex: 1
                        }}>
                            <input
                                type="checkbox"
                                checked={data.rows.length > 0 && selectedIndices.size === data.rows.length}
                                ref={input => {
                                    if (input) {
                                        input.indeterminate = selectedIndices.size > 0 && selectedIndices.size < data.rows.length;
                                    }
                                }}
                                onChange={handleSelectAll}
                                style={{ cursor: 'pointer' }}
                            />
                        </th>
                        {data.columns.map((col, idx) => (
                            <th key={idx}
                                onClick={() => onSort && onSort(col)}
                                style={{
                                    textAlign: 'left',
                                    padding: '0.5rem 1rem',
                                    borderBottom: '1px solid var(--border-color)',
                                    borderRight: '1px solid var(--border-color)',
                                    backgroundColor: 'var(--bg-secondary)',
                                    position: 'sticky', top: 0, zIndex: 1,
                                    cursor: onSort ? 'pointer' : 'default',
                                    userSelect: 'none'
                                }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    {col}
                                    <div style={{ opacity: 0.3, display: 'flex', flexDirection: 'column', height: '10px', justifyContent: 'center' }}>
                                        <ChevronUp size={8} />
                                        <ChevronDown size={8} />
                                    </div>
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.rows.map((row, rIdx) => {
                        const isSelected = selectedIndices.has(rIdx);
                        const pendingDelete = pendingChanges.some(c => c.type === 'DELETE' && c.rowIndex === rIdx);

                        // Style priority: Delete Red > Selected Blue > Default
                        const rowBg = pendingDelete ? 'rgba(255, 77, 77, 0.15)' : (isSelected ? 'rgba(74, 144, 226, 0.1)' : undefined);
                        const rowStyle = { backgroundColor: rowBg };

                        return (
                            <tr key={rIdx} style={rowStyle}>
                                <td style={{
                                    textAlign: 'center',
                                    borderBottom: '1px solid var(--border-color)',
                                    borderRight: '1px solid var(--border-color)',
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleSelectRow(rIdx)}
                                        style={{ cursor: 'pointer' }}
                                    />
                                </td>
                                {row.map((cell, cIdx) => {
                                    const colName = data.columns[cIdx];
                                    const pendingUpdate = pendingChanges.find(c => c.type === 'UPDATE' && c.rowIndex === rIdx && c.column === colName);

                                    const displayValue = pendingUpdate ? pendingUpdate.newValue : cell;

                                    let content = displayValue;
                                    if (displayValue === null || displayValue === undefined) {
                                        content = 'NULL'; // Explicitly show NULL
                                    } else if (typeof displayValue === 'object') {
                                        try {
                                            content = JSON.stringify(displayValue);
                                        } catch (e) {
                                            content = '[Object]';
                                        }
                                    }
                                    return (
                                        <td key={cIdx} style={{
                                            padding: '0.5rem 1rem',
                                            maxWidth: '300px',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            borderBottom: '1px solid var(--border-color)',
                                            borderRight: '1px solid var(--border-color)',
                                            color: displayValue === null ? 'var(--text-muted)' : 'inherit',
                                            fontStyle: displayValue === null ? 'italic' : 'normal',
                                            backgroundColor: pendingUpdate ? 'rgba(255, 230, 0, 0.2)' : undefined // Yellow highlight for cell
                                        }} title={String(content)}>
                                            {String(content)}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
