import React, { useState, useEffect } from 'react';
import { X, Save, Database, FileJson, Plus, Trash2 } from 'lucide-react';
import styles from '../styles/ConnectionForm.module.css';

interface InsertRowPanelProps {
    isOpen: boolean;
    onClose: () => void;
    columns: string[];
    onInsert: (data: Record<string, any>[]) => void;
    tableName: string;
    initialData?: Record<string, any>[]; // For Edit Mode
    onAddRow?: () => void;
    onUpdateRow?: (rowIndex: number, column: string, value: any) => void;
    onRemoveRow?: (rowIndex: number) => void;
}

export const InsertRowPanel: React.FC<InsertRowPanelProps> = ({ isOpen, onClose, columns, onInsert, tableName, initialData, onAddRow, onUpdateRow, onRemoveRow }) => {
    const [mode, setMode] = useState<'form' | 'json'>('form');
    // Array of rows. Each row is a Record<column, value>
    const [rows, setRows] = useState<Record<string, string>[]>([{}]);
    const [jsonContent, setJsonContent] = useState('[\n  {\n    \n  }\n]');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (initialData && initialData.length > 0) {
            // Populate form for editing
            const mappedRows = initialData.map(d => {
                const newRow: Record<string, string> = {};
                columns.forEach(c => newRow[c] = d[c] !== null && d[c] !== undefined ? String(d[c]) : '');
                return newRow;
            });
            setRows(mappedRows);
            setJsonContent(JSON.stringify(initialData, null, 2));
            return;
        }

        // Initialize empty form data
        const initial: Record<string, string> = {};
        columns.forEach(c => initial[c] = '');
        setRows([initial]);

        // Initialize JSON
        const example: Record<string, string> = {};
        columns.forEach(c => example[c] = '');
        setJsonContent(JSON.stringify([example], null, 2));

    }, [columns, isOpen, initialData]);

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
        if (onUpdateRow) {
            onUpdateRow(rowIdx, col, val);
            return;
        }
        const newRows = [...rows];
        if (!newRows[rowIdx]) newRows[rowIdx] = {};
        newRows[rowIdx][col] = val;
        setRows(newRows);
    };

    const handleAddRow = () => {
        if (onAddRow) {
            onAddRow();
            return;
        }
        const newRow: Record<string, string> = {};
        columns.forEach(c => newRow[c] = '');
        setRows([...rows, newRow]);
    };

    const handleRemoveRow = (idx: number) => {
        if (onRemoveRow) {
            onRemoveRow(idx);
            return;
        }
        const newRows = rows.filter((_, i) => i !== idx);
        setRows(newRows.length ? newRows : [{}]); // Keep at least one
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

    // if (!isOpen) return null; // Removed for animation

    return (
        <div style={{
            position: 'absolute',
            top: '44px', right: 0, bottom: 0,
            width: '450px',
            backgroundColor: 'var(--bg-primary)',
            borderLeft: '1px solid var(--border-color)',
            boxShadow: '-4px 0 15px rgba(0,0,0,0.3)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.3s ease-in-out',
            pointerEvents: isOpen ? 'auto' : 'none'
        }}>
            {/* Header */}
            {/* Header Removed */}
            <div style={{ height: '44px', display: 'none' }} />

            {/* Toggle */}
            <div style={{ display: 'flex', padding: '1rem', gap: '1rem' }}>
                <button
                    onClick={() => setMode('form')}
                    style={{
                        flex: 1,
                        padding: '0.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        backgroundColor: mode === 'form' ? 'var(--bg-tertiary)' : 'transparent',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: 'var(--text-primary)'
                    }}
                >
                    <Database size={16} /> Form
                </button>
                <button
                    onClick={() => setMode('json')}
                    style={{
                        flex: 1,
                        padding: '0.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        backgroundColor: mode === 'json' ? 'var(--bg-tertiary)' : 'transparent',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: 'var(--text-primary)'
                    }}
                >
                    <FileJson size={16} /> JSON
                </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                {initialData && initialData.length === 0 ? (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                        <div style={{ marginBottom: '1rem', opacity: 0.5 }}>No rows selected</div>
                        <div style={{ fontSize: '0.85rem' }}>Select rows in the grid to edit them here.</div>
                    </div>
                ) : mode === 'form' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {columns.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No columns found.</div>}

                        {rows.map((row, rIdx) => (
                            <div key={rIdx} style={{
                                padding: '1rem',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                position: 'relative'
                            }}>
                                <div style={{
                                    position: 'absolute',
                                    top: '-10px',
                                    left: '10px',
                                    background: 'var(--bg-primary)',
                                    padding: '0 5px',
                                    fontSize: '0.8rem',
                                    color: 'var(--text-secondary)',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    gap: '10px',
                                    alignItems: 'center'
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
                                        background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '50%',
                                        width: '24px',
                                        height: '24px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: '#ff4d4d',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <Trash2 size={12} />
                                </button>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                                    {columns.map(col => (
                                        <div key={col}>
                                            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.2rem', color: 'var(--text-secondary)' }}>{col}</label>
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
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
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
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            padding: '1rem',
                            fontFamily: 'monospace',
                            resize: 'none'
                        }}
                        value={jsonContent}
                        onChange={e => setJsonContent(e.target.value)}
                    />
                )}
            </div>

            {/* Footer */}
            <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
                {error && <div style={{ color: '#ff4d4d', fontSize: '0.9rem', marginBottom: '1rem' }}>{error}</div>}
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={onClose}
                        style={{ flex: 1, padding: '0.75rem', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        style={{ flex: 1, padding: '0.75rem', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    >
                        <Save size={16} /> {initialData ? 'Update' : 'Insert'}
                    </button>
                </div>
            </div>
        </div>
    );
};
