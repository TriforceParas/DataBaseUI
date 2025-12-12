import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import styles from '../styles/ConnectionForm.module.css'; // Reuse form styles
import { Plus, Trash2, Save } from 'lucide-react';

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
        { name: 'id', type: 'INTEGER', length: '', defaultValue: '', isNullable: false, isPrimaryKey: true, isAutoIncrement: true, isUnique: false }
    ]);
    const [error, setError] = useState<string | null>(null);

    const addColumn = () => {
        setColumns([...columns, { name: '', type: 'TEXT', length: '', defaultValue: '', isNullable: true, isPrimaryKey: false, isAutoIncrement: false, isUnique: false }]);
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
        // MySQL typically uses backticks, others use double quotes for identifiers
        const q = dialect === 'mysql' ? '`' : '"';

        // Build SQL
        try {
            const colDefs = columns.map(col => {
                let typeStr = col.type;
                if ((col.type === 'VARCHAR' || col.type === 'CHAR') && col.length) {
                    typeStr = `${col.type}(${col.length})`;
                }

                // Quote identifier
                let def = `${q}${col.name}${q} ${typeStr}`;

                if (col.isPrimaryKey) {
                    def += " PRIMARY KEY";

                    if (col.isAutoIncrement) {
                        if (dialect === 'mysql') {
                            def += " AUTO_INCREMENT";
                        } else if (dialect === 'sqlite') {
                            // SQLite only supports AUTOINCREMENT on INTEGER PRIMARY KEY
                            if (col.type === 'INTEGER') {
                                def += " AUTOINCREMENT";
                            }
                        } else {
                            // Postgres usually implies SERIAL via type, but user might select INTEGER+AI
                            // For minimal compatibility we ignore explicit AUTOINCREMENT keyword if not supported
                        }
                    }
                }

                if (!col.isNullable && !col.isPrimaryKey) def += " NOT NULL";
                if (col.isUnique && !col.isPrimaryKey) def += " UNIQUE";

                if (col.defaultValue) {
                    const upperDefault = col.defaultValue.toUpperCase();
                    // Naive check for unquoting numbers and SQL functions
                    const isNum = !isNaN(Number(col.defaultValue));
                    const isSqlFunc = ['CURRENT_TIMESTAMP', 'CURRENT_DATE', 'CURRENT_TIME', 'TRUE', 'FALSE', 'NULL'].includes(upperDefault);

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

    return (
        <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', height: '100%', overflowY: 'auto' }}>
            <h2 className={styles.sectionTitle}>Create New Table</h2>

            <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Table Name</label>
                <input
                    className={styles.input}
                    value={tableName}
                    onChange={e => setTableName(e.target.value)}
                    placeholder="e.g. users"
                />
            </div>

            <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Columns</h3>
                    <button type="button" className={styles.addButton} onClick={addColumn} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
                        <Plus size={14} /> Add Column
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {columns.map((col, idx) => (
                        <div key={idx} style={{
                            display: 'grid',
                            gridTemplateColumns: '2fr 1.5fr 80px 100px 50px 50px 50px 50px 40px',
                            gap: '0.5rem',
                            alignItems: 'center',
                            backgroundColor: 'var(--bg-secondary)',
                            padding: '0.5rem',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)'
                        }}>
                            {/* Name */}
                            <input
                                className={styles.input}
                                value={col.name}
                                onChange={e => updateColumn(idx, 'name', e.target.value)}
                                placeholder="Name"
                                title="Column Name"
                            />

                            {/* Type */}
                            <select
                                className={styles.input}
                                value={col.type}
                                onChange={e => updateColumn(idx, 'type', e.target.value)}
                                title="Data Type"
                            >
                                <option value="INTEGER">INTEGER</option>
                                <option value="TEXT">TEXT</option>
                                <option value="VARCHAR">VARCHAR</option>
                                <option value="CHAR">CHAR</option>
                                <option value="REAL">REAL</option>
                                <option value="BLOB">BLOB</option>
                                <option value="BOOLEAN">BOOLEAN</option>
                                <option value="DATE">DATE</option>
                                <option value="DATETIME">DATETIME</option>
                            </select>

                            {/* Length */}
                            <input
                                className={styles.input}
                                value={col.length}
                                onChange={e => updateColumn(idx, 'length', e.target.value)}
                                placeholder="Len"
                                disabled={col.type !== 'VARCHAR' && col.type !== 'CHAR'}
                                title="Length (for VARCHAR/CHAR)"
                            />

                            {/* Default */}
                            <input
                                className={styles.input}
                                value={col.defaultValue}
                                onChange={e => updateColumn(idx, 'defaultValue', e.target.value)}
                                placeholder="Default"
                                title="Default Value"
                                list={`default-suggestions-${idx}`}
                            />
                            <datalist id={`default-suggestions-${idx}`}>
                                {(col.type === 'DATE' || col.type === 'DATETIME') && (
                                    <>
                                        <option value="CURRENT_TIMESTAMP" />
                                        <option value="CURRENT_DATE" />
                                        <option value="CURRENT_TIME" />
                                    </>
                                )}
                                {col.type === 'BOOLEAN' && (
                                    <>
                                        <option value="TRUE" />
                                        <option value="FALSE" />
                                    </>
                                )}
                            </datalist>

                            {/* PK */}
                            <label style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }} title="Primary Key">
                                <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>PK</span>
                                <input
                                    type="checkbox"
                                    checked={col.isPrimaryKey}
                                    onChange={e => updateColumn(idx, 'isPrimaryKey', e.target.checked)}
                                />
                            </label>

                            {/* AI */}
                            <label style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }} title="Auto Increment">
                                <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>AI</span>
                                <input
                                    type="checkbox"
                                    checked={col.isAutoIncrement}
                                    onChange={e => updateColumn(idx, 'isAutoIncrement', e.target.checked)}
                                    disabled={!col.isPrimaryKey || col.type !== 'INTEGER'}
                                />
                            </label>

                            {/* NN (Not Null) */}
                            <label style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }} title="Allow Null">
                                <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>Null</span>
                                <input
                                    type="checkbox"
                                    checked={col.isNullable}
                                    onChange={e => updateColumn(idx, 'isNullable', e.target.checked)}
                                />
                            </label>

                            {/* UQ */}
                            <label style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }} title="Unique">
                                <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>UQ</span>
                                <input
                                    type="checkbox"
                                    checked={col.isUnique}
                                    onChange={e => updateColumn(idx, 'isUnique', e.target.checked)}
                                />
                            </label>

                            <button
                                onClick={() => removeColumn(idx)}
                                style={{ background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer', display: 'flex', justifyContent: 'center' }}
                                title="Remove Column"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {error && <div style={{ color: '#ff4d4d', marginTop: '1rem', padding: '0.5rem', border: '1px solid #ff4d4d', borderRadius: '4px' }}>
                Error: {error}
            </div>}

            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button className={styles.addButton} onClick={handleCreate} style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}>
                    <Save size={16} /> Create Table
                </button>
            </div>
        </div>
    );
};
