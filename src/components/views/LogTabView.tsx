import React, { useState } from 'react';
import { RiPulseLine, RiFileCopyLine, RiArrowDownSLine, RiDownloadLine, RiArrowLeftSLine, RiArrowRightSLine, RiEyeOffLine, RiEyeLine, RiRefreshLine } from 'react-icons/ri';
import styles from '../../styles/MainLayout.module.css';
import { DataGrid } from '../datagrid/DataGrid';
import { Tab, SystemLog, PaginationState } from '../../types/index';

interface LogTabViewProps {
    activeTab: Tab;
    logs: SystemLog[];
    paginationMap: Record<string, PaginationState>;
    setPaginationMap: React.Dispatch<React.SetStateAction<Record<string, PaginationState>>>;
    activeDropdown: 'copy' | 'export' | 'pageSize' | null;
    setActiveDropdown: (val: 'copy' | 'export' | 'pageSize' | null) => void;
    onCopy: (format: 'CSV' | 'JSON') => void;
    onExport: (format: 'CSV' | 'JSON') => void;
    onRefresh?: () => void;
}

export const LogTabView: React.FC<LogTabViewProps> = ({
    activeTab,
    logs,
    paginationMap,
    setPaginationMap,
    activeDropdown,
    setActiveDropdown,
    onCopy,
    onExport,
    onRefresh
}) => {
    const [hideSuccess, setHideSuccess] = useState(false);
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

    // Filter logs based on hideSuccess toggle
    const filteredLogs = hideSuccess ? logs.filter(l => l.status.toLowerCase() !== 'success') : logs;

    const pag = paginationMap[activeTab.id] || { page: 1, pageSize: 50, total: filteredLogs.length };
    // Update total based on filtered logs
    if (pag.total !== filteredLogs.length) pag.total = filteredLogs.length;

    const totalPages = Math.ceil(pag.total / pag.pageSize) || 1;

    const setPage = (p: number) => setPaginationMap(prev => ({ ...prev, [activeTab.id]: { ...pag, page: p } }));
    const setSize = (s: number) => setPaginationMap(prev => ({ ...prev, [activeTab.id]: { ...pag, pageSize: s, page: 1 } }));

    const start = (pag.page - 1) * pag.pageSize;
    const end = start + pag.pageSize;
    const paginatedLogs = filteredLogs.slice(start, end);

    return (
        <>
            <div className={styles.tableToolbar}>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <RiPulseLine size={16} />
                    {onRefresh && (
                        <button
                            className={styles.iconBtn}
                            onClick={onRefresh}
                            title="Refresh logs"
                        >
                            <RiRefreshLine size={14} />
                        </button>
                    )}
                </div>

                {/* Hide Success Toggle */}
                <button
                    className={styles.secondaryBtn}
                    onClick={() => setHideSuccess(!hideSuccess)}
                    style={{
                        marginLeft: '0.5rem',
                        backgroundColor: hideSuccess ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                        borderColor: hideSuccess ? '#ef4444' : undefined
                    }}
                    title={hideSuccess ? 'Show all logs' : 'Hide success logs'}
                >
                    {hideSuccess ? <RiEyeLine size={14} style={{ marginRight: 4 }} /> : <RiEyeOffLine size={14} style={{ marginRight: 4 }} />}
                    {hideSuccess ? 'Show All' : 'Hide Success'}
                </button>

                {/* Copy Dropdown */}
                <div style={{ position: 'relative', marginLeft: '0.5rem', display: 'inline-block' }}>
                    <button className={styles.secondaryBtn} onClick={() => setActiveDropdown(activeDropdown === 'copy' ? null : 'copy')}>
                        <RiFileCopyLine size={14} style={{ marginRight: 4 }} /> Copy <RiArrowDownSLine size={12} style={{ marginLeft: 2 }} />
                    </button>
                    {activeDropdown === 'copy' && (
                        <div className={styles.dropdownMenu} style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '4px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', minWidth: '100px' }}>
                            <div className={styles.dropdownItem} onClick={() => { onCopy('CSV'); setActiveDropdown(null); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem' }}>As CSV</div>
                            <div className={styles.dropdownItem} onClick={() => { onCopy('JSON'); setActiveDropdown(null); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem' }}>As JSON</div>
                        </div>
                    )}
                </div>
                {/* Export Dropdown */}
                <div style={{ position: 'relative', marginLeft: '0.5rem', display: 'inline-block' }}>
                    <button className={styles.secondaryBtn} onClick={() => setActiveDropdown(activeDropdown === 'export' ? null : 'export')}>
                        <RiDownloadLine size={14} style={{ marginRight: 4 }} /> Export <RiArrowDownSLine size={12} style={{ marginLeft: 2 }} />
                    </button>
                    {activeDropdown === 'export' && (
                        <div className={styles.dropdownMenu} style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '4px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', minWidth: '100px' }}>
                            <div className={styles.dropdownItem} onClick={() => { onExport('CSV'); setActiveDropdown(null); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem' }}>As CSV</div>
                            <div className={styles.dropdownItem} onClick={() => { onExport('JSON'); setActiveDropdown(null); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem' }}>As JSON</div>
                        </div>
                    )}
                </div>

                {/* Pagination Controls */}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                    <button className={styles.iconBtn} disabled={pag.page === 1} onClick={() => setPage(pag.page - 1)}><RiArrowLeftSLine size={16} /></button>
                    <span>Page {pag.page} of {totalPages}</span>
                    <button className={styles.iconBtn} disabled={pag.page === totalPages} onClick={() => setPage(pag.page + 1)}><RiArrowRightSLine size={16} /></button>

                    <div style={{ position: 'relative', marginLeft: '0.5rem' }}>
                        <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 6px' }} onClick={() => setActiveDropdown(activeDropdown === 'pageSize' ? null : 'pageSize')}>
                            {pag.pageSize} / page <RiArrowDownSLine size={12} style={{ marginLeft: 4 }} />
                        </div>
                        {activeDropdown === 'pageSize' && (
                            <div className={styles.dropdownMenu} style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: '4px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', minWidth: '80px', zIndex: 100 }}>
                                {[10, 20, 50, 100, 500].map(size => (
                                    <div key={size} className={styles.dropdownItem} onClick={() => { setSize(size); setActiveDropdown(null); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem', backgroundColor: pag.pageSize === size ? 'var(--bg-tertiary)' : 'transparent' }}>
                                        {size}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div style={{ minWidth: '80px', textAlign: 'right' }}>{pag.total} entries</div>
                </div>
            </div>
            <div style={{ flex: 1, padding: '1rem', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                    <DataGrid
                        data={{
                            columns: ['Time', 'Status', 'Table', 'Query', 'Error', 'User', 'Rows'],
                            rows: paginatedLogs.map(l => [l.time, l.status, l.table || '-', l.query, l.error || '', l.user || '', l.rows != null ? String(l.rows) : '-'])
                        }}
                        loading={false}
                        error={null}
                        selectedIndices={selectedIndices}
                        onSelectionChange={setSelectedIndices}
                        onSort={() => { }}
                    />
                </div>
            </div>
        </>
    );
};
