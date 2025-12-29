import React from 'react';
import { Icons } from '../../assets/icons';
import { PendingChange } from '../../types/index';

interface ContextMenuProps {
    x: number;
    y: number;
    rowIndex: number;
    colIndex: number;
    selectedIndices: Set<number>;
    pendingChanges: PendingChange[];
    isInsertRow: boolean;
    onEdit: () => void;
    onToggleRowSelection: () => void;
    onDeleteRow?: () => void;
    onRecoverRow?: () => void;
    onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
    x, y, rowIndex,
    selectedIndices, pendingChanges, isInsertRow,
    onEdit, onToggleRowSelection, onDeleteRow, onRecoverRow, onClose
}) => {
    // Adjust position to stay in viewport
    const menuWidth = 150;
    const menuHeight = 130;
    const adjustedX = x + menuWidth > window.innerWidth ? window.innerWidth - menuWidth - 10 : x;
    const adjustedY = y + menuHeight > window.innerHeight ? window.innerHeight - menuHeight - 10 : y;

    const isPendingDelete = pendingChanges.some(c => c.type === 'DELETE' && c.rowIndex === rowIndex);

    return (
        <div
            style={{
                position: 'fixed',
                top: adjustedY,
                left: adjustedX,
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                zIndex: 9999,
                minWidth: '150px',
                overflow: 'hidden',
                userSelect: 'none'
            }}
            onClick={e => e.stopPropagation()}
        >
            <div
                onClick={() => { onEdit(); onClose(); }}
                style={{
                    padding: '0.6rem 0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.9rem',
                    color: 'var(--text-primary)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
                <Icons.Pencil size={14} /> Edit Cell
            </div>
            <div
                onClick={() => { onToggleRowSelection(); onClose(); }}
                style={{
                    padding: '0.6rem 0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.9rem',
                    color: 'var(--text-primary)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
                <Icons.MousePointer size={14} /> {selectedIndices.has(rowIndex) ? 'Unselect Row' : 'Select Row'}
            </div>

            {isInsertRow ? (
                <div
                    onClick={() => { onDeleteRow?.(); onClose(); }}
                    style={{
                        padding: '0.6rem 0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.9rem',
                        color: '#ef4444',
                        borderTop: '1px solid var(--border-color)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                    <Icons.Trash2 size={14} /> Remove Row
                </div>
            ) : isPendingDelete ? (
                <div
                    onClick={() => { onRecoverRow?.(); onClose(); }}
                    style={{
                        padding: '0.6rem 0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.9rem',
                        color: '#22c55e',
                        borderTop: '1px solid var(--border-color)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                    <Icons.Trash2 size={14} /> Recover Row
                </div>
            ) : (
                <div
                    onClick={() => { onDeleteRow?.(); onClose(); }}
                    style={{
                        padding: '0.6rem 0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.9rem',
                        color: '#ef4444',
                        borderTop: '1px solid var(--border-color)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                    <Icons.Trash2 size={14} /> Delete Row
                </div>
            )}
        </div>
    );
};
