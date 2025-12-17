import React, { useState } from 'react';
import { PendingChange } from '../types';
import { Check, Trash2, Undo2 } from 'lucide-react';
import styles from '../styles/MainLayout.module.css';

interface ChangelogSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    changes: Record<string, PendingChange[]>; // Keyed by Tab ID
    tabs: { id: string; title: string, type: string }[];
    onConfirm: () => void;
    onDiscard: () => void;
    onRevert: (tabId: string, idx: number) => void;
    onNavigate: (tabId: string, rowIndex: number) => void;
}

export const ChangelogSidebar: React.FC<ChangelogSidebarProps> = ({
    isOpen,
    onClose,
    changes,
    tabs,
    onConfirm,
    onDiscard,
    onRevert,
    onNavigate
}) => {
    const [viewMode, setViewMode] = useState<'visual' | 'sql'>('visual');

    const totalChanges = Object.values(changes).reduce((acc, curr) => acc + curr.length, 0);

    // Close on Escape
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    return (
        <div style={{
            // Removed fixed positioning for layout shift
            width: isOpen ? '400px' : '0',
            height: '100%',
            backgroundColor: 'var(--bg-secondary)',
            borderLeft: isOpen ? '1px solid var(--border-color)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 100,
            boxShadow: isOpen ? '-4px 0 15px rgba(0,0,0,0.1)' : 'none',
            transition: 'width 0.3s ease',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            flexShrink: 0
        }}>
            {/* Tabs / Toggle (Replaces Header) */}
            <div style={{
                padding: '0 1rem',
                borderBottom: '1px solid var(--border-color)',
                height: '40px',
                display: 'flex',
                alignItems: 'center'
            }}>
                <div className={styles.filterToggle} style={{ width: 'fit-content' }}>
                    <button
                        className={viewMode === 'visual' ? styles.filterBtnActive : styles.filterBtn}
                        onClick={() => setViewMode('visual')}
                    >
                        Visual
                    </button>
                    <button
                        className={viewMode === 'sql' ? styles.filterBtnActive : styles.filterBtn}
                        onClick={() => setViewMode('sql')}
                    >
                        SQL
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', backgroundColor: 'var(--bg-primary)' }}>
                {totalChanges === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem', fontStyle: 'italic', fontSize: '0.9rem' }}>
                        No pending changes
                    </div>
                ) : viewMode === 'visual' ? (
                    Object.entries(changes).map(([tabId, tabChanges]) => {
                        if (tabChanges.length === 0) return null;

                        // FIX: Use tableName from the changes themselves if available, fallback to tab title
                        const tableName = tabChanges[0]?.tableName || tabs.find(t => t.id === tabId)?.title || 'Unknown Table';

                        return (
                            <div key={tabId}>
                                {tabChanges.map((change, idx) => {
                                    const isUpdate = change.type === 'UPDATE';
                                    const updateColor = '#f59e0b'; // Orange
                                    const deleteColor = '#ff4d4d'; // Red

                                    return (
                                        <div key={idx}
                                            onClick={() => onNavigate(tabId, change.rowIndex)}
                                            style={{
                                                backgroundColor: 'var(--bg-secondary)',
                                                borderRadius: '6px',
                                                padding: '0.75rem',
                                                marginBottom: '0.75rem',
                                                border: '1px solid var(--border-color)',
                                                cursor: 'pointer',
                                                transition: 'background-color 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem', justifyContent: 'space-between' }}>
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                    <span style={{
                                                        backgroundColor: isUpdate ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 77, 77, 0.2)',
                                                        color: isUpdate ? updateColor : deleteColor,
                                                        borderRadius: '3px',
                                                        width: 18, height: 18,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontWeight: 700, marginRight: '0.5rem',
                                                        fontSize: '0.65rem'
                                                    }}>
                                                        {isUpdate ? 'U' : 'D'}
                                                    </span>
                                                    <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>
                                                        {tableName}
                                                    </span>
                                                    <span style={{ marginLeft: '0.5rem', opacity: 0.7 }}>
                                                        Row {change.rowIndex + 1}
                                                    </span>
                                                    {change.column && (
                                                        <span style={{ marginLeft: '0.5rem', opacity: 0.7, fontStyle: 'italic' }}>
                                                            ({change.column})
                                                        </span>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onRevert(tabId, idx); }}
                                                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', opacity: 0.6 }}
                                                    title="Undo"
                                                >
                                                    <Undo2 size={14} />
                                                </button>
                                            </div>

                                            <div style={{ fontSize: '0.85rem' }}>
                                                <div style={{
                                                    color: '#ff6b6b',
                                                    marginBottom: '4px',
                                                    fontFamily: 'monospace',
                                                    display: 'flex',
                                                    alignItems: 'center'
                                                }}>
                                                    <span style={{ marginRight: '0.5rem', opacity: 0.6, width: '10px', display: 'inline-block' }}>-</span>
                                                    <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{isUpdate ? String(change.oldValue) : 'Deleted Row'}</span>
                                                </div>
                                                {isUpdate && (
                                                    <div style={{
                                                        color: '#34d399',
                                                        fontFamily: 'monospace',
                                                        display: 'flex',
                                                        alignItems: 'center'
                                                    }}>
                                                        <span style={{ marginRight: '0.5rem', opacity: 0.6, width: '10px', display: 'inline-block' }}>+</span>
                                                        <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{String(change.newValue)}</span>
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
                    <div style={{ padding: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                        <div style={{ color: 'var(--accent-color)', marginBottom: '1rem', fontStyle: 'italic' }}>-- Generated SQL Preview</div>
                        {Object.entries(changes).flatMap(([_, list]) => list.map(c => c.generatedSql || '-- No SQL generated')).map((sql, i) => (
                            <div key={i} style={{ marginBottom: '0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{sql}</div>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', display: 'flex', gap: '0.5rem' }}>
                <button
                    className={styles.secondaryBtn}
                    style={{ flex: 1, justifyContent: 'center', color: '#ff4d4d', borderColor: 'var(--border-color)' }}
                    onClick={onDiscard}
                    disabled={totalChanges === 0}
                >
                    <Trash2 size={14} style={{ marginRight: 6 }} /> Discard
                </button>
                <button
                    className={styles.primaryBtn}
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={onConfirm}
                    disabled={totalChanges === 0}
                >
                    <Check size={14} style={{ marginRight: 6 }} /> Confirm
                </button>
            </div>
        </div>
    );
};

