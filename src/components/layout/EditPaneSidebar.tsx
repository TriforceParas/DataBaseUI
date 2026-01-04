import React, { useState, useEffect, useMemo } from 'react';
import { Save, Plus, Trash2, X } from 'lucide-react';
import styles from '../../styles/ConnectionForm.module.css';
import lStyles from '../../styles/MainLayout.module.css';
import { TabResult, PendingChange } from '../../types/index';

interface EditPaneSidebarProps {
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

export const EditPaneSidebar: React.FC<EditPaneSidebarProps> = ({
    isOpen,
    onClose,
    activeTabId,
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
    const [mode, setMode] = useState<'form' | 'json'>('form');
    const [rows, setRows] = useState<Record<string, string>[]>([{}]);
    const [jsonContent, setJsonContent] = useState('[\n  {\n    \n  }\n]');
    const [error, setError] = useState<string | null>(null);

    const columns = panelColumns.length > 0
        ? panelColumns
        : (activeTabId && results[activeTabId]?.data?.columns ? results[activeTabId].data!.columns : []);

    // Prepare initial data from selection
    const initialDataForPane = useMemo(() => {
        const currentData = activeTabId && results[activeTabId]?.data;
        if (activeTabId && currentData && selectedIndices.size > 0) {
            const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);
            return sortedIndices.map(idx => {
                const rowObj: Record<string, any> = {};
                if (idx < currentData.rows.length) {
                    currentData.columns.forEach((col, cIdx) => {
                        rowObj[col] = currentData.rows[idx][cIdx];
                    });
                } else {
                    const pendingList = pendingChanges[activeTabId] || [];
                    const inserts = pendingList.filter(c => c.type === 'INSERT');
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
        }
        return [];
    }, [activeTabId, results, selectedIndices, pendingChanges]);

    // Track selection state to avoid resetting form while typing
    const [lastInitialDataLen, setLastInitialDataLen] = useState(0);

    useEffect(() => {
        if (initialDataForPane && initialDataForPane.length > 0) {
            if (initialDataForPane.length !== lastInitialDataLen || rows.length === 0 || rows[0] === undefined) {
                const mappedRows = initialDataForPane.map(d => {
                    const newRow: Record<string, string> = {};
                    columns.forEach(c => newRow[c] = d[c] !== null && d[c] !== undefined ? String(d[c]) : '');
                    return newRow;
                });
                setRows(mappedRows);
                setLastInitialDataLen(initialDataForPane.length);
                setJsonContent(JSON.stringify(initialDataForPane, null, 2));
            }
            return;
        }

        if (initialDataForPane && initialDataForPane.length === 0 && lastInitialDataLen !== 0) {
            setLastInitialDataLen(0);
            setRows([{}]);
        }
    }, [columns, isOpen, initialDataForPane]);

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const handleFieldChange = (rowIdx: number, col: string, val: string) => {
        const newRows = [...rows];
        if (!newRows[rowIdx]) newRows[rowIdx] = {};
        newRows[rowIdx][col] = val;
        setRows(newRows);

        // Notify parent for live update if in edit mode
        if (initialDataForPane.length > 0) {
            const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);
            const actualRowIndex = sortedIndices[rowIdx];
            if (actualRowIndex !== undefined) {
                onCellEdit(actualRowIndex, col, val);
            }
        }
    };

    const handleAddRow = () => {
        if (initialDataForPane.length > 0) {
            onAddRow();
            return;
        }
        const newRow: Record<string, string> = {};
        columns.forEach(c => newRow[c] = '');
        setRows([...rows, newRow]);
    };

    const handleRemoveRow = (idx: number) => {
        if (initialDataForPane.length > 0) {
            const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);
            const actualRowIndex = sortedIndices[idx];
            if (actualRowIndex !== undefined) {
                const currentData = results[activeTabId]?.data;
                if (currentData && actualRowIndex >= currentData.rows.length) {
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
                    const newSet = new Set(selectedIndices);
                    newSet.delete(actualRowIndex);
                    setSelectedIndices(newSet);
                }
            }
            return;
        }
        const newRows = rows.filter((_, i) => i !== idx);
        setRows(newRows.length ? newRows : [{}]);
    };

    const handleSubmit = () => {
        try {
            setError(null);
            let finalData: Record<string, any>[] = [];

            if (mode === 'form') {
                finalData = rows.map(r => ({ ...r }));
            } else {
                const parsed = JSON.parse(jsonContent);
                if (Array.isArray(parsed)) {
                    finalData = parsed;
                } else {
                    finalData = [parsed];
                }
            }

            onInsert(finalData);
        } catch (e) {
            setError("Invalid JSON format");
        }
    };

    const hasSelection = selectedIndices.size > 0;

    return (
        <div style={{
            width: isOpen ? '400px' : '0',
            height: '100%',
            backgroundColor: 'var(--bg-secondary)',
            borderLeft: isOpen ? '1px solid var(--border-color)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 100,
            boxShadow: isOpen ? '-4px 0 15px rgba(0,0,0,0.1)' : 'none',
            transition: 'width 0.3s ease',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            flexShrink: 0
        }}>
            {/* Mode Tabs (Header Equivalent) */}
            <div style={{
                padding: '0 1rem',
                borderBottom: '1px solid var(--border-color)',
                height: '40px',
                display: 'flex',
                alignItems: 'center'
            }}>
                <div style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    borderRadius: '4px',
                    padding: '2px',
                    display: 'flex',
                    width: 'fit-content'
                }}>
                    <button
                        onClick={() => setMode('form')}
                        style={{
                            border: 'none',
                            background: mode === 'form' ? 'var(--bg-primary)' : 'transparent',
                            color: 'var(--text-primary)',
                            padding: '2px 12px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            borderRadius: '2px',
                            userSelect: 'none',
                            boxShadow: mode === 'form' ? '0 1px 2px rgba(0, 0, 0, 0.1)' : 'none'
                        }}
                    >
                        Form
                    </button>
                    <button
                        onClick={() => setMode('json')}
                        style={{
                            border: 'none',
                            background: mode === 'json' ? 'var(--bg-primary)' : 'transparent',
                            color: 'var(--text-primary)',
                            padding: '2px 12px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            borderRadius: '2px',
                            userSelect: 'none',
                            boxShadow: mode === 'json' ? '0 1px 2px rgba(0, 0, 0, 0.1)' : 'none'
                        }}
                    >
                        JSON
                    </button>
                </div>
            </div>

            {/* Content with matching background */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', backgroundColor: 'var(--bg-primary)' }}>
                {columns.length === 0 ? (
                    <div style={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-secondary)',
                        textAlign: 'center',
                        padding: '2rem'
                    }}>
                        <div style={{ marginBottom: '0.5rem', opacity: 0.6 }}>No table selected</div>
                        <div style={{ fontSize: '0.85rem' }}>
                            Open a table first to edit rows.
                        </div>
                    </div>
                ) : !hasSelection ? (
                    <div style={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-secondary)',
                        textAlign: 'center',
                        padding: '2rem'
                    }}>
                        <div style={{ marginBottom: '0.5rem', opacity: 0.6 }}>No rows selected</div>
                        <div style={{ fontSize: '0.85rem' }}>
                            Select rows in the grid to edit them here.
                        </div>
                    </div>
                ) : mode === 'form' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {columns.length === 0 && (
                            <div style={{ color: 'var(--text-muted)' }}>No columns found.</div>
                        )}

                        {rows.map((row, rIdx) => (
                            <div key={rIdx} style={{
                                padding: '0.75rem',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                position: 'relative'
                            }}>
                                <div style={{
                                    position: 'absolute',
                                    top: '-10px',
                                    left: '10px',
                                    background: 'var(--bg-secondary)',
                                    padding: '0 5px',
                                    fontSize: '0.75rem',
                                    color: 'var(--text-secondary)',
                                    fontWeight: 'bold'
                                }}>
                                    Row #{rIdx + 1}
                                </div>
                                <button
                                    onClick={() => handleRemoveRow(rIdx)}
                                    title="Remove Row"
                                    style={{
                                        position: 'absolute',
                                        top: '-10px',
                                        right: '10px',
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '50%',
                                        width: '22px',
                                        height: '22px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#ff4d4d',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <Trash2 size={12} />
                                </button>

                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '0.75rem',
                                    marginTop: '0.5rem'
                                }}>
                                    {columns.map(col => (
                                        <div key={col}>
                                            <label style={{
                                                display: 'block',
                                                fontSize: '0.75rem',
                                                marginBottom: '0.2rem',
                                                color: 'var(--text-secondary)'
                                            }}>
                                                {col}
                                            </label>
                                            <input
                                                className={styles.input}
                                                value={row[col] || ''}
                                                onChange={e => handleFieldChange(rIdx, col, e.target.value)}
                                                placeholder={col === 'id' ? '(Auto)' : ''}
                                                style={{ fontSize: '0.85rem', padding: '0.4rem' }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}

                        <button
                            onClick={handleAddRow}
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px dashed var(--border-color)',
                                backgroundColor: 'transparent',
                                color: 'var(--text-secondary)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <Plus size={16} /> Add Another Row
                        </button>
                    </div>
                ) : (
                    <textarea
                        style={{
                            width: '100%',
                            height: '100%',
                            backgroundColor: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            padding: '0.75rem',
                            fontFamily: 'monospace',
                            resize: 'none',
                            borderRadius: '4px'
                        }}
                        value={jsonContent}
                        onChange={e => setJsonContent(e.target.value)}
                    />
                )}
            </div>

            {/* Footer */}
            {hasSelection && (
                <div style={{
                    padding: '0.75rem',
                    borderTop: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                }}>
                    {error && (
                        <div style={{
                            color: '#ff4d4d',
                            fontSize: '0.85rem',
                            padding: '0 0.25rem'
                        }}>
                            {error}
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            onClick={onClose}
                            className={lStyles.secondaryBtn}
                            style={{
                                flex: 1,
                                justifyContent: 'center'
                            }}
                        >
                            <X size={14} style={{ marginRight: 6 }} /> Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            className={lStyles.primaryBtn}
                            style={{
                                flex: 1,
                                justifyContent: 'center'
                            }}
                        >
                            <Save size={14} style={{ marginRight: 6 }} /> Update
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
