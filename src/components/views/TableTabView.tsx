import React from 'react';
import { Icons } from '../../assets/icons';
import styles from '../../styles/MainLayout.module.css';
import { DataGrid } from '../datagrid/DataGrid';
import { Tab, TableDataState, PendingChange, PaginationState, ColumnSchema } from '../../types/index';

interface TableTabViewProps {
    activeTab: Tab;
    results: Record<string, TableDataState>;
    selectedIndices: Set<number>;
    setSelectedIndices: (action: Set<number> | ((prev: Set<number>) => Set<number>)) => void;
    paginationMap: Record<string, PaginationState>;
    pendingChanges: Record<string, PendingChange[]>;
    highlightRowIndex: number | null;
    tableSchemas: Record<string, ColumnSchema[]>;
    activeDropdown: 'copy' | 'export' | 'pageSize' | null;
    setActiveDropdown: (val: 'copy' | 'export' | 'pageSize' | null) => void;

    // Actions
    onInsertRow: () => void;
    onRefresh: () => void;
    onDeleteRows: () => void;
    onCopy: (format: 'CSV' | 'JSON') => void;
    onExport: (format: 'CSV' | 'JSON') => void;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    onSort: (col: string) => void;
    onCellEdit: (rowIndex: number, column: string, value: any) => void;
    onRowDelete: (rowIndex: number) => void;
    onRecoverRow: (rowIndex: number) => void;
}

export const TableTabView: React.FC<TableTabViewProps> = ({
    activeTab,
    results,
    selectedIndices,
    setSelectedIndices,
    paginationMap,
    pendingChanges,
    highlightRowIndex,
    tableSchemas,
    activeDropdown,
    setActiveDropdown,
    onInsertRow,
    onRefresh,
    onDeleteRows,
    onCopy,
    onExport,
    onPageChange,
    onPageSizeChange,
    onSort,
    onCellEdit,
    onRowDelete,
    onRecoverRow
}) => {
    const pag = paginationMap[activeTab.id] || { page: 1, pageSize: 20, total: 0 };
    const totalPages = Math.ceil(pag.total / pag.pageSize) || 1;

    return (
        <>
            <div className={styles.tableToolbar}>
                <button className={styles.primaryBtn} onClick={onInsertRow}>
                    <Icons.Plus size={14} /> Insert
                </button>

                <button className={styles.toolbarBtn} onClick={onRefresh} title="Refresh">
                    <Icons.RefreshCw size={14} />
                </button>
                <div className={styles.verticalDivider} style={{ height: 16 }}></div>
                <button className={styles.toolbarBtn} title="Filter"><Icons.Filter size={14} /></button>

                {selectedIndices.size > 0 && (
                    <>
                        <button className={styles.outlineBtn} onClick={onDeleteRows} style={{ border: '1px solid #ef4444', color: '#ef4444', backgroundColor: 'transparent', marginRight: '0.5rem' }}>
                            <Icons.Trash2 size={14} style={{ marginRight: 4 }} /> Delete ({selectedIndices.size})
                        </button>

                        {/* Copy Dropdown */}
                        <div style={{ position: 'relative', display: 'inline-block', marginRight: '0.5rem' }}>
                            <button className={styles.secondaryBtn} onClick={() => setActiveDropdown(activeDropdown === 'copy' ? null : 'copy')}>
                                <Icons.Copy size={14} style={{ marginRight: 4 }} /> Copy <Icons.ChevronDown size={12} style={{ marginLeft: 2 }} />
                            </button>
                            {activeDropdown === 'copy' && (
                                <div className={styles.dropdownMenu} style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '4px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', minWidth: '100px' }}>
                                    <div className={styles.dropdownItem} onClick={() => { onCopy('CSV'); setActiveDropdown(null); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem' }}>As CSV</div>
                                    <div className={styles.dropdownItem} onClick={() => { onCopy('JSON'); setActiveDropdown(null); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem' }}>As JSON</div>
                                </div>
                            )}
                        </div>
                        {/* Export Dropdown */}
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                            <button className={styles.secondaryBtn} onClick={() => setActiveDropdown(activeDropdown === 'export' ? null : 'export')}>
                                <Icons.Download size={14} style={{ marginRight: 4 }} /> Export <Icons.ChevronDown size={12} style={{ marginLeft: 2 }} />
                            </button>
                            {activeDropdown === 'export' && (
                                <div className={styles.dropdownMenu} style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '4px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', minWidth: '100px' }}>
                                    <div className={styles.dropdownItem} onClick={() => { onExport('CSV'); setActiveDropdown(null); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem' }}>As CSV</div>
                                    <div className={styles.dropdownItem} onClick={() => { onExport('JSON'); setActiveDropdown(null); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem' }}>As JSON</div>
                                </div>
                            )}
                        </div>
                    </>
                )}

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                            className={styles.iconBtn}
                            disabled={pag.page <= 1}
                            onClick={() => onPageChange(pag.page - 1)}
                            style={{ opacity: pag.page <= 1 ? 0.3 : 1 }}
                        >
                            <Icons.ChevronLeft size={16} />
                        </button>
                        <span style={{ minWidth: '60px', textAlign: 'center' }}>{pag.page} of {totalPages}</span>
                        <button
                            className={styles.iconBtn}
                            disabled={pag.page >= totalPages}
                            onClick={() => onPageChange(pag.page + 1)}
                            style={{ opacity: pag.page >= totalPages ? 0.3 : 1 }}
                        >
                            <Icons.ChevronRight size={16} />
                        </button>
                    </div>

                    <div style={{ position: 'relative' }}>
                        <button
                            className={styles.secondaryBtn}
                            onClick={() => setActiveDropdown(activeDropdown === 'pageSize' ? null : 'pageSize')}
                        >
                            {pag.pageSize >= 5000 ? 'All Rows' : `${pag.pageSize} rows`} <Icons.ChevronDown size={12} style={{ marginLeft: 4 }} />
                        </button>
                        {activeDropdown === 'pageSize' && (
                            <div className={styles.dropdownMenu} style={{ position: 'absolute', top: '100%', right: 0, zIndex: 100, backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '4px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', minWidth: '80px' }}>
                                {[20, 50, 100, 200, 'All'].map(size => {
                                    const isAll = size === 'All';
                                    const value = isAll ? (pag.total || 10000) : (size as number);
                                    return (
                                        <div
                                            key={size}
                                            className={styles.dropdownItem}
                                            onClick={() => {
                                                setActiveDropdown(null);
                                                onPageSizeChange(value);
                                            }}
                                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem', backgroundColor: pag.pageSize === value ? 'var(--bg-tertiary)' : 'transparent' }}
                                        >
                                            {size === 'All' ? 'All Rows' : size}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div style={{ minWidth: '80px', textAlign: 'right' }}>{pag.total} rows</div>
                </div>
            </div>
            <div style={{ flex: 1, padding: '1rem', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-secondary)', overflow: 'hidden', marginBottom: '0.5rem' }}>
                    <DataGrid
                        key={activeTab.id}
                        data={results[activeTab.id]?.data || null}
                        loading={results[activeTab.id]?.loading || false}
                        error={results[activeTab.id]?.error || null}
                        selectedIndices={selectedIndices}
                        onSelectionChange={setSelectedIndices}
                        onSort={onSort}
                        pendingChanges={pendingChanges[activeTab.id]}
                        highlightRowIndex={highlightRowIndex}
                        onCellEdit={onCellEdit}
                        primaryKeys={new Set(tableSchemas[activeTab.title]?.filter(c => c.is_primary_key).map(c => c.name) || [])}
                        foreignKeys={new Set(tableSchemas[activeTab.title]?.filter(c => c.name.endsWith('_id') && c.name !== 'id').map(c => c.name) || [])}
                        onDeleteRow={onRowDelete}
                        onRecoverRow={onRecoverRow}
                    />
                </div>
            </div>
        </>
    );
};
