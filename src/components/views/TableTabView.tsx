import React from 'react';
import { Plus, Filter, Trash2, ChevronDown, Copy, Download, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import styles from '../../styles/MainLayout.module.css';
import { DataGrid } from '../DataGrid';
import { Tab, TableDataState, PendingChange, PaginationState, ColumnSchema } from '../../types';

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
    const pag = paginationMap[activeTab.id] || { page: 1, pageSize: 50, total: 0 };
    const totalPages = Math.ceil(pag.total / pag.pageSize) || 1;

    return (
        <>
            <div className={styles.tableToolbar}>
                <button className={styles.outlineBtn} onClick={onInsertRow} style={{ border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', backgroundColor: 'transparent' }}>
                    <Plus size={14} /> Insert
                </button>

                <button className={styles.toolbarBtn} onClick={onRefresh} title="Refresh">
                    <RefreshCw size={14} />
                </button>
                <div className={styles.verticalDivider} style={{ height: 16 }}></div>
                <button className={styles.toolbarBtn} title="Filter"><Filter size={14} /></button>

                {selectedIndices.size > 0 && (
                    <>
                        <button className={styles.outlineBtn} onClick={onDeleteRows} style={{ border: '1px solid #ef4444', color: '#ef4444', backgroundColor: 'transparent', marginRight: '0.5rem' }}>
                            <Trash2 size={14} style={{ marginRight: 4 }} /> Delete ({selectedIndices.size})
                        </button>

                        {/* Copy Dropdown */}
                        <div style={{ position: 'relative', display: 'inline-block', marginRight: '0.5rem' }}>
                            <button className={styles.secondaryBtn} onClick={() => setActiveDropdown(activeDropdown === 'copy' ? null : 'copy')}>
                                <Copy size={14} style={{ marginRight: 4 }} /> Copy <ChevronDown size={12} style={{ marginLeft: 2 }} />
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
                                <Download size={14} style={{ marginRight: 4 }} /> Export <ChevronDown size={12} style={{ marginLeft: 2 }} />
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
                            <ChevronLeft size={16} />
                        </button>
                        <span style={{ minWidth: '60px', textAlign: 'center' }}>{pag.page} of {totalPages}</span>
                        <button
                            className={styles.iconBtn}
                            disabled={pag.page >= totalPages}
                            onClick={() => onPageChange(pag.page + 1)}
                            style={{ opacity: pag.page >= totalPages ? 0.3 : 1 }}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    <div style={{ position: 'relative' }}>
                        <button
                            className={styles.secondaryBtn}
                            onClick={() => setActiveDropdown(activeDropdown === 'pageSize' ? null : 'pageSize')}
                        >
                            {pag.pageSize} rows <ChevronDown size={12} style={{ marginLeft: 4 }} />
                        </button>
                        {activeDropdown === 'pageSize' && (
                            <div className={styles.dropdownMenu} style={{ position: 'absolute', top: '100%', right: 0, zIndex: 100, backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '4px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', minWidth: '80px' }}>
                                {[20, 50, 100, 200].map(size => (
                                    <div
                                        key={size}
                                        className={styles.dropdownItem}
                                        onClick={() => {
                                            setActiveDropdown(null);
                                            onPageSizeChange(size);
                                        }}
                                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem', backgroundColor: pag.pageSize === size ? 'var(--bg-tertiary)' : 'transparent' }}
                                    >
                                        {size}
                                    </div>
                                ))}
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
                        primaryKeys={new Set(tableSchemas[activeTab.title]?.filter(c => c.column_key === 'PRI').map(c => c.name) || [])}
                        onDeleteRow={onRowDelete}
                        onRecoverRow={onRecoverRow}
                    />
                </div>
            </div>
        </>
    );
};
