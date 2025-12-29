import React, { useState, useEffect } from 'react';
import styles from '../../styles/MainLayout.module.css';
import { Connection, Tag, TableTag, SavedQuery, SavedFunction } from '../../types/index';
import { Icons } from '../../assets/icons';
import { invoke } from '@tauri-apps/api/core';
import { TagManager } from './TagManager';
import { ConfirmModal } from '../modals/ConfirmModal';
import { DatabaseManagementModal } from '../modals/DatabaseManagementModal';
import { DndContext, useDraggable, useDroppable, DragEndEvent, useSensor, useSensors, PointerSensor, KeyboardSensor } from '@dnd-kit/core';

interface SidebarProps {
    sidebarOpen: boolean;
    connection: Connection;
    tables: string[];
    savedConnections: Connection[];
    onSwitchConnection: (conn: Connection) => void;
    onSwitchDatabase: (dbName: string) => void;
    onTableClick: (tableName: string) => void;
    onAddConnection: () => void;
    refreshTrigger?: number;
    // Table context menu actions
    onGetTableSchema?: (tableName: string) => void;
    onEditTableSchema?: (tableName: string) => void;
    onDuplicateTable?: (tableName: string) => void;
    onTruncateTable?: (tableName: string) => void;
    onDropTable?: (tableName: string) => void;
    style?: React.CSSProperties;
    // Saved queries and functions
    savedQueries?: SavedQuery[];
    savedFunctions?: SavedFunction[];
    onQueryClick?: (query: SavedQuery) => void;
    onFunctionClick?: (func: SavedFunction) => void;
    onDeleteQuery?: (id: number) => void;
    onDeleteFunction?: (id: number) => void;
    onEditFunction?: (func: SavedFunction) => void;
    // Search
    searchQuery?: string;
}

// Draggable Table Item with Context Menu
const DraggableTableItem = ({
    table,
    onClick,
    fromTagId,
    onGetSchema,
    onEditSchema,
    onDuplicate,
    onTruncate,
    onDrop,
    style
}: {
    table: string;
    onClick: () => void;
    fromTagId?: number | null;
    onGetSchema?: (t: string) => void;
    onEditSchema?: (t: string) => void;
    onDuplicate?: (t: string) => void;
    onTruncate?: (t: string) => void;
    onDrop?: (t: string) => void;
    style?: React.CSSProperties;
}) => {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: `table-${table}`,
        data: { tableName: table, fromTagId }
    });

    const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
    const [isHovered, setIsHovered] = useState(false);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    // Close context menu on click
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, [contextMenu]);

    const transformStyle = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 1000,
        opacity: 0.8
    } : undefined;

    const menuItems = [
        { label: 'Get Table Schema', icon: <Icons.FileText size={14} />, action: () => onGetSchema?.(table) },
        { label: 'Edit Table Schema', icon: <Icons.Pencil size={14} />, action: () => onEditSchema?.(table) },
        { label: 'Duplicate Table', icon: <Icons.Copy size={14} />, action: () => onDuplicate?.(table) },
        { label: 'Truncate Table', icon: <Icons.AlertCircle size={14} />, action: () => onTruncate?.(table), danger: true },
        { label: 'Drop Table', icon: <Icons.Trash2 size={14} />, action: () => onDrop?.(table), danger: true },
    ];

    return (
        <>
            <div
                ref={setNodeRef}
                style={{
                    ...style,
                    ...transformStyle,
                    marginBottom: '2px', // Add slight gap
                    cursor: 'pointer', // Force pointer cursor
                    backgroundColor: isHovered ? 'var(--bg-tertiary)' : 'transparent', // Hover highlight
                    transition: 'background-color 0.2s',
                    borderRadius: '4px', // Rounded corners
                    padding: '4px 8px' // Increase touch area
                }}
                {...listeners}
                {...attributes}
                className={styles.sidebarItem}
                onClick={onClick}
                onContextMenu={handleContextMenu}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <Icons.Table size={14} style={{ marginRight: '0.5rem', opacity: 0.7 }} />
                {table}
            </div>

            {/* Table Context Menu */}
            {contextMenu && (
                <div
                    style={{
                        position: 'fixed',
                        top: contextMenu.y,
                        left: contextMenu.x,
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        zIndex: 9999,
                        minWidth: '180px',
                        overflow: 'hidden'
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    {menuItems.map((item, idx) => (
                        <div
                            key={idx}
                            onClick={() => { item.action(); setContextMenu(null); }}
                            style={{
                                padding: '0.6rem 0.8rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontSize: '0.9rem',
                                color: item.danger ? '#ef4444' : 'var(--text-primary)',
                                borderTop: idx === 3 ? '1px solid var(--border-color)' : 'none'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            {item.icon} {item.label}
                        </div>
                    ))}
                </div>
            )}
        </>
    );
};

// Saved Item with Context Menu (for Queries/Functions)
const SavedItemWithContextMenu = ({
    name,
    icon,
    onClick,
    onDelete,
    onEdit
}: {
    name: string;
    icon: React.ReactNode;
    onClick: () => void;
    onDelete: () => void;
    onEdit?: () => void;
}) => {
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
    const [isHovered, setIsHovered] = useState(false);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, [contextMenu]);

    return (
        <>
            <div
                onClick={onClick}
                onContextMenu={handleContextMenu}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                style={{
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.85rem',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    backgroundColor: isHovered ? 'var(--bg-tertiary)' : 'transparent'
                }}
            >
                {icon}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
            </div>
            {contextMenu && (
                <div
                    style={{
                        position: 'fixed',
                        top: contextMenu.y,
                        left: contextMenu.x,
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        padding: '0.25rem',
                        zIndex: 1000,
                        boxShadow: 'var(--shadow-lg)'
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    {onEdit && (
                        <div
                            onClick={() => { onEdit(); setContextMenu(null); }}
                            style={{
                                padding: '0.5rem 0.75rem',
                                cursor: 'pointer',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontSize: '0.9rem',
                                color: 'var(--text-primary)'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <Icons.Pencil size={14} /> Edit
                        </div>
                    )}
                    <div
                        onClick={() => { onDelete(); setContextMenu(null); }}
                        style={{
                            padding: '0.5rem 0.75rem',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.9rem',
                            color: '#ef4444'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        <Icons.Trash2 size={14} /> Delete
                    </div>
                </div>
            )}
        </>
    );
};

// Collapsible Helper - controlled component
const CollapsibleSection = ({
    title,
    count,
    children,
    icon,
    isOpen,
    onToggle,
    headerStyle,
    droppableId
}: {
    title: string;
    count?: number;
    children: React.ReactNode;
    icon?: React.ReactNode;
    isOpen: boolean;
    onToggle: () => void;
    headerStyle?: React.CSSProperties;
    droppableId?: string;
}) => {
    const { setNodeRef, isOver } = useDroppable({
        id: droppableId || 'section-default',
        data: { tagId: null }
    });

    const containerRef = droppableId ? setNodeRef : null;

    return (
        <div ref={containerRef} style={{ marginBottom: '0.2rem', backgroundColor: isOver ? 'rgba(255,255,255,0.05)' : 'transparent', borderRadius: '4px' }}>
            <div
                onClick={onToggle}
                style={{
                    padding: '0.4rem 0.5rem',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    userSelect: 'none',
                    ...headerStyle
                }}
            >
                {isOpen ? <Icons.ChevronDown size={14} style={{ marginRight: '0.5rem', opacity: 0.7 }} /> : <Icons.ChevronRight size={14} style={{ marginRight: '0.5rem', opacity: 0.7 }} />}
                {icon && <span style={{ marginRight: '0.5rem', display: 'flex' }}>{icon}</span>}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
                {count !== undefined && <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: '0.75rem' }}>{count}</span>}
            </div>
            {isOpen && (
                <div style={{ marginLeft: '1rem', paddingLeft: '0.5rem' }}>
                    {children}
                </div>
            )}
        </div>
    );
};

// Droppable Tag Group - controlled component with context menu
const TagGroup = ({
    tag,
    tables,
    onTableClick,
    color,
    isOpen,
    onToggle,
    onEditTag,
    onDeleteTag,
    onGetSchema,
    onEditSchema,
    onDuplicate,
    onTruncate,
    onDrop
}: {
    tag: Tag | null,
    tables: string[],
    onTableClick: (t: string) => void,
    color?: string,
    isOpen: boolean,
    onToggle: () => void,
    onEditTag?: (tag: Tag) => void,
    onDeleteTag?: (tag: Tag) => void,
    onGetSchema?: (t: string) => void,
    onEditSchema?: (t: string) => void,
    onDuplicate?: (t: string) => void,
    onTruncate?: (t: string) => void,
    onDrop?: (t: string) => void
}) => {
    const { setNodeRef, isOver } = useDroppable({
        id: tag ? `tag-${tag.id}` : 'tag-untagged',
        data: { tagId: tag ? tag.id : null }
    });

    const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);

    const handleContextMenu = (e: React.MouseEvent) => {
        if (!tag) return; // No context menu for untagged
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    // Close context menu when clicking outside
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        if (contextMenu) {
            window.addEventListener('click', handleClick);
            return () => window.removeEventListener('click', handleClick);
        }
    }, [contextMenu]);

    return (
        <div ref={setNodeRef} style={{ marginBottom: '0.5rem', backgroundColor: isOver ? 'rgba(255,255,255,0.05)' : 'transparent', borderRadius: '4px' }}>
            <div
                onClick={onToggle}
                onContextMenu={handleContextMenu}
                style={{
                    padding: '0.4rem 0.5rem',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    userSelect: 'none'
                }}
            >
                {isOpen ? <Icons.ChevronDown size={14} style={{ marginRight: '0.5rem', opacity: 0.7 }} /> : <Icons.ChevronRight size={14} style={{ marginRight: '0.5rem', opacity: 0.7 }} />}
                <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color || '#64748b', marginRight: '0.6rem' }}></div>
                <span style={{ flex: 1 }}>{tag ? tag.name : 'Untagged Tables'}</span>
                <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: '0.75rem' }}>{tables.length}</span>
            </div>

            {/* Context Menu */}
            {contextMenu && tag && (
                <div
                    style={{
                        position: 'fixed',
                        top: contextMenu.y,
                        left: contextMenu.x,
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        zIndex: 9999,
                        minWidth: '140px',
                        overflow: 'hidden'
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    <div
                        onClick={() => { onEditTag?.(tag); setContextMenu(null); }}
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
                        <Icons.Pencil size={14} /> Edit
                    </div>
                    <div
                        onClick={() => { onDeleteTag?.(tag); setContextMenu(null); }}
                        style={{
                            padding: '0.6rem 0.8rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.9rem',
                            color: '#ef4444'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        <Icons.Trash2 size={14} /> Delete
                    </div>
                </div>
            )}

            {isOpen && (
                <div style={{ paddingLeft: '0.5rem' }}>
                    {tables.map(table => (
                        <DraggableTableItem
                            key={table}
                            table={table}
                            onClick={() => onTableClick(table)}
                            fromTagId={tag ? tag.id : null}
                            onGetSchema={onGetSchema}
                            onEditSchema={onEditSchema}
                            onDuplicate={onDuplicate}
                            onTruncate={onTruncate}
                            onDrop={onDrop}
                        />
                    ))}
                    {tables.length === 0 && <div style={{ padding: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>Empty</div>}
                </div>
            )}
        </div>
    );
};



// Wrapper for Import/Export Modal with mode selection
const SchemaImportExportModalWrapper: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    connection: Connection;
}> = ({ isOpen, onClose, connection }) => {
    const [mode, setMode] = useState<'import' | 'export' | null>(null);

    if (!isOpen) return null;

    // If mode not selected, show selection
    if (!mode) {
        return (
            <div style={{
                position: 'fixed', inset: 0, zIndex: 2000,
                backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }} onClick={onClose}>
                <div style={{
                    width: '400px',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '8px', border: '1px solid var(--border-color)',
                    padding: '2rem',
                    boxShadow: 'var(--shadow-xl)'
                }} onClick={e => e.stopPropagation()}>
                    <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem' }}>Import/Export Schemas</h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <button
                            onClick={() => setMode('import')}
                            style={{
                                padding: '1rem',
                                backgroundColor: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                fontSize: '1rem',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            <Icons.Upload size={20} />
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontWeight: 600 }}>Import Schema</div>
                                <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Import .sql files into database</div>
                            </div>
                        </button>

                        <button
                            onClick={() => setMode('export')}
                            style={{
                                padding: '1rem',
                                backgroundColor: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                fontSize: '1rem',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            <Icons.Download size={20} />
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontWeight: 600 }}>Export Schema</div>
                                <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Export database to .sql files</div>
                            </div>
                        </button>

                        <button
                            onClick={onClose}
                            style={{
                                marginTop: '0.5rem',
                                padding: '0.5rem 1rem',
                                backgroundColor: 'transparent',
                                border: '1px solid var(--border-color)',
                                borderRadius: '4px',
                                color: 'var(--text-primary)',
                                cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // If mode selected, show the import/export modal
    return (
        <SchemaImportExportModal
            isOpen={true}
            onClose={() => {
                setMode(null);
                onClose();
            }}
            mode={mode}
            connection={connection}
        />
    );
};

export const Sidebar: React.FC<SidebarProps> = ({
    sidebarOpen, connection, tables, savedConnections,
    onSwitchConnection, onSwitchDatabase, onTableClick, onAddConnection, refreshTrigger,
    onGetTableSchema, onEditTableSchema, onDuplicateTable, onTruncateTable, onDropTable,
    savedQueries = [], savedFunctions = [], onQueryClick, onFunctionClick, onDeleteQuery, onDeleteFunction, onEditFunction,
    searchQuery = ''
}) => {
    const [viewMode, setViewMode] = useState<'az' | 'tags'>('az');
    const [showConnDropdown, setShowConnDropdown] = useState(false);
    const [availableDatabases, setAvailableDatabases] = useState<string[]>([]);
    const [showDatabaseManager, setShowDatabaseManager] = useState(false);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (showConnDropdown && !target.closest('[data-conn-dropdown="true"]') && !target.closest('[data-conn-trigger="true"]')) {
                setShowConnDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showConnDropdown]);

    const [tags, setTags] = useState<Tag[]>([]);
    const [tableTags, setTableTags] = useState<TableTag[]>([]);
    const [showTagManager, setShowTagManager] = useState(false);
    const [editingTag, setEditingTag] = useState<Tag | undefined>(undefined);
    const [confirmModal, setConfirmModal] = useState<{ tag: Tag } | null>(null);

    // Expansion State - persists during session
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['az-tables', 'tag-untagged']));

    const toggleSection = (id: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    // Handle Edit Tag
    const handleEditTag = (tag: Tag) => {
        setEditingTag(tag);
        setShowTagManager(true);
    };

    // Handle Delete Tag - show confirmation modal
    const handleDeleteTag = (tag: Tag) => {
        setConfirmModal({ tag });
    };

    // Confirm delete tag action
    const confirmDeleteTag = async () => {
        if (!confirmModal) return;
        try {
            await invoke('delete_tag', { id: confirmModal.tag.id });
            fetchTags();
        } catch (e) {
            console.error('Failed to delete tag:', e);
        }
        setConfirmModal(null);
    };

    // DnD Sensors for Sidebar
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, {} as any)
    );


    useEffect(() => {
        // Always fetch tags so colors are available even in AZ mode
        fetchTags();
        fetchTableTags();
        fetchDatabases();
    }, [connection, refreshTrigger]);

    const fetchTags = async () => {
        try {
            const t = await invoke<Tag[]>('get_tags');
            setTags(t);
        } catch (e) { console.error(e); }
    };

    const fetchTableTags = async () => {
        try {
            const tt = await invoke<TableTag[]>('get_table_tags', { connectionId: connection.id });
            setTableTags(tt);
        } catch (e) { console.error(e); }
    };

    const fetchDatabases = async () => {
        try {
            const dbs = await invoke<string[]>('get_databases', { connectionString: connection.connection_string });
            // Filter out system schemas
            const systemSchemas = ['sys', 'information_schema', 'mysql', 'performance_schema'];
            const filteredDbs = dbs.filter(db => !systemSchemas.includes(db.toLowerCase()));
            setAvailableDatabases(filteredDbs);
        } catch (e) { console.error("Failed to fetch databases", e); }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;

        const tableName = active.data.current?.tableName;
        const fromTagId = active.data.current?.fromTagId;
        const toTagId = over.data.current?.tagId;

        if (tableName && toTagId !== undefined) {
            if (fromTagId === toTagId) return;

            try {
                // Remove from old tag if exists
                if (fromTagId !== null && fromTagId !== undefined) {
                    await invoke('remove_tag_from_table', {
                        connectionId: connection.id,
                        tableName: tableName,
                        tagId: fromTagId
                    });
                }

                // Add to new tag if target is not Untagged
                if (toTagId !== null) {
                    await invoke('assign_tag', {
                        connectionId: connection.id,
                        tableName: tableName,
                        tagId: toTagId
                    });
                }
                fetchTableTags();
            } catch (e) {
                console.error(e);
            }
        }
    };

    // Grouping Logic
    const getGroupedTables = () => {
        let assignedTables = new Set<string>();
        const groups = tags.map(tag => {
            const tabs = tableTags
                .filter(tt => tt.tag_id === tag.id)
                .map(tt => tt.table_name);

            tabs.forEach(t => assignedTables.add(t));
            return { tag, tables: tabs };
        });

        // Untagged
        const untagged = tables.filter(t => !assignedTables.has(t));

        return { groups, untagged };
    };

    const { groups, untagged } = getGroupedTables();

    // Filter items based on search query
    const filteredTables = searchQuery
        ? tables.filter(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
        : tables;
    
    const filteredQueries = searchQuery
        ? savedQueries.filter(q => q.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : savedQueries;
    
    const filteredFunctions = searchQuery
        ? savedFunctions.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : savedFunctions;

    const isSearching = searchQuery.length > 0;

    // Extract current database name from connection string
    const getCurrentDatabase = () => {
        try {
            const url = new URL(connection.connection_string);
            const dbName = url.pathname.slice(1); // Remove leading '/'
            return dbName || connection.name;
        } catch (e) {
            // If it's not a valid URL, try to extract from connection string manually
            const parts = connection.connection_string.split('/');
            if (parts.length > 1) {
                const lastPart = parts[parts.length - 1];
                return lastPart || connection.name;
            }
            return connection.name;
        }
    };

    return (
        <div className={`${styles.sidebar} ${!sidebarOpen ? styles.closed : ''}`}>
            <div
                className={styles.sidebarConnection}
                onClick={() => setShowConnDropdown(!showConnDropdown)}
                data-conn-trigger="true" // Ensure trigger is marked
                style={{ position: 'relative' }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <span style={{ fontWeight: 600, fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '0.5rem' }}>
                        {getCurrentDatabase()}
                    </span>
                </div>
                <Icons.ChevronDown size={14} style={{ opacity: 0.5, marginLeft: 'auto' }} />

                {/* Connection Dropdown */}
                {showConnDropdown && (
                    <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        width: '240px',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        boxShadow: 'var(--shadow-lg)',
                        zIndex: 100,
                        marginTop: '4px',
                        maxHeight: '400px',
                        overflowY: 'auto',
                        userSelect: 'none'
                    }} data-conn-dropdown="true">

                        {/* Database Selection Section */}
                        {availableDatabases.length > 0 && (
                            <>
                                <div style={{
                                    padding: '0.5rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    color: 'var(--text-muted)',
                                    backgroundColor: 'var(--bg-tertiary)',
                                    letterSpacing: '0.05em'
                                }}>
                                    Databases
                                </div>
                                <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                                    {availableDatabases.map(db => (
                                        <div
                                            key={db}
                                            style={{
                                                padding: '0.5rem 1rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                fontSize: '0.9rem',
                                                color: connection.connection_string.includes(`/${db}`)
                                                    || (connection.connection_string.endsWith('/') && db === 'postgres') // weak check
                                                    ? 'var(--accent-primary)' : 'var(--text-primary)',
                                                // Check active logic is naive, but works if we switched using handleSwitchDatabase
                                            }}
                                            onClick={(e) => { e.stopPropagation(); onSwitchDatabase(db); setShowConnDropdown(false); }}
                                        >
                                            <Icons.Database size={14} />
                                            {db}
                                        </div>
                                    ))}
                                </div>
                                <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '0.25rem 0' }}></div>
                            </>
                        )}

                        {/* Database Manager */}
                        <div
                            style={{
                                padding: '0.5rem 0.75rem',
                                cursor: 'pointer',
                                color: 'var(--text-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontSize: '0.9rem',
                                borderRadius: '4px'
                            }}
                            onClick={(e) => { e.stopPropagation(); setShowDatabaseManager(true); setShowConnDropdown(false); }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <Icons.Settings size={14} /> Database Manager
                        </div>
                    </div>
                )}
            </div>

            <div className={styles.sidebarControls}>
                {!isSearching && (
                    <>
                        <div className={styles.filterToggle}>
                            <button className={viewMode === 'az' ? styles.filterBtnActive : styles.filterBtn} onClick={() => setViewMode('az')}>A-Z</button>
                            <button className={viewMode === 'tags' ? styles.filterBtnActive : styles.filterBtn} onClick={() => setViewMode('tags')}>Tags</button>
                        </div>
                        {viewMode === 'tags' && (
                            <button className={styles.newTagBtn} onClick={() => setShowTagManager(true)}>
                                + New Tag
                            </button>
                        )}
                    </>
                )}
            </div>

            <div className={styles.tableList}>
                {/* Search Results View - flat list without groupings */}
                {isSearching ? (
                    <div style={{ padding: '0.5rem 0' }}>
                        {/* Tables */}
                        {filteredTables.length > 0 && (
                            <div style={{ marginBottom: '0.5rem' }}>
                                <div style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Tables</div>
                                {filteredTables.map(table => {
                                    const tt = tableTags.find(t => t.table_name === table);
                                    const tag = tt ? tags.find(t => t.id === tt.tag_id) : undefined;
                                    return (
                                        <DraggableTableItem
                                            key={table}
                                            table={table}
                                            onClick={() => onTableClick(table)}
                                            fromTagId={tag ? tag.id : null}
                                            onGetSchema={onGetTableSchema}
                                            onEditSchema={onEditTableSchema}
                                            onDuplicate={onDuplicateTable}
                                            onTruncate={onTruncateTable}
                                            onDrop={onDropTable}
                                            style={{ color: 'var(--text-primary)' }}
                                        />
                                    );
                                })}
                            </div>
                        )}
                        {/* Queries */}
                        {filteredQueries.length > 0 && (
                            <div style={{ marginBottom: '0.5rem' }}>
                                <div style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Queries</div>
                                {filteredQueries.map(query => (
                                    <SavedItemWithContextMenu
                                        key={query.id}
                                        name={query.name}
                                        icon={<Icons.Code2 size={14} color="#8b5cf6" />}
                                        onClick={() => onQueryClick?.(query)}
                                        onDelete={() => onDeleteQuery?.(query.id)}
                                    />
                                ))}
                            </div>
                        )}
                        {/* Functions */}
                        {filteredFunctions.length > 0 && (
                            <div style={{ marginBottom: '0.5rem' }}>
                                <div style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Functions</div>
                                {filteredFunctions.map(func => (
                                    <SavedItemWithContextMenu
                                        key={func.id}
                                        name={func.name}
                                        icon={<Icons.MathFunction size={14} color="#f59e0b" />}
                                        onClick={() => onFunctionClick?.(func)}
                                        onDelete={() => onDeleteFunction?.(func.id)}
                                        onEdit={() => onEditFunction?.(func)}
                                    />
                                ))}
                            </div>
                        )}
                        {/* No results */}
                        {filteredTables.length === 0 && filteredQueries.length === 0 && filteredFunctions.length === 0 && (
                            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                No results found for "{searchQuery}"
                            </div>
                        )}
                    </div>
                ) : viewMode === 'az' ? (
                    <>
                        <CollapsibleSection
                            title="Tables"
                            count={tables.length}
                            icon={<Icons.Folder size={14} color="var(--text-secondary)" />}
                            isOpen={expandedSections.has('az-tables')}
                            onToggle={() => toggleSection('az-tables')}
                        >
                            {tables.map(table => {
                                const tt = tableTags.find(t => t.table_name === table);
                                const tag = tt ? tags.find(t => t.id === tt.tag_id) : undefined;
                                return (
                                    <DraggableTableItem
                                        key={table}
                                        table={table}
                                        onClick={() => onTableClick(table)}
                                        fromTagId={tag ? tag.id : null}
                                        onGetSchema={onGetTableSchema}
                                        onEditSchema={onEditTableSchema}
                                        onDuplicate={onDuplicateTable}
                                        onTruncate={onTruncateTable}
                                        onDrop={onDropTable}
                                        style={{ color: 'var(--text-primary)' }} // Tab names follow the dark/white light/black rule
                                    />
                                );
                            })}
                        </CollapsibleSection>

                        <CollapsibleSection
                            title="Queries"
                            count={savedQueries.length}
                            icon={<Icons.Code2 size={14} color="var(--text-secondary)" />}
                            isOpen={expandedSections.has('az-queries')}
                            onToggle={() => toggleSection('az-queries')}
                        >
                            {savedQueries.length > 0 ? (
                                savedQueries.map(query => (
                                    <SavedItemWithContextMenu
                                        key={query.id}
                                        name={query.name}
                                        icon={<Icons.Code2 size={14} color="#8b5cf6" />}
                                        onClick={() => onQueryClick?.(query)}
                                        onDelete={() => onDeleteQuery?.(query.id)}
                                    />
                                ))
                            ) : (
                                <div style={{ padding: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>No saved queries</div>
                            )}
                        </CollapsibleSection>

                        <CollapsibleSection
                            title="Functions"
                            count={savedFunctions.length}
                            icon={<Icons.MathFunction size={14} color="#f59e0b" />}
                            isOpen={expandedSections.has('az-functions')}
                            onToggle={() => toggleSection('az-functions')}
                        >
                            {savedFunctions.length > 0 ? (
                                savedFunctions.map(func => (
                                    <SavedItemWithContextMenu
                                        key={func.id}
                                        name={func.name}
                                        icon={<Icons.MathFunction size={14} color="#f59e0b" />}
                                        onClick={() => onFunctionClick?.(func)}
                                        onDelete={() => onDeleteFunction?.(func.id)}
                                        onEdit={() => onEditFunction?.(func)}
                                    />
                                ))
                            ) : (
                                <div style={{ padding: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>No functions</div>
                            )}
                        </CollapsibleSection>
                    </>
                ) : (
                    <DndContext onDragEnd={handleDragEnd} sensors={sensors}>
                        {groups.map(g => (
                            <TagGroup
                                key={g.tag.id}
                                tag={g.tag}
                                tables={g.tables}
                                onTableClick={onTableClick}
                                color={g.tag.color}
                                isOpen={expandedSections.has(`tag-${g.tag.id}`)}
                                onToggle={() => toggleSection(`tag-${g.tag.id}`)}
                                onEditTag={handleEditTag}
                                onDeleteTag={handleDeleteTag}
                                onGetSchema={onGetTableSchema}
                                onEditSchema={onEditTableSchema}
                                onDuplicate={onDuplicateTable}
                                onTruncate={onTruncateTable}
                                onDrop={onDropTable}
                            />
                        ))}
                        {/* Untagged Section */}
                        <TagGroup
                            tag={null}
                            tables={untagged}
                            onTableClick={onTableClick}
                            isOpen={expandedSections.has('tag-untagged')}
                            onToggle={() => toggleSection('tag-untagged')}
                            onGetSchema={onGetTableSchema}
                            onEditSchema={onEditTableSchema}
                            onDuplicate={onDuplicateTable}
                            onTruncate={onTruncateTable}
                            onDrop={onDropTable}
                        />
                    </DndContext>
                )}
            </div>

            {showTagManager && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000
                }}>
                    <div onClick={e => e.stopPropagation()}>
                        <TagManager
                            onSuccess={() => { setShowTagManager(false); setEditingTag(undefined); fetchTags(); }}
                            onCancel={() => { setShowTagManager(false); setEditingTag(undefined); }}
                            editTag={editingTag}
                        />
                    </div>
                </div>
            )}

            {/* Confirm Modal for Delete Tag */}
            {confirmModal && (
                <ConfirmModal
                    title="Delete Tag"
                    message={`Are you sure you want to delete "${confirmModal.tag.name}"? All tables in this tag will be moved to Untagged.`}
                    confirmText="Delete"
                    onConfirm={confirmDeleteTag}
                    onCancel={() => setConfirmModal(null)}
                />
            )}

            {/* Database Manager Modal */}
            {showDatabaseManager && (
                <DatabaseManagementModal
                    isOpen={showDatabaseManager}
                    onClose={() => setShowDatabaseManager(false)}
                    connection={connection}
                    onSuccess={() => {
                        // Refresh databases
                        fetchDatabases();
                    }}
                    onDatabaseChange={onSwitchDatabase}
                />
            )}
        </div>
    );
};
