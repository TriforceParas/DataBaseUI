import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import styles from '../styles/TableCreator.module.css';
import { Plus, Trash2, Key, HelpCircle, X, Shield, Lock, Fingerprint } from 'lucide-react';

interface TableCreatorProps {
    connectionString: string;
    onSuccess: () => void;
}

interface ColumnDef {
    name: string;
    type: string;
    length: string;
    defaultValue: string;
    isNullable: boolean;
    isPrimaryKey: boolean;
    isAutoIncrement: boolean;
    isUnique: boolean;
}

export const TableCreator: React.FC<TableCreatorProps> = ({ connectionString, onSuccess }) => {
    const [tableName, setTableName] = useState('');
    const [columns, setColumns] = useState<ColumnDef[]>([
        { name: 'id', type: 'INTEGER', length: '', defaultValue: '', isNullable: false, isPrimaryKey: true, isAutoIncrement: true, isUnique: true }
    ]);
    const [error, setError] = useState<string | null>(null);

    const addColumn = () => {
        setColumns([...columns, { name: '', type: 'TEXT', length: 'N/A', defaultValue: '', isNullable: true, isPrimaryKey: false, isAutoIncrement: false, isUnique: false }]);
    };

    const removeColumn = (idx: number) => {
        const newCols = [...columns];
        newCols.splice(idx, 1);
        setColumns(newCols);
    };

    const updateColumn = (idx: number, field: keyof ColumnDef, value: any) => {
        const newCols = [...columns];
        newCols[idx] = { ...newCols[idx], [field]: value };
        setColumns(newCols);
    };

    const getDialect = (connStr: string) => {
        if (connStr.startsWith('mysql:')) return 'mysql';
        if (connStr.startsWith('postgres:')) return 'postgres';
        return 'sqlite';
    };

    const handleCreate = async () => {
        setError(null);
        if (!tableName) {
            setError("Table name is required");
            return;
        }
        if (columns.length === 0) {
            setError("At least one column is required");
            return;
        }

        const dialect = getDialect(connectionString);
        const q = dialect === 'mysql' ? '`' : '"';

        try {
            const colDefs = columns.map(col => {
                let typeStr = col.type;
                if ((col.type === 'VARCHAR' || col.type === 'CHAR') && col.length && col.length !== 'N/A') {
                    typeStr = `${col.type}(${col.length})`;
                }

                let def = `${q}${col.name}${q} ${typeStr}`;

                if (col.isPrimaryKey) {
                    def += " PRIMARY KEY";
                    if (col.isAutoIncrement) {
                        if (dialect === 'mysql') def += " AUTO_INCREMENT";
                        else if (dialect === 'sqlite' && col.type === 'INTEGER') def += " AUTOINCREMENT";
                    }
                }

                if (!col.isNullable && !col.isPrimaryKey) def += " NOT NULL";
                if (col.isUnique && !col.isPrimaryKey) def += " UNIQUE";

                if (col.defaultValue && col.defaultValue !== '') {
                    // Check if it's a numeric or function or custom string
                    const isNum = !isNaN(Number(col.defaultValue));
                    const isSqlFunc = ['CURRENT_TIMESTAMP', 'NULL', 'TRUE', 'FALSE', 'now()'].includes(col.defaultValue); // now() is function
                    def += ` DEFAULT ${isNum || isSqlFunc ? col.defaultValue : `'${col.defaultValue}'`}`;
                }

                return def;
            }).join(', ');

            const query = `CREATE TABLE ${q}${tableName}${q} (${colDefs})`;
            await invoke('execute_query', { connectionString, query });
            onSuccess();
        } catch (e) {
            console.error(e);
            setError(String(e));
        }
    };

    // Helper to check if value is a preset
    const isPreset = (val: string) => ['', 'NULL', 'now()', 'TRUE', 'FALSE'].includes(val);

    return (
        <div className={styles.container}>
            {/* Top Bar */}
            <div className={styles.topBar}>
                <div style={{ marginRight: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button className={styles.saveButton} onClick={handleCreate}>
                        <Shield size={14} /> Save Changes
                    </button>
                    {error && <span style={{ color: '#ef4444', fontSize: '0.9rem' }}>{error}</span>}
                </div>
            </div>

            {/* Content */}
            <div className={styles.section}>
                {/* Table Name */}
                <div style={{ marginBottom: '2rem' }}>
                    <label className={styles.label}>Table Name</label>
                    <input
                        className={styles.mainInput}
                        value={tableName}
                        onChange={e => setTableName(e.target.value)}
                        placeholder="Enter table name..."
                    />
                </div>

                {/* Columns */}
                <div style={{ marginBottom: '2rem' }}>
                    <label className={styles.label}>Columns</label>

                    <div className={styles.columnsHeader}>
                        <div>#</div>
                        <div>Name</div>
                        <div>Type</div>
                        <div>Parameters</div>
                        <div>Default Value</div>
                        <div>Constraints</div>
                        <div></div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {columns.map((col, idx) => (
                            <div key={idx} className={styles.columnRow}>
                                <div style={{ opacity: 0.5, textAlign: 'center' }}>{idx + 1}</div>

                                {/* Name */}
                                <input
                                    className={styles.rowInput}
                                    value={col.name}
                                    onChange={e => updateColumn(idx, 'name', e.target.value)}
                                    placeholder="column_name"
                                />

                                {/* Type */}
                                <select
                                    className={styles.rowSelect}
                                    value={col.type}
                                    onChange={e => updateColumn(idx, 'type', e.target.value)}
                                >
                                    <option value="INTEGER">int4</option>
                                    <option value="serial">serial</option>
                                    <option value="TEXT">text</option>
                                    <option value="VARCHAR">varchar</option>
                                    <option value="BOOLEAN">bool</option>
                                    <option value="jsonb">jsonb</option>
                                    <option value="timestamp">timestamp</option>
                                </select>

                                {/* Parameters */}
                                <input
                                    className={styles.rowInput}
                                    value={col.length}
                                    onChange={e => updateColumn(idx, 'length', e.target.value)}
                                    placeholder="N/A"
                                    disabled={col.type !== 'VARCHAR'}
                                />

                                {/* Default Value - Logic: If preset, show select. If custom, show input. */}
                                <div>
                                    {isPreset(col.defaultValue) ? (
                                        <select
                                            className={styles.rowSelect}
                                            value={col.defaultValue}
                                            onChange={e => {
                                                const val = e.target.value;
                                                if (val === '_CUSTOM_') {
                                                    // Set to space to trigger input mode, or specific placeholder?
                                                    // Let's set to a placeholder space ' ' which user can delete?
                                                    // No, let's set to 'custom_value' and select text?
                                                    // Better: Set to a known non-preset string like ' ' (space)
                                                    updateColumn(idx, 'defaultValue', ' ');
                                                } else {
                                                    updateColumn(idx, 'defaultValue', val);
                                                }
                                            }}
                                        >
                                            <option value="">Empty</option>
                                            <option value="NULL">NULL</option>
                                            <option value="now()">now()</option>
                                            <option value="_CUSTOM_">Value...</option>
                                        </select>
                                    ) : (
                                        <div style={{ position: 'relative', width: '100%' }}>
                                            <input
                                                className={styles.rowInput}
                                                value={col.defaultValue === ' ' ? '' : col.defaultValue} // Handle init space
                                                onChange={e => updateColumn(idx, 'defaultValue', e.target.value)}
                                                placeholder="Enter default..."
                                                autoFocus
                                                onBlur={(e) => {
                                                    if (!e.target.value) {
                                                        // If empty on blur, revert to 'Empty' preset
                                                        updateColumn(idx, 'defaultValue', '');
                                                    }
                                                }}
                                            />
                                            <div
                                                onClick={() => updateColumn(idx, 'defaultValue', '')}
                                                style={{
                                                    position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)',
                                                    cursor: 'pointer', opacity: 0.5
                                                }}
                                                title="Clear"
                                            >
                                                <X size={12} />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Constraints */}
                                <div className={styles.constraintsGroup}>
                                    <label className={styles.constraintLabel} title="Primary Key">
                                        <input type="checkbox" checked={col.isPrimaryKey} onChange={e => updateColumn(idx, 'isPrimaryKey', e.target.checked)} />
                                        <Key size={12} className={styles.constraintIcon} /> PK
                                    </label>
                                    <label className={styles.constraintLabel} title="Unique">
                                        <input type="checkbox" checked={col.isUnique} onChange={e => updateColumn(idx, 'isUnique', e.target.checked)} />
                                        <Fingerprint size={12} className={styles.constraintIcon} /> Unique
                                    </label>
                                    <label className={styles.constraintLabel} title="Nullable">
                                        <input type="checkbox" checked={col.isNullable} onChange={e => updateColumn(idx, 'isNullable', e.target.checked)} />
                                        <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>?</span> Nullable
                                    </label>
                                </div>

                                {/* Remove - Trash Icon Red */}
                                <button
                                    className={styles.iconButton}
                                    onClick={() => removeColumn(idx)}
                                    style={{ color: '#ef4444' }}
                                    title="Delete Column"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <button className={styles.addColumnBtn} onClick={addColumn}>
                        <Plus size={16} /> Add Column
                    </button>
                </div>

                {/* Foreign Keys (Placeholder for layout matching) */}
                <div className={styles.fkSection}>
                    <label className={styles.label}>Foreign Keys</label>
                    <button className={styles.addColumnBtn} style={{ marginLeft: 0 }}>
                        <Plus size={16} /> Add Foreign Key
                    </button>
                </div>
            </div>
        </div>
    );
};
