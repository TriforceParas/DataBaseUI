import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import styles from '../../styles/TableCreator.module.css';
import { RiAddLine, RiDeleteBinLine, RiKey2Line, RiCloseLine, RiSaveLine, RiFingerprintLine, RiRefreshLine } from 'react-icons/ri';
import { PendingChange, Connection } from '../../types/index';

export interface ColumnDef {
    name: string;
    type: string;
    length: string;
    defaultValue: string;
    isNullable: boolean;
    isPrimaryKey: boolean;
    isAutoIncrement: boolean;
    isUnique: boolean;
}

export interface ForeignKeyDef {
    column: string;
    refTable: string;
    refColumn: string;
    onDelete: string;
    onUpdate: string;
}

export interface TableCreatorState {
    tableName: string;
    columns: ColumnDef[];
    foreignKeys: ForeignKeyDef[];
}


interface TableCreatorProps {
    connection: Connection;
    onSuccess: () => void;
    mode?: 'create' | 'edit';
    initialState?: TableCreatorState;
    onStateChange?: (state: TableCreatorState) => void;
    originalColumns?: ColumnDef[]; // Original columns for edit mode - used for visual change tracking
    onSchemaChange?: (changes: PendingChange[]) => void; // For adding schema changes to changelog
    tabId?: string; // Tab ID for changelog tracking
}

const DEFAULT_STATE: TableCreatorState = {
    tableName: '',
    columns: [{ name: 'id', type: 'INTEGER', length: '', defaultValue: 'AUTO_INCREMENT', isNullable: false, isPrimaryKey: true, isAutoIncrement: true, isUnique: true }],
    foreignKeys: []
};

export const TableCreator: React.FC<TableCreatorProps> = ({ connection, onSuccess, mode = 'create', initialState, onStateChange, originalColumns, onSchemaChange }) => {
    const [tableName, setTableName] = useState(initialState?.tableName ?? DEFAULT_STATE.tableName);
    const [columns, setColumns] = useState<ColumnDef[]>(initialState?.columns ?? DEFAULT_STATE.columns);
    const [foreignKeys, setForeignKeys] = useState<ForeignKeyDef[]>(initialState?.foreignKeys ?? DEFAULT_STATE.foreignKeys);
    const [availableTables, setAvailableTables] = useState<string[]>([]);
    const [refTableColumns, setRefTableColumns] = useState<Record<string, string[]>>({});

    // Track columns marked for deletion (by name) - only for edit mode
    const [deletedColumns, setDeletedColumns] = useState<Set<string>>(new Set());

    const [error, setError] = useState<string | null>(null);

    // Use ref to avoid infinite loop - only notify parent when state actually changes
    const onStateChangeRef = useRef(onStateChange);
    onStateChangeRef.current = onStateChange;

    const isFirstRender = useRef(true);

    // Track original columns reference to detect when parent updates it (after schema confirmation)
    const prevOriginalColumnsRef = useRef(originalColumns);

    useEffect(() => {
        if (mode === 'edit' && originalColumns && prevOriginalColumnsRef.current !== originalColumns) {
            if (deletedColumns.size > 0) {
                setColumns(prev => prev.filter(c => !deletedColumns.has(c.name)));
            }

            setDeletedColumns(new Set());
            prevOriginalColumnsRef.current = originalColumns;
        } else if (mode === 'edit' && originalColumns && !prevOriginalColumnsRef.current) {
            prevOriginalColumnsRef.current = originalColumns;
        }
    }, [originalColumns, mode, deletedColumns]);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        if (onStateChangeRef.current) {
            onStateChangeRef.current({ tableName, columns, foreignKeys });
        }
    }, [tableName, columns, foreignKeys]);

    const addColumn = () => {
        setColumns([...columns, { name: '', type: 'TEXT', length: '', defaultValue: '', isNullable: true, isPrimaryKey: false, isAutoIncrement: false, isUnique: false }]);
    };

    const removeColumn = (idx: number) => {
        const col = columns[idx];
        if (mode === 'edit' && originalColumns?.find(oc => oc.name === col.name)) {
            setDeletedColumns(prev => new Set([...prev, col.name]));
        } else {
            const newCols = [...columns];
            newCols.splice(idx, 1);
            setColumns(newCols);
        }
    };

    const recoverColumn = (colName: string) => {
        setDeletedColumns(prev => {
            const newSet = new Set(prev);
            newSet.delete(colName);
            return newSet;
        });
    };

    const updateColumn = (idx: number, field: keyof ColumnDef, value: any) => {
        const newCols = [...columns];
        const col = newCols[idx];

        // Validation logic
        if (field === 'isNullable' && value === false) {
            // If unchecking Nullable, and default is NULL, clear it
            if (col.defaultValue === 'NULL') {
                col.defaultValue = '';
            }
        }

        newCols[idx] = { ...col, [field]: value };
        setColumns(newCols);
    };

    const getDialect = () => {
        if (connection.db_type === 'mysql') return 'mysql';
        if (connection.db_type === 'postgres') return 'postgres';
        return 'sqlite';
    };

    const getConnectionString = useCallback(async (): Promise<string> => {
        return await invoke<string>('get_connection_string', { 
            connectionId: connection.id,
            databaseName: connection.database_name 
        });
    }, [connection.id, connection.database_name]);

    useEffect(() => {
        const fetchTables = async () => {
            try {
                const connectionString = await getConnectionString();
                const tables = await invoke<string[]>('get_tables', { connectionString });
                setAvailableTables(tables);
            } catch (e) {
                console.error("Failed to fetch tables", e);
            }
        };
        fetchTables();
    }, [connection.id, connection.database_name, getConnectionString]);

    const fetchColumnsForTable = async (tableName: string) => {
        if (refTableColumns[tableName]) return;
        try {
            const connectionString = await getConnectionString();
            const cols = await invoke<string[]>('get_columns', { connectionString, tableName });
            setRefTableColumns(prev => ({ ...prev, [tableName]: cols }));
        } catch (e) {
            console.error("Failed to fetch columns", e);
        }
    };

    const addForeignKey = () => {
        setForeignKeys([...foreignKeys, { column: '', refTable: '', refColumn: '', onDelete: 'NO ACTION', onUpdate: 'NO ACTION' }]);
    };

    const removeForeignKey = (idx: number) => {
        const newFks = [...foreignKeys];
        newFks.splice(idx, 1);
        setForeignKeys(newFks);
    };

    const updateForeignKey = (idx: number, field: keyof ForeignKeyDef, value: any) => {
        const newFks = [...foreignKeys];
        newFks[idx] = { ...newFks[idx], [field]: value };

        if (field === 'refTable') {
            fetchColumnsForTable(value);
            newFks[idx].refColumn = '';
        }

        setForeignKeys(newFks);
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

        const dialect = getDialect();
        const q = dialect === 'mysql' ? '`' : '"';

        // Helper to build column definition
        const buildColumnDef = (col: ColumnDef) => {
            // Ensure type is not empty - default to TEXT if missing
            let typeStr = col.type || 'TEXT';
            if ((typeStr === 'VARCHAR' || typeStr === 'CHAR') && col.length && col.length !== 'N/A') {
                typeStr = `${typeStr}(${col.length})`;
            }

            let def = `${q}${col.name}${q} ${typeStr}`;

            if (col.isPrimaryKey) {
                def += " PRIMARY KEY";
                if (col.defaultValue === 'AUTO_INCREMENT') {
                    if (dialect === 'mysql') def += " AUTO_INCREMENT";
                    else if (dialect === 'sqlite' && col.type === 'INTEGER') def += " AUTOINCREMENT";
                }
            }

            if (!col.isNullable && !col.isPrimaryKey) def += " NOT NULL";
            if (col.isUnique && !col.isPrimaryKey) def += " UNIQUE";

            if (col.defaultValue && col.defaultValue !== '' && col.defaultValue !== 'AUTO_INCREMENT') {
                const isNum = !isNaN(Number(col.defaultValue));
                const isSqlFunc = ['CURRENT_TIMESTAMP', 'NULL', 'TRUE', 'FALSE'].includes(col.defaultValue);
                def += ` DEFAULT ${isNum || isSqlFunc ? col.defaultValue : `'${col.defaultValue}'`}`;
            }

            return def;
        };

        try {
            if (mode === 'edit' && originalColumns) {
                // Edit mode: Add changes to changelog (not immediate execution)
                const originalColNames = new Set(originalColumns.map(c => c.name));

                // Use deletedColumns state directly for columns to remove
                const columnsToRemove = originalColumns.filter(c => deletedColumns.has(c.name));

                // Find new columns (in current but not in original, and not deleted)
                const columnsToAdd = columns.filter(c => !originalColNames.has(c.name) && !deletedColumns.has(c.name));

                const pendingChanges: PendingChange[] = [];

                // Generate DROP COLUMN pending changes
                columnsToRemove.forEach((col, idx) => {
                    const dropQuery = dialect === 'mysql'
                        ? `ALTER TABLE ${q}${tableName}${q} DROP COLUMN ${q}${col.name}${q}`
                        : `ALTER TABLE ${q}${tableName}${q} DROP COLUMN ${q}${col.name}${q}`;
                    pendingChanges.push({
                        type: 'DROP_COLUMN',
                        tableName,
                        rowIndex: idx,
                        column: col.name,
                        rowData: col,
                        generatedSql: dropQuery
                    });
                });

                // Generate ADD COLUMN pending changes
                columnsToAdd.forEach((col, idx) => {
                    const colDef = buildColumnDef(col);
                    let addColDef = colDef.replace(' PRIMARY KEY', '').replace(' AUTO_INCREMENT', '').replace(' AUTOINCREMENT', '');
                    const addQuery = `ALTER TABLE ${q}${tableName}${q} ADD COLUMN ${addColDef}`;
                    pendingChanges.push({
                        type: 'ADD_COLUMN',
                        tableName,
                        rowIndex: idx,
                        column: col.name,
                        rowData: col,
                        generatedSql: addQuery
                    });
                });

                if (pendingChanges.length === 0) {
                    setError("No changes detected");
                    return;
                }

                // Pass to parent via callback (adds to changelog) - parent should handle deduplication
                if (onSchemaChange) {
                    onSchemaChange(pendingChanges);
                }
                // Don't call onSuccess() - keep tab open
            } else {
                // Create mode: Generate CREATE TABLE statement
                const colDefs = columns.map(buildColumnDef).join(', ');

                const fkDefs = foreignKeys.filter(fk => fk.column && fk.refTable && fk.refColumn).map(fk => {
                    return `FOREIGN KEY (${q}${fk.column}${q}) REFERENCES ${q}${fk.refTable}${q}(${q}${fk.refColumn}${q}) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`;
                });

                const allDefs = [colDefs, ...fkDefs].join(', ');

                const query = `CREATE TABLE ${q}${tableName}${q} (${allDefs})`;
                const connectionString = await getConnectionString();
                await invoke('execute_query', { connectionString, query });
                onSuccess();
            }
        } catch (e) {
            console.error(e);
            setError(String(e));
        }
    };

    // Helper to check if value is a preset
    const isPreset = (val: string) => ['', 'NULL', 'CURRENT_TIMESTAMP', 'AUTO_INCREMENT', 'TRUE', 'FALSE'].includes(val);

    return (
        <div className={styles.container}>
            {/* Content */}
            <div className={styles.section}>
                {/* Table Name with Action Button */}
                <div style={{ marginBottom: '2rem' }}>
                    <label className={styles.label}>Table Name</label>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <input
                            className={styles.mainInput}
                            value={tableName}
                            onChange={e => setTableName(e.target.value)}
                            placeholder="Enter table name..."
                            style={{ flex: 1 }}
                        />
                        <button className={styles.saveButton} onClick={handleCreate}>
                            {mode === 'edit' ? (
                                <><RiSaveLine size={14} /> Save Changes</>
                            ) : (
                                <><RiAddLine size={14} /> Create Table</>
                            )}
                        </button>
                    </div>
                    {error && <span style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.5rem', display: 'block' }}>{error}</span>}
                </div>

                {/* Columns */}
                <div style={{ marginBottom: '2rem' }}>
                    <label className={styles.label}>Columns</label>

                    <div className={styles.columnsHeader}>
                        <div>#</div>
                        <div>Name</div>
                        <div>Type</div>
                        <div>Length/Size</div>
                        <div>Default Value</div>
                        <div>Constraints</div>
                        <div></div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {columns.map((col, idx) => {
                            // Determine column status for visual indicators
                            const isNewColumn = mode === 'edit' && originalColumns && !originalColumns.find(oc => oc.name === col.name);
                            const isDeletedColumn = mode === 'edit' && deletedColumns.has(col.name);
                            const rowStyle: React.CSSProperties = {
                                ...(isDeletedColumn ? {
                                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                    borderLeft: '3px solid #ef4444',
                                    opacity: 0.7
                                } : isNewColumn ? {
                                    backgroundColor: 'rgba(34, 197, 94, 0.15)',
                                    borderLeft: '3px solid #22c55e'
                                } : {})
                            };

                            return (
                                <div key={idx} className={styles.columnRow} style={rowStyle}>
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
                                        <option value="CHAR">char</option>
                                        <option value="BOOLEAN">bool</option>
                                        <option value="jsonb">jsonb</option>
                                        <option value="timestamp">timestamp</option>
                                        <option value="date">date</option>
                                        <option value="DECIMAL">decimal</option>
                                    </select>

                                    {/* Parameters (Length/Size) */}
                                    <input
                                        className={styles.rowInput}
                                        value={col.length}
                                        onChange={e => updateColumn(idx, 'length', e.target.value)}
                                        placeholder={['VARCHAR', 'CHAR', 'DECIMAL'].includes(col.type) ? "1-255" : "N/A"}
                                        disabled={!['VARCHAR', 'CHAR', 'DECIMAL'].includes(col.type)}
                                    />

                                    {/* Default Value */}
                                    <div>
                                        {isPreset(col.defaultValue) ? (
                                            <select
                                                className={styles.rowSelect}
                                                value={col.defaultValue}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    if (val === '_CUSTOM_') {
                                                        updateColumn(idx, 'defaultValue', ' ');
                                                    } else {
                                                        updateColumn(idx, 'defaultValue', val);
                                                    }
                                                }}
                                            >
                                                <option value="">None</option>
                                                {col.isNullable && <option value="NULL">NULL</option>}
                                                {col.isPrimaryKey && <option value="AUTO_INCREMENT">AUTO_INCREMENT</option>}
                                                {['timestamp', 'date', 'datetime'].includes(col.type.toLowerCase()) && (
                                                    <option value="CURRENT_TIMESTAMP">CURRENT_TIMESTAMP</option>
                                                )}
                                                <option value="_CUSTOM_">Value...</option>
                                            </select>
                                        ) : (
                                            <div style={{ position: 'relative', width: '100%' }}>
                                                <input
                                                    className={styles.rowInput}
                                                    value={col.defaultValue === ' ' ? '' : col.defaultValue}
                                                    onChange={e => updateColumn(idx, 'defaultValue', e.target.value)}
                                                    placeholder="Enter default..."
                                                    autoFocus
                                                    onBlur={(e) => {
                                                        if (!e.target.value) {
                                                            updateColumn(idx, 'defaultValue', '');
                                                        }
                                                    }}
                                                />
                                                <div
                                                    onClick={() => updateColumn(idx, 'defaultValue', '')}
                                                    style={{
                                                        position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)',
                                                        cursor: 'pointer',
                                                        opacity: 0.5
                                                    }}
                                                    title="Clear"
                                                >
                                                    <RiCloseLine size={12} />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Constraints */}
                                    <div className={styles.constraintsGroup}>
                                        <label className={styles.constraintLabel} title="Primary Key">
                                            <input type="checkbox" checked={col.isPrimaryKey} onChange={e => updateColumn(idx, 'isPrimaryKey', e.target.checked)} />
                                            <RiKey2Line size={12} className={styles.constraintIcon} /> PK
                                        </label>

                                        <label className={styles.constraintLabel} title="Unique">
                                            <input type="checkbox" checked={col.isUnique} onChange={e => updateColumn(idx, 'isUnique', e.target.checked)} />
                                            <RiFingerprintLine size={12} className={styles.constraintIcon} /> Unique
                                        </label>
                                        <label className={styles.constraintLabel} title="Nullable">
                                            <input type="checkbox" checked={col.isNullable} onChange={e => updateColumn(idx, 'isNullable', e.target.checked)} />
                                            <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>?</span> Nullable
                                        </label>
                                    </div>

                                    {/* Remove/Recover Button */}
                                    {isDeletedColumn ? (
                                        <button
                                            className={styles.iconButton}
                                            onClick={() => recoverColumn(col.name)}
                                            style={{ color: '#22c55e' }}
                                            title="Recover Column"
                                        >
                                            <RiRefreshLine size={16} />
                                        </button>
                                    ) : (
                                        <button
                                            className={styles.iconButton}
                                            onClick={() => removeColumn(idx)}
                                            style={{ color: '#ef4444' }}
                                            title="Delete Column"
                                        >
                                            <RiDeleteBinLine size={16} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <button className={styles.addColumnBtn} onClick={addColumn}>
                        <RiAddLine size={16} /> Add Column
                    </button>
                </div>

                {/* Foreign Keys */}
                <div style={{ marginBottom: '2rem' }}>
                    <label className={styles.label}>Foreign Keys</label>

                    <div className={styles.columnsHeader} style={{ gridTemplateColumns: '40px 1fr 1fr 1fr 0.8fr 0.8fr 40px' }}>
                        <div>#</div>
                        <div>Column</div>
                        <div>Ref Table</div>
                        <div>Ref Column</div>
                        <div>On Delete</div>
                        <div>On Update</div>
                        <div></div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {foreignKeys.map((fk, idx) => (
                            <div key={idx} className={styles.columnRow} style={{ gridTemplateColumns: '40px 1fr 1fr 1fr 0.8fr 0.8fr 40px' }}>
                                <div style={{ opacity: 0.5, textAlign: 'center' }}>{idx + 1}</div>

                                <select
                                    className={styles.rowSelect}
                                    value={fk.column}
                                    onChange={e => updateForeignKey(idx, 'column', e.target.value)}
                                >
                                    <option value="">Select Col...</option>
                                    {columns.filter(c => c.name).map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                </select>

                                <select
                                    className={styles.rowSelect}
                                    value={fk.refTable}
                                    onChange={e => updateForeignKey(idx, 'refTable', e.target.value)}
                                >
                                    <option value="">Select Table...</option>
                                    {availableTables.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>

                                <select
                                    className={styles.rowSelect}
                                    value={fk.refColumn}
                                    onChange={e => updateForeignKey(idx, 'refColumn', e.target.value)}
                                    disabled={!fk.refTable}
                                >
                                    <option value="">Ref Col...</option>
                                    {(refTableColumns[fk.refTable] || []).map(c => <option key={c} value={c}>{c}</option>)}
                                </select>

                                <select className={styles.rowSelect} value={fk.onDelete} onChange={e => updateForeignKey(idx, 'onDelete', e.target.value)}>
                                    <option value="NO ACTION">No Action</option>
                                    <option value="CASCADE">Cascade</option>
                                    <option value="SET NULL">Set Null</option>
                                    <option value="RESTRICT">Restrict</option>
                                </select>

                                <select className={styles.rowSelect} value={fk.onUpdate} onChange={e => updateForeignKey(idx, 'onUpdate', e.target.value)}>
                                    <option value="NO ACTION">No Action</option>
                                    <option value="CASCADE">Cascade</option>
                                    <option value="SET NULL">Set Null</option>
                                    <option value="RESTRICT">Restrict</option>
                                </select>

                                <button
                                    className={styles.iconButton}
                                    onClick={() => removeForeignKey(idx)}
                                    style={{ color: '#ef4444' }}
                                    title="Delete FK"
                                >
                                    <RiDeleteBinLine size={16} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <button className={styles.addColumnBtn} onClick={addForeignKey}>
                        <RiAddLine size={16} /> Add Foreign Key
                    </button>
                </div>
            </div>
        </div>
    );
};
