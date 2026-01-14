import React, { useState, useEffect, useRef } from 'react';
import styles from '../../styles/MainLayout.module.css';
import { Icons } from '../../assets/icons';
import { WindowControls } from './WindowControls';
import { Portal } from '../common/Portal';
import { Connection } from '../../types';

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
    showEditWindow: boolean;
    handleOpenSchema: () => void;
    connection: Connection;
    savedConnections: Connection[];
    onSwitchConnection: (conn: Connection) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    enableChangeLog: boolean;
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
    handleOpenSchema,
    connection,
    savedConnections,
    onSwitchConnection,
    searchQuery,
    onSearchChange,
    enableChangeLog
}) => {
    const [showConnectionMenu, setShowConnectionMenu] = useState(false);
    const [isSearchActive, setIsSearchActive] = useState(false);

    // Close connection menu on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (showConnectionMenu && !target.closest('[data-connection-dropdown]') && !target.closest('[data-connection-trigger]')) {
                setShowConnectionMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showConnectionMenu]);

    // DB Dropdown Logic
    const dbButtonRef = useRef<HTMLDivElement>(null);
    const [dbDropdownPos, setDbDropdownPos] = useState({ top: 0, left: 0 });

    const handleDbClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!showDbMenu && dbButtonRef.current) {
            const rect = dbButtonRef.current.getBoundingClientRect();
            setDbDropdownPos({
                top: rect.bottom + 5,
                left: rect.left
            });
            setShowDbMenu(true);
        } else {
            setShowDbMenu(false);
        }
    };

    const handleSearchClick = () => {
        if (!isSearchActive) {
            setIsSearchActive(true);
            // Focus the input after render
            setTimeout(() => {
                const input = document.getElementById('navbar-search-input');
                input?.focus();
            }, 0);
        } else {
            setIsSearchActive(false);
            onSearchChange('');
        }
    };

    return (
        <div className={styles.navBar} data-tauri-drag-region style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            {/* LEFT SECTION - DB+, Connection, Refresh, Search, Sidebar, Divider, SQL, + */}
            {/* LEFT SECTION - DB+, Connection, Refresh, Search, Sidebar, Divider, SQL, + */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 1, minWidth: 0, overflow: 'hidden' }}>
                <div className={styles.sidebarHeaderStub} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {/* LEFT: DB+ Menu */}
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        {!isSearchActive && (
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                <div
                                    ref={dbButtonRef}
                                    onClick={handleDbClick}
                                    data-dropdown-trigger="true"
                                    style={{
                                        fontWeight: 900, fontSize: '1.2rem', color: 'var(--text-primary)',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                                        userSelect: 'none'
                                    }}
                                >
                                    <div style={{ background: 'var(--accent-primary)', color: '#fff', borderRadius: '4px', padding: '0 4px', pointerEvents: 'none' }}>DB</div>+
                                </div>
                                {showDbMenu && (
                                    <Portal>
                                        {/* Backdrop */}
                                        <div
                                            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998 }}
                                            onClick={() => setShowDbMenu(false)}
                                            onContextMenu={(e) => { e.preventDefault(); setShowDbMenu(false); }}
                                        />
                                        <div
                                            className={styles.dropdownMenu}
                                            data-dropdown="true"
                                            style={{
                                                position: 'fixed',
                                                top: dbDropdownPos.top,
                                                left: dbDropdownPos.left,
                                                zIndex: 9999,
                                                backgroundColor: 'var(--bg-secondary)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: '6px',
                                                boxShadow: 'var(--shadow-lg)',
                                                minWidth: '150px',
                                                padding: '0.4rem',
                                                userSelect: 'none'
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <div
                                                className={styles.dropdownItem}
                                                onClick={() => { setShowPreferences(true); setShowDbMenu(false); }}
                                                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                                            >
                                                <Icons.Settings size={14} /> Preferences
                                            </div>
                                        </div>
                                    </Portal>
                                )}
                            </div>
                        )}
                    </div>

                    {/* RIGHT: Connection, Refresh, Search, Sidebar Toggle, Divider */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {/* Connection Switcher */}
                        {!isSearchActive && (
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                <button
                                    className={styles.iconBtn}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowConnectionMenu(!showConnectionMenu);
                                    }}
                                    data-connection-trigger
                                    title="Switch Connection"
                                    id="connection-switcher-btn"
                                    style={{
                                        width: '58px',
                                        height: '32px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '6px',
                                        padding: '4px 8px 4px 4px',
                                        borderRadius: '6px'
                                    }}
                                >
                                    <div style={{
                                        width: '24px',
                                        height: '24px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: 'var(--bg-tertiary)',
                                        borderRadius: '4px',
                                        flexShrink: 0
                                    }}>
                                        <Icons.Database size={14} />
                                    </div>
                                    <Icons.ChevronDown size={12} style={{ opacity: 0.7 }} />
                                </button>

                                {showConnectionMenu && (
                                    <div
                                        data-connection-dropdown
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                            position: 'fixed',
                                            top: '44px',
                                            left: 'auto',
                                            marginTop: '4px',
                                            zIndex: 99999,
                                            backgroundColor: 'var(--bg-secondary)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '6px',
                                            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                                            minWidth: '220px',
                                            padding: '0.4rem',
                                            userSelect: 'none',
                                            maxHeight: '300px',
                                            overflowY: 'auto'
                                        }}
                                    >
                                        {savedConnections.length === 0 ? (
                                            <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                                                No saved connections
                                            </div>
                                        ) : (
                                            savedConnections.map(conn => (
                                                <div
                                                    key={conn.id}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onSwitchConnection(conn);
                                                        setShowConnectionMenu(false);
                                                    }}
                                                    style={{
                                                        padding: '8px 12px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.9rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        gap: '8px',
                                                        borderRadius: '4px',
                                                        backgroundColor: conn.id === connection.id ? 'var(--bg-tertiary)' : 'transparent',
                                                        transition: 'background-color 0.15s ease'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        if (conn.id !== connection.id) {
                                                            e.currentTarget.style.backgroundColor = 'transparent';
                                                        }
                                                    }}
                                                >
                                                    <span>{conn.name}</span>
                                                    {conn.id === connection.id && <Icons.Check size={14} />}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Refresh Button */}
                        {!isSearchActive && (
                            <button className={styles.iconBtn} onClick={fetchTables} title="Refresh Connection" style={{ flexShrink: 0 }}>
                                <Icons.RefreshCw size={16} />
                            </button>
                        )}

                        {/* Search */}
                        {isSearchActive ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0, flex: 1 }}>
                                <input
                                    id="navbar-search-input"
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => onSearchChange(e.target.value)}
                                    placeholder="Search..."
                                    style={{
                                        width: '100%',
                                        padding: '0.25rem 0.5rem',
                                        fontSize: '0.85rem',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '4px',
                                        backgroundColor: 'var(--bg-tertiary)',
                                        color: 'var(--text-primary)',
                                        outline: 'none'
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape') {
                                            handleSearchClick();
                                        }
                                    }}
                                />
                                <button className={styles.iconBtn} onClick={handleSearchClick} title="Close Search">
                                    <Icons.X size={16} />
                                </button>
                            </div>
                        ) : (
                            <button className={styles.iconBtn} onClick={handleSearchClick} title="Search" style={{ flexShrink: 0 }}>
                                <Icons.Search size={16} />
                            </button>
                        )}

                        {/* Sidebar Toggle */}
                        <button className={styles.iconBtn} onClick={() => setSidebarOpen(!sidebarOpen)} title={sidebarOpen ? "Hide Sidebar" : "Show Sidebar"} style={{ flexShrink: 0 }}>
                            {sidebarOpen ? <Icons.SidebarClose size={16} /> : <Icons.SidebarOpen size={16} />}
                        </button>

                        {/* Divider */}
                        <div className={styles.verticalDivider} style={{ flexShrink: 0, margin: '0' }}></div>
                    </div>
                </div>

                {/* SQL and + buttons */}
                <button className={styles.outlineBtn} onClick={handleAddQuery} title="New SQL Query" style={{ flexShrink: 0, marginLeft: '0.5rem' }}>SQL</button>
                <button
                    className={styles.outlineBtn}
                    onClick={handleAddTableTab}
                    title="New Table"
                    style={{ width: '26px', height: '26px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                >
                    <Icons.Plus size={14} />
                </button>
            </div>

            {/* CENTER SECTION - Connection Name (can shrink) */}
            <div
                style={{
                    flex: 1,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minWidth: 0,
                    overflow: 'hidden'
                }}
                data-tauri-drag-region
            >
                <span
                    style={{
                        fontSize: '0.9rem',
                        fontWeight: 400,
                        color: 'var(--text-secondary)',
                        opacity: 0.7,
                        userSelect: 'none',
                        pointerEvents: 'none',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}
                >
                    {connection.name}
                </span>
            </div>

            {/* RIGHT SECTION - Changes, Logs, Schema, Edit, Window Controls */}
            <div style={{ display: 'flex', alignItems: 'center', height: '100%', flexShrink: 0 }}>
                {enableChangeLog && (
                    <button
                        className={`${styles.iconBtn} ${totalChanges > 0 ? styles.changesBtnPending : ''}`}
                        onClick={() => {
                            if (showChangelog) {
                                // Just close changelog
                                setShowChangelog(false);
                            } else {
                                // Close edit pane first, then open changelog
                                if (showEditWindow) {
                                    handleOpenEditWindow();
                                }
                                setShowChangelog(true);
                            }
                        }}
                        title="Pending Changes"
                        style={{
                            width: 'auto',
                            padding: '0.25rem 0.6rem',
                            gap: '0.5rem',
                            borderRadius: '6px',
                            backgroundColor: showChangelog ? 'var(--bg-tertiary)' : 'transparent',
                            border: '1px solid var(--border-color)',
                            flexShrink: 0,
                            marginRight: '0.5rem',
                            height: '28px'
                        }}
                    >
                        <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Changes</span>
                        {totalChanges > 0 && <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>{totalChanges}</span>}
                        <div style={{
                            width: 6, height: 6, borderRadius: '50%',
                            backgroundColor: totalChanges > 0 ? '#f59e0b' : '#10b981',
                            opacity: 1
                        }} />
                    </button>
                )}
                <div className={styles.verticalDivider} style={{ marginRight: 0 }}></div>
                <div style={{ display: 'flex', alignItems: 'center', height: '100%', flexShrink: 0, gap: '0.5rem', padding: '0 0.25rem' }}>
                    <button className={styles.iconBtn} onClick={handleOpenLogs} title="Logs">
                        <Icons.Activity size={16} />
                    </button>
                    <button className={styles.iconBtn} onClick={handleOpenSchema} title="Schema">
                        <Icons.Schema size={16} />
                    </button>
                    <button
                        className={styles.iconBtn}
                        onClick={() => {
                            if (showEditWindow) {
                                // Just close the edit pane
                                handleOpenEditWindow();
                            } else {
                                // Close changelog first, then open edit pane
                                if (showChangelog) {
                                    setShowChangelog(false);
                                }
                                handleOpenEditWindow();
                            }
                        }}
                        title={showEditWindow ? "Close Edit Pane" : "Open Edit Pane"}
                        style={{
                            backgroundColor: showEditWindow ? 'var(--bg-tertiary)' : 'transparent'
                        }}
                    >
                        <Icons.ListPlus size={16} />
                    </button>
                </div>
                <div className={styles.verticalDivider} style={{ margin: 0 }}></div>
                <WindowControls />
            </div>
        </div>
    );
};
