import React from 'react';
import { Icons } from '../../assets/icons';

interface GridHeaderProps {
    columns: string[];
    primaryKeys: Set<string>;
    foreignKeys?: Set<string>;
    onSort?: (column: string) => void;

    // Select All Checkbox
    allSelected: boolean;
    indeterminate: boolean;
    onToggleAll: (checked: boolean) => void;
}

export const GridHeader: React.FC<GridHeaderProps> = ({
    columns, primaryKeys, foreignKeys = new Set(), onSort, allSelected, indeterminate, onToggleAll
}) => {
    return (
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
                        checked={allSelected}
                        ref={input => {
                            if (input) input.indeterminate = indeterminate;
                        }}
                        onChange={(e) => onToggleAll(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                    />
                </th>
                {columns.map((col, idx) => (
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
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                                {col}
                                {primaryKeys.has(col) && <Icons.Key size={12} style={{ color: '#f59e0b', flexShrink: 0 }} />}
                                {foreignKeys.has(col) && <Icons.Link size={12} style={{ color: '#3b82f6', flexShrink: 0 }} />}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <div style={{ opacity: 0.6, display: 'flex', flexDirection: 'column', height: '10px', justifyContent: 'center' }}>
                                    <Icons.ChevronUp size={8} />
                                    <Icons.ChevronDown size={8} />
                                </div>
                            </div>
                        </div>
                    </th>
                ))}
            </tr>
        </thead>
    );
};
