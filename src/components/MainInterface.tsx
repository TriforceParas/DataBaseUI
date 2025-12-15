import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import styles from '../styles/MainLayout.module.css';
import { Connection, QueryResult, PendingChange, Tag, TableTag, LogEntry } from '../types';
import { RefreshCw, Search, Plus, PanelLeftClose, PanelLeftOpen, Code2, Table, Filter, ArrowUpDown, Trash2, Pencil, ChevronUp, ChevronDown, X, Copy, Download, Activity, ChevronLeft, ChevronRight, Clock, CheckCircle, AlertCircle, Settings, ZoomIn, ZoomOut, Moon, Sun, Monitor, Minus, Square } from 'lucide-react';
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
function SortableTab({ tab, isActive, onClick, onClose, color }: { tab: any, isActive: boolean, onClick: () => void, onClose: (e: any, id: string) => void, color?: string }) {
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
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                {tab.type === 'query' ? <Code2 size={14} style={{ flexShrink: 0 }} /> : tab.type === 'log' ? <Activity size={14} style={{ flexShrink: 0 }} /> : <Table size={14} style={{ flexShrink: 0, color: color }} />}
                <span style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tab.title}</span>
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

    // Preference State
    const [theme, setTheme] = useState<'blue' | 'gray' | 'amoled' | 'light'>('blue');
    const [zoom, setZoom] = useState(1);
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

    useEffect(() => {
        // Apply Theme
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

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

    // Tabs State
    const [tabs, setTabs] = useState<{ id: string; type: 'table' | 'query' | 'create-table' | 'log'; title: string }[]>([
        { id: 'query1', type: 'query', title: 'Query 1' }
    ]);
    const [activeTabId, setActiveTabId] = useState('query1');
    const [resultsVisible, setResultsVisible] = useState(true);

    // Query Texts State (Persist per tab)
    const [tabQueries, setTabQueries] = useState<Record<string, string>>({
        'query1': '-- Write your SQL query here\nSELECT * FROM '
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
    const setSelectedIndices = (action: Set<number> | ((prev: Set<number>) => Set<number>)) => {
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

        try {
            const isMysql = connection.connection_string.startsWith('mysql:');
            const q = isMysql ? '`' : '"';

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

        const newChanges: PendingChange[] = [];
        selectedIndices.forEach(idx => {
            const row = currentData.rows[idx];
            // Check if already deleted
            const existing = pendingChanges[activeTab.id]?.find(c => c.type === 'DELETE' && c.rowIndex === idx);
            if (!existing) {
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

        setPendingChanges(prev => ({
            ...prev,
            [activeTab.id]: [...(prev[activeTab.id] || []), ...newChanges]
        }));
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

    const handleTableClick = (tableName: string) => {
        const existing = tabs.find(t => t.title === tableName && t.type === 'table');
        if (existing) {
            setActiveTabId(existing.id);
            return;
        }
        const newTabId = `table-${tableName}`;
        setTabs([...tabs, { id: newTabId, type: 'table', title: tableName }]);
        setActiveTabId(newTabId);
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

    const handleOpenInsert = async () => {
        if (!activeTab || activeTab.type !== 'table') return;

        setEditData(undefined); // Reset edit data
        setShowInsertPanel(true);

        try {
            const cols = await invoke<string[]>('get_columns', {
                connectionString: connection.connection_string,
                tableName: activeTab.title
            });
            setPanelColumns(cols);
        } catch (e) {
            console.error("Failed to fetch columns", e);
            if (results[activeTab.id]?.data?.columns) {
                setPanelColumns(results[activeTab.id].data!.columns);
            }
        }
    };

    const handleOpenEdit = async () => {
        if (!activeTab || activeTab.type !== 'table') return;
        const currentData = results[activeTab.id]?.data;
        if (!currentData) return;

        // Get selected rows
        const rowsToEdit = Array.from(selectedIndices).map(idx => {
            const rowArr = currentData.rows[idx];
            const rowObj: Record<string, any> = {};
            currentData.columns.forEach((col, i) => rowObj[col] = rowArr[i]);
            return rowObj;
        });

        if (rowsToEdit.length === 0) return;

        setEditData(rowsToEdit);
        setPanelColumns(currentData.columns);
        setShowInsertPanel(true);
    };

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
        } catch (e) {
            alert(`Failed to apply changes: ${e}`);
            addLog(`Error applying changes: ${e}`, 'Error', undefined, String(e));
        }
    };

    const handleDiscardChanges = () => {
        if (confirm("Discard all pending changes?")) {
            setPendingChanges({});
            setShowChangelog(false);
            setSelectedIndices(new Set());
        }
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
            <ChangelogSidebar
                isOpen={showChangelog}
                onClose={() => setShowChangelog(false)}
                changes={pendingChanges}
                tabs={tabs}
                onConfirm={handleConfirmChanges}
                onDiscard={handleDiscardChanges}
                onRevert={handleRevertChange}
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
                                    {selectedIndices.size > 0 ? (
                                        <>
                                            <button className={styles.dangerBtn} onClick={handleDeleteRows} style={{ marginRight: '0.5rem' }}>
                                                <Trash2 size={14} style={{ marginRight: 4 }} /> Delete ({selectedIndices.size})
                                            </button>
                                            <button className={styles.primaryBtn} onClick={handleOpenEdit} style={{ marginRight: '0.5rem' }}>
                                                <Pencil size={14} style={{ marginRight: 4 }} /> Edit
                                            </button>

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
                                        </>
                                    ) : (
                                        <button className={styles.primaryBtn} onClick={handleOpenInsert}>
                                            <Plus size={14} /> Insert
                                        </button>
                                    )}

                                    <button className={styles.toolbarBtn} onClick={() => fetchTableData(activeTab.id, activeTab.title)}>
                                        <RefreshCw size={14} /> Refresh
                                    </button>
                                    <div className={styles.verticalDivider} style={{ height: 16 }}></div>
                                    <button className={styles.toolbarBtn}><Filter size={14} /> Filter</button>
                                    <button className={styles.toolbarBtn}><ArrowUpDown size={14} /> Sort</button>

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
                                        value={tabQueries[activeTabId] || '-- Write your SQL query here\nSELECT * FROM '}
                                        onChange={(val) => setTabQueries(prev => ({ ...prev, [activeTabId]: val }))}
                                        onRunQuery={handleRunQuery}
                                        selectedRowCount={selectedIndices.size}
                                        onCopy={handleCopy}
                                        onExport={handleExport}
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
            </div>

            <InsertRowPanel
                isOpen={showInsertPanel}
                onClose={() => setShowInsertPanel(false)}
                columns={panelColumns}
                onInsert={handlePanelSubmit}
                tableName={activeTab?.type === 'table' ? activeTab.title : ''}
                initialData={editData}
            />

            {
                showNewConnModal && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowNewConnModal(false)}>
                        <div style={{ width: '400px' }} onClick={e => e.stopPropagation()}>
                            <ConnectionForm onSuccess={() => { setShowNewConnModal(false); fetchConnections(); }} onCancel={() => setShowNewConnModal(false)} />
                        </div>
                    </div>
                )
            }
        </div >
    );
};
