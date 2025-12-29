import React, { useState, useEffect } from 'react';
import styles from '../../styles/MainLayout.module.css';
import { Icons } from '../../assets/icons';
import { WindowControls } from './WindowControls';
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
    onSearchChange
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
        <div className={styles.navBar} data-tauri-drag-region>
            {/* DB+ Menu - Leftmost position in navbar */}
            {!isSearchActive && (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                        <div
                            onClick={() => setShowDbMenu(!showDbMenu)}
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
                            <div
                                className={styles.dropdownMenu}
                                data-dropdown="true"
                                style={{ position: 'absolute', top: '100%', left: 0, zIndex: 9999, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', marginTop: '8px', boxShadow: 'var(--shadow-lg)', minWidth: '150px', padding: '0.4rem', userSelect: 'none' }}
                            >
                                <div
                                    className={styles.dropdownItem}
                                    onClick={() => { setShowPreferences(true); setShowDbMenu(false); }}
                                    style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                                >
                                    <Icons.Settings size={14} /> Preferences
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Icons aligned to LEFT of the divider (right side of sidebar area) */}
            <div style={{ 
                position: 'absolute', 
                left: '275px', 
                transform: 'translateX(-100%)',
                display: 'flex', 
                alignItems: 'center', 
                gap: '2px',
                paddingRight: '8px'
            }}>
                {/* When search is NOT active, show connection, refresh */}
                {!isSearchActive && (
                    <>
                        {/* Connection Switcher */}
                        <div style={{ position: 'relative' }}>
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
                                    width: '42px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '2px',
                                    padding: '0 6px'
                                }}
                            >
                                <Icons.Database size={16} />
                                <Icons.ChevronDown size={10} />
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

                        <button className={styles.iconBtn} onClick={fetchTables} title="Refresh Connection"><Icons.RefreshCw size={16} /></button>
                    </>
                )}
                
                {/* Search Bar */}
                {isSearchActive ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1 }}>
                        <input
                            id="navbar-search-input"
                            type="text"
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder="Search tables, queries, functions..."
                            style={{
                                flex: 1,
                                minWidth: '180px',
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
                    <button className={styles.iconBtn} onClick={handleSearchClick} title="Search">
                        <Icons.Search size={16} />
                    </button>
                )}

                <button className={styles.iconBtn} onClick={() => setSidebarOpen(!sidebarOpen)} title={sidebarOpen ? "Hide Sidebar" : "Show Sidebar"}>
                    {sidebarOpen ? <Icons.SidebarClose size={16} /> : <Icons.SidebarOpen size={16} />}
                </button>
            </div>
            
            {/* Divider aligned with sidebar edge */}
            <div className={styles.verticalDivider} style={{ position: 'absolute', left: '275px', zIndex: 10 }}></div>
            
            {/* SQL and + buttons - aligned left after the divider */}
            <div style={{ 
                position: 'absolute', 
                left: '283px',
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                zIndex: 10 
            }}>
                <button className={styles.outlineBtn} onClick={handleAddQuery} title="New SQL Query">SQL</button>
                <button 
                    className={styles.outlineBtn} 
                    onClick={handleAddTableTab} 
                    title="New Table"
                    style={{ width: '26px', height: '26px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    <Icons.Plus size={14} />
                </button>
            </div>

            {/* Connection Name in Center */}
            <div 
                style={{ 
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: '0.9rem',
                    fontWeight: 400,
                    color: 'var(--text-secondary)',
                    opacity: 0.7,
                    userSelect: 'none',
                    pointerEvents: 'none',
                    zIndex: 1
                }}
                data-tauri-drag-region
            >
                {connection.name}
            </div>

            {/* Right side buttons - Changes, Logs, Schema, Edit */}
            <div 
                style={{ 
                    position: 'absolute',
                    right: '150px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    zIndex: 10
                }}
            >
                <button
                    className={`${styles.iconBtn} ${totalChanges > 0 ? styles.changesBtnPending : ''}`}
                    onClick={() => {
                        if (showChangelog) {
                            setShowChangelog(false);
                        } else {
                            if (showEditWindow) handleOpenEditWindow();
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
                        border: '1px solid var(--border-color)'
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
                <div className={styles.verticalDivider}></div>
                <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                    <button className={styles.iconBtn} onClick={handleOpenLogs} title="Logs">
                        <Icons.Activity size={16} />
                    </button>
                    <button className={styles.iconBtn} onClick={handleOpenSchema} title="Schema">
                        <Icons.Schema size={16} />
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
                        <Icons.ListPlus size={16} />
                    </button>
                </div>
                <div className={styles.verticalDivider}></div>
            </div>
            
            <div style={{ position: 'absolute', top: 0, right: 0, height: '44px', zIndex: 50 }}>
                <WindowControls />
            </div>
        </div>
    );
};

