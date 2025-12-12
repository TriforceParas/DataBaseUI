import React from 'react';
import { PendingChange } from '../types';
import { X, Check, Trash2, Edit3 } from 'lucide-react';
import styles from '../styles/MainLayout.module.css';

interface ChangelogSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    changes: Record<string, PendingChange[]>; // Keyed by Tab ID
    tabs: { id: string; title: string, type: string }[];
    onConfirm: () => void;
    onDiscard: () => void;
}

export const ChangelogSidebar: React.FC<ChangelogSidebarProps> = ({
    isOpen,
    onClose,
    changes,
    tabs,
    onConfirm,
    onDiscard
}) => {
    if (!isOpen) return null;

    const totalChanges = Object.values(changes).reduce((acc, curr) => acc + curr.length, 0);

    return (
        <div style={{
            position: 'fixed',
            top: 50, // Below Navbar
            right: 0,
            bottom: 0,
            width: '350px',
            backgroundColor: 'var(--bg-secondary)',
            borderLeft: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 100,
            boxShadow: '-4px 0 15px rgba(0,0,0,0.1)'
        }}>
            <div className={styles.panelHeader} style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>Changelog ({totalChanges})</span>
                <button onClick={onClose} className={styles.iconBtn}><X size={18} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                {totalChanges === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem' }}>
                        No pending changes.
                    </div>
                ) : (
                    Object.entries(changes).map(([tabId, tabChanges]) => {
                        if (tabChanges.length === 0) return null;
                        const tab = tabs.find(t => t.id === tabId);
                        const tableName = tab ? tab.title : 'Unknown Table';

                        return (
                            <div key={tabId} style={{ marginBottom: '1.5rem' }}>
                                <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                                    {tableName}
                                </div>
                                {tabChanges.map((change, idx) => (
                                    <div key={idx} style={{
                                        padding: '0.5rem',
                                        backgroundColor: 'var(--bg-primary)',
                                        borderRadius: '4px',
                                        marginBottom: '0.5rem',
                                        borderLeft: `3px solid ${change.type === 'DELETE' ? '#ff4d4d' : '#f59e0b'}`,
                                        fontSize: '0.85rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                                            {change.type === 'DELETE' && <Trash2 size={12} style={{ marginRight: 6, color: '#ff4d4d' }} />}
                                            {change.type === 'UPDATE' && <Edit3 size={12} style={{ marginRight: 6, color: '#f59e0b' }} />}
                                            <span style={{ fontWeight: 500, color: change.type === 'DELETE' ? '#ff4d4d' : '#f59e0b' }}>
                                                {change.type === 'DELETE' ? 'Row Deleted' : 'Cell Updated'}
                                            </span>
                                        </div>
                                        {change.type === 'DELETE' && (
                                            <div style={{ color: 'var(--text-secondary)' }}>Row Index: {change.rowIndex + 1}</div>
                                        )}
                                        {change.type === 'UPDATE' && (
                                            <div>
                                                <div style={{ color: 'var(--text-secondary)' }}>Column: {change.column}</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                                    <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{String(change.oldValue)}</span>
                                                    <span>→</span>
                                                    <span style={{ color: 'var(--accent-color)' }}>{String(change.newValue)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        );
                    })
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
