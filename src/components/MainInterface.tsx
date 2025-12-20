import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import styles from '../styles/MainLayout.module.css';
import { Connection, QueryResult, PendingChange, Tag, TableTag, LogEntry, ColumnSchema } from '../types';
import { Plus, Code2, Table, Filter, Trash2, ChevronUp, ChevronDown, X, Copy, Download, Activity, ChevronLeft, ChevronRight, Clock, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { ConnectionForm } from './ConnectionForm';
import { Sidebar } from './Sidebar';
import { ChangelogSidebar } from './ChangelogSidebar';
import { QueryEditor } from './QueryEditor';
import { DataGrid } from './DataGrid';
import { TableCreator } from './TableCreator';
import { InsertRowPanel } from './InsertRowPanel';
import { Navbar } from './Navbar';
import { PreferencesModal } from './PreferencesModal';
import { WindowControls } from './WindowControls';
import { ConfirmModal } from './ConfirmModal';
import { DuplicateTableModal } from './DuplicateTableModal';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface MainInterfaceProps {
    connection: Connection;
    onSwitchConnection: (conn: Connection) => void;
}

interface TabResult {
    data: QueryResult | null;
    loading: boolean;
    error: string | null;
}

interface SortState {
    column: string;
    direction: 'ASC' | 'DESC';
}

// Sortable Tab Component
function SortableTab({ tab, isActive, onClick, onClose, onDoubleClick, color }: { tab: any, isActive: boolean, onClick: () => void, onClose: (e: any, id: string) => void, onDoubleClick?: () => void, color?: string }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: tab.id });
    const [isHovered, setIsHovered] = useState(false);
    const [isCloseHovered, setIsCloseHovered] = useState(false);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        cursor: 'pointer',
        padding: '0.5rem 1rem',
        backgroundColor: isActive ? 'var(--bg-primary)' : (isHovered ? 'var(--bg-tertiary)' : 'var(--bg-secondary)'),
        borderRight: '1px solid var(--border-color)',
        borderTop: isActive ? `2px solid ${color || 'var(--accent-color)'} ` : '2px solid transparent',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        minWidth: '120px',
        maxWidth: '200px',
        justifyContent: 'space-between',
        color: isActive ? (color || 'var(--text-primary)') : (isHovered ? (color || 'var(--text-primary)') : 'var(--text-secondary)'),
        userSelect: 'none' as const,
        height: '100%'
    };
    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onAuxClick={(e) => {
                // Middle-click (button 1) closes the tab
                if (e.button === 1) {
                    e.preventDefault();
                    onClose(e, tab.id);
                }
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                {tab.type === 'query' ? <Code2 size={14} style={{ flexShrink: 0, color: 'var(--accent-color)' }} /> :
                    tab.type === 'table' ? <Table size={14} style={{ flexShrink: 0, color: color || 'var(--text-primary)' }} /> :
                        tab.type === 'log' ? <Activity size={14} style={{ flexShrink: 0, color: '#a855f7' }} /> :
                            tab.type === 'create-table' ? <Plus size={14} style={{ flexShrink: 0, color: 'var(--accent-primary)' }} /> :
                                <Table size={14} style={{ flexShrink: 0 }} />}
                <span style={{
                    fontSize: '0.85rem',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontStyle: tab.isPreview ? 'italic' : 'normal'
                }}>{tab.title}</span>
            </div>
            <div
                role="button"
                onClick={(e) => onClose(e, tab.id)}
                onMouseEnter={() => setIsCloseHovered(true)}
                onMouseLeave={() => setIsCloseHovered(false)}
                style={{
                    opacity: isCloseHovered ? 1 : 0.6,
                    cursor: 'pointer',
                    display: 'flex',
                    flexShrink: 0,
                    marginLeft: '4px',
                    backgroundColor: isCloseHovered ? 'rgba(255, 77, 77, 0.2)' : 'transparent',
                    borderRadius: '4px',
                    padding: '2px',
                    color: isCloseHovered ? '#ff4d4d' : 'inherit'
                }}
            >
                <X size={12} />
            </div>
        </div>
    );
}

export const MainInterface: React.FC<MainInterfaceProps> = ({ connection, onSwitchConnection }) => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [tables, setTables] = useState<string[]>([]);
    const [savedConnections, setSavedConnections] = useState<Connection[]>([]);
    const [showNewConnModal, setShowNewConnModal] = useState(false);

    const [showPreferences, setShowPreferences] = useState(false);

    // Preference State - Load from localStorage
    const [theme, setTheme] = useState<'blue' | 'gray' | 'amoled' | 'light'>(() => {
        const saved = localStorage.getItem('app-theme');
        return (saved as 'blue' | 'gray' | 'amoled' | 'light') || 'blue';
    });
    const [zoom, setZoom] = useState(() => {
        const saved = localStorage.getItem('app-zoom');
        return saved ? parseFloat(saved) : 1;
    });
    const [showDbMenu, setShowDbMenu] = useState(false);

    // Window Management
    useEffect(() => {
        const maximize = async () => {
            try {
                // const win = getCurrentWindow();
                // await win.maximize();
            } catch (e) { console.error(e) }
        };
        maximize();
    }, [connection]);

    // Save and apply theme
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('app-theme', theme);
    }, [theme]);

    // Save zoom
    useEffect(() => {
        localStorage.setItem('app-zoom', zoom.toString());
    }, [zoom]);

    // Close dropdowns on outside click with ignore logic
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            // If clicking inside a dropdown or on a trigger, ignore
            if (target.closest('[data-dropdown="true"]') || target.closest('[data-dropdown-trigger="true"]')) {
                return;
            }
            if (showDbMenu) setShowDbMenu(false);
            // Remove showConnDropdown from here, handled in Sidebar
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showDbMenu]);

    const [tableSchemas, setTableSchemas] = useState<Record<string, ColumnSchema[]>>({});
    const [showEditWindow, setShowEditWindow] = useState(false);

    const handleZoom = (delta: number) => {
        setZoom(prev => Math.max(0.5, Math.min(2.0, prev + delta)));
    };

    // Keyboard Shortcuts for Zoom
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey) {
                if (e.key === '=' || e.key === '+') {
                    e.preventDefault();
                    handleZoom(0.1);
                } else if (e.key === '-') {
                    e.preventDefault();
                    handleZoom(-0.1);
                } else if (e.key === '0') {
                    e.preventDefault();
                    setZoom(1);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Tabs State - isPreview indicates tab is in preview mode (italic title, can be replaced)
    const [tabs, setTabs] = useState<{ id: string; type: 'table' | 'query' | 'create-table' | 'log'; title: string; isPreview?: boolean }[]>([
        { id: 'query1', type: 'query', title: 'Query 1' }
    ]);
    const [activeTabId, setActiveTabId] = useState('query1');
    const [resultsVisible, setResultsVisible] = useState(true);

    // Query Texts State (Persist per tab) - Start with empty query
    const [tabQueries, setTabQueries] = useState<Record<string, string>>({
        'query1': ''
    });

    // Results state keyed by tab ID
    const [results, setResults] = useState<Record<string, TabResult>>({});

    // Pagination State
    const [paginationMap, setPaginationMap] = useState<Record<string, { page: number, pageSize: number, total: number }>>({});

    // Sort State
    const [sortState, setSortState] = useState<SortState | null>(null);

    // Selection State
    const [selectedIndicesMap, setSelectedIndicesMap] = useState<Record<string, Set<number>>>({});
    const selectedIndices = selectedIndicesMap[activeTabId] || new Set();

    // Auto-pin tab when user interacts with it
    const pinActiveTab = () => {
        setTabs(prevTabs => prevTabs.map(t =>
            t.id === activeTabId && t.isPreview ? { ...t, isPreview: false } : t
        ));
    };

    const setSelectedIndices = (action: Set<number> | ((prev: Set<number>) => Set<number>)) => {
        // Pin tab when user selects rows (indicates interaction)
        pinActiveTab();
        setSelectedIndicesMap(prev => {
            const current = prev[activeTabId] || new Set();
            const next = typeof action === 'function' ? action(current) : action;
            return { ...prev, [activeTabId]: next };
        });
    };

    // Insert/Edit Panel State
    const [showInsertPanel, setShowInsertPanel] = useState(false);
    const [panelColumns, setPanelColumns] = useState<string[]>([]);
    const [editData, setEditData] = useState<Record<string, any>[] | undefined>(undefined);

    // Resize state
    const [resultsHeight, setResultsHeight] = useState(300);
    const [isResizing, setIsResizing] = useState(false);

    // Dropdown state for Table View
    const [activeDropdown, setActiveDropdown] = useState<'copy' | 'export' | 'pageSize' | null>(null);

    // Changelog State
    const [showChangelog, setShowChangelog] = useState(false);
    const [pendingChanges, setPendingChanges] = useState<Record<string, PendingChange[]>>({});

    // Logs State
    const [logs, setLogs] = useState<LogEntry[]>([]);

    // Refresh State
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Table Operation Confirmation Modal State
    const [tableConfirmModal, setTableConfirmModal] = useState<{
        type: 'truncate' | 'drop';
        tableName: string;
    } | null>(null);

    // Duplicate Table Modal State
    const [duplicateTableModal, setDuplicateTableModal] = useState<string | null>(null);
    const [highlightRowIndex, setHighlightRowIndex] = useState<number | null>(null);
    const [changelogConfirm, setChangelogConfirm] = useState<{ type: 'confirm' | 'discard' } | null>(null);

    // Tags for Coloring
    const [tags, setTags] = useState<Tag[]>([]);
    const [tableTags, setTableTags] = useState<TableTag[]>([]);


    useEffect(() => {
        const loadTags = async () => {
            try {
                const t = await invoke<Tag[]>('get_tags');
                setTags(t);
                const tt = await invoke<TableTag[]>('get_table_tags', { connectionId: connection.id });
                setTableTags(tt);
            } catch (e) { console.error(e); }
        };
        loadTags();
    }, [connection, refreshTrigger]);

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setTabs((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            setResultsHeight(h => Math.max(100, Math.min(800, h - e.movementY)));
        };
        const handleMouseUp = () => setIsResizing(false);

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    useEffect(() => {
        fetchTables();
    }, [connection]);

    useEffect(() => {
        fetchConnections();
    }, []);

    // Reset view state on tab switch
    useEffect(() => {
        setSelectedIndices(new Set());
        setSortState(null);
        setShowInsertPanel(false);
        setEditData(undefined);
    }, [activeTabId]);

    const activeTab = tabs.find(t => t.id === activeTabId);

    // Fetch data when switching to a table tab if not already loaded
    useEffect(() => {
        if (activeTab && activeTab.type === 'table') {
            if (!results[activeTab.id]) {
                fetchTableData(activeTab.id, activeTab.title);
            }
        }
    }, [activeTabId]);

    // Re-fetch when sort changes
    useEffect(() => {
        if (activeTab && activeTab.type === 'table') {
            fetchTableData(activeTab.id, activeTab.title);
        }
    }, [sortState]);

    const fetchTables = async () => {
        setRefreshTrigger(prev => prev + 1);
        try {
            const fetchedTables = await invoke<string[]>('get_tables', { connectionString: connection.connection_string });
            setTables(fetchedTables);
        } catch (e) {
            console.error("Failed to fetch tables:", e);
        }
    };

    const fetchConnections = async () => {
        try {
            const conns = await invoke<Connection[]>('list_connections');
            setSavedConnections(conns);
        } catch (e) {
            console.error("Failed to fetch connections", e);
        }
    };

    const fetchTableData = async (tabId: string, tableName: string, pageOverride?: number, pageSizeOverride?: number) => {
        // Optimistic update for loading state?
        // Don't clear data immediately if just paging? Maybe. User wants smoother exp.
        // For now, keep simple.
        setResults(prev => ({ ...prev, [tabId]: { ...prev[tabId], loading: true, error: null } }));

        const currentPag = paginationMap[tabId] || { page: 1, pageSize: 50, total: 0 };
        const page = pageOverride !== undefined ? pageOverride : currentPag.page;
        const pageSize = pageSizeOverride !== undefined ? pageSizeOverride : currentPag.pageSize;

        // Skip fetching data for special tabs like "Schema: [table]"
        if (tableName.startsWith('Schema: ')) return;

        try {
            const isMysql = connection.connection_string.startsWith('mysql:');
            const q = isMysql ? '`' : '"';

            // Get Schema if not cached (for PK detection)
            if (!tableSchemas[tableName]) {
                try {
                    const schema = await invoke<ColumnSchema[]>('get_table_schema', {
                        connectionString: connection.connection_string,
                        tableName
                    });
                    setTableSchemas(prev => ({ ...prev, [tableName]: schema }));
                } catch (e) {
                    console.error('Failed to fetch schema for', tableName, e);
                }
            }

            // Get Count
            // TODO: Optimize by caching count?
            const countRes = await invoke<QueryResult>('execute_query', {
                connectionString: connection.connection_string,
                query: `SELECT COUNT(*) as count FROM ${q}${tableName}${q}`
            });
            const total = countRes.rows.length > 0 ? parseInt(countRes.rows[0][0]) : 0;

            let query = `SELECT * FROM ${q}${tableName}${q}`;
            if (sortState) {
                query += ` ORDER BY ${q}${sortState.column}${q} ${sortState.direction}`;
            }
            // Ensure valid offset
            const offset = Math.max(0, (page - 1) * pageSize);
            query += ` LIMIT ${pageSize} OFFSET ${offset}`;

            const res = await invoke<QueryResult>('execute_query', {
                connectionString: connection.connection_string,
                query
            });
            setResults(prev => ({ ...prev, [tabId]: { data: res, loading: false, error: null } }));
            setPaginationMap(prev => ({ ...prev, [tabId]: { page, pageSize, total } }));
        } catch (e) {
            setResults(prev => ({ ...prev, [tabId]: { data: null, loading: false, error: String(e) } }));
        }
    };

    const handlePendingDelete = () => {
        if (!activeTab || activeTab.type !== 'table' || !results[activeTab.id]?.data) return;
        const currentData = results[activeTab.id].data!;

        const cols = currentData.columns;
        const idColIdx = cols.findIndex(c => c.toLowerCase() === 'id');
        const idColName = idColIdx !== -1 ? cols[idColIdx] : null;
        const isMysql = connection.connection_string.startsWith('mysql:');
        const q = isMysql ? '`' : '"';

        const safeVal = (v: any) => {
            if (v === null || v === 'NULL') return 'NULL';
            if (!isNaN(Number(v)) && v !== '') return v;
            return `'${String(v).replace(/'/g, "''")}'`;
        };

        const existingRowsCount = currentData.rows.length;
        const newChanges: PendingChange[] = [];
        const insertIndicesToRemove: number[] = [];

        selectedIndices.forEach(idx => {
            // Check if this is an INSERT (virtual) row
            if (idx >= existingRowsCount) {
                // Track which INSERT to remove
                insertIndicesToRemove.push(idx);
                return;
            }

            const row = currentData.rows[idx];
            // Check if already deleted
            const existing = pendingChanges[activeTab.id]?.find(c => c.type === 'DELETE' && c.rowIndex === idx);
            if (!existing && row) {
                let generatedSql = '';
                if (idColName) {
                    const idVal = row[idColIdx];
                    generatedSql = `DELETE FROM ${q}${activeTab.title}${q} WHERE ${q}${idColName}${q} = ${safeVal(idVal)}`;
                } else {
                    const whereClause = cols.map((c, i) => {
                        const val = row[i];
                        return `${q}${c}${q} ${val === null ? 'IS NULL' : `= ${safeVal(val)}`}`;
                    }).join(' AND ');
                    generatedSql = `DELETE FROM ${q}${activeTab.title}${q} WHERE ${whereClause}`;
                }

                newChanges.push({
                    type: 'DELETE',
                    tableName: activeTab.title,
                    rowIndex: idx,
                    rowData: row,
                    generatedSql
                });
            }
        });

        // Remove INSERT pending changes for virtual rows that were selected
        setPendingChanges(prev => {
            let tabChanges = [...(prev[activeTab.id] || [])];

            // Remove INSERT rows by their offset
            if (insertIndicesToRemove.length > 0) {
                const insertChanges = tabChanges.filter(c => c.type === 'INSERT');
                const insertOffsetsToRemove = insertIndicesToRemove.map(idx => idx - existingRowsCount);
                const insertsToRemove = insertOffsetsToRemove
                    .filter(offset => offset >= 0 && offset < insertChanges.length)
                    .map(offset => insertChanges[offset]);
                tabChanges = tabChanges.filter(c => !insertsToRemove.includes(c));
            }

            // Add new DELETE changes
            return {
                ...prev,
                [activeTab.id]: [...tabChanges, ...newChanges]
            };
        });
        setSelectedIndices(new Set());
    };

    const handleRunQuery = async (query: string) => {
        if (!activeTabId) return;
        setResults(prev => ({ ...prev, [activeTabId]: { data: null, loading: true, error: null } }));
        try {
            const res = await invoke<QueryResult>('execute_query', {
                connectionString: connection.connection_string,
                query
            });
            setResults(prev => ({ ...prev, [activeTabId]: { data: res, loading: false, error: null } }));
            addLog(query, 'Success', undefined, undefined, res.rows.length);
        } catch (e) {
            setResults(prev => ({ ...prev, [activeTabId]: { data: null, loading: false, error: String(e) } }));
            addLog(query, 'Error', undefined, String(e));
        }
    };

    const handleAddTableTab = () => {
        const newTabId = `create-table-${Date.now()}`;
        setTabs([...tabs, { id: newTabId, type: 'create-table', title: 'New Table' }]);
        setActiveTabId(newTabId);
    };

    const handleAddQuery = () => {
        const newId = `query${tabs.length + 1}`;
        setTabs([...tabs, { id: newId, type: 'query', title: `Query ${tabs.length + 1}` }]);
        setActiveTabId(newId);
    };

    // Single click opens table in preview mode (italic title, can be replaced by next single-click)
    // Double-click on tab pins it (removes preview mode)
    const handleTableClick = (tableName: string) => {
        // Check if already exists as a pinned tab
        const existingPinned = tabs.find(t => t.title === tableName && t.type === 'table' && !t.isPreview);
        if (existingPinned) {
            setActiveTabId(existingPinned.id);
            return;
        }

        // Check if this table is already the preview tab
        const existingPreview = tabs.find(t => t.title === tableName && t.type === 'table' && t.isPreview);
        if (existingPreview) {
            setActiveTabId(existingPreview.id);
            return;
        }

        // Find any existing preview tab (to replace it)
        const previewTab = tabs.find(t => t.isPreview);

        if (previewTab) {
            // Replace the preview tab with the new table
            setTabs(tabs.map(t =>
                t.id === previewTab.id
                    ? { ...t, id: `table-${tableName}`, title: tableName, isPreview: true }
                    : t
            ));
            // Clear results for old preview tab
            const newResults = { ...results };
            delete newResults[previewTab.id];
            setResults(newResults);
            setActiveTabId(`table-${tableName}`);
        } else {
            // Create new preview tab
            const newTabId = `table-${tableName}`;
            setTabs([...tabs, { id: newTabId, type: 'table', title: tableName, isPreview: true }]);
            setActiveTabId(newTabId);
        }
    };

    // Pin tab (remove preview mode) - called on double-click
    const pinTab = (tabId: string) => {
        setTabs(tabs.map(t =>
            t.id === tabId ? { ...t, isPreview: false } : t
        ));
    };

    // ---- Table Context Menu Actions ----

    // Get Table Schema - Opens a tab showing the schema
    const handleGetTableSchema = async (tableName: string) => {
        try {
            const schema = await invoke<ColumnSchema[]>('get_table_schema', {
                connectionString: connection.connection_string,
                tableName
            });

            // Convert schema to QueryResult format for display in DataGrid
            const schemaResult: QueryResult = {
                columns: ['Column', 'Type', 'Nullable', 'Default', 'Key'],
                rows: schema.map(col => [
                    col.name,
                    col.data_type,
                    col.is_nullable,
                    col.column_default || 'NULL',
                    col.column_key
                ])
            };

            // Create a schema tab
            const tabId = `schema-${tableName}`;
            const existingTab = tabs.find(t => t.id === tabId);
            if (!existingTab) {
                setTabs([...tabs, { id: tabId, type: 'table', title: `Schema: ${tableName}` }]);
            }
            setActiveTabId(tabId);
            setResults(prev => ({
                ...prev,
                [tabId]: { data: schemaResult, loading: false, error: null }
            }));
        } catch (e) {
            console.error('Failed to get table schema:', e);
        }
    };

    // Edit Table Schema - Opens the TableCreator with existing schema
    const handleEditTableSchema = (tableName: string) => {
        // Open Add Table tab - in a real implementation, you'd prefill with existing schema
        const tabId = `create-table-${Date.now()}`;
        setTabs([...tabs, { id: tabId, type: 'create-table', title: `Edit: ${tableName}` }]);
        setActiveTabId(tabId);
    };

    // Duplicate Table - Show modal
    const handleDuplicateTable = (tableName: string) => {
        setDuplicateTableModal(tableName);
    };

    // Confirm Duplicate Table
    const confirmDuplicateTable = async (newName: string, includeData: boolean) => {
        if (!duplicateTableModal) return;

        try {
            await invoke('duplicate_table', {
                connectionString: connection.connection_string,
                sourceTable: duplicateTableModal,
                newTable: newName,
                includeData
            });
            setRefreshTrigger(prev => prev + 1);
            fetchTables();
        } catch (e) {
            console.error('Failed to duplicate table:', e);
            alert(`Failed to duplicate table: ${e}`);
        }
        setDuplicateTableModal(null);
    };

    // Truncate Table - Show confirmation modal
    const handleTruncateTable = (tableName: string) => {
        setTableConfirmModal({ type: 'truncate', tableName });
    };

    // Drop Table - Show confirmation modal
    const handleDropTable = (tableName: string) => {
        setTableConfirmModal({ type: 'drop', tableName });
    };

    // Confirm table operation
    const confirmTableOperation = async () => {
        if (!tableConfirmModal) return;

        try {
            if (tableConfirmModal.type === 'truncate') {
                await invoke('truncate_table', {
                    connectionString: connection.connection_string,
                    tableName: tableConfirmModal.tableName
                });
            } else if (tableConfirmModal.type === 'drop') {
                await invoke('drop_table', {
                    connectionString: connection.connection_string,
                    tableName: tableConfirmModal.tableName
                });
                // Close any tabs for this table
                setTabs(tabs.filter(t => t.title !== tableConfirmModal.tableName));
            }
            setRefreshTrigger(prev => prev + 1);
            fetchTables();
        } catch (e) {
            console.error(`Failed to ${tableConfirmModal.type} table:`, e);
            alert(`Failed to ${tableConfirmModal.type} table: ${e}`);
        }
        setTableConfirmModal(null);
    };

    const closeTab = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const newTabs = tabs.filter(t => t.id !== id);
        setTabs(newTabs);

        // Clean up results
        const newResults = { ...results };
        delete newResults[id];
        setResults(newResults);

        if (activeTabId === id && newTabs.length > 0) {
            setActiveTabId(newTabs[newTabs.length - 1].id);
        } else if (newTabs.length === 0) {
            setActiveTabId('');
        }
    };

    const handleTableCreated = () => {
        fetchTables();
        if (activeTabId) {
            closeTab({ stopPropagation: () => { } } as React.MouseEvent, activeTabId);
        }
    };

    const handleInsertRow = () => {
        if (!activeTab || activeTab.type !== 'table' || !results[activeTab.id]?.data) return;
        const currentData = results[activeTab.id].data!;

        // Create empty row data based on columns
        // const newRow: any = {};
        // currentData.columns.forEach(c => newRow[c] = '');
        const newRowArray = currentData.columns.map(() => '');

        const newChange: PendingChange = {
            type: 'INSERT',
            tableName: activeTab.title,
            rowIndex: currentData.rows.length + (pendingChanges[activeTab.id]?.filter(p => p.type === 'INSERT').length || 0),
            rowData: newRowArray
        };

        setPendingChanges(prev => ({
            ...prev,
            [activeTab.id]: [...(prev[activeTab.id] || []), newChange]
        }));

        // Select the new virtual row (ADD to existing selection)
        const newIdx = currentData.rows.length + (pendingChanges[activeTab.id]?.filter(p => p.type === 'INSERT').length || 0);
        setSelectedIndices(prev => new Set([...prev, newIdx]));
    };

    const handleOpenInsertSidebar = () => {
        if (!activeTab || activeTab.type !== 'table') return;

        if (showEditWindow) {
            setShowEditWindow(false);
        } else {
            setShowChangelog(false);
            setPanelColumns(results[activeTab.id]?.data?.columns || []);
            setShowEditWindow(true);
        }
    };

    // handleOpenEdit removed

    const handleDeleteRows = async () => {
        handlePendingDelete();
    };

    const handlePanelSubmit = async (data: Record<string, any>[]) => {
        if (!activeTab || activeTab.type !== 'table') return;

        // PENDING UPDATE Logic
        if (selectedIndices.size > 0 && editData) {
            const indices = Array.from(selectedIndices).sort((a, b) => a - b);
            const currentData = results[activeTab.id]?.data;
            if (!currentData) return;

            const cols = currentData.columns;
            const idColIdx = cols.findIndex(c => c.toLowerCase() === 'id');
            const idColName = idColIdx !== -1 ? cols[idColIdx] : null;
            const isMysql = connection.connection_string.startsWith('mysql:');
            const q = isMysql ? '`' : '"';

            const safeVal = (v: any) => {
                if (v === null || v === 'NULL') return 'NULL';
                if (!isNaN(Number(v)) && v !== '') return v;
                return `'${String(v).replace(/'/g, "''")}'`;
            };

            const newChanges: PendingChange[] = [];

            data.forEach((newRow, i) => {
                const rowIndex = indices[i];
                if (rowIndex === undefined || !currentData.rows[rowIndex]) return;
                const oldRow = currentData.rows[rowIndex];

                Object.keys(newRow).forEach(col => {
                    const colIdx = currentData.columns.indexOf(col);
                    if (colIdx === -1) return;
                    const oldVal = oldRow[colIdx];
                    const newVal = newRow[col];

                    if (String(oldVal) !== String(newVal)) {
                        let generatedSql = '';
                        if (idColName) {
                            const idVal = oldRow[idColIdx];
                            generatedSql = `UPDATE ${q}${activeTab.title}${q} SET ${q}${col}${q} = ${safeVal(newVal)} WHERE ${q}${idColName}${q} = ${safeVal(idVal)}`;
                        } else {
                            // Where fallback
                            const whereClause = cols.map((c, idx) => {
                                const val = oldRow[idx];
                                return `${q}${c}${q} ${val === null ? 'IS NULL' : `= ${safeVal(val)}`}`;
                            }).join(' AND ');
                            generatedSql = `UPDATE ${q}${activeTab.title}${q} SET ${q}${col}${q} = ${safeVal(newVal)} WHERE ${whereClause}`;
                        }

                        newChanges.push({
                            type: 'UPDATE',
                            tableName: activeTab.title,
                            rowIndex: rowIndex,
                            rowData: oldRow,
                            column: col,
                            oldValue: oldVal,
                            newValue: newVal,
                            generatedSql
                        });
                    }
                });
            });

            setPendingChanges(prev => {
                const current = prev[activeTab.id] || [];
                const filtered = current.filter(c =>
                    !(c.type === 'UPDATE' && newChanges.some(nc => nc.rowIndex === c.rowIndex && nc.column === c.column))
                );
                return { ...prev, [activeTab.id]: [...filtered, ...newChanges] };
            });

            setShowInsertPanel(false);
            setEditData(undefined);
            setSelectedIndices(new Set());
            return;
        }

        // INSERT (Immediate)
        const isMysql = connection.connection_string.startsWith('mysql:');
        const q = isMysql ? '`' : '"';
        const tableName = activeTab.title;

        const keys = Object.keys(data[0] || {}).filter(k => k);
        if (keys.length === 0) return;
        const allKeys = Array.from(new Set(data.flatMap(d => Object.keys(d))));
        const validKeys = allKeys.filter(k => k && k !== '');
        if (validKeys.length === 0) return;
        const cols = validKeys.map(k => `${q}${k}${q}`).join(', ');
        const valueGroups = data.map(d => {
            return `(${validKeys.map(k => {
                const val = d[k];
                if (val === null || val === undefined || val === 'NULL') return 'NULL';
                if (!isNaN(Number(val)) && val !== '') return val;
                return `'${String(val).replace(/'/g, "''")}'`;
            }).join(', ')})`;
        });
        const query = `INSERT INTO ${q}${tableName}${q} (${cols}) VALUES ${valueGroups.join(', ')}`;

        try {
            await invoke('execute_query', {
                connectionString: connection.connection_string,
                query
            });
            setShowInsertPanel(false);
            setEditData(undefined);
            fetchTableData(activeTab.id, activeTab.title);
            addLog(query, 'Success', activeTab.title, undefined, valueGroups.length);
        } catch (e) {
            alert(`Insert failed: ${e}`);
            addLog(`Insert failed: ${e}`, 'Error', activeTab.title, String(e));
        }
    };

    const addLog = (query: string, status: 'Success' | 'Error', table?: string, error?: string, rows?: number, user?: string) => {
        const newLog: LogEntry = {
            id: crypto.randomUUID(),
            time: new Date().toLocaleTimeString(),
            status,
            table,
            query,
            error,
            rows,
            user: user || connection.name
        };
        setLogs(prev => [newLog, ...prev]);
    };

    const handleRevertChange = (tabId: string, changeIndex: number) => {
        setPendingChanges(prev => {
            const list = prev[tabId] || [];
            if (changeIndex < 0 || changeIndex >= list.length) return prev;
            const newList = [...list];
            newList.splice(changeIndex, 1);
            return { ...prev, [tabId]: newList };
        });
    };

    const handleConfirmChanges = async () => {
        setChangelogConfirm({ type: 'confirm' });
    };

    const executeConfirmChanges = async () => {
        const isMysql = connection.connection_string.startsWith('mysql:');
        const q = isMysql ? '`' : '"';

        try {
            for (const [tabId, changes] of Object.entries(pendingChanges)) {
                if (changes.length === 0) continue;

                const res = results[tabId];
                if (!res || !res.data) continue;

                const cols = res.data.columns;
                const idColIdx = cols.findIndex(c => c.toLowerCase() === 'id');
                // Use rowid if no ID? SQLite specific.
                // For now, if no ID, try to use all columns? Too complex.
                // Just log if ID missing.
                if (idColIdx === -1) {
                    // Try to finding a column with 'id' in it?
                    // alert(`Cannot apply changes for ${changes[0].tableName}: No 'id' column.`);
                    // continue;
                }
                const idColName = idColIdx !== -1 ? cols[idColIdx] : null;

                for (const change of changes) {
                    let query = change.generatedSql || '';
                    if (!query) {
                        const row = change.rowData as any[];
                        // Re-construct logic if generatedSql fallback missing
                        const safeVal = (v: any) => {
                            if (v === null || v === 'NULL') return 'NULL';
                            if (!isNaN(Number(v)) && v !== '') return v;
                            return `'${String(v).replace(/'/g, "''")}'`;
                        };

                        if (idColName) {
                            const idVal = row[idColIdx];
                            if (change.type === 'DELETE') {
                                query = `DELETE FROM ${q}${change.tableName}${q} WHERE ${q}${idColName}${q} = ${safeVal(idVal)}`;
                            } else if (change.type === 'UPDATE') {
                                if (!change.column) continue;
                                query = `UPDATE ${q}${change.tableName}${q} SET ${q}${change.column}${q} = ${safeVal(change.newValue)} WHERE ${q}${idColName}${q} = ${safeVal(idVal)}`;
                            } else if (change.type === 'INSERT') {
                                const colNames = cols.map(c => `${q}${c}${q}`).join(', ');
                                const values = row.map((v: any) => safeVal(v)).join(', ');
                                query = `INSERT INTO ${q}${change.tableName}${q} (${colNames}) VALUES (${values})`;
                            }
                        } else {
                            // Fallback
                            const whereClause = cols.map((c, i) => {
                                const val = row[i];
                                return `${q}${c}${q} ${val === null ? 'IS NULL' : `= ${safeVal(val)}`}`;
                            }).join(' AND ');

                            if (change.type === 'DELETE') {
                                query = `DELETE FROM ${q}${change.tableName}${q} WHERE ${whereClause}`;
                            } else if (change.type === 'UPDATE') {
                                if (!change.column) continue;
                                query = `UPDATE ${q}${change.tableName}${q} SET ${q}${change.column}${q} = ${safeVal(change.newValue)} WHERE ${whereClause}`;
                            } else if (change.type === 'INSERT') {
                                const colNames = cols.map(c => `${q}${c}${q}`).join(', ');
                                const values = row.map((v: any) => safeVal(v)).join(', ');
                                query = `INSERT INTO ${q}${change.tableName}${q} (${colNames}) VALUES (${values})`;
                            }
                        }
                    }

                    if (query) {
                        await invoke('execute_query', { connectionString: connection.connection_string, query });
                        addLog(query, 'Success', change.tableName, undefined, 1);
                    }
                }
                const tab = tabs.find(t => t.id === tabId);
                if (tab) fetchTableData(tabId, tab.title);
            }
            setPendingChanges({});
            setShowChangelog(false);
            setChangelogConfirm(null);
        } catch (e) {
            alert(`Failed to apply changes: ${e}`);
            addLog(`Error applying changes: ${e}`, 'Error', undefined, String(e));
            setChangelogConfirm(null);
        }
    };

    const handleDiscardChanges = () => {
        setChangelogConfirm({ type: 'discard' });
    };

    const executeDiscardChanges = () => {
        setPendingChanges({});
        setShowChangelog(false);
        setSelectedIndices(new Set());
        setChangelogConfirm(null);
    };

    const handleNavigateToChange = (tabId: string, rowIndex: number) => {
        const existingTab = tabs.find(t => t.id === tabId);
        if (existingTab) {
            setActiveTabId(tabId);
        } else {
            // Try to re-open closed tab
            const changes = pendingChanges[tabId];
            if (changes && changes.length > 0) {
                const tableName = changes[0].tableName;
                if (tableName) handleTableClick(tableName);
            }
        }
        setHighlightRowIndex(rowIndex);
        setTimeout(() => setHighlightRowIndex(null), 2000);
    };

    const handleCellEdit = (rowIndex: number, column: string, value: any) => {
        if (!activeTab || activeTab.type !== 'table') return;
        const currentData = results[activeTab.id]?.data;
        if (!currentData) return;

        const colIdx = currentData.columns.indexOf(column);
        if (colIdx === -1) return;

        const tabId = activeTab.id;
        const existingRows = currentData.rows;

        // Check if this is a virtual INSERT row
        if (rowIndex >= existingRows.length) {
            // This is an INSERT row - update the rowData in the INSERT pending change
            const insertRowOffset = rowIndex - existingRows.length;
            setPendingChanges(prev => {
                const tabChanges = [...(prev[tabId] || [])];
                const insertChanges = tabChanges.filter(c => c.type === 'INSERT');
                if (insertRowOffset < insertChanges.length) {
                    const insertChange = insertChanges[insertRowOffset];
                    const newRowData = [...(insertChange.rowData as any[])];
                    newRowData[colIdx] = value;
                    // Find and update the actual change in tabChanges
                    const actualIdx = tabChanges.findIndex(c => c === insertChange);
                    if (actualIdx !== -1) {
                        tabChanges[actualIdx] = { ...insertChange, rowData: newRowData };
                    }
                }
                return { ...prev, [tabId]: tabChanges };
            });
            return;
        }

        // This is an existing row - UPDATE logic
        const row = existingRows[rowIndex];
        const oldValue = row[colIdx];

        setPendingChanges(prev => {
            const tabChanges = prev[tabId] || [];
            const existingIdx = tabChanges.findIndex(c => c.type === 'UPDATE' && c.rowIndex === rowIndex && c.column === column);

            let newChanges = [...tabChanges];

            // If reverting to original value, remove the pending change
            if (String(oldValue) === String(value)) {
                if (existingIdx !== -1) {
                    newChanges.splice(existingIdx, 1);
                }
                return { ...prev, [tabId]: newChanges };
            }

            if (existingIdx !== -1) {
                // Update existing change
                newChanges[existingIdx] = {
                    ...newChanges[existingIdx],
                    newValue: value
                };
            } else {
                // Determine ID column for generatedSql (best effort)
                const idColIdx = currentData.columns.findIndex(c => c.toLowerCase() === 'id');
                const idVal = idColIdx !== -1 ? row[idColIdx] : null;
                const isMysql = connection.connection_string.startsWith('mysql:');
                const q = isMysql ? '`' : '"';

                // Basic SQL generation (can be improved or done server-side)
                let generatedSql = '';
                if (idVal !== null) {
                    const safeVal = (v: any) => {
                        if (v === null || v === 'NULL') return 'NULL';
                        if (!isNaN(Number(v)) && v !== '') return v;
                        return `'${String(v).replace(/'/g, "''")}'`;
                    };
                    generatedSql = `UPDATE ${q}${activeTab.title}${q} SET ${q}${column}${q} = ${safeVal(value)} WHERE ${q}${currentData.columns[idColIdx]}${q} = ${safeVal(idVal)}`;
                }

                newChanges.push({
                    type: 'UPDATE',
                    tableName: activeTab.title,
                    rowIndex,
                    rowData: row,
                    column,
                    oldValue,
                    newValue: value,
                    generatedSql
                });
            }
            return { ...prev, [tabId]: newChanges };
        });
    };

    const handleSwitchConnectionWrapper = (conn: Connection) => {
        const hasChanges = Object.values(pendingChanges).some(list => list.length > 0);
        if (hasChanges) {
            if (!confirm('You have unsaved changes that will be lost. Continue switching connection?')) {
                return;
            }
        }
        onSwitchConnection(conn);
    };

    const generateDataText = (format: 'CSV' | 'JSON', data: QueryResult, indices: number[]) => {
        if (format === 'JSON') {
            const rows = indices.map(i => {
                const r = data.rows[i];
                const obj: any = {};
                data.columns.forEach((c, idx) => obj[c] = r[idx]);
                return obj;
            });
            return JSON.stringify(rows, null, 2);
        } else {
            let text = data.columns.join(',') + '\n';
            text += indices.map(i => {
                return data.rows[i].map(cell => {
                    if (cell === null) return 'NULL';
                    if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
                        return `"${cell.replace(/"/g, '""')}"`;
                    }
                    return cell;
                }).join(',');
            }).join('\n');
            return text;
        }
    };

    const handleCopy = async (format: 'CSV' | 'JSON') => {
        let data: QueryResult | null = null;
        let indices: number[] = [];

        if (activeTab?.type === 'log') {
            data = {
                columns: ['Time', 'Status', 'Table', 'Query', 'Error', 'User', 'Rows'],
                rows: logs.map(l => [l.time, l.status, l.table || '-', l.query, l.error || '', l.user || '', l.rows ? String(l.rows) : ''])
            };
            indices = selectedIndices.size > 0 ? Array.from(selectedIndices) : logs.map((_, i) => i);
        } else if (activeTab && results[activeTab.id]?.data) {
            data = results[activeTab.id].data!;
            indices = Array.from(selectedIndices);
        }

        if (!data || indices.length === 0) return;
        const text = generateDataText(format, data, indices);
        try {
            await navigator.clipboard.writeText(text);
        } catch (e) {
            console.error(e);
        }
    };

    const handleExport = (format: 'CSV' | 'JSON') => {
        let data: QueryResult | null = null;
        let indices: number[] = [];

        if (activeTab?.type === 'log') {
            data = {
                columns: ['Time', 'Status', 'Table', 'Query', 'Error', 'User', 'Rows'],
                rows: logs.map(l => [l.time, l.status, l.table || '-', l.query, l.error || '', l.user || '', l.rows ? String(l.rows) : ''])
            };
            indices = selectedIndices.size > 0 ? Array.from(selectedIndices) : logs.map((_, i) => i);
        } else if (activeTab && results[activeTab.id]?.data) {
            data = results[activeTab.id].data!;
            indices = Array.from(selectedIndices);
        }

        if (!data || indices.length === 0) return;
        const text = generateDataText(format, data, indices);

        const blob = new Blob([text], { type: format === 'JSON' ? 'application/json' : 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export.${format.toLowerCase()}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleOpenLogs = () => {
        const logTabId = 'logs-tab';
        const existing = tabs.find(t => t.id === logTabId);
        if (!existing) {
            setTabs([...tabs, { id: logTabId, type: 'log', title: 'System Logs' }]);
        }
        setActiveTabId(logTabId);
    };

    const totalChanges = Object.values(pendingChanges).reduce((acc, curr) => acc + curr.length, 0);

    return (
        <div className={styles.container} style={{ zoom: zoom, width: `calc(100vw / ${zoom})`, height: `calc(100vh / ${zoom})` } as any}>
            <PreferencesModal
                isOpen={showPreferences}
                onClose={() => setShowPreferences(false)}
                theme={theme}
                setTheme={setTheme}
                zoom={zoom}
                setZoom={setZoom}
            />


            <Navbar
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                showDbMenu={showDbMenu}
                setShowDbMenu={setShowDbMenu}
                setShowPreferences={setShowPreferences}
                handleAddTableTab={handleAddTableTab}
                fetchTables={fetchTables}
                handleAddQuery={handleAddQuery}
                showChangelog={showChangelog}
                setShowChangelog={setShowChangelog}
                totalChanges={totalChanges}
                handleOpenLogs={handleOpenLogs}
                handleOpenEditWindow={handleOpenInsertSidebar}
                showEditWindow={showEditWindow}
                handleOpenSchema={() => {
                    if (activeTab && activeTab.type === 'table') {
                        // Refresh schema view if checking a schema tab, or get schema for a table
                        if (activeTab.title.startsWith('Schema: ')) {
                            handleGetTableSchema(activeTab.title.replace('Schema: ', ''));
                        } else {
                            handleGetTableSchema(activeTab.title);
                        }
                    }
                }}
            />

            <div className={styles.body}>
                <Sidebar
                    sidebarOpen={sidebarOpen}
                    connection={connection}
                    tables={tables}
                    savedConnections={savedConnections}
                    onSwitchConnection={handleSwitchConnectionWrapper}
                    onTableClick={handleTableClick}
                    onAddConnection={() => setShowNewConnModal(true)}
                    refreshTrigger={refreshTrigger}
                    onGetTableSchema={handleGetTableSchema}
                    onEditTableSchema={handleEditTableSchema}
                    onDuplicateTable={handleDuplicateTable}
                    onTruncateTable={handleTruncateTable}
                    onDropTable={handleDropTable}
                />

                <div className={styles.content}>
                    <div className={styles.tabBar}>
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={tabs.map(t => t.id)} strategy={horizontalListSortingStrategy}>
                                <div className={styles.tabsContainer} style={{ display: 'flex', overflowX: 'auto' }}>
                                    {tabs.map(tab => {
                                        let color: string | undefined;
                                        if (tab.type === 'table') {
                                            const tt = tableTags.find(t => t.table_name === tab.title);
                                            const tag = tt ? tags.find(t => t.id === tt.tag_id) : undefined;
                                            color = tag?.color;
                                        }
                                        return (
                                            <SortableTab
                                                key={tab.id}
                                                tab={tab}
                                                isActive={activeTabId === tab.id}
                                                onClick={() => setActiveTabId(tab.id)}
                                                onClose={closeTab}
                                                onDoubleClick={() => pinTab(tab.id)}
                                                color={color}
                                            />
                                        );
                                    })}
                                </div>
                            </SortableContext>
                        </DndContext>
                    </div>

                    <div className={styles.mainView}>
                        {!activeTab ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                                <div style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.2 }}>❖</div>
                                <p>No tabs open</p>
                                <button className={styles.outlineBtn} onClick={handleAddQuery} style={{ marginTop: '1rem' }}>Open New Query</button>
                            </div>
                        ) : activeTab.type === 'table' ? (
                            <>
                                <div className={styles.tableToolbar}>
                                    <button className={styles.outlineBtn} onClick={handleInsertRow} style={{ border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', backgroundColor: 'transparent' }}>
                                        <Plus size={14} /> Insert
                                    </button>

                                    <button className={styles.toolbarBtn} onClick={() => fetchTableData(activeTab.id, activeTab.title)} title="Refresh">
                                        <RefreshCw size={14} />
                                    </button>
                                    <div className={styles.verticalDivider} style={{ height: 16 }}></div>
                                    <button className={styles.toolbarBtn} title="Filter"><Filter size={14} /></button>

                                    {selectedIndices.size > 0 && (
                                        <>
                                            <button className={styles.outlineBtn} onClick={handleDeleteRows} style={{ border: '1px solid #ef4444', color: '#ef4444', backgroundColor: 'transparent', marginRight: '0.5rem' }}>
                                                <Trash2 size={14} style={{ marginRight: 4 }} /> Delete ({selectedIndices.size})
                                            </button>

                                            {/* Copy Dropdown */}
                                            <div style={{ position: 'relative', display: 'inline-block', marginRight: '0.5rem' }}>
                                                <button className={styles.secondaryBtn} onClick={() => setActiveDropdown(activeDropdown === 'copy' ? null : 'copy')}>
                                                    <Copy size={14} style={{ marginRight: 4 }} /> Copy <ChevronDown size={12} style={{ marginLeft: 2 }} />
                                                </button>
                                                {activeDropdown === 'copy' && (
                                                    <div className={styles.dropdownMenu} style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '4px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', minWidth: '100px' }}>
                                                        <div className={styles.dropdownItem} onClick={() => { handleCopy('CSV'); setActiveDropdown(null); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem' }}>As CSV</div>
                                                        <div className={styles.dropdownItem} onClick={() => { handleCopy('JSON'); setActiveDropdown(null); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem' }}>As JSON</div>
                                                    </div>
                                                )}
                                            </div>
                                            {/* Export Dropdown */}
                                            <div style={{ position: 'relative', display: 'inline-block' }}>
                                                <button className={styles.secondaryBtn} onClick={() => setActiveDropdown(activeDropdown === 'export' ? null : 'export')}>
                                                    <Download size={14} style={{ marginRight: 4 }} /> Export <ChevronDown size={12} style={{ marginLeft: 2 }} />
                                                </button>
                                                {activeDropdown === 'export' && (
                                                    <div className={styles.dropdownMenu} style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '4px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', minWidth: '100px' }}>
                                                        <div className={styles.dropdownItem} onClick={() => { handleExport('CSV'); setActiveDropdown(null); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem' }}>As CSV</div>
                                                        <div className={styles.dropdownItem} onClick={() => { handleExport('JSON'); setActiveDropdown(null); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem' }}>As JSON</div>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}

                                    {/* Pagination Controls - Moved to Toolbar */}
                                    {(() => {
                                        const pag = paginationMap[activeTab.id] || { page: 1, pageSize: 50, total: 0 };
                                        const totalPages = Math.ceil(pag.total / pag.pageSize) || 1;
                                        return (
                                            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <button
                                                        className={styles.iconBtn}
                                                        disabled={pag.page <= 1}
                                                        onClick={() => fetchTableData(activeTab.id, activeTab.title, pag.page - 1)}
                                                        style={{ opacity: pag.page <= 1 ? 0.3 : 1 }}
                                                    >
                                                        <ChevronLeft size={16} />
                                                    </button>
                                                    <span style={{ minWidth: '60px', textAlign: 'center' }}>{pag.page} of {totalPages}</span>
                                                    <button
                                                        className={styles.iconBtn}
                                                        disabled={pag.page >= totalPages}
                                                        onClick={() => fetchTableData(activeTab.id, activeTab.title, pag.page + 1)}
                                                        style={{ opacity: pag.page >= totalPages ? 0.3 : 1 }}
                                                    >
                                                        <ChevronRight size={16} />
                                                    </button>
                                                </div>

                                                <div style={{ position: 'relative' }}>
                                                    <button
                                                        className={styles.secondaryBtn}
                                                        onClick={() => setActiveDropdown(activeDropdown === 'pageSize' ? null : 'pageSize')}
                                                    >
                                                        {pag.pageSize} rows <ChevronDown size={12} style={{ marginLeft: 4 }} />
                                                    </button>
                                                    {activeDropdown === 'pageSize' && (
                                                        <div className={styles.dropdownMenu} style={{ position: 'absolute', top: '100%', right: 0, zIndex: 100, backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '4px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', minWidth: '80px' }}>
                                                            {[20, 50, 100, 200].map(size => (
                                                                <div
                                                                    key={size}
                                                                    className={styles.dropdownItem}
                                                                    onClick={() => {
                                                                        setActiveDropdown(null);
                                                                        fetchTableData(activeTab.id, activeTab.title, 1, size);
                                                                    }}
                                                                    style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem', backgroundColor: pag.pageSize === size ? 'var(--bg-tertiary)' : 'transparent' }}
                                                                >
                                                                    {size}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                <div style={{ minWidth: '80px', textAlign: 'right' }}>{pag.total} rows</div>
                                            </div>
                                        );
                                    })()}
                                </div>
                                <div style={{ flex: 1, padding: '1rem', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ flex: 1, border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-secondary)', overflow: 'hidden', marginBottom: '0.5rem' }}>
                                        <DataGrid
                                            key={activeTab.id}
                                            data={results[activeTab.id]?.data || null}
                                            loading={results[activeTab.id]?.loading || false}
                                            error={results[activeTab.id]?.error || null}
                                            selectedIndices={selectedIndices}
                                            onSelectionChange={setSelectedIndices}
                                            onSort={(col) => setSortState(prev => prev?.column === col && prev.direction === 'ASC' ? { column: col, direction: 'DESC' } : { column: col, direction: 'ASC' })}
                                            pendingChanges={pendingChanges[activeTab.id]}
                                            highlightRowIndex={activeTabId === activeTab.id ? highlightRowIndex : null}
                                            onCellEdit={handleCellEdit}
                                            primaryKeys={new Set(tableSchemas[activeTab.title]?.filter(c => c.column_key === 'PRI').map(c => c.name) || [])}
                                            onDeleteRow={(rowIndex) => {
                                                const existingRowsCount = results[activeTab.id]?.data?.rows?.length || 0;

                                                // Check if this is an INSERT (virtual) row
                                                if (rowIndex >= existingRowsCount) {
                                                    // Remove the INSERT pending change for this row
                                                    const insertRowOffset = rowIndex - existingRowsCount;
                                                    setPendingChanges(prev => {
                                                        const tabChanges = [...(prev[activeTab.id] || [])];
                                                        const insertChanges = tabChanges.filter(c => c.type === 'INSERT');
                                                        if (insertRowOffset < insertChanges.length) {
                                                            const insertToRemove = insertChanges[insertRowOffset];
                                                            return {
                                                                ...prev,
                                                                [activeTab.id]: tabChanges.filter(c => c !== insertToRemove)
                                                            };
                                                        }
                                                        return prev;
                                                    });
                                                    // Also remove from selection
                                                    setSelectedIndices(prev => {
                                                        const newSet = new Set(prev);
                                                        newSet.delete(rowIndex);
                                                        return newSet;
                                                    });
                                                    return;
                                                }

                                                // Existing row - add DELETE change
                                                const displayRows = [...(results[activeTab.id]?.data?.rows || []), ...(pendingChanges[activeTab.id] || []).filter(c => c.type === 'INSERT').map(c => c.rowData)];
                                                const rowData = displayRows[rowIndex];
                                                if (rowData) {
                                                    const newChange = { type: 'DELETE' as const, tableName: activeTab.title, rowIndex, rowData };
                                                    setPendingChanges(prev => ({
                                                        ...prev,
                                                        [activeTab.id]: [...(prev[activeTab.id] || []), newChange]
                                                    }));
                                                }
                                            }}
                                            onRecoverRow={(rowIndex) => {
                                                // Remove the DELETE pending change for this row
                                                setPendingChanges(prev => ({
                                                    ...prev,
                                                    [activeTab.id]: (prev[activeTab.id] || []).filter(c => !(c.type === 'DELETE' && c.rowIndex === rowIndex))
                                                }));
                                            }}
                                        />
                                    </div>
                                </div>
                            </>
                        ) : activeTab.type === 'log' ? (
                            <>
                                <div className={styles.tableToolbar}>
                                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Activity size={16} /></div>

                                    {/* Copy Dropdown */}
                                    <div style={{ position: 'relative', marginLeft: '0.5rem', display: 'inline-block' }}>
                                        <button className={styles.secondaryBtn} onClick={() => setActiveDropdown(activeDropdown === 'copy' ? null : 'copy')}>
                                            <Copy size={14} style={{ marginRight: 4 }} /> Copy <ChevronDown size={12} style={{ marginLeft: 2 }} />
                                        </button>
                                        {activeDropdown === 'copy' && (
                                            <div className={styles.dropdownMenu} style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '4px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', minWidth: '100px' }}>
                                                <div className={styles.dropdownItem} onClick={() => { handleCopy('CSV'); setActiveDropdown(null); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem' }}>As CSV</div>
                                                <div className={styles.dropdownItem} onClick={() => { handleCopy('JSON'); setActiveDropdown(null); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem' }}>As JSON</div>
                                            </div>
                                        )}
                                    </div>
                                    {/* Export Dropdown */}
                                    <div style={{ position: 'relative', marginLeft: '0.5rem', display: 'inline-block' }}>
                                        <button className={styles.secondaryBtn} onClick={() => setActiveDropdown(activeDropdown === 'export' ? null : 'export')}>
                                            <Download size={14} style={{ marginRight: 4 }} /> Export <ChevronDown size={12} style={{ marginLeft: 2 }} />
                                        </button>
                                        {activeDropdown === 'export' && (
                                            <div className={styles.dropdownMenu} style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '4px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', minWidth: '100px' }}>
                                                <div className={styles.dropdownItem} onClick={() => { handleExport('CSV'); setActiveDropdown(null); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem' }}>As CSV</div>
                                                <div className={styles.dropdownItem} onClick={() => { handleExport('JSON'); setActiveDropdown(null); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem' }}>As JSON</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Pagination Controls */}
                                    {(() => {
                                        const pag = paginationMap[activeTab.id] || { page: 1, pageSize: 50, total: logs.length };
                                        // Update total if mismatch (syncing logs state)
                                        if (pag.total !== logs.length) pag.total = logs.length;

                                        const totalPages = Math.ceil(pag.total / pag.pageSize) || 1;
                                        const setPage = (p: number) => setPaginationMap(prev => ({ ...prev, [activeTab.id]: { ...pag, page: p } }));
                                        const setSize = (s: number) => setPaginationMap(prev => ({ ...prev, [activeTab.id]: { ...pag, pageSize: s, page: 1 } }));

                                        return (
                                            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                                                <button className={styles.iconBtn} disabled={pag.page === 1} onClick={() => setPage(pag.page - 1)}><ChevronLeft size={16} /></button>
                                                <span>Page {pag.page} of {totalPages}</span>
                                                <button className={styles.iconBtn} disabled={pag.page === totalPages} onClick={() => setPage(pag.page + 1)}><ChevronRight size={16} /></button>

                                                <div style={{ position: 'relative', marginLeft: '0.5rem' }}>
                                                    <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 6px' }} onClick={() => setActiveDropdown(activeDropdown === 'pageSize' ? null : 'pageSize')}>
                                                        {pag.pageSize} / page <ChevronDown size={12} style={{ marginLeft: 4 }} />
                                                    </div>
                                                    {activeDropdown === 'pageSize' && (
                                                        <div className={styles.dropdownMenu} style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: '4px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', minWidth: '80px', zIndex: 100 }}>
                                                            {[10, 20, 50, 100, 500].map(size => (
                                                                <div key={size} className={styles.dropdownItem} onClick={() => { setSize(size); setActiveDropdown(null); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem', backgroundColor: pag.pageSize === size ? 'var(--bg-tertiary)' : 'transparent' }}>
                                                                    {size}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ minWidth: '80px', textAlign: 'right' }}>{pag.total} entries</div>
                                            </div>
                                        );
                                    })()}
                                </div>
                                <div style={{ flex: 1, padding: '1rem', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ flex: 1, border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                                        {(() => {
                                            const pag = paginationMap[activeTab.id] || { page: 1, pageSize: 50, total: logs.length };
                                            const start = (pag.page - 1) * pag.pageSize;
                                            const end = start + pag.pageSize;
                                            const paginatedLogs = logs.slice(start, end);

                                            return (
                                                <DataGrid
                                                    data={{
                                                        columns: ['Time', 'Status', 'Table', 'Query', 'Error', 'User', 'Rows'],
                                                        rows: paginatedLogs.map(l => [l.time, l.status, l.table || '-', l.query, l.error || '', l.user || '', l.rows ? String(l.rows) : '-'])
                                                    }}
                                                    loading={false}
                                                    error={null}
                                                    selectedIndices={selectedIndices}
                                                    onSelectionChange={setSelectedIndices}
                                                    onSort={() => { }}
                                                />
                                            );
                                        })()}
                                    </div>
                                </div>
                            </>
                        ) : activeTab.type === 'create-table' ? (
                            <TableCreator connectionString={connection.connection_string} onSuccess={handleTableCreated} />
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                                    <QueryEditor
                                        value={tabQueries[activeTabId] || ''}
                                        onChange={(val) => setTabQueries(prev => ({ ...prev, [activeTabId]: val }))}
                                        onRunQuery={handleRunQuery}
                                        selectedRowCount={selectedIndices.size}
                                        onCopy={handleCopy}
                                        onExport={handleExport}
                                        theme={theme}
                                        tables={tables}
                                    />
                                </div>

                                {/* Resizer */}
                                <div
                                    onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}
                                    style={{
                                        height: '4px',
                                        cursor: 'ns-resize',
                                        backgroundColor: isResizing ? 'var(--accent-color)' : 'transparent',
                                        transition: 'background-color 0.2s',
                                        marginTop: '-2px', // Overlap borders slightly
                                        marginBottom: '-2px',
                                        zIndex: 10
                                    }}
                                />

                                <div style={{
                                    height: resultsVisible ? resultsHeight : '32px',
                                    minHeight: resultsVisible ? '100px' : '32px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    borderTop: '1px solid var(--border-color)',
                                    transition: isResizing ? 'none' : 'height 0.2s ease'
                                }}>
                                    <div
                                        className={styles.panelHeader}
                                        onDoubleClick={() => setResultsVisible(!resultsVisible)}
                                        style={{ userSelect: 'none' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.8rem' }}>
                                            <Table size={14} /> Query Results
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button className={styles.iconBtn} onClick={(e) => { e.stopPropagation(); setResultsVisible(!resultsVisible); }}>
                                                {resultsVisible ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                                            </button>
                                        </div>
                                    </div>
                                    {resultsVisible && (
                                        <div style={{ flex: 1, overflow: 'hidden' }}>
                                            <DataGrid
                                                key={activeTabId}
                                                data={results[activeTabId]?.data || null}
                                                loading={results[activeTabId]?.loading || false}
                                                error={results[activeTabId]?.error || null}
                                                selectedIndices={selectedIndices}
                                                onSelectionChange={setSelectedIndices}
                                                onSort={(col) => setSortState(prev => prev?.column === col && prev.direction === 'ASC' ? { column: col, direction: 'DESC' } : { column: col, direction: 'ASC' })}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <ChangelogSidebar
                    isOpen={showChangelog}
                    onClose={() => setShowChangelog(false)}
                    changes={pendingChanges}
                    tabs={tabs}
                    onConfirm={handleConfirmChanges}
                    onDiscard={handleDiscardChanges}
                    onRevert={handleRevertChange}
                    onNavigate={handleNavigateToChange}
                />
            </div>

            {(() => {
                // Logic to prepare initialData for Edit Pane based on Selection
                let initialDataForPane: Record<string, any>[] = [];
                const currentData = activeTabId && results[activeTabId]?.data;

                if (activeTabId && currentData && selectedIndices.size > 0) {
                    // Populate from selection
                    const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);
                    initialDataForPane = sortedIndices.map(idx => {
                        const rowObj: Record<string, any> = {};
                        // Check if it's an existing row or a pending insert
                        if (idx < currentData.rows.length) {
                            currentData.columns.forEach((col, cIdx) => {
                                rowObj[col] = currentData.rows[idx][cIdx];
                            });
                        } else {
                            // It's a pending insert
                            const pendingList = pendingChanges[activeTabId] || [];
                            const inserts = pendingList.filter(c => c.type === 'INSERT');
                            // The 'idx' relative to INSERTs is (idx - data.rows.length)
                            const insertIdx = idx - currentData.rows.length;
                            const pending = inserts[insertIdx];
                            if (pending) {
                                currentData.columns.forEach((col, cIdx) => {
                                    rowObj[col] = pending.rowData[cIdx];
                                });
                            }
                        }
                        return rowObj;
                    });
                } else {
                    // Empty state (user will see "No rows selected")
                    initialDataForPane = [];
                }

                return (
                    <InsertRowPanel
                        isOpen={showEditWindow}
                        onClose={() => setShowEditWindow(false)}
                        columns={panelColumns.length > 0 ? panelColumns : (activeTabId && results[activeTabId]?.data?.columns ? results[activeTabId].data!.columns : [])}
                        onInsert={handlePanelSubmit}
                        tableName={activeTab?.type === 'table' ? activeTab.title : ''}
                        initialData={initialDataForPane}
                        onAddRow={handleInsertRow}
                        onUpdateRow={(formRowIdx, col, val) => {
                            if (!activeTabId) return;
                            // Map formRowIdx back to actual rowIndex
                            const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);
                            const actualRowIndex = sortedIndices[formRowIdx];
                            if (actualRowIndex !== undefined) {
                                handleCellEdit(actualRowIndex, col, val);
                            }
                        }}
                        onRemoveRow={(formRowIdx) => {
                            if (!activeTabId) return;
                            const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);
                            const actualRowIndex = sortedIndices[formRowIdx];
                            if (actualRowIndex !== undefined) {
                                // If it's a pending insert, remove it entirely
                                const currentData = results[activeTabId]?.data;
                                if (currentData && actualRowIndex >= currentData.rows.length) {
                                    // It's an INSERT change
                                    // Find the specific change object
                                    const changes = pendingChanges[activeTabId] || [];
                                    const change = changes.find(c => c.type === 'INSERT' && c.rowIndex === actualRowIndex);
                                    if (change) {
                                        setPendingChanges(prev => ({
                                            ...prev,
                                            [activeTabId]: prev[activeTabId].filter(c => c !== change)
                                        }));
                                        const newSet = new Set(selectedIndices);
                                        newSet.delete(actualRowIndex);
                                        setSelectedIndices(newSet);
                                    }
                                } else {
                                    // Existing row - Trigger Delete?
                                    // User probably expects visual removal or queuing for delete
                                    // For now, let's treat it as "remove from selection"?
                                    // Or queue delete?
                                    // "Delete" button handles deletes. Sidebar remove might be confusing if it deletes from DB.
                                    // Let's assume for now it just removes from the 'edit list' (selection).
                                    const newSet = new Set(selectedIndices);
                                    newSet.delete(actualRowIndex);
                                    setSelectedIndices(newSet);
                                }
                            }
                        }}
                    />
                );
            })()}

            {
                showNewConnModal && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowNewConnModal(false)}>
                        <div style={{ width: '400px' }} onClick={e => e.stopPropagation()}>
                            <ConnectionForm onSuccess={() => { setShowNewConnModal(false); fetchConnections(); }} onCancel={() => setShowNewConnModal(false)} />
                        </div>
                    </div>
                )
            }

            {/* Table Operation Confirmation Modal */}
            {tableConfirmModal && (
                <ConfirmModal
                    title={tableConfirmModal.type === 'truncate' ? 'Truncate Table' : 'Drop Table'}
                    message={
                        tableConfirmModal.type === 'truncate'
                            ? `Are you sure you want to TRUNCATE "${tableConfirmModal.tableName}"? This will permanently delete ALL data in the table but keep the table structure.`
                            : `Are you sure you want to DROP "${tableConfirmModal.tableName}"? This will permanently delete the table and ALL its data. This action cannot be undone.`
                    }
                    confirmText={tableConfirmModal.type === 'truncate' ? 'Truncate' : 'Drop'}
                    onConfirm={confirmTableOperation}
                    onCancel={() => setTableConfirmModal(null)}
                />
            )}

            {/* Changelog Confirmation Modal */}
            {changelogConfirm && (
                <ConfirmModal
                    title={changelogConfirm.type === 'confirm' ? 'Confirm Changes' : 'Discard Changes'}
                    message={
                        changelogConfirm.type === 'confirm'
                            ? `Are you sure you want to apply ${Object.values(pendingChanges).flat().length} pending changes?`
                            : `Are you sure you want to discard ALL ${Object.values(pendingChanges).flat().length} pending changes? This action cannot be undone.`
                    }
                    confirmText={changelogConfirm.type === 'confirm' ? 'Apply' : 'Discard'}
                    onConfirm={changelogConfirm.type === 'confirm' ? executeConfirmChanges : executeDiscardChanges}
                    onCancel={() => setChangelogConfirm(null)}
                />
            )}

            {duplicateTableModal && (
                <DuplicateTableModal
                    tableName={duplicateTableModal}
                    existingTables={tables} // Pass existing tables
                    onConfirm={confirmDuplicateTable}
                    onCancel={() => setDuplicateTableModal(null)}
                />
            )}


        </div>
    );
};
