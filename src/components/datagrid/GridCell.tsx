import React from 'react';
import { Icons } from '../../assets/icons';
import styles from '../../styles/MainLayout.module.css';
import { PendingChange } from '../../types/index';

interface GridCellProps {
    rowIndex: number;
    colIndex: number;
    columnName: string;
    value: any;

    // State
    isSelected: boolean;
    isEditing: boolean;
    isActive: boolean;
    pendingUpdate?: PendingChange;

    // Actions
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseEnter: () => void;
    onDoubleClick: () => void;
    onContextMenu: (e: React.MouseEvent) => void;

    // Editing
    editValue: string;
    setEditValue: (val: string) => void;
    onSaveEdit: () => void;
    onCancelEdit: () => void;
}

export const GridCell: React.FC<GridCellProps> = ({
    value,
    isSelected, isEditing, isActive, pendingUpdate,
    onMouseDown, onMouseEnter, onDoubleClick, onContextMenu,
    editValue, setEditValue, onSaveEdit, onCancelEdit
}) => {

    const displayValue = pendingUpdate ? pendingUpdate.newValue : value;
    const content = displayValue === null || displayValue === undefined ? 'NULL' :
        typeof displayValue === 'object' ? JSON.stringify(displayValue) : String(displayValue);

    const handleInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            onSaveEdit();
            e.stopPropagation();
        } else if (e.key === 'Escape') {
            onCancelEdit();
            e.stopPropagation();
        }
    };

    return (
        <td
            onMouseDown={onMouseDown}
            onMouseEnter={onMouseEnter}
            onDoubleClick={onDoubleClick}
            onContextMenu={onContextMenu}
            className={`${isSelected ? styles.cellSelected : ''} ${isActive ? styles.cellActive : ''}`}
            style={{
                padding: isEditing ? '0' : '0.5rem 1rem',
                maxWidth: '300px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                borderBottom: '1px solid var(--border-color)',
                borderRight: '1px solid var(--border-color)',
                color: displayValue === null ? 'var(--text-muted)' : 'inherit',
                fontStyle: displayValue === null ? 'italic' : 'normal',
                backgroundColor: pendingUpdate ? 'rgba(255, 230, 0, 0.2)' : undefined,
                position: 'relative',
                cursor: 'cell'
            }}
            title={isEditing ? '' : content}
        >
            {isEditing ? (
                <>
                    <div className={styles.editGuide}>
                        <div>
                            <span className={styles.keyBadge}><Icons.CornerDownLeft size={10} /></span>
                            Confirm
                        </div>
                        <div>
                            <span className={styles.keyBadge}><Icons.X size={10} /></span>
                            Cancel
                        </div>
                    </div>
                    <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleInputKeyDown}
                        onBlur={onSaveEdit}
                        style={{
                            width: '100%',
                            height: '100%',
                            border: 'none',
                            outline: 'none',
                            padding: '0.5rem 1rem',
                            background: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                            fontFamily: 'inherit',
                            fontSize: 'inherit'
                        }}
                    />
                </>
            ) : (
                content
            )}
        </td>
    );
};
