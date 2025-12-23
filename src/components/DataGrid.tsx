import React, { useRef, useEffect, useState } from 'react';
import { QueryResult, PendingChange } from '../types';
import { ChevronUp, ChevronDown, CornerDownLeft, X, Key, Pencil, MousePointer, Trash2 } from 'lucide-react';
import styles from '../styles/MainLayout.module.css';

interface DataGridProps {
    data: QueryResult | null;
    loading: boolean;
    error: string | null;
    selectedIndices?: Set<number>;
    onSelectionChange?: (indices: Set<number>) => void;
    onSort?: (column: string) => void;
    pendingChanges?: PendingChange[];
    highlightRowIndex?: number | null;
    onCellEdit?: (rowIndex: number, column: string, value: any) => void;
    primaryKeys?: Set<string>;
    onDeleteRow?: (rowIndex: number) => void;
    onRecoverRow?: (rowIndex: number) => void; // Undo pending delete
}

export const DataGrid: React.FC<DataGridProps> = ({
    data,
    loading,
    error,
    selectedIndices = new Set(),
    onSelectionChange,
    onSort,
    pendingChanges = [],
    highlightRowIndex,
    onCellEdit,
    primaryKeys = new Set(),
    onDeleteRow,
    onRecoverRow
}) => {
    const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());
    const tableContainerRef = useRef<HTMLDivElement>(null);

    // Cell Selection State
    // Format: "rowIndex:colIndex"
    const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<{ r: number, c: number } | null>(null);
    const [lastSelected, setLastSelected] = useState<{ r: number, c: number } | null>(null);

    // Editing State
    const [editingCell, setEditingCell] = useState<{ r: number, c: number } | null>(null);
    const [editValue, setEditValue] = useState<string>('');

    // Context menu state
    const [cellContextMenu, setCellContextMenu] = useState<{ x: number, y: number, r: number, c: number } | null>(null);

    useEffect(() => {
        if (highlightRowIndex !== undefined && highlightRowIndex !== null) {
            const row = rowRefs.current.get(highlightRowIndex);
            if (row) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [highlightRowIndex]);

    // Global mouse up to stop dragging if released outside table
    useEffect(() => {
        const handleGlobalMouseUp = () => setIsDragging(false);
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, []);

    // Close cell context menu on any click
    useEffect(() => {
        const handleClick = () => setCellContextMenu(null);
        if (cellContextMenu) {
            window.addEventListener('click', handleClick);
            return () => window.removeEventListener('click', handleClick);
        }
    }, [cellContextMenu]);

    if (loading) {
        return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading...</div>;
    }

    if (error) {
        return <div style={{ padding: '1rem', color: '#ff4d4d', border: '1px solid #ff4d4d', borderRadius: '4px', margin: '1rem' }}>
            Error: {error}
        </div>;
    }

    if (!data || data.columns.length === 0) {
        return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No data to display</div>;
    }

    const pendingInserts = pendingChanges.filter(c => c.type === 'INSERT');
    const displayRows = [...data.rows, ...pendingInserts.map(c => c.rowData)];

    const hasRows = displayRows.length > 0;
    const rowCount = displayRows.length;
    const colCount = data.columns.length;

    const getCellId = (r: number, c: number) => `${r}:${c}`;

    const handleCellMouseDown = (e: React.MouseEvent, r: number, c: number) => {
        if (e.button !== 0) return; // Only left click logic
        if (editingCell) return; // Don't mess with selection while editing

        // Focus table for keyboard events
        if (tableContainerRef.current) tableContainerRef.current.focus();

        setIsDragging(true);
        setDragStart({ r, c });
        setLastSelected({ r, c });

        if (e.ctrlKey) {
            // Multi-select toggle
            const id = getCellId(r, c);
            setSelectedCells(prev => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
            });
        } else {
            // Single select / Start of range
            setSelectedCells(new Set([getCellId(r, c)]));
        }
    };

    const handleCellMouseEnter = (r: number, c: number) => {
        if (isDragging && dragStart && !editingCell) {
            updateRangeSelection(dragStart, { r, c });
            setLastSelected({ r, c });
        }
    };

    const updateRangeSelection = (start: { r: number, c: number }, end: { r: number, c: number }) => {
        const minR = Math.min(start.r, end.r);
        const maxR = Math.max(start.r, end.r);
        const minC = Math.min(start.c, end.c);
        const maxC = Math.max(start.c, end.c);

        const newSet = new Set<string>();
        for (let i = minR; i <= maxR; i++) {
            for (let j = minC; j <= maxC; j++) {
                newSet.add(getCellId(i, j));
            }
        }
        setSelectedCells(newSet);
    };

    const startEditing = (r: number, c: number) => {
        const row = displayRows[r];
        const val = row[c];

        // Find if there's a pending change for this cell to show current value
        const colName = data.columns[c];
        const pendingUpdate = pendingChanges.find(p => p.type === 'UPDATE' && p.rowIndex === r && p.column === colName);
        const displayVal = pendingUpdate ? pendingUpdate.newValue : val;

        setEditingCell({ r, c });
        setEditValue(displayVal === null ? 'NULL' : String(displayVal));
    };

    const saveEdit = () => {
        if (editingCell && onCellEdit) {
            const { r, c } = editingCell;
            const colName = data.columns[c];
            // Simple type inference? For now send string, let backend/handler deal or strict typed
            onCellEdit(r, colName, editValue);
        }
        setEditingCell(null);
        // Restore focus to grid
        if (tableContainerRef.current) tableContainerRef.current.focus();
    };

    const cancelEdit = () => {
        setEditingCell(null);
        setEditValue('');
        if (tableContainerRef.current) tableContainerRef.current.focus();
    };

    const handleInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            saveEdit();
            e.stopPropagation();
        } else if (e.key === 'Escape') {
            cancelEdit();
            e.stopPropagation();
        }
        // Don't propagate standard keys to grid while editing
    };

    // --- Keyboard Navigation ---
    // --- Keyboard Navigation ---
    const getNextPosition = (key: string, current: { r: number, c: number }) => {
        let { r, c } = current;
        switch (key) {
            case 'ArrowUp': r = Math.max(0, r - 1); break;
            case 'ArrowDown': r = Math.min(rowCount - 1, r + 1); break;
            case 'ArrowLeft': c = Math.max(0, c - 1); break;
            case 'ArrowRight': c = Math.min(colCount - 1, c + 1); break;
        }
        return { r, c };
    };

    const handleGridKeyDown = (e: React.KeyboardEvent) => {
        if (editingCell || selectedCells.size === 0) return; // Handled by input or no selection

        if (e.key === 'Escape') {
            setSelectedCells(new Set());
            setDragStart(null);
            setLastSelected(null);
            e.preventDefault();
            return;
        }

        if (!lastSelected) return;

        if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedCells.size > 0) startEditing(lastSelected.r, lastSelected.c);
            return;
        }

        const { r, c } = getNextPosition(e.key, lastSelected);
        const moved = r !== lastSelected.r || c !== lastSelected.c;

        if (moved) {
            e.preventDefault();
            setLastSelected({ r, c });

            if (e.ctrlKey) {
                // "Expand" selection from dragStart (anchor) to new pos
                const anchor = dragStart || lastSelected;
                if (!dragStart) setDragStart(anchor);
                updateRangeSelection(anchor, { r, c });
            } else {
                // "Move" selection
                setSelectedCells(new Set([getCellId(r, c)]));
                setDragStart({ r, c }); // Reset anchor
            }
        }
    };


    // Row Selection Handlers (Existing)
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!onSelectionChange) return;
        if (e.target.checked) {
            const all = new Set(displayRows.map((_, i) => i));
            onSelectionChange(all);
        } else {
            onSelectionChange(new Set());
        }
    };

    const handleSelectRow = (idx: number) => {
        if (!onSelectionChange) return;
        const newSet = new Set(selectedIndices);
        if (newSet.has(idx)) {
            newSet.delete(idx);
        } else {
            newSet.add(idx);
        }
        onSelectionChange(newSet);
    };

    return (
        <div
            ref={tableContainerRef}
            tabIndex={0}
            onKeyDown={handleGridKeyDown}
            style={{ width: '100%', height: '100%', overflow: 'auto', position: 'relative', outline: 'none' }}
        >
            <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.9rem',
                color: 'var(--text-primary)',
                userSelect: 'none' // Prevent text selection while dragging
            }}>
                <thead>
                    <tr>
                        <th style={{
                            width: '40px',
                            minWidth: '40px',
                            maxWidth: '40px',
                            textAlign: 'center',
                            borderBottom: '1px solid var(--border-color)',
                            borderRight: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-secondary)',
                            position: 'sticky', top: 0, zIndex: 1,
                            padding: '0.5rem'
                        }}>
                            <input
                                type="checkbox"
                                checked={data.rows.length > 0 && selectedIndices.size === data.rows.length}
                                ref={input => {
                                    if (input) {
                                        input.indeterminate = selectedIndices.size > 0 && selectedIndices.size < data.rows.length;
                                    }
                                }}
                                onChange={handleSelectAll}
                                style={{ cursor: 'pointer' }}
                            />
                        </th>
                        {data.columns.map((col, idx) => (
                            <th key={idx}
                                onClick={() => onSort && onSort(col)}
                                style={{
                                    textAlign: 'left',
                                    padding: '0.5rem 1rem',
                                    borderBottom: '1px solid var(--border-color)',
                                    borderRight: '1px solid var(--border-color)',
                                    backgroundColor: 'var(--bg-secondary)',
                                    position: 'sticky', top: 0, zIndex: 1,
                                    cursor: onSort ? 'pointer' : 'default',
                                    userSelect: 'none'
                                }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    {col}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {primaryKeys.has(col) && <Key size={12} style={{ color: '#f59e0b' }} />}
                                        <div style={{ opacity: 0.3, display: 'flex', flexDirection: 'column', height: '10px', justifyContent: 'center' }}>
                                            <ChevronUp size={8} />
                                            <ChevronDown size={8} />
                                        </div>
                                    </div>
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {displayRows.map((row: any[], rIdx: number) => {
                        const isSelectedRow = selectedIndices.has(rIdx);
                        const isHighlightedRow = highlightRowIndex === rIdx;
                        const pendingDelete = pendingChanges.some(c => c.type === 'DELETE' && c.rowIndex === rIdx);

                        // Style priority: Delete Red > Insert Yellow > Selected Blue > Default
                        const isInsert = rIdx >= data.rows.length;
                        const rowBg = pendingDelete ? 'rgba(255, 77, 77, 0.15)' : (isInsert ? 'rgba(255, 230, 0, 0.15)' : (isSelectedRow ? 'rgba(74, 144, 226, 0.1)' : undefined));
                        const rowStyle = { backgroundColor: rowBg };

                        return (
                            <tr
                                key={rIdx}
                                style={rowStyle}
                                ref={el => {
                                    if (el) rowRefs.current.set(rIdx, el);
                                    else rowRefs.current.delete(rIdx);
                                }}
                                className={`${styles.tableRow} ${isHighlightedRow ? styles.highlightRow : ''}`}
                            >
                                <td style={{
                                    width: '40px',
                                    minWidth: '40px',
                                    maxWidth: '40px',
                                    textAlign: 'center',
                                    borderBottom: '1px solid var(--border-color)',
                                    borderRight: '1px solid var(--border-color)',
                                    padding: '0.5rem',
                                    backgroundColor: 'var(--bg-secondary)'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={isSelectedRow}
                                        onChange={() => handleSelectRow(rIdx)}
                                        style={{ cursor: 'pointer' }}
                                    />
                                </td>
                                {row.map((cell: any, cIdx: number) => {
                                    const colName = data.columns[cIdx];
                                    const pendingUpdate = pendingChanges.find(c => c.type === 'UPDATE' && c.rowIndex === rIdx && c.column === colName);
                                    const displayValue = pendingUpdate ? pendingUpdate.newValue : cell;

                                    const content = displayValue === null || displayValue === undefined ? 'NULL' :
                                        typeof displayValue === 'object' ? JSON.stringify(displayValue) : String(displayValue);

                                    const isCellSelected = selectedCells.has(getCellId(rIdx, cIdx));
                                    const isEditing = editingCell?.r === rIdx && editingCell?.c === cIdx;
                                    const isLastSelected = lastSelected?.r === rIdx && lastSelected?.c === cIdx;
                                    const isActive = isEditing || (isCellSelected && isLastSelected); // Simplified active check

                                    return (
                                        <td
                                            key={cIdx}
                                            onMouseDown={(e) => handleCellMouseDown(e, rIdx, cIdx)}
                                            onMouseEnter={() => handleCellMouseEnter(rIdx, cIdx)}
                                            onDoubleClick={() => startEditing(rIdx, cIdx)}
                                            onContextMenu={(e) => {
                                                e.preventDefault();
                                                const cellId = getCellId(rIdx, cIdx);
                                                setSelectedCells(new Set([cellId]));
                                                setLastSelected({ r: rIdx, c: cIdx });
                                                setCellContextMenu({ x: e.clientX, y: e.clientY, r: rIdx, c: cIdx });
                                            }}
                                            className={`${isCellSelected ? styles.cellSelected : ''} ${isActive ? styles.cellActive : ''}`}
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
                                            title={content}
                                        >
                                            {isEditing ? (
                                                <>
                                                    <div className={styles.editGuide}>
                                                        <div>
                                                            <span className={styles.keyBadge}><CornerDownLeft size={10} /></span>
                                                            Confirm
                                                        </div>
                                                        <div>
                                                            <span className={styles.keyBadge}><X size={10} /></span>
                                                            Cancel
                                                        </div>
                                                    </div>
                                                    <input
                                                        autoFocus
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        onKeyDown={handleInputKeyDown}
                                                        onBlur={saveEdit}
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
                                })}
                            </tr>
                        );
                    })}
                    {!hasRows && (
                        <tr>
                            <td
                                colSpan={data.columns.length + 1}
                                style={{
                                    padding: '2rem',
                                    textAlign: 'center',
                                    color: 'var(--text-muted)',
                                    fontStyle: 'italic',
                                    borderBottom: '1px solid var(--border-color)'
                                }}
                            >
                                No data in Table
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            {/* Cell Context Menu */}
            {cellContextMenu && (() => {
                const menuWidth = 150;
                const menuHeight = 130;
                const adjustedX = cellContextMenu.x + menuWidth > window.innerWidth
                    ? window.innerWidth - menuWidth - 10
                    : cellContextMenu.x;
                const adjustedY = cellContextMenu.y + menuHeight > window.innerHeight
                    ? window.innerHeight - menuHeight - 10
                    : cellContextMenu.y;
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
                            overflow: 'hidden'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div
                            onClick={() => { startEditing(cellContextMenu.r, cellContextMenu.c); setCellContextMenu(null); }}
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
                            <Pencil size={14} /> Edit Cell
                        </div>
                        <div
                            onClick={() => {
                                if (onSelectionChange) {
                                    const newSet = new Set(selectedIndices);
                                    if (selectedIndices.has(cellContextMenu.r)) {
                                        newSet.delete(cellContextMenu.r);
                                    } else {
                                        newSet.add(cellContextMenu.r);
                                    }
                                    onSelectionChange(newSet);
                                }
                                setCellContextMenu(null);
                            }}
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
                            <MousePointer size={14} /> {selectedIndices.has(cellContextMenu.r) ? 'Unselect Row' : 'Select Row'}
                        </div>
                        {(() => {
                            const isPendingDelete = pendingChanges.some(c => c.type === 'DELETE' && c.rowIndex === cellContextMenu.r);
                            const isInsertRow = cellContextMenu.r >= (data?.rows?.length || 0);

                            // For INSERT rows, always show "Remove Row" (removes the pending INSERT)
                            if (isInsertRow) {
                                return (
                                    <div
                                        onClick={() => {
                                            if (onDeleteRow) {
                                                onDeleteRow(cellContextMenu.r);
                                            }
                                            setCellContextMenu(null);
                                        }}
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
                                        <Trash2 size={14} /> Remove Row
                                    </div>
                                );
                            }

                            return isPendingDelete ? (
                                <div
                                    onClick={() => {
                                        if (onRecoverRow) {
                                            onRecoverRow(cellContextMenu.r);
                                        }
                                        setCellContextMenu(null);
                                    }}
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
                                    <Trash2 size={14} /> Recover Row
                                </div>
                            ) : (
                                <div
                                    onClick={() => {
                                        if (onDeleteRow) {
                                            onDeleteRow(cellContextMenu.r);
                                        }
                                        setCellContextMenu(null);
                                    }}
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
                                    <Trash2 size={14} /> Delete Row
                                </div>
                            );
                        })()}
                    </div>
                );
            })()}
        </div>
    );
};
