import React from 'react';
import styles from '../styles/MainLayout.module.css';
import { RefreshCw, Search, Plus, PanelLeftClose, PanelLeftOpen, Settings, Activity, ListPlus, Workflow } from 'lucide-react';
import { WindowControls } from './WindowControls';

interface NavbarProps {
    sidebarOpen: boolean;
    setSidebarOpen: (v: boolean) => void;
    showDbMenu: boolean;
    setShowDbMenu: (v: boolean) => void;
    setShowPreferences: (v: boolean) => void;
    handleAddTableTab: () => void;
    fetchTables: () => void;
    handleAddQuery: () => void;
    showChangelog: boolean;
    setShowChangelog: (v: boolean) => void;
    totalChanges: number;
    handleOpenLogs: () => void;
    handleOpenEditWindow: () => void;
    showEditWindow: boolean; // New prop for active state
    handleOpenSchema: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
    sidebarOpen,
    setSidebarOpen,
    showDbMenu,
    setShowDbMenu,
    setShowPreferences,
    handleAddTableTab,
    fetchTables,
    handleAddQuery,
    showChangelog,
    setShowChangelog,
    totalChanges,
    handleOpenLogs,
    handleOpenEditWindow,
    showEditWindow,
    handleOpenSchema
}) => {
    return (
        <div className={styles.navBar} data-tauri-drag-region>
            <div className={styles.navGroup}>
                {/* DB+ Menu */}
                <div style={{ position: 'relative' }}>
                    <div
                        onClick={() => setShowDbMenu(!showDbMenu)}
                        data-dropdown-trigger="true" // Mark as trigger
                        style={{
                            fontWeight: 900, fontSize: '1.2rem', marginRight: '1rem', color: 'var(--text-primary)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                            userSelect: 'none'
                        }}
                    >
                        <div style={{ background: 'var(--accent-primary)', color: '#fff', borderRadius: '4px', padding: '0 4px', pointerEvents: 'none' }}>DB</div>+
                    </div>
                    {showDbMenu && (
                        <div
                            className={styles.dropdownMenu}
                            data-dropdown="true" // Mark as dropdown content
                            style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', marginTop: '8px', boxShadow: 'var(--shadow-lg)', minWidth: '150px', padding: '0.4rem' }}
                        >
                            <div
                                className={styles.dropdownItem}
                                onClick={() => { setShowPreferences(true); setShowDbMenu(false); }}
                                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <Settings size={14} /> Preferences
                            </div>
                        </div>
                    )}
                </div>

                <button className={styles.iconBtn} onClick={handleAddTableTab} title="New Table"><Plus size={18} /></button>
                <button className={styles.iconBtn} onClick={fetchTables} title="Refresh Connection" style={{ color: 'var(--text-primary)' }}><RefreshCw size={18} /></button>
                <button className={styles.iconBtn} title="Search"><Search size={18} /></button>
                <button className={styles.iconBtn} onClick={() => setSidebarOpen(!sidebarOpen)} title={sidebarOpen ? "Hide Sidebar" : "Show Sidebar"}>
                    {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
                </button>
                <div className={styles.verticalDivider}></div>
                <button className={styles.outlineBtn} onClick={handleAddQuery} title="New SQL Query">SQL</button>
            </div>

            <div className={styles.navGroup} style={{ marginRight: '180px' }}>
                <button
                    className={`${styles.iconBtn} ${totalChanges > 0 ? styles.changesBtnPending : ''}`}
                    onClick={() => {
                        if (showChangelog) {
                            setShowChangelog(false);
                        } else {
                            if (showEditWindow) handleOpenEditWindow(); // Toggle/Close it
                            setShowChangelog(true);
                        }
                    }}
                    title="Pending Changes"
                    style={{
                        width: 'auto',
                        padding: '0.4rem 0.8rem',
                        gap: '0.6rem',
                        borderRadius: '6px',
                        backgroundColor: showChangelog ? 'var(--bg-tertiary)' : 'transparent',
                        border: '1px solid var(--border-color)'
                    }}
                >
                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Changes</span>
                    {totalChanges > 0 && <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>{totalChanges}</span>}
                    <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        backgroundColor: totalChanges > 0 ? '#f59e0b' : '#10b981',
                        opacity: 1
                    }} />
                </button>
                <div className={styles.verticalDivider}></div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <button className={styles.iconBtn} onClick={handleOpenLogs} title="Logs">
                        <Activity size={18} />
                    </button>
                    <button className={styles.iconBtn} onClick={handleOpenSchema} title="Schema">
                        <Workflow size={18} />
                    </button>
                    <button
                        className={styles.iconBtn}
                        onClick={handleOpenEditWindow}
                        title={showEditWindow ? "Close Edit Pane" : "Open Edit Pane"}
                        style={{
                            backgroundColor: showEditWindow ? 'var(--bg-tertiary)' : 'transparent',
                            color: showEditWindow ? 'var(--text-primary)' : 'var(--text-secondary)'
                        }}
                    >
                        <ListPlus size={18} />
                    </button>
                </div>

                <div className={styles.verticalDivider} style={{ margin: '0 1rem' }}></div>


            </div>
            <div style={{ position: 'absolute', top: 0, right: 0, height: '44px', zIndex: 50 }}>
                <WindowControls />
            </div>
        </div>
    );
};
