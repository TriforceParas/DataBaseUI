import React, { useState, useEffect } from 'react';
import styles from '../styles/MainLayout.module.css';
import { Connection, Tag, TableTag } from '../types';
import { ChevronDown, Table, Check, Plus, Trash2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { TagManager } from './TagManager';
import { DndContext, useDraggable, useDroppable, DragEndEvent } from '@dnd-kit/core';

interface SidebarProps {
    sidebarOpen: boolean;
    connection: Connection;
    tables: string[];
    savedConnections: Connection[];
    onSwitchConnection: (conn: Connection) => void;
    onTableClick: (tableName: string) => void;
    onAddConnection: () => void;
}

// Draggable Table Item
const DraggableTableItem = ({ table, onClick }: { table: string; onClick: () => void }) => {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: `table-${table}`,
        data: { tableName: table }
    });

    // Simple transform style if needed during drag, customized via DndContext usually
    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 1000,
        opacity: 0.8
    } : undefined;

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className={styles.tableItem}
            style={style}
            onClick={onClick}
        >
            <Table size={14} style={{ marginRight: '0.5rem', opacity: 0.7 }} />
            {table}
        </div>
    );
};

// Droppable Tag Group
const TagGroup = ({ tag, tables, onTableClick, color }: { tag: Tag | null, tables: string[], onTableClick: (t: string) => void, color?: string }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: tag ? `tag-${tag.id}` : 'tag-untagged',
        data: { tagId: tag ? tag.id : null } // null for untagged? or special ID
    });

    return (
        <div ref={setNodeRef} style={{ marginBottom: '1rem', backgroundColor: isOver ? 'rgba(255,255,255,0.05)' : 'transparent', borderRadius: '4px' }}>
            <div style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color || '#64748b', marginRight: '0.5rem' }}></div>
                {tag ? tag.name : 'Untagged Tables'}
                <span style={{ marginLeft: 'auto', opacity: 0.5 }}>{tables.length}</span>
            </div>
            {tables.map(table => (
                <DraggableTableItem key={table} table={table} onClick={() => onTableClick(table)} />
            ))}
        </div>
    );
};


export const Sidebar: React.FC<SidebarProps> = ({
    sidebarOpen, connection, tables, savedConnections,
    onSwitchConnection, onTableClick, onAddConnection
}) => {
    const [viewMode, setViewMode] = useState<'az' | 'tags'>('az');
    const [showConnDropdown, setShowConnDropdown] = useState(false);
    const [tags, setTags] = useState<Tag[]>([]);
    const [tableTags, setTableTags] = useState<TableTag[]>([]);
    const [showTagManager, setShowTagManager] = useState(false);

    useEffect(() => {
        if (viewMode === 'tags') {
            fetchTags();
            fetchTableTags();
        }
    }, [viewMode, connection]);

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
        const tagId = over.data.current?.tagId; // number or null

        if (tagId !== undefined && tableName) {
            // If tagId is null, it means "Untagged". We should remove existing tags for this table?
            // User said "all the tables in the tag are we will be able to drag and add to a tag"
            // Assuming moving to Untagged means removing tag.
            try {
                if (tagId === null) {
                    // Remove current tag? We need to know which tag it came from?
                    // Or we just delete all tags for this table and connection?
                    // Currently model allows multiple tags but UI implies single group.
                    // For logic simplicity, assuming 1 tag per table for this view or we assign new tag.
                    // But if we drop on untagged, we probably want to remove tags. 
                    // Let's implement 'remove tag' if supported, or just ignore if multi-tag.
                    // User requirements imply grouping. "The tags are like group".

                    // Let's find current tag for this table and delete it?
                    // Ideally we should just clear tags for this table on this connection.
                    // We don't have a 'clear_tags' command. I'll stick to 'assign_tag' for now.
                    // Wait, I can't assign to null.

                    // Actually, if I drop on a Tag, I assign.
                    // If I drop on Untagged, I should remove tags.
                    const currentTag = tableTags.find(tt => tt.table_name === tableName);
                    if (currentTag) {
                        await invoke('remove_tag_from_table', {
                            connectionId: connection.id,
                            tableName: tableName,
                            tagId: currentTag.tag_id
                        });
                    }

                } else {
                    await invoke('assign_tag', {
                        connectionId: connection.id,
                        tableName: tableName,
                        tagId: tagId
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
                        right: 0,
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
                    tables.map(table => (
                        <div key={table} className={styles.tableItem} onClick={() => onTableClick(table)}>
                            <Table size={14} style={{ marginRight: '0.5rem', opacity: 0.7 }} />
                            {table}
                        </div>
                    ))
                ) : (
                    <DndContext onDragEnd={handleDragEnd}>
                        {groups.map(g => (
                            <TagGroup
                                key={g.tag.id}
                                tag={g.tag}
                                tables={g.tables}
                                onTableClick={onTableClick}
                                color={g.tag.color}
                            />
                        ))}
                        {/* Untagged Section */}
                        <TagGroup
                            tag={null}
                            tables={untagged}
                            onTableClick={onTableClick}
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
                }} onClick={() => setShowTagManager(false)}>
                    <div onClick={e => e.stopPropagation()}>
                        <TagManager
                            onSuccess={() => { setShowTagManager(false); fetchTags(); }}
                            onCancel={() => setShowTagManager(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
