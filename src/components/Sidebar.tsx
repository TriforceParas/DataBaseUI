import React, { useState, useEffect } from 'react';
import styles from '../styles/MainLayout.module.css';
import { Connection, Tag, TableTag } from '../types';
import { ChevronDown, ChevronRight, Table, Check, Plus, Trash2, Folder, Terminal, Sigma, Pencil, Copy, FileText, AlertTriangle } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { TagManager } from './TagManager';
import { ConfirmModal } from './ConfirmModal';
import { DndContext, useDraggable, useDroppable, DragEndEvent, useSensor, useSensors, PointerSensor, KeyboardSensor } from '@dnd-kit/core';

interface SidebarProps {
    sidebarOpen: boolean;
    connection: Connection;
    tables: string[];
    savedConnections: Connection[];
    onSwitchConnection: (conn: Connection) => void;
    onTableClick: (tableName: string) => void;
    onAddConnection: () => void;
    refreshTrigger: number;
    // Table context menu actions
    onGetTableSchema?: (tableName: string) => void;
    onEditTableSchema?: (tableName: string) => void;
    onDuplicateTable?: (tableName: string) => void;
    onTruncateTable?: (tableName: string) => void;
    onDropTable?: (tableName: string) => void;
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
    onDrop
}: {
    table: string;
    onClick: () => void;
    fromTagId?: number | null;
    onGetSchema?: (t: string) => void;
    onEditSchema?: (t: string) => void;
    onDuplicate?: (t: string) => void;
    onTruncate?: (t: string) => void;
    onDrop?: (t: string) => void;
}) => {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: `table-${table}`,
        data: { tableName: table, fromTagId }
    });

    const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    // Close context menu on click
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        if (contextMenu) {
            window.addEventListener('click', handleClick);
            return () => window.removeEventListener('click', handleClick);
        }
    }, [contextMenu]);

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 1000,
        opacity: 0.8
    } : undefined;

    const menuItems = [
        { label: 'Get Table Schema', icon: <FileText size={14} />, action: () => onGetSchema?.(table) },
        { label: 'Edit Table Schema', icon: <Pencil size={14} />, action: () => onEditSchema?.(table) },
        { label: 'Duplicate Table', icon: <Copy size={14} />, action: () => onDuplicate?.(table) },
        { label: 'Truncate Table', icon: <AlertTriangle size={14} />, action: () => onTruncate?.(table), danger: true },
        { label: 'Drop Table', icon: <Trash2 size={14} />, action: () => onDrop?.(table), danger: true },
    ];

    return (
        <>
            <div
                ref={setNodeRef}
                {...listeners}
                {...attributes}
                className={styles.tableItem}
                style={style}
                onClick={onClick}
                onContextMenu={handleContextMenu}
            >
                <Table size={14} style={{ marginRight: '0.5rem', opacity: 0.7 }} />
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
                {isOpen ? <ChevronDown size={14} style={{ marginRight: '0.5rem', opacity: 0.7 }} /> : <ChevronRight size={14} style={{ marginRight: '0.5rem', opacity: 0.7 }} />}
                {icon && <span style={{ marginRight: '0.5rem', display: 'flex' }}>{icon}</span>}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
                {count !== undefined && <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: '0.75rem' }}>{count}</span>}
            </div>
            {isOpen && (
                <div style={{ marginLeft: '1rem', borderLeft: '1px solid var(--border-color)', paddingLeft: '0.5rem' }}>
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
                {isOpen ? <ChevronDown size={14} style={{ marginRight: '0.5rem', opacity: 0.7 }} /> : <ChevronRight size={14} style={{ marginRight: '0.5rem', opacity: 0.7 }} />}
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
                        <Pencil size={14} /> Edit
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
                        <Trash2 size={14} /> Delete
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



export const Sidebar: React.FC<SidebarProps> = ({
    sidebarOpen, connection, tables, savedConnections,
    onSwitchConnection, onTableClick, onAddConnection, refreshTrigger,
    onGetTableSchema, onEditTableSchema, onDuplicateTable, onTruncateTable, onDropTable
}) => {
    const [viewMode, setViewMode] = useState<'az' | 'tags'>('az');
    const [showConnDropdown, setShowConnDropdown] = useState(false);
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

    return (
        <div className={`${styles.sidebar} ${!sidebarOpen ? styles.closed : ''}`}>
            <div
                className={styles.sidebarConnection}
                onClick={() => setShowConnDropdown(!showConnDropdown)}
                style={{ position: 'relative' }}
            >
                <span style={{ fontWeight: 600, fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '0.5rem' }}>
                    {connection.name}
                </span>
                <ChevronDown size={14} style={{ opacity: 0.5 }} />

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
                        maxHeight: '300px',
                        overflowY: 'auto'
                    }}>
                        <div style={{
                            padding: '0.5rem',
                            fontSize: '0.8rem',
                            color: 'var(--text-secondary)',
                            borderBottom: '1px solid var(--border-color)'
                        }}>
                            Switch Connection
                        </div>
                        {savedConnections.map(conn => (
                            <div
                                key={conn.id}
                                style={{
                                    padding: '0.5rem 0.75rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    fontSize: '0.9rem',
                                    backgroundColor: conn.id === connection.id ? 'var(--bg-tertiary)' : 'transparent',
                                    color: 'var(--text-primary)'
                                }}
                                onClick={(e) => { e.stopPropagation(); onSwitchConnection(conn); setShowConnDropdown(false); }}
                            >
                                {conn.name}
                                {conn.id === connection.id && <Check size={14} />}
                            </div>
                        ))}
                        <div
                            style={{
                                padding: '0.5rem 0.75rem',
                                cursor: 'pointer',
                                color: 'var(--accent-primary)',
                                borderTop: '1px solid var(--border-color)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontWeight: 500
                            }}
                            onClick={(e) => { e.stopPropagation(); onAddConnection(); setShowConnDropdown(false); }}
                        >
                            <Plus size={14} /> New Connection
                        </div>
                    </div>
                )}
            </div>

            <div className={styles.sidebarControls}>
                <div className={styles.filterToggle}>
                    <button className={viewMode === 'az' ? styles.filterBtnActive : styles.filterBtn} onClick={() => setViewMode('az')}>A-Z</button>
                    <button className={viewMode === 'tags' ? styles.filterBtnActive : styles.filterBtn} onClick={() => setViewMode('tags')}>Tags</button>
                </div>
                {viewMode === 'tags' && (
                    <button className={styles.newTagBtn} onClick={() => setShowTagManager(true)}>
                        + New Tag
                    </button>
                )}
            </div>

            <div className={styles.tableList}>
                {viewMode === 'az' ? (
                    <>
                        <CollapsibleSection
                            title="Tables"
                            count={tables.length}
                            icon={<Folder size={14} color="#64748b" />}
                            isOpen={expandedSections.has('az-tables')}
                            onToggle={() => toggleSection('az-tables')}
                        >
                            {tables.map(table => {
                                const tt = tableTags.find(t => t.table_name === table);
                                const tag = tt ? tags.find(t => t.id === tt.tag_id) : undefined;
                                const color = tag ? tag.color : undefined;
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
                                    />
                                );
                            })}
                        </CollapsibleSection>

                        <CollapsibleSection
                            title="Queries"
                            count={0}
                            icon={<Terminal size={14} color="#8b5cf6" />}
                            isOpen={expandedSections.has('az-queries')}
                            onToggle={() => toggleSection('az-queries')}
                        >
                            <div style={{ padding: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>No saved queries</div>
                        </CollapsibleSection>

                        <CollapsibleSection
                            title="Functions"
                            count={0}
                            icon={<Sigma size={14} color="#f59e0b" />}
                            isOpen={expandedSections.has('az-functions')}
                            onToggle={() => toggleSection('az-functions')}
                        >
                            <div style={{ padding: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>No functions</div>
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
        </div>
    );
};
