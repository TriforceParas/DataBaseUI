import React, { useState } from 'react';
import { PendingChange } from '../types';
import { X, Check, Trash2, Undo2 } from 'lucide-react';
import styles from '../styles/MainLayout.module.css';

interface ChangelogSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    changes: Record<string, PendingChange[]>; // Keyed by Tab ID
    tabs: { id: string; title: string, type: string }[];
    onConfirm: () => void;
    onDiscard: () => void;
    onRevert: (tabId: string, idx: number) => void;
}

export const ChangelogSidebar: React.FC<ChangelogSidebarProps> = ({
    isOpen,
    onClose,
    changes,
    tabs,
    onConfirm,
    onDiscard,
    onRevert
}) => {
    const [viewMode, setViewMode] = useState<'visual' | 'sql'>('visual');

    if (!isOpen) return null;

    const totalChanges = Object.values(changes).reduce((acc, curr) => acc + curr.length, 0);

    return (
        <div style={{
            position: 'fixed',
            top: 50, // Below Navbar
            right: 0,
            bottom: 0,
            width: '400px', // Wider for code view
            backgroundColor: 'var(--bg-secondary)',
            borderLeft: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 100,
            boxShadow: '-4px 0 15px rgba(0,0,0,0.3)'
        }}>
            <div className={styles.panelHeader} style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>Pending Changes ({totalChanges})</span>
                <button onClick={onClose} className={styles.iconBtn}><X size={18} /></button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', padding: '1rem 1rem 0 1rem', gap: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                <button
                    onClick={() => setViewMode('visual')}
                    style={{
                        padding: '0.5rem 1rem',
                        borderBottom: viewMode === 'visual' ? '2px solid var(--accent-color)' : '2px solid transparent',
                        color: viewMode === 'visual' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontWeight: 500
                    }}
                >
                    Visual
                </button>
                <button
                    onClick={() => setViewMode('sql')}
                    style={{
                        padding: '0.5rem 1rem',
                        borderBottom: viewMode === 'sql' ? '2px solid var(--accent-color)' : '2px solid transparent',
                        color: viewMode === 'sql' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontWeight: 500
                    }}
                >
                    SQL
                </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', backgroundColor: 'var(--bg-primary)' }}>
                {totalChanges === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem' }}>
                        No pending changes.
                    </div>
                ) : viewMode === 'visual' ? (
                    Object.entries(changes).map(([tabId, tabChanges]) => {
                        if (tabChanges.length === 0) return null;
                        const tab = tabs.find(t => t.id === tabId);
                        const tableName = tab ? tab.title : 'Unknown Table';

                        return (
                            <div key={tabId}>
                                {tabChanges.map((change, idx) => {
                                    const isUpdate = change.type === 'UPDATE';
                                    const updateColor = '#f59e0b'; // Orange
                                    const deleteColor = '#ff4d4d'; // Red

                                    return (
                                        <div key={idx} style={{
                                            backgroundColor: 'var(--bg-secondary)',
                                            borderRadius: '8px',
                                            padding: '1rem',
                                            marginBottom: '1rem',
                                            border: '1px solid var(--border-color)',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.8rem', color: 'var(--text-secondary)', fontSize: '0.8rem', justifyContent: 'space-between' }}>
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                    <span style={{
                                                        backgroundColor: isUpdate ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 77, 77, 0.2)',
                                                        color: isUpdate ? updateColor : deleteColor,
                                                        borderRadius: '4px',
                                                        width: 20, height: 20,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontWeight: 700, marginRight: '0.5rem',
                                                        fontSize: '0.7rem'
                                                    }}>
                                                        {isUpdate ? 'U' : 'D'}
                                                    </span>
                                                    <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>
                                                        {tableName} <span style={{ opacity: 0.5 }}>&gt;</span> row {change.rowIndex}
                                                        {isUpdate && <> <span style={{ opacity: 0.5 }}>&gt;</span> {change.column}</>}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => onRevert(tabId, idx)}
                                                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', opacity: 0.5 }}
                                                    title="Undo"
                                                >
                                                    <Undo2 size={14} />
                                                </button>
                                            </div>

                                            <div style={{ fontSize: '0.85rem' }}>
                                                <div style={{
                                                    backgroundColor: 'rgba(255, 77, 77, 0.1)',
                                                    color: '#ff6b6b',
                                                    padding: '0.5rem',
                                                    borderRadius: '4px',
                                                    marginBottom: '4px',
                                                    fontFamily: 'monospace',
                                                    display: 'flex',
                                                    borderLeft: '2px solid #ff4d4d'
                                                }}>
                                                    <span style={{ marginRight: '0.5rem', opacity: 0.6 }}>-</span>
                                                    {isUpdate ? String(change.oldValue) : 'Deleted Row'}
                                                </div>
                                                {isUpdate && (
                                                    <div style={{
                                                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                                        color: '#34d399',
                                                        padding: '0.5rem',
                                                        borderRadius: '4px',
                                                        fontFamily: 'monospace',
                                                        display: 'flex',
                                                        borderLeft: '2px solid #10b981'
                                                    }}>
                                                        <span style={{ marginRight: '0.5rem', opacity: 0.6 }}>+</span>
                                                        {String(change.newValue)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })
                ) : (
                    <div style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                        {/* SQL preview */}
                        <div style={{ color: 'var(--accent-color)', marginBottom: '1rem' }}>-- Generated SQL Preview</div>
                        {Object.entries(changes).flatMap(([_, list]) => list.map(c => c.generatedSql || '-- No SQL generated')).map((sql, i) => (
                            <div key={i} style={{ marginBottom: '0.5rem' }}>{sql}</div>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                <button
                    className={styles.primaryBtn}
                    style={{ width: '100%', justifyContent: 'center', marginBottom: '0.5rem' }}
                    onClick={onConfirm}
                    disabled={totalChanges === 0}
                >
                    <Check size={16} style={{ marginRight: 6 }} /> Confirm Changes
                </button>
                <button
                    className={styles.secondaryBtn}
                    style={{ width: '100%', justifyContent: 'center', color: '#ff4d4d', borderColor: '#ff4d4d' }}
                    onClick={onDiscard}
                    disabled={totalChanges === 0}
                >
                    <Trash2 size={16} style={{ marginRight: 6 }} /> Discard All
                </button>
            </div>
        </div>
    );
};

