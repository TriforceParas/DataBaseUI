import React from 'react';
import { PendingChange } from '../../types/index';
import styles from '../../styles/MainLayout.module.css';
import { GridCell } from './GridCell';

interface GridRowProps {
    rowIndex: number;
    columns: string[];
    row: any[];
    isSelected: boolean;
    isHighlighted: boolean;
    pendingDelete: boolean;
    isInsert: boolean;
    pendingChanges: PendingChange[];
    selectedCells: Set<string>;
    editingCell: { r: number, c: number } | null;
    lastSelected: { r: number, c: number } | null;
    editValue: string;

    onSelectRow: (idx: number) => void;
    onCellMouseDown: (e: React.MouseEvent, r: number, c: number) => void;
    onCellMouseEnter: (r: number, c: number) => void;
    onCellDoubleClick: (r: number, c: number) => void;
    onCellContextMenu: (e: React.MouseEvent, r: number, c: number) => void;
    onSetEditValue: (val: string) => void;
    onSaveEdit: () => void;
    onCancelEdit: () => void;
    rowRef: (el: HTMLTableRowElement | null) => void;
}

export const GridRow: React.FC<GridRowProps> = ({
    rowIndex,
    columns,
    row,
    isSelected,
    isHighlighted,
    pendingDelete,
    isInsert,
    pendingChanges,
    selectedCells,
    editingCell,
    lastSelected,
    editValue,
    onSelectRow,
    onCellMouseDown,
    onCellMouseEnter,
    onCellDoubleClick,
    onCellContextMenu,
    onSetEditValue,
    onSaveEdit,
    onCancelEdit,
    rowRef
}) => {
    const getCellId = (r: number, c: number) => `${r}:${c}`;

    const rowBg = pendingDelete ? 'rgba(255, 77, 77, 0.15)' :
        (isInsert ? 'rgba(255, 230, 0, 0.15)' :
            (isSelected ? 'rgba(74, 144, 226, 0.1)' : undefined));

    return (
        <tr
            style={{ backgroundColor: rowBg }}
            ref={rowRef}
            className={`${styles.tableRow} ${isHighlighted ? styles.highlightRow : ''}`}
        >
            {/* Row Checkbox */}
            <td style={{
                width: '40px', minWidth: '40px', maxWidth: '40px',
                textAlign: 'center',
                borderBottom: '1px solid var(--border-color)',
                borderRight: '1px solid var(--border-color)',
                padding: '0.5rem',
                backgroundColor: 'var(--bg-secondary)'
            }}>
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onSelectRow(rowIndex)}
                    style={{ cursor: 'pointer' }}
                />
            </td>

            {/* Cells */}
            {row.map((cell, cIdx) => {
                const colName = columns[cIdx];
                const pendingUpdate = pendingChanges.find(c => c.type === 'UPDATE' && c.rowIndex === rowIndex && c.column === colName);

                const isCellSelected = selectedCells.has(getCellId(rowIndex, cIdx));
                const isEditing = editingCell?.r === rowIndex && editingCell?.c === cIdx;
                const isCellLastSelected = lastSelected?.r === rowIndex && lastSelected?.c === cIdx;
                const isActive = isEditing || (isCellSelected && isCellLastSelected);

                return (
                    <GridCell
                        key={cIdx}
                        rowIndex={rowIndex}
                        colIndex={cIdx}
                        columnName={colName}
                        value={cell}
                        isSelected={isCellSelected}
                        isEditing={isEditing}
                        isActive={isActive}
                        pendingUpdate={pendingUpdate}

                        onMouseDown={(e) => onCellMouseDown(e, rowIndex, cIdx)}
                        onMouseEnter={() => onCellMouseEnter(rowIndex, cIdx)}
                        onDoubleClick={() => onCellDoubleClick(rowIndex, cIdx)}
                        onContextMenu={(e) => onCellContextMenu(e, rowIndex, cIdx)}

                        editValue={editValue}
                        setEditValue={onSetEditValue}
                        onSaveEdit={onSaveEdit}
                        onCancelEdit={onCancelEdit}
                    />
                );
            })}
        </tr>
    );
};
