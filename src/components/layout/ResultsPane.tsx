
import React from 'react';
import { Icons } from '../../assets/icons';
import { DataGrid } from '../datagrid/DataGrid';
import { TabResult, PendingChange } from '../../types/index';
import styles from '../../styles/MainLayout.module.css';

interface ResultsPaneProps {
    activeTabId: string;
    activeTabType?: string;
    results: Record<string, TabResult>;
    resultsVisible: boolean;
    resultsHeight: number;
    isResizing: boolean;
    paginationMap: Record<string, { page: number, pageSize: number, total: number }>;

    // Actions
    toggleResults: () => void;
    startResizing: (e: React.MouseEvent) => void;
    onRefresh: () => void;
    onPageChange: (newPage: number) => void;
    onPageSizeChange: (newSize: number) => void;
    onSort: (column: string) => void;

    // Selection & Data Grid Props
    selectedIndices: Set<number>;
    setSelectedIndices: (action: Set<number> | ((prev: Set<number>) => Set<number>)) => void;

    // Dropdown state logic (passed down or managed here? Passed down for now to keep it dumb if possible, 
    // but Dropdowns logic is complex. Let's simplify and pass activeDropdown if needed, or keeping it internal to DataGrid if possible?)
    // Actually DataGrid handles most cell rendering. 
    // The Toolbar above DataGrid needs handlers.

    activeDropdown: 'copy' | 'export' | 'pageSize' | null;
    setActiveDropdown: (val: 'copy' | 'export' | 'pageSize' | null) => void;

    // For Editable DataGrid
    onUpdateValue?: (rowIndex: number, column: string, value: any) => void;
    pendingChanges?: Record<string, PendingChange[]>;

    // Export handlers
    onExport: (format: 'CSV' | 'JSON') => void;
    onCopy: (format: 'CSV' | 'JSON') => void;

    // Schema info
    primaryKeys?: Set<string>;
    foreignKeys?: Set<string>;
}

export const ResultsPane: React.FC<ResultsPaneProps> = ({
    activeTabId,
    activeTabType,
    results,
    resultsVisible,
    resultsHeight,
    isResizing,
    paginationMap,
    toggleResults,
    startResizing,
    onRefresh,
    onPageChange,
    onPageSizeChange,
    onSort,
    selectedIndices,
    setSelectedIndices,
    activeDropdown,
    setActiveDropdown,
    onUpdateValue,
    pendingChanges,
    onExport,
    onCopy,
    primaryKeys,
    foreignKeys
}) => {

    const currentResult = results[activeTabId];
    const pagination = paginationMap[activeTabId] || { page: 1, pageSize: 20, total: 0 };
    const totalPages = Math.ceil(pagination.total / pagination.pageSize);

    if (!activeTabId) return null;

    return (
        <div style={{
            height: resultsVisible ? resultsHeight : '32px',
            minHeight: resultsVisible ? '100px' : '32px',
            display: 'flex',
            flexDirection: 'column',
            borderTop: '1px solid var(--border-color)',
            transition: isResizing ? 'none' : 'height 0.2s ease',
            backgroundColor: 'var(--bg-secondary)',
            position: 'relative' // For resize handle positioning context
        }}>
            {/* Resize Handle */}
            {resultsVisible && (
                <div
                    onMouseDown={(e) => { e.preventDefault(); startResizing(e); }}
                    style={{
                        height: '4px',
                        cursor: 'ns-resize',
                        backgroundColor: 'transparent',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        zIndex: 10
                    }}
                />
            )}

            {/* Header / Toolbar */}
            <div
                className={styles.panelHeader}
                onDoubleClick={toggleResults}
                style={{ userSelect: 'none', padding: '0 0.5rem', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)' }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.8rem' }}>
                    <Icons.Table size={14} /> Query Results
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className={styles.iconBtn} onClick={(e) => { e.stopPropagation(); toggleResults(); }}>
                        {resultsVisible ? <Icons.ChevronDown size={14} /> : <Icons.ChevronUp size={14} />}
                    </button>
                </div>
            </div>

            {/* Content */}
            {resultsVisible && (
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {/* Multi-result View (if multiple result sets) */}
                    {(currentResult?.allData?.length ?? 0) > 1 ? (
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {currentResult!.allData!.map((res, idx) => (
                                <div key={idx} style={{ height: '300px', borderBottom: '2px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ padding: '4px 8px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: 'var(--bg-tertiary)' }}>Result {idx + 1}</div>
                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                        <DataGrid
                                            data={res}
                                            loading={false}
                                            error={null}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        // Single Result View
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                            {/* Toolbar (Pagination & Actions) */}
                            {/* Toolbar (Pagination & Actions) */}
                            {activeTabType === 'table' && (
                                <div className={styles.toolbar} style={{ padding: '0.25rem 0.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <button className={styles.toolbarBtn} onClick={onRefresh} title="Refresh">
                                        <Icons.RefreshCw size={14} />
                                    </button>
                                    <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-color)', margin: '0 4px' }} />

                                    {/* Pagination Controls */}
                                    <button
                                        className={styles.toolbarBtn}
                                        disabled={pagination.page <= 1}
                                        onClick={() => onPageChange(pagination.page - 1)}
                                    >
                                        <Icons.ChevronLeft size={14} />
                                    </button>
                                    <span style={{ fontSize: '0.8rem' }}>
                                        Page {pagination.page} of {Math.max(1, totalPages)}
                                    </span>
                                    <button
                                        className={styles.toolbarBtn}
                                        disabled={pagination.page >= totalPages}
                                        onClick={() => onPageChange(pagination.page + 1)}
                                    >
                                        <Icons.ChevronRight size={14} />
                                    </button>

                                    <div style={{ position: 'relative' }}>
                                        <button
                                            className={styles.toolbarBtn}
                                            onClick={() => setActiveDropdown(activeDropdown === 'pageSize' ? null : 'pageSize')}
                                            style={{ fontSize: '0.8rem', minWidth: '60px', justifyContent: 'space-between' }}
                                        >
                                            {pagination.pageSize} rows <Icons.ChevronDown size={12} />
                                        </button>
                                        {activeDropdown === 'pageSize' && (
                                            <div className={styles.dropdownMenu} style={{ bottom: '100%', top: 'auto', marginBottom: '4px' }}>
                                                {[20, 50, 100, 500, 1000].map(size => (
                                                    <div key={size} className={styles.dropdownItem} onClick={() => { onPageSizeChange(size); setActiveDropdown(null); }} style={{ color: 'var(--text-primary)' }}>
                                                        {size} rows
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ flex: 1 }} />

                                    {/* Export / Copy */}
                                    <div style={{ position: 'relative' }}>
                                        <button className={styles.toolbarBtn} onClick={() => setActiveDropdown(activeDropdown === 'copy' ? null : 'copy')}>
                                            <Icons.Copy size={14} /> Copy <Icons.ChevronDown size={12} />
                                        </button>
                                        {activeDropdown === 'copy' && (
                                            <div className={styles.dropdownMenu} style={{ bottom: '100%', top: 'auto', marginBottom: '4px', right: 0 }}>
                                                <div className={styles.dropdownItem} onClick={() => { onCopy('CSV'); setActiveDropdown(null); }}>Copy as CSV</div>
                                                <div className={styles.dropdownItem} onClick={() => { onCopy('JSON'); setActiveDropdown(null); }}>Copy as JSON</div>
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ position: 'relative' }}>
                                        <button className={styles.toolbarBtn} onClick={() => setActiveDropdown(activeDropdown === 'export' ? null : 'export')}>
                                            <Icons.Download size={14} /> Export <Icons.ChevronDown size={12} />
                                        </button>
                                        {activeDropdown === 'export' && (
                                            <div className={styles.dropdownMenu} style={{ bottom: '100%', top: 'auto', marginBottom: '4px', right: 0 }}>
                                                <div className={styles.dropdownItem} onClick={() => { onExport('CSV'); setActiveDropdown(null); }}>Export CSV</div>
                                                <div className={styles.dropdownItem} onClick={() => { onExport('JSON'); setActiveDropdown(null); }}>Export JSON</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* The Grid */}
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <DataGrid
                                    data={currentResult?.data || null}
                                    loading={currentResult?.loading || false}
                                    error={currentResult?.error || null}
                                    onSort={onSort}
                                    selectedIndices={selectedIndices}
                                    onSelectionChange={setSelectedIndices}
                                    onCellEdit={activeTabType === 'table' ? onUpdateValue : undefined}
                                    pendingChanges={activeTabType === 'table' && pendingChanges ? pendingChanges[activeTabId] : undefined}
                                    primaryKeys={primaryKeys}
                                    foreignKeys={foreignKeys}
                                />
                            </div>

                            {/* Status Footer */}
                            {/* Status Footer */}
                            {activeTabType === 'table' && (
                                <div className={styles.statusBar}>
                                    <div className={styles.statusItem}>
                                        <Icons.Activity size={12} />
                                        <span>{currentResult?.loading ? 'Executing...' : 'Ready'}</span>
                                    </div>
                                    <div className={styles.statusItem}>
                                        <span>{currentResult?.data?.rows?.length || 0} rows visible</span>
                                    </div>
                                    <div className={styles.statusItem}>
                                        <span>Total: {Number.isFinite(pagination.total) ? pagination.total : 0}</span>
                                    </div>
                                    {currentResult?.data?.duration_ms !== undefined && (
                                        <div className={styles.statusItem}>
                                            <span>Time: {currentResult.data.duration_ms}ms</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
