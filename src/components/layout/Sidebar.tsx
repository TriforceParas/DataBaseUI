import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import styles from '../../styles/MainLayout.module.css';
import { Connection, Tag, SavedQuery, SavedFunction, SidebarView } from '../../types/index';
import { Icons } from '../../assets/icons';
import { invoke } from '@tauri-apps/api/core';
import { TagManager } from './TagManager';
import { ConfirmModal } from '../modals/ConfirmModal';
import { DatabaseManagementModal } from '../modals/DatabaseManagementModal';
import { DndContext, useDraggable, useDroppable, DragEndEvent, DragStartEvent, DragOverlay, useSensor, useSensors, PointerSensor, KeyboardSensor, pointerWithin } from '@dnd-kit/core';
import { Portal } from '../common/Portal';
import { ContextMenu } from '../common/ContextMenu';


interface SidebarProps {
    sidebarOpen: boolean;
    connection: Connection;
    sessionId?: string | null;
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
// Draggable Table Item with Context Menu
const DraggableTableItem = ({
    table,
    onClick,
    fromTagId,
    onContextMenu,
    style,
    tagColor,
    tagName
}: {
    table: string;
    onClick: () => void;
    fromTagId?: number | null;
    onContextMenu: (e: React.MouseEvent) => void;
    style?: React.CSSProperties;
    tagColor?: string;
    tagName?: string;
}) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `table-${table}`,
        data: { tableName: table, fromTagId }
    });

    const itemStyle: React.CSSProperties = {
        ...style,
        opacity: isDragging ? 0.3 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={itemStyle}
            {...listeners}
            {...attributes}
            className={`${styles.sidebarItem} ${isDragging ? styles.sidebarItemActive : ''}`}
            onClick={onClick}
            onContextMenu={onContextMenu}
        >
            <div title={tagName} style={{ display: 'flex', alignItems: 'center' }}>
                <Icons.Table size={14} color={tagColor} style={{ marginRight: '0.5rem', opacity: tagColor ? 1 : 0.7 }} />
            </div>
            {table}
        </div>
    );
};

// Saved Item with Context Menu (for Queries/Functions)
// Saved Item (for Queries/Functions)
const SavedItemWithContextMenu = ({
    name,
    icon,
    onClick,
    onContextMenu
}: {
    name: string;
    icon: React.ReactNode;
    onClick: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
}) => {
    return (
        <div
            onClick={onClick}
            onContextMenu={onContextMenu}
            className={styles.sidebarItem}
            style={{ paddingLeft: '0.8rem' }}
        >
            {icon}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        </div>
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
// Droppable Tag Group - controlled component with context menu
const TagGroup = ({
    tag,
    tables,
    onTableClick,
    color,
    isOpen,
    onToggle,
    onTagContextMenu,
    onTableContextMenu,
}: {
    tag: Tag | null,
    tables: string[],
    onTableClick: (t: string) => void,
    color?: string,
    isOpen: boolean,
    onToggle: () => void,
    onTagContextMenu?: (e: React.MouseEvent, tag: Tag) => void,
    onTableContextMenu: (e: React.MouseEvent, table: string, tagId?: number) => void
}) => {
    const { setNodeRef, isOver } = useDroppable({
        id: tag ? `tag-${tag.id}` : 'tag-untagged',
        data: { tagId: tag ? tag.id : null }
    });

    return (
        <div ref={setNodeRef} style={{ marginBottom: '0.5rem', backgroundColor: isOver ? 'var(--bg-tertiary)' : 'transparent', borderRadius: '4px', border: isOver ? '1px solid var(--border-color)' : '1px solid transparent' }}>
            <div
                onClick={onToggle}
                onContextMenu={(e) => tag && onTagContextMenu?.(e, tag)}
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

            {isOpen && (
                <div style={{ paddingLeft: '0.5rem' }}>
                    {tables.map(table => (
                        <DraggableTableItem
                            key={table}
                            table={table}
                            onClick={() => onTableClick(table)}
                            fromTagId={tag ? tag.id : null}
                            onContextMenu={(e) => onTableContextMenu(e, table, tag?.id)}
                        />
                    ))}
                    {tables.length === 0 && <div style={{ padding: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>Empty</div>}
                </div>
            )}
        </div>
    );
};



// Wrapper for Import/Export Modal with mode selection


export const Sidebar: React.FC<SidebarProps> = ({
    sidebarOpen, connection, sessionId, /* savedConnections, */
    /* onSwitchConnection, */ onSwitchDatabase, onTableClick, /* onAddConnection, */ refreshTrigger,
    onGetTableSchema, onEditTableSchema, onDuplicateTable, onTruncateTable, onDropTable,
    savedQueries = [], savedFunctions = [], onQueryClick, onFunctionClick, onDeleteQuery, onDeleteFunction, onEditFunction,
    searchQuery = ''
}) => {
    const [viewMode, setViewMode] = useState<'az' | 'tags'>('az');
    const [showConnDropdown, setShowConnDropdown] = useState(false);
    const [viewData, setViewData] = useState<SidebarView>({ groups: [], untagged: [], databases: [] });
    const [showDatabaseManager, setShowDatabaseManager] = useState(false);

    // Global Context Menu State
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        type: 'table' | 'tag' | 'query' | 'function';
        data: any;
    } | null>(null);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (showConnDropdown && !target.closest('[data-conn-dropdown="true"]') && !target.closest('[data-conn-trigger="true"]')) {
                setShowConnDropdown(false);
            }
            if (contextMenu && !target.closest('[data-context-menu="true"]')) {
                setContextMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showConnDropdown, contextMenu]);

    const handleContextMenu = (e: React.MouseEvent, type: 'table' | 'tag' | 'query' | 'function', data: any) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            type,
            data
        });
    };

    const [showTagManager, setShowTagManager] = useState(false);
    const [editingTag, setEditingTag] = useState<Tag | undefined>(undefined);
    const [confirmModal, setConfirmModal] = useState<{ tag: Tag } | null>(null);
    const [activeDragItem, setActiveDragItem] = useState<string | null>(null);

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
            fetchSidebarView(true);
        } catch (e) {
            console.error('Failed to delete tag:', e);
        }
        setConfirmModal(null);
    };

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, {} as any)
    );

    // Track ongoing requests and debounce to prevent rapid re-fetches
    const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isFetchingRef = useRef(false);
    const lastFetchParamsRef = useRef<string>('');

    const getCurrentDatabase = useCallback(() => {
        if (!connection) return undefined;
        if (connection.db_type === 'sqlite') {
            return connection.host;
        }
        return connection.database_name;
    }, [connection]);

    const fetchSidebarView = useCallback(async (force = false) => {
        // Create a unique key for current params to dedupe identical requests
        const dbName = getCurrentDatabase();
        const fetchKey = `${connection.id}-${dbName}-${sessionId}-${searchQuery}`;

        // Skip if same params and not forced
        if (!force && fetchKey === lastFetchParamsRef.current) {
            return;
        }

        // Skip if already fetching (prevents overlapping requests)
        if (isFetchingRef.current) {
            return;
        }

        isFetchingRef.current = true;
        lastFetchParamsRef.current = fetchKey;

        try {
            const data = await invoke<SidebarView>('get_sidebar_view', {
                connectionId: connection.id,
                connectionString: sessionId || undefined,
                databaseName: dbName,
                searchQuery
            });
            setViewData(data);
        } catch (e) {
            console.error("Failed to fetch sidebar view", e);
        } finally {
            isFetchingRef.current = false;
        }
    }, [connection.id, getCurrentDatabase, sessionId, searchQuery]);

    // Track previous refreshTrigger to detect changes
    const prevRefreshTriggerRef = useRef(refreshTrigger);

    // Debounced effect for fetching sidebar view
    useEffect(() => {
        // Clear any pending fetch
        if (fetchTimeoutRef.current) {
            clearTimeout(fetchTimeoutRef.current);
        }

        // Check if refreshTrigger changed (force refresh)
        const shouldForce = prevRefreshTriggerRef.current !== refreshTrigger;
        prevRefreshTriggerRef.current = refreshTrigger;

        // Debounce the fetch to avoid rapid consecutive calls
        fetchTimeoutRef.current = setTimeout(() => {
            fetchSidebarView(shouldForce);
        }, 50); // Small debounce to batch rapid state changes

        return () => {
            if (fetchTimeoutRef.current) {
                clearTimeout(fetchTimeoutRef.current);
            }
        };
    }, [connection.id, connection.database_name, sessionId, refreshTrigger, searchQuery, fetchSidebarView]);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveDragItem(event.active.id as string);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        setActiveDragItem(null);
        const { active, over } = event;
        if (!over) return;

        const tableName = active.data.current?.tableName;
        const fromTagId = active.data.current?.fromTagId; // Draggable always uses fromTagId
        const toTagId = over.data.current?.tagId;

        // Moving between tags (Assign/Re-assign)
        if (tableName && toTagId !== undefined) {
            // If dropping on same tag, do nothing (no reordering)
            if (fromTagId === toTagId) return;

            const dbName = getCurrentDatabase();

            // Optimistic Update
            setViewData(prev => {
                let nextGroups = prev.groups.map(g => {
                    let newTables = g.tables;
                    // Remove from source if it was a tag
                    if (fromTagId && g.tag.id === fromTagId) {
                        newTables = newTables.filter(t => t !== tableName);
                    }
                    // Add to dest if it is a tag
                    if (toTagId && g.tag.id === toTagId) {
                        if (!newTables.includes(tableName)) {
                            newTables = [...newTables, tableName].sort();
                        }
                    }
                    return { ...g, tables: newTables };
                });

                let nextUntagged = prev.untagged;
                // Remove from source if it was untagged
                if (!fromTagId) {
                    nextUntagged = nextUntagged.filter(t => t !== tableName);
                }
                // Add to dest if it is untagged
                if (!toTagId) {
                    if (!nextUntagged.includes(tableName)) {
                        nextUntagged = [...nextUntagged, tableName].sort();
                    }
                }

                return { ...prev, groups: nextGroups, untagged: nextUntagged };
            });

            try {
                if (fromTagId) {
                    await invoke('remove_tag_from_table', {
                        connectionId: connection.id,
                        tableName: tableName,
                        databaseName: dbName,
                        tagId: fromTagId
                    });
                }
                if (toTagId) {
                    await invoke('assign_tag', {
                        connectionId: connection.id,
                        tableName: tableName,
                        databaseName: dbName,
                        tagId: toTagId
                    });
                }
                fetchSidebarView(true);
            } catch (e) {
                console.error('Error during drag operation:', e);
                fetchSidebarView(true);
            }
        }
    };

    const { groups, untagged, databases: availableDatabases } = viewData;

    const filteredTables = useMemo(() => {
        const all = new Set<string>();
        groups.forEach(g => g.tables.forEach(t => all.add(t)));
        untagged.forEach(t => all.add(t));
        return Array.from(all).sort();
    }, [viewData]);

    const filteredQueries = useMemo(() => searchQuery
        ? savedQueries.filter(q => q.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : savedQueries, [searchQuery, savedQueries]);

    const filteredFunctions = useMemo(() => searchQuery
        ? savedFunctions.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : savedFunctions, [searchQuery, savedFunctions]);

    const isSearching = searchQuery.length > 0;


    return (
        <div className={`${styles.sidebar} ${!sidebarOpen ? styles.closed : ''}`}>
            <div
                className={styles.sidebarConnection}
                onClick={() => setShowConnDropdown(!showConnDropdown)}
                data-conn-trigger="true" // Ensure trigger is marked
                style={{ position: 'relative' }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '0.5rem' }}>
                        {getCurrentDatabase() || <i style={{ color: 'var(--text-muted)', fontWeight: 400, opacity: 0.8 }}>Select Database</i>}
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
                                        color: (connection.database_name === db)
                                            ? 'var(--accent-primary)' : 'var(--text-primary)',
                                    }}
                                    onClick={(e) => { e.stopPropagation(); onSwitchDatabase(db); setShowConnDropdown(false); }}
                                >
                                    <Icons.Database size={14} />
                                    {db}
                                </div>
                            ))}
                            {availableDatabases.length === 0 && (
                                <div style={{ padding: '0.8rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    No databases found
                                </div>
                            )}
                        </div>
                        <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '0.25rem 0' }}></div>

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
                                    const group = groups.find(g => g.tables.includes(table));
                                    const tag = group ? group.tag : undefined;
                                    return (
                                        <DraggableTableItem
                                            key={table}
                                            table={table}
                                            onClick={() => onTableClick(table)}
                                            fromTagId={tag ? tag.id : null}
                                            onContextMenu={(e) => handleContextMenu(e, 'table', table)}
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
                                        onContextMenu={(e) => handleContextMenu(e, 'query', query)}
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
                                        onContextMenu={(e) => handleContextMenu(e, 'function', func)}
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
                            count={filteredTables.length}
                            icon={<Icons.Folder size={14} color="var(--text-secondary)" />}
                            isOpen={expandedSections.has('az-tables')}
                            onToggle={() => toggleSection('az-tables')}
                        >
                            {filteredTables.map(table => {
                                const group = groups.find(g => g.tables.includes(table));
                                const tag = group ? group.tag : undefined;
                                return (
                                    <DraggableTableItem
                                        key={table}
                                        table={table}
                                        onClick={() => onTableClick(table)}
                                        fromTagId={tag ? tag.id : null}
                                        tagColor={tag?.color}
                                        tagName={tag?.name}
                                        onContextMenu={(e) => handleContextMenu(e, 'table', table)}
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
                                        onContextMenu={(e) => handleContextMenu(e, 'query', query)}
                                    />
                                ))
                            ) : (
                                <div style={{ padding: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>No saved queries</div>
                            )}
                        </CollapsibleSection>

                        <CollapsibleSection
                            title="Functions"
                            count={savedFunctions.length}
                            icon={<Icons.MathFunction size={16} color="#f59e0b" />}
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
                                        onContextMenu={(e) => handleContextMenu(e, 'function', func)}
                                    />
                                ))
                            ) : (
                                <div style={{ padding: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>No functions</div>
                            )}
                        </CollapsibleSection>
                    </>
                ) : (
                    <DndContext
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        sensors={sensors}
                        collisionDetection={pointerWithin}
                    >
                        {groups.map(g => (
                            <TagGroup
                                key={g.tag.id}
                                tag={g.tag}
                                tables={g.tables}
                                onTableClick={onTableClick}
                                color={g.tag.color}
                                isOpen={expandedSections.has(`tag-${g.tag.id}`)}
                                onToggle={() => toggleSection(`tag-${g.tag.id}`)}
                                onTagContextMenu={(e, tag) => handleContextMenu(e, 'tag', tag)}
                                onTableContextMenu={(e, table) => handleContextMenu(e, 'table', table)}
                            />
                        ))}
                        {/* Untagged Section */}
                        <TagGroup
                            tag={null}
                            tables={untagged}
                            onTableClick={onTableClick}
                            isOpen={expandedSections.has('tag-untagged')}
                            onToggle={() => toggleSection('tag-untagged')}
                            onTableContextMenu={(e, table) => handleContextMenu(e, 'table', table)}
                        />
                        <DragOverlay>
                            {activeDragItem ? (
                                <div style={{
                                    padding: '4px 8px',
                                    backgroundColor: 'var(--bg-tertiary)',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    color: 'var(--text-primary)',
                                    boxShadow: '0 5px 15px rgba(0,0,0,0.25)',
                                    opacity: 0.9,
                                    cursor: 'grabbing'
                                }}>
                                    <Icons.Table size={14} style={{ marginRight: '0.5rem', opacity: 0.7 }} />
                                    {(() => {
                                        // Parse ID: table-{name} or {tagId}-{name}
                                        const parts = activeDragItem.split('-');
                                        return parts.length > 1 ? parts.slice(1).join('-') : activeDragItem;
                                    })()}
                                </div>
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                )}
            </div>

            {showTagManager && (
                <Portal>
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
                                onSuccess={() => { setShowTagManager(false); setEditingTag(undefined); fetchSidebarView(true); }}
                                onCancel={() => { setShowTagManager(false); setEditingTag(undefined); }}
                                editTag={editingTag}
                                connection={connection}
                            />
                        </div>
                    </div>
                </Portal>
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
                <Portal>
                    <DatabaseManagementModal
                        isOpen={showDatabaseManager}
                        onClose={() => setShowDatabaseManager(false)}
                        connection={connection}
                        onSuccess={() => {
                            // Refresh sidebar
                            fetchSidebarView(true);
                        }}
                        onDatabaseChange={onSwitchDatabase}
                    />
                </Portal>
            )}

            {/* Global Context Menu */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    style={{
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        minWidth: '160px',
                        overflow: 'hidden'
                    }}
                >
                    {contextMenu.type === 'table' && (
                        <>
                            <div className={styles.dropdownItem} onClick={() => { onGetTableSchema?.(contextMenu.data); setContextMenu(null); }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Icons.FileText size={14} /> Get Schema
                                </div>
                            </div>
                            <div className={styles.dropdownItem} onClick={() => { onEditTableSchema?.(contextMenu.data); setContextMenu(null); }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Icons.Pencil size={14} /> Edit Schema
                                </div>
                            </div>
                            <div className={styles.dropdownItem} onClick={() => { onDuplicateTable?.(contextMenu.data); setContextMenu(null); }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Icons.Copy size={14} /> Duplicate Table
                                </div>
                            </div>
                            <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }}></div>
                            <div className={styles.dropdownItem} onClick={() => { onTruncateTable?.(contextMenu.data); setContextMenu(null); }} style={{ color: '#ef4444' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Icons.AlertCircle size={14} /> Truncate Table
                                </div>
                            </div>
                            <div className={styles.dropdownItem} onClick={() => { onDropTable?.(contextMenu.data); setContextMenu(null); }} style={{ color: '#ef4444' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Icons.Trash2 size={14} /> Drop Table
                                </div>
                            </div>
                        </>
                    )}

                    {contextMenu.type === 'tag' && (
                        <>
                            <div className={styles.dropdownItem} onClick={() => { handleEditTag(contextMenu.data); setContextMenu(null); }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Icons.Pencil size={14} /> Edit Tag
                                </div>
                            </div>
                            <div className={styles.dropdownItem} onClick={() => { handleDeleteTag(contextMenu.data); setContextMenu(null); }} style={{ color: '#ef4444' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Icons.Trash2 size={14} /> Delete Tag
                                </div>
                            </div>
                        </>
                    )}

                    {contextMenu.type === 'query' && (
                        <>
                            {/* Assuming onQueryClick works as load. Edit logic needed? Typically 'Load' is click. */}
                            <div className={styles.dropdownItem} onClick={() => { onQueryClick?.(contextMenu.data); setContextMenu(null); }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Icons.Code2 size={14} /> Load Query
                                </div>
                            </div>
                            <div className={styles.dropdownItem} onClick={() => { onDeleteQuery?.(contextMenu.data.id); setContextMenu(null); }} style={{ color: '#ef4444' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Icons.Trash2 size={14} /> Delete Query
                                </div>
                            </div>
                        </>
                    )}

                    {contextMenu.type === 'function' && (
                        <>
                            <div className={styles.dropdownItem} onClick={() => { onEditFunction?.(contextMenu.data); setContextMenu(null); }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Icons.Pencil size={14} /> Edit Function
                                </div>
                            </div>
                            <div className={styles.dropdownItem} onClick={() => { onDeleteFunction?.(contextMenu.data.id); setContextMenu(null); }} style={{ color: '#ef4444' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Icons.Trash2 size={14} /> Delete Function
                                </div>
                            </div>
                        </>
                    )}
                </ContextMenu>
            )}
        </div>
    );
};
