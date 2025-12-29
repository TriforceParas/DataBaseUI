import React, { useRef, useEffect, useState } from 'react';
import { QueryResult, PendingChange } from '../../types/index';
import { GridHeader } from './GridHeader';
import { GridRow } from './GridRow';
import { ContextMenu } from './ContextMenu';
import styles from '../../styles/DataGrid.module.css';

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
    foreignKeys?: Set<string>;
    onDeleteRow?: (rowIndex: number) => void;
    onRecoverRow?: (rowIndex: number) => void;
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
    foreignKeys = new Set(),
    onDeleteRow,
    onRecoverRow
}) => {
    const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());
    const tableContainerRef = useRef<HTMLDivElement>(null);

    // Cell Selection State (rowIndex:colIndex)
    const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<{ r: number, c: number } | null>(null);
    const [lastSelected, setLastSelected] = useState<{ r: number, c: number } | null>(null);

    // Editing State
    const [editingCell, setEditingCell] = useState<{ r: number, c: number } | null>(null);
    const [editValue, setEditValue] = useState<string>('');

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, r: number, c: number } | null>(null);

    // Scroll to Highlighted Row
    useEffect(() => {
        if (highlightRowIndex !== undefined && highlightRowIndex !== null) {
            const row = rowRefs.current.get(highlightRowIndex);
            if (row) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [highlightRowIndex]);

    // Close context menu on outside click
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        if (contextMenu) {
            window.addEventListener('click', handleClick);
            return () => window.removeEventListener('click', handleClick);
        }
    }, [contextMenu]);

    // Global drag end
    useEffect(() => {
        const handleGlobalMouseUp = () => setIsDragging(false);
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, []);

    if (loading) {
        return <div className={styles.loading}>Loading...</div>;
    }

    if (error) {
        return <div className={styles.error}>Error: {error}</div>;
    }

    if (!data || data.columns.length === 0) {
        return <div className={styles.noData}>No data to display</div>;
    }

    const pendingInserts = pendingChanges.filter(c => c.type === 'INSERT');
    const displayRows = [...data.rows, ...pendingInserts.map(c => c.rowData)];
    const hasRows = displayRows.length > 0;
    const rowCount = displayRows.length;
    const colCount = data.columns.length;

    const getCellId = (r: number, c: number) => `${r}:${c}`;

    // --- Selection Logic ---

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

    const handleCellMouseDown = (e: React.MouseEvent, r: number, c: number) => {
        if (e.button !== 0) return;
        if (editingCell) return;

        if (tableContainerRef.current) tableContainerRef.current.focus();

        setIsDragging(true);
        setDragStart({ r, c });
        setLastSelected({ r, c });

        if (e.ctrlKey) {
            const id = getCellId(r, c);
            setSelectedCells(prev => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
            });
        } else {
            setSelectedCells(new Set([getCellId(r, c)]));
        }
    };

    const handleCellMouseEnter = (r: number, c: number) => {
        if (isDragging && dragStart && !editingCell) {
            updateRangeSelection(dragStart, { r, c });
            setLastSelected({ r, c });
        }
    };

    // --- Editing Logic ---

    const startEditing = (r: number, c: number) => {
        const row = displayRows[r];
        const val = row[c];
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
            onCellEdit(r, colName, editValue);
        }
        setEditingCell(null);
        if (tableContainerRef.current) tableContainerRef.current.focus();
    };

    const cancelEdit = () => {
        setEditingCell(null);
        setEditValue('');
        if (tableContainerRef.current) tableContainerRef.current.focus();
    };

    // --- Copy/Paste Functionality ---

    const getSelectedCellsData = () => {
        if (selectedCells.size === 0) return '';
        
        // Parse cell IDs and find bounds
        const cells = Array.from(selectedCells).map(id => {
            const [r, c] = id.split(':').map(Number);
            return { r, c };
        });
        
        const minR = Math.min(...cells.map(c => c.r));
        const maxR = Math.max(...cells.map(c => c.r));
        const minC = Math.min(...cells.map(c => c.c));
        const maxC = Math.max(...cells.map(c => c.c));
        
        // Build tab-separated values for Excel compatibility
        const rows: string[] = [];
        for (let r = minR; r <= maxR; r++) {
            const rowValues: string[] = [];
            for (let c = minC; c <= maxC; c++) {
                const cellId = getCellId(r, c);
                if (selectedCells.has(cellId)) {
                    const row = displayRows[r];
                    const val = row[c];
                    // Handle NULL and special values
                    const strVal = val === null || val === undefined ? '' : String(val);
                    rowValues.push(strVal);
                } else {
                    rowValues.push('');
                }
            }
            rows.push(rowValues.join('\t'));
        }
        
        return rows.join('\n');
    };

    const handleCopy = async () => {
        const data = getSelectedCellsData();
        if (data) {
            try {
                await navigator.clipboard.writeText(data);
            } catch (e) {
                console.error('Failed to copy:', e);
            }
        }
    };

    const handlePaste = async () => {
        if (!lastSelected || !onCellEdit) return;
        
        try {
            const text = await navigator.clipboard.readText();
            if (!text) return;
            
            // Parse tab-separated values (Excel format)
            const rows = text.split('\n').map(row => row.split('\t'));
            const { r: startR, c: startC } = lastSelected;
            
            // Apply pasted values to cells
            for (let ri = 0; ri < rows.length; ri++) {
                const targetRow = startR + ri;
                if (targetRow >= rowCount) break;
                
                for (let ci = 0; ci < rows[ri].length; ci++) {
                    const targetCol = startC + ci;
                    if (targetCol >= colCount) break;
                    
                    const colName = data.columns[targetCol];
                    const value = rows[ri][ci];
                    
                    // Convert empty strings back to NULL if needed
                    const finalValue = value === '' ? null : value;
                    onCellEdit(targetRow, colName, finalValue);
                }
            }
        } catch (e) {
            console.error('Failed to paste:', e);
        }
    };

    // --- Keyboard Navigation ---

    const handleGridKeyDown = (e: React.KeyboardEvent) => {
        if (editingCell) return;

        // Copy: Ctrl+C
        if (e.ctrlKey && e.key === 'c') {
            e.preventDefault();
            handleCopy();
            return;
        }

        // Paste: Ctrl+V
        if (e.ctrlKey && e.key === 'v') {
            e.preventDefault();
            handlePaste();
            return;
        }

        if (e.key === 'Escape') {
            setSelectedCells(new Set());
            setDragStart(null);
            setLastSelected(null);
            e.preventDefault();
            return;
        }

        if (!lastSelected || selectedCells.size === 0) return;

        if (e.key === 'Enter') {
            e.preventDefault();
            startEditing(lastSelected.r, lastSelected.c);
            return;
        }

        let { r, c } = lastSelected;
        let moved = false;

        switch (e.key) {
            case 'ArrowUp': r = Math.max(0, r - 1); moved = true; break;
            case 'ArrowDown': r = Math.min(rowCount - 1, r + 1); moved = true; break;
            case 'ArrowLeft': c = Math.max(0, c - 1); moved = true; break;
            case 'ArrowRight': c = Math.min(colCount - 1, c + 1); moved = true; break;
        }

        if (moved) {
            e.preventDefault();
            setLastSelected({ r, c });

            if (e.ctrlKey) {
                const anchor = dragStart || lastSelected;
                if (!dragStart) setDragStart(anchor);
                updateRangeSelection(anchor, { r, c });
            } else {
                setSelectedCells(new Set([getCellId(r, c)]));
                setDragStart({ r, c });
            }
        }
    };

    // --- Row Selection Helpers ---

    const handleSelectAll = (checked: boolean) => {
        if (!onSelectionChange) return;
        if (checked) {
            onSelectionChange(new Set(displayRows.map((_, i) => i)));
        } else {
            onSelectionChange(new Set());
        }
    };

    const handleSelectRow = (idx: number) => {
        if (!onSelectionChange) return;
        const newSet = new Set(selectedIndices);
        if (newSet.has(idx)) newSet.delete(idx);
        else newSet.add(idx);
        onSelectionChange(newSet);
    };

    return (
        <div
            ref={tableContainerRef}
            tabIndex={0}
            onKeyDown={handleGridKeyDown}
            className={styles.gridContainer}
        >
            <table className={styles.table}>
                <GridHeader
                    columns={data.columns}
                    primaryKeys={primaryKeys}
                    foreignKeys={foreignKeys}
                    onSort={onSort}
                    allSelected={hasRows && selectedIndices.size === displayRows.length}
                    indeterminate={selectedIndices.size > 0 && selectedIndices.size < displayRows.length}
                    onToggleAll={handleSelectAll}
                />
                <tbody>
                    {displayRows.map((row: any[], rIdx: number) => (
                        <GridRow
                            key={rIdx}
                            rowIndex={rIdx}
                            columns={data.columns}
                            row={row}
                            isSelected={selectedIndices.has(rIdx)}
                            isHighlighted={highlightRowIndex === rIdx}
                            pendingDelete={pendingChanges.some(c => c.type === 'DELETE' && c.rowIndex === rIdx)}
                            isInsert={rIdx >= data.rows.length}
                            pendingChanges={pendingChanges}
                            selectedCells={selectedCells}
                            editingCell={editingCell}
                            lastSelected={lastSelected}
                            editValue={editValue}

                            onSelectRow={handleSelectRow}
                            onCellMouseDown={handleCellMouseDown}
                            onCellMouseEnter={handleCellMouseEnter}
                            onCellDoubleClick={startEditing}
                            onCellContextMenu={(e: React.MouseEvent, r: number, c: number) => {
                                e.preventDefault();
                                const id = getCellId(r, c);
                                setSelectedCells(new Set([id]));
                                setLastSelected({ r, c });
                                setContextMenu({ x: e.clientX, y: e.clientY, r, c });
                            }}
                            onSetEditValue={setEditValue}
                            onSaveEdit={saveEdit}
                            onCancelEdit={cancelEdit}
                            rowRef={(el: HTMLTableRowElement | null) => {
                                if (el) rowRefs.current.set(rIdx, el);
                                else rowRefs.current.delete(rIdx);
                            }}
                        />
                    ))}
                    {!hasRows && (
                        <tr className={styles.emptyRow}>
                            <td colSpan={data.columns.length + 1}>
                                No data in Table
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            {/* Context Menu Portal */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    rowIndex={contextMenu.r}
                    colIndex={contextMenu.c}
                    selectedIndices={selectedIndices}
                    pendingChanges={pendingChanges}
                    isInsertRow={contextMenu.r >= data.rows.length}
                    onEdit={() => startEditing(contextMenu.r, contextMenu.c)}
                    onToggleRowSelection={() => handleSelectRow(contextMenu.r)}
                    onDeleteRow={() => onDeleteRow?.(contextMenu.r)}
                    onRecoverRow={() => onRecoverRow?.(contextMenu.r)}
                    onClose={() => setContextMenu(null)}
                />
            )}
        </div>
    );
};
