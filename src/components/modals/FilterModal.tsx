import React, { useState, useEffect, useRef } from 'react';
import { RiCloseLine, RiAddLine, RiCheckboxLine, RiCheckboxBlankLine, RiArrowDownSLine } from 'react-icons/ri';
import styles from '../../styles/MainLayout.module.css';
import { Portal } from '../common/Portal';

export type FilterOperator =
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'not_contains'
    | 'starts_with'
    | 'ends_with'
    | 'greater_than'
    | 'less_than'
    | 'greater_than_or_equal'
    | 'less_than_or_equal'
    | 'is_null'
    | 'is_not_null';

export interface FilterCondition {
    id: string;
    enabled: boolean;
    column: string;
    operator: FilterOperator;
    value: string;
}

interface FilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    columns: string[];
    filters: FilterCondition[];
    onApply: (filters: FilterCondition[]) => void;
    anchorRef?: React.RefObject<HTMLButtonElement | null>;
}

const OPERATORS: { value: FilterOperator; label: string }[] = [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'not equals' },
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'not contains' },
    { value: 'starts_with', label: 'starts with' },
    { value: 'ends_with', label: 'ends with' },
    { value: 'greater_than', label: 'greater than' },
    { value: 'less_than', label: 'less than' },
    { value: 'greater_than_or_equal', label: 'greater than or equal' },
    { value: 'less_than_or_equal', label: 'less than or equal' },
    { value: 'is_null', label: 'is null' },
    { value: 'is_not_null', label: 'is not null' },
];

const generateId = () => Math.random().toString(36).substring(2, 9);

// Custom Dropdown Component
interface CustomDropdownProps {
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
    width?: string;
    placeholder?: string;
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({ value, options, onChange, width = '150px', placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    const selectedOption = options.find(o => o.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
                triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleOpen = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setPosition({
                top: rect.bottom + 4,
                left: rect.left
            });
        }
        setIsOpen(!isOpen);
    };

    return (
        <>
            <button
                ref={triggerRef}
                onClick={handleOpen}
                type="button"
                style={{
                    width,
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    textAlign: 'left'
                }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedOption?.label || placeholder || value}
                </span>
                <RiArrowDownSLine size={16} style={{ flexShrink: 0, opacity: 0.6 }} />
            </button>

            {isOpen && (
                <Portal>
                    <div
                        ref={dropdownRef}
                        data-filter-dropdown="true"
                        style={{
                            position: 'fixed',
                            top: position.top,
                            left: position.left,
                            zIndex: 10000,
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                            minWidth: width,
                            maxHeight: options.length > 15 ? '450px' : 'none',
                            overflowY: options.length > 15 ? 'auto' : 'visible',
                            padding: '4px'
                        }}
                    >
                        {options.map(option => (
                            <div
                                key={option.value}
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                style={{
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    borderRadius: '4px',
                                    backgroundColor: option.value === value ? 'var(--accent-primary)' : 'transparent',
                                    color: option.value === value ? '#fff' : 'var(--text-primary)',
                                    transition: 'background-color 0.1s ease'
                                }}
                                onMouseEnter={(e) => {
                                    if (option.value !== value) {
                                        e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (option.value !== value) {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                    }
                                }}
                            >
                                {option.label}
                            </div>
                        ))}
                    </div>
                </Portal>
            )}
        </>
    );
};

export const FilterModal: React.FC<FilterModalProps> = ({
    isOpen,
    onClose,
    columns,
    filters: initialFilters,
    onApply,
    anchorRef
}) => {
    const [localFilters, setLocalFilters] = useState<FilterCondition[]>([]);
    const panelRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    useEffect(() => {
        if (isOpen) {
            if (initialFilters.length > 0) {
                setLocalFilters([...initialFilters]);
            } else {
                setLocalFilters([{
                    id: generateId(),
                    enabled: true,
                    column: columns[0] || '',
                    operator: 'contains',
                    value: ''
                }]);
            }

            // Position the panel below the anchor
            if (anchorRef?.current) {
                const rect = anchorRef.current.getBoundingClientRect();
                setPosition({
                    top: rect.bottom + 8,
                    left: rect.left
                });
            }
        }
    }, [isOpen, initialFilters, columns, anchorRef]);

    // Close on click outside (but not on dropdown menus)
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;

            // Check if clicking on a dropdown portal (has data-filter-dropdown attribute)
            if (target.closest('[data-filter-dropdown="true"]')) {
                return; // Don't close if clicking on a dropdown
            }

            if (panelRef.current && !panelRef.current.contains(target) &&
                anchorRef?.current && !anchorRef.current.contains(target)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose, anchorRef]);

    const handleAddFilter = () => {
        setLocalFilters(prev => [
            ...prev,
            {
                id: generateId(),
                enabled: true,
                column: columns[0] || '',
                operator: 'contains',
                value: ''
            }
        ]);
    };

    const handleRemoveFilter = (id: string) => {
        setLocalFilters(prev => prev.filter(f => f.id !== id));
    };

    const handleUpdateFilter = (id: string, field: keyof FilterCondition, value: any) => {
        setLocalFilters(prev => prev.map(f =>
            f.id === id ? { ...f, [field]: value } : f
        ));
    };

    const handleToggleEnabled = (id: string) => {
        setLocalFilters(prev => prev.map(f =>
            f.id === id ? { ...f, enabled: !f.enabled } : f
        ));
    };

    const handleApply = () => {
        // Keep all filters (including disabled ones), only remove those without a column
        onApply(localFilters.filter(f => f.column));
        onClose();
    };

    const isNullOperator = (op: FilterOperator) => op === 'is_null' || op === 'is_not_null';

    if (!isOpen) return null;

    const columnOptions = columns.map(col => ({ value: col, label: col }));

    return (
        <Portal>
            <div
                ref={panelRef}
                style={{
                    position: 'fixed',
                    top: position.top,
                    left: position.left,
                    zIndex: 5000,
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                    minWidth: '520px',
                    maxWidth: '700px',
                    overflow: 'hidden'
                }}
            >
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-tertiary)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2">
                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                        </svg>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Filter Data</span>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '4px'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        <RiCloseLine size={18} />
                    </button>
                </div>

                {/* Filter Rows */}
                <div style={{
                    padding: '1rem',
                    maxHeight: '300px',
                    overflowY: 'auto'
                }}>
                    {localFilters.map((filter) => (
                        <div
                            key={filter.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                marginBottom: '0.75rem'
                            }}
                        >
                            {/* Enabled Checkbox */}
                            <button
                                onClick={() => handleToggleEnabled(filter.id)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: filter.enabled ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    padding: '2px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    flexShrink: 0
                                }}
                            >
                                {filter.enabled ? <RiCheckboxLine size={20} /> : <RiCheckboxBlankLine size={20} />}
                            </button>

                            {/* Column Dropdown */}
                            <CustomDropdown
                                value={filter.column}
                                options={columnOptions}
                                onChange={(val) => handleUpdateFilter(filter.id, 'column', val)}
                                width="120px"
                            />

                            {/* Operator Dropdown */}
                            <CustomDropdown
                                value={filter.operator}
                                options={OPERATORS}
                                onChange={(val) => handleUpdateFilter(filter.id, 'operator', val as FilterOperator)}
                                width="160px"
                                placeholder="Operator..."
                            />

                            {/* Value Input */}
                            <input
                                type="text"
                                value={filter.value}
                                onChange={e => handleUpdateFilter(filter.id, 'value', e.target.value)}
                                placeholder={isNullOperator(filter.operator) ? '—' : 'Value...'}
                                disabled={isNullOperator(filter.operator)}
                                style={{
                                    flex: 1,
                                    minWidth: '80px',
                                    padding: '0.5rem 0.75rem',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-color)',
                                    backgroundColor: isNullOperator(filter.operator) ? 'var(--bg-primary)' : 'var(--bg-tertiary)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.85rem',
                                    opacity: isNullOperator(filter.operator) ? 0.5 : 1,
                                    outline: 'none'
                                }}
                            />

                            {/* Remove Button */}
                            <button
                                onClick={() => handleRemoveFilter(filter.id)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-secondary)',
                                    cursor: localFilters.length === 1 ? 'not-allowed' : 'pointer',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    flexShrink: 0,
                                    opacity: localFilters.length === 1 ? 0.3 : 1,
                                    borderRadius: '4px'
                                }}
                                disabled={localFilters.length === 1}
                                onMouseEnter={(e) => {
                                    if (localFilters.length > 1) {
                                        e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                            >
                                <RiCloseLine size={18} />
                            </button>
                        </div>
                    ))}

                    {/* Add Filter Button */}
                    <button
                        onClick={handleAddFilter}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.5rem 0.75rem',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            marginTop: '0.25rem'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--text-secondary)'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                    >
                        <RiAddLine size={16} />
                        Add Filter
                    </button>
                </div>

                {/* Footer */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.5rem',
                    padding: '0.75rem 1rem',
                    borderTop: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-tertiary)'
                }}>
                    <button
                        onClick={onClose}
                        className={styles.secondaryBtn}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleApply}
                        className={styles.primaryBtn}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                    >
                        Apply
                    </button>
                </div>
            </div>
        </Portal>
    );
};

/**
 * Utility function to build SQL WHERE clause from filters
 */
export const buildWhereClause = (filters: FilterCondition[], quoteChar: string = '"'): string => {
    const enabledFilters = filters.filter(f => f.enabled && f.column);
    if (enabledFilters.length === 0) return '';

    const conditions = enabledFilters.map(f => {
        const col = `${quoteChar}${f.column}${quoteChar}`;
        const val = f.value.replace(/'/g, "''"); // Escape single quotes

        switch (f.operator) {
            case 'equals':
                return `${col} = '${val}'`;
            case 'not_equals':
                return `${col} != '${val}'`;
            case 'contains':
                return `${col} LIKE '%${val}%'`;
            case 'not_contains':
                return `${col} NOT LIKE '%${val}%'`;
            case 'starts_with':
                return `${col} LIKE '${val}%'`;
            case 'ends_with':
                return `${col} LIKE '%${val}'`;
            case 'greater_than':
                return `${col} > '${val}'`;
            case 'less_than':
                return `${col} < '${val}'`;
            case 'greater_than_or_equal':
                return `${col} >= '${val}'`;
            case 'less_than_or_equal':
                return `${col} <= '${val}'`;
            case 'is_null':
                return `${col} IS NULL`;
            case 'is_not_null':
                return `${col} IS NOT NULL`;
            default:
                return '';
        }
    }).filter(Boolean);

    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
};
