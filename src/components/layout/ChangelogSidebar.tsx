import React, { useState, useMemo } from 'react';
import type { PendingChange } from '../../types/index';
import { RiCheckLine, RiDeleteBinLine, RiArrowGoBackLine, RiCheckboxBlankLine, RiCheckboxLine } from 'react-icons/ri';
import styles from '../../styles/MainLayout.module.css';

interface ChangelogSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    changes: Record<string, PendingChange[]>; // Keyed by Tab ID
    tabs: { id: string; title: string, type: string }[];
    onConfirm: () => void;
    onDiscard: () => void;
    onConfirmSelected: (selected: { tabId: string; indices: number[] }[]) => void;
    onDiscardSelected: (selected: { tabId: string; indices: number[] }[]) => void;
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
    onConfirmSelected,
    onDiscardSelected,
    onRevert,
    onNavigate
}) => {
    const [viewMode, setViewMode] = useState<'visual' | 'sql'>('visual');
    // Track selected changes as "tabId:index" strings
    const [selectedChanges, setSelectedChanges] = useState<Set<string>>(new Set());

    const totalChanges = Object.values(changes).reduce((acc, curr) => acc + curr.length, 0);

    // Helper to create unique key for a change
    const getChangeKey = (tabId: string, idx: number) => `${tabId}:${idx}`;

    // Parse selected changes into structured format
    const getSelectedStructured = useMemo(() => {
        const result: Record<string, number[]> = {};
        selectedChanges.forEach(key => {
            const [tabId, idxStr] = key.split(':');
            const idx = parseInt(idxStr, 10);
            if (!result[tabId]) result[tabId] = [];
            result[tabId].push(idx);
        });
        return Object.entries(result).map(([tabId, indices]) => ({ tabId, indices: indices.sort((a, b) => b - a) })); // Sort descending for safe removal
    }, [selectedChanges]);

    const hasSelection = selectedChanges.size > 0;

    // Toggle selection for a single change
    const toggleSelection = (tabId: string, idx: number) => {
        const key = getChangeKey(tabId, idx);
        setSelectedChanges(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) {
                newSet.delete(key);
            } else {
                newSet.add(key);
            }
            return newSet;
        });
    };

    // Handle confirm - either selected only or all
    const handleConfirm = () => {
        if (hasSelection) {
            onConfirmSelected(getSelectedStructured);
            setSelectedChanges(new Set());
        } else {
            onConfirm();
        }
    };

    // Handle discard - either selected only or all
    const handleDiscard = () => {
        if (hasSelection) {
            onDiscardSelected(getSelectedStructured);
            setSelectedChanges(new Set());
        } else {
            onDiscard();
        }
    };

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

    // Clear selection when changes update (e.g., after apply/discard)
    React.useEffect(() => {
        setSelectedChanges(new Set());
    }, [changes]);

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
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem', fontStyle: 'italic', fontSize: '0.9rem', userSelect: 'none' }}>
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
                                    const isInsert = change.type === 'INSERT';
                                    const isAddColumn = change.type === 'ADD_COLUMN';
                                    const isDropColumn = change.type === 'DROP_COLUMN';
                                    const isSchemaChange = isAddColumn || isDropColumn;

                                    const updateColor = '#f59e0b'; // Orange
                                    const insertColor = '#22c55e'; // Green
                                    const deleteColor = '#ff4d4d'; // Red

                                    const getColor = () => {
                                        if (isUpdate) return updateColor;
                                        if (isInsert || isAddColumn) return insertColor;
                                        if (isDropColumn) return deleteColor;
                                        return deleteColor;
                                    };

                                    const getBgColor = () => {
                                        if (isUpdate) return 'rgba(245, 158, 11, 0.2)';
                                        if (isInsert || isAddColumn) return 'rgba(34, 197, 94, 0.2)';
                                        if (isDropColumn) return 'rgba(255, 77, 77, 0.2)';
                                        return 'rgba(255, 77, 77, 0.2)';
                                    };

                                    const getBadge = () => {
                                        if (isUpdate) return 'U';
                                        if (isInsert) return 'I';
                                        if (isAddColumn) return '+C';
                                        if (isDropColumn) return '-C';
                                        return 'D';
                                    };

                                    return (
                                        <div key={idx}
                                            onClick={() => !isSchemaChange && onNavigate(tabId, change.rowIndex)}
                                            style={{
                                                backgroundColor: 'var(--bg-secondary)',
                                                borderRadius: '6px',
                                                padding: '0.75rem',
                                                marginBottom: '0.75rem',
                                                border: '1px solid var(--border-color)',
                                                cursor: isSchemaChange ? 'default' : 'pointer',
                                                transition: 'background-color 0.2s',
                                                userSelect: 'none'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem', justifyContent: 'space-between' }}>
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                    {/* Checkbox for selection */}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); toggleSelection(tabId, idx); }}
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            padding: 0,
                                                            marginRight: '0.5rem',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            color: selectedChanges.has(getChangeKey(tabId, idx)) ? 'var(--accent-color)' : 'var(--text-secondary)'
                                                        }}
                                                        title={selectedChanges.has(getChangeKey(tabId, idx)) ? 'Deselect' : 'Select'}
                                                    >
                                                        {selectedChanges.has(getChangeKey(tabId, idx)) ? (
                                                            <RiCheckboxLine size={16} />
                                                        ) : (
                                                            <RiCheckboxBlankLine size={16} />
                                                        )}
                                                    </button>
                                                    <span style={{
                                                        backgroundColor: getBgColor(),
                                                        color: getColor(),
                                                        borderRadius: '3px',
                                                        width: isSchemaChange ? 22 : 18, height: 18,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontWeight: 700, marginRight: '0.5rem',
                                                        fontSize: '0.65rem'
                                                    }}>
                                                        {getBadge()}
                                                    </span>
                                                    <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>
                                                        {tableName}
                                                    </span>
                                                    {isSchemaChange ? (
                                                        <span style={{ marginLeft: '0.5rem', opacity: 0.7 }}>
                                                            Column: {change.column}
                                                        </span>
                                                    ) : (
                                                        <>
                                                            <span style={{ marginLeft: '0.5rem', opacity: 0.7 }}>
                                                                Row {change.rowIndex + 1}
                                                            </span>
                                                            {change.column && (
                                                                <span style={{ marginLeft: '0.5rem', opacity: 0.7, fontStyle: 'italic' }}>
                                                                    ({change.column})
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onRevert(tabId, idx); }}
                                                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', opacity: 0.6 }}
                                                    title="Undo"
                                                >
                                                    <RiArrowGoBackLine size={14} />
                                                </button>
                                            </div>

                                            <div style={{ fontSize: '0.85rem' }}>
                                                {isInsert ? (
                                                    <div style={{
                                                        color: '#34d399',
                                                        fontFamily: 'monospace',
                                                        display: 'flex',
                                                        alignItems: 'center'
                                                    }}>
                                                        <span style={{ marginRight: '0.5rem', opacity: 0.6, width: '10px', display: 'inline-block' }}>+</span>
                                                        <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>New Row</span>
                                                    </div>
                                                ) : (
                                                    <>
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
                                                    </>
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

            <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', display: 'flex', gap: '0.5rem' }}>
                <button
                    className={styles.secondaryBtn}
                    style={{ flex: 1, justifyContent: 'center', color: '#ff4d4d', borderColor: 'var(--border-color)' }}
                    onClick={handleDiscard}
                    disabled={totalChanges === 0}
                >
                    <RiDeleteBinLine size={14} style={{ marginRight: 6 }} /> {hasSelection ? `Discard (${selectedChanges.size})` : 'Discard'}
                </button>
                <button
                    className={styles.primaryBtn}
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={handleConfirm}
                    disabled={totalChanges === 0}
                >
                    <RiCheckLine size={14} style={{ marginRight: 6 }} /> {hasSelection ? `Confirm (${selectedChanges.size})` : 'Confirm'}
                </button>
            </div>
        </div>
    );
};

