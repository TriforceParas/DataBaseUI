import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { generateRowChangeSql } from '../helpers/sqlHelpers';

import styles from '../styles/MainLayout.module.css';
import { Connection, QueryResult, PendingChange, Tag, TableTag, LogEntry, ColumnSchema, SavedQuery, SavedFunction } from '../types';
import { Plus, Table, Filter, Trash2, ChevronUp, ChevronDown, Copy, Download, Activity, ChevronLeft, ChevronRight, RefreshCw, Save } from 'lucide-react';
import { ConnectionForm } from './ConnectionForm';
import { Sidebar, Navbar, TabBar, ChangelogSidebar, ResultsPane, InsertRowPanel } from './layout';
import { QueryEditor } from './editors/QueryEditor';
import { DataGrid } from './DataGrid';
import { TableCreator, TableCreatorState } from './editors/TableCreator';
import { PreferencesModal } from './modals/PreferencesModal';
import { ConfirmModal } from './modals/ConfirmModal';
import { DuplicateTableModal } from './modals/DuplicateTableModal';
import { SchemaVisualizer } from './editors/SchemaVisualizer';
import { SaveQueryModal } from './modals/SaveQueryModal';
import { useSystemLogs } from '../hooks/useSystemLogs';
import { useSavedItems } from '../hooks/useSavedItems';
import { useTableOperations } from '../hooks/useTableOperations';
import { useTableData } from '../hooks/useTableData';
import { useResultsPane } from '../hooks/useResultsPane';
import { useTabs } from '../hooks/useTabs';
import { TabItem } from '../types';
import { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

interface MainInterfaceProps {
    connection: Connection;
    onSwitchConnection: (conn: Connection) => void;
}

// Local interfaces moved to types.ts



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
        document.documentElement.dataset.theme = theme;
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

    // --- Hooks ---
    const { logs, addLog } = useSystemLogs();

    // Tabs & Navigation (Extracted to useTabs)
    const {
        tabs,
        setTabs,
        activeTabId,
        setActiveTabId,
        tabQueries,
        setTabQueries,
        activeTab,
        handleAddTableTab,
        handleAddQuery,
        closeTab: closeTabState,
        handleDragEnd,
        handleOpenSavedQuery
    } = useTabs();

    // Legacy mapping (if needed, or verify naming below)
    // handleCloseTab in MainInterface signature? No, usually directly used.

    // resultsVisible removed (duplicate)

    // Results state
    // Results state (Extracted to useTableData)
    const {
        results,
        setResults,
        paginationMap,
        setPaginationMap,
        sortState,
        setSortState,
        handleSort,
        fetchTableData,
        handleRunQuery: runQuery
    } = useTableData({ connection, addLog });

    // Results Pane UI State (Extracted to useResultsPane)
    const {
        resultsHeight,
        isResizing,
        resultsVisible,
        toggleResults,
        startResizing
    } = useResultsPane();

    // Legacy mapping for existing code compatibility if any
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
    const [renderEditWindow, setRenderEditWindow] = useState(false);
    const [panelColumns, setPanelColumns] = useState<string[]>([]);
    const [editData, setEditData] = useState<Record<string, any>[] | undefined>(undefined);

    // Resize state
    // Resume Dropdown state

    // Dropdown state for Table View
    const [activeDropdown, setActiveDropdown] = useState<'copy' | 'export' | 'pageSize' | null>(null);

    // Refresh State (Used by various effects)
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Fetch Tables (Moved up for Hook Dependency)
    const fetchTables = async () => {
        setRefreshTrigger(prev => prev + 1);
        try {
            const fetchedTables = await invoke<string[]>('get_tables', { connectionString: connection.connection_string });
            setTables(fetchedTables);
        } catch (e) {
            console.error("Failed to fetch tables:", e);
        }
    };

    // --- Hooks ---
    // Moved useSystemLogs to top

    // Saved Items
    const {
        savedQueries, savedFunctions, fetchSavedItems,
        saveQuery, saveFunction, deleteQuery, deleteFunction, updateQuery, updateFunction
    } = useSavedItems(connection);
    const [saveModal, setSaveModal] = useState<{ type: 'query' | 'function' } | null>(null);

    // Table Operations
    const {
        tableConfirmModal, setTableConfirmModal,
        duplicateTableModal, setDuplicateTableModal,
        handleDuplicateTable, confirmDuplicateTable,
        handleTruncateTable, handleDropTable, confirmTableOperation
    } = useTableOperations({
        connection,
        onRefreshTables: fetchTables,
        onTableDropped: (tableName) => {
            setTabs(tabs.filter(t => t.title !== tableName));
        },
        addLog
    });

    // Changelog State
    const [showChangelog, setShowChangelog] = useState(false);

    // TableCreator state persistence per tab
    const [tableCreatorStates, setTableCreatorStates] = useState<Record<string, TableCreatorState>>({});
    const [originalSchemas, setOriginalSchemas] = useState<Record<string, TableCreatorState>>({});
    const [pendingChanges, setPendingChanges] = useState<Record<string, PendingChange[]>>({});

    // Other UI State
    const [highlightRowIndex, setHighlightRowIndex] = useState<number | null>(null);
    const [changelogConfirm, setChangelogConfirm] = useState<{ type: 'confirm' | 'discard' } | null>(null);

    // Tags
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

    // Save Query Handler
    const handleSaveQuery = async (name: string) => {
        const query = tabQueries[activeTabId] || '';
        if (!query.trim()) return;
        try {
            const savedId = await saveQuery(name, query);
            // Update current tab with saved query info
            if (savedId) {
                setTabs(prev => prev.map(t =>
                    t.id === activeTabId ? { ...t, title: name, savedQueryId: savedId } : t
                ));
            }
        } catch (e) {
            // Error already logged in hook
        }
    };

    // Save Function Handler
    const handleSaveFunction = async (name: string) => {
        const functionBody = tabQueries[activeTabId] || '';
        if (!functionBody.trim()) return;
        try {
            const savedId = await saveFunction(name, functionBody);
            if (savedId) {
                setTabs(prev => prev.map(t =>
                    t.id === activeTabId ? { ...t, title: `ƒ ${name}`, savedFunctionId: savedId } : t
                ));
            }
        } catch (e) { }
    };

    const handleDeleteQuery = deleteQuery;
    const handleDeleteFunction = deleteFunction;
    const handleUpdateQuery = async () => {
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (!activeTab?.savedQueryId) return;
        const query = tabQueries[activeTabId] || '';
        if (!query.trim()) return;
        await updateQuery(activeTab.savedQueryId, activeTab.title, query);
    };

    const handleUpdateFunction = async () => {
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (!activeTab?.savedFunctionId) return;
        const functionBody = tabQueries[activeTabId] || '';
        if (!functionBody.trim()) return;
        const name = activeTab.title.replace(/^ƒ /, '');
        await updateFunction(activeTab.savedFunctionId, name, functionBody);
    };

    // handleOpenSavedQuery provided by useTabs


    // Execute saved function and show results (or switch to existing)
    const handleExecuteFunction = async (func: SavedFunction) => {
        // Check if tab already exists for this function
        const existingTab = tabs.find(t => t.savedFunctionId === func.id);
        if (existingTab) {
            setActiveTabId(existingTab.id);
            return;
        }
        const tabId = `func-${func.id}-${Date.now()}`;
        setTabs([...tabs, { id: tabId, type: 'function-output', title: `ƒ ${func.name}`, savedFunctionId: func.id }]);
        setTabQueries(prev => ({ ...prev, [tabId]: func.function_body }));
        setActiveTabId(tabId);
        setResults(prev => ({ ...prev, [tabId]: { data: null, loading: true, error: null } }));

        try {
            const res = await invoke<QueryResult[]>('execute_query', {
                connectionString: connection.connection_string,
                query: func.function_body
            });
            const lastRes = res.length > 0 ? res[res.length - 1] : null;
            setResults(prev => ({ ...prev, [tabId]: { data: lastRes, allData: res, loading: false, error: null } }));
            addLog(func.function_body, 'Success', undefined, undefined, lastRes ? lastRes.rows.length : 0, 'User');
        } catch (e) {
            setResults(prev => ({ ...prev, [tabId]: { data: null, loading: false, error: String(e) } }));
            addLog(func.function_body, 'Error', undefined, String(e), 0, 'User');
        }
    };

    // Edit saved function - open in query tab for editing
    const handleEditFunction = (func: SavedFunction) => {
        // Check if tab already exists for this function
        const existingTab = tabs.find(t => t.savedFunctionId === func.id);
        if (existingTab) {
            setActiveTabId(existingTab.id);
            return;
        }
        const tabId = `func-edit-${func.id}-${Date.now()}`;
        setTabs([...tabs, { id: tabId, type: 'query', title: `ƒ ${func.name}`, savedFunctionId: func.id }]);
        setTabQueries(prev => ({ ...prev, [tabId]: func.function_body }));
        setActiveTabId(tabId);
    };

    // Export query as .sql file
    const handleExportQuery = () => {
        const query = tabQueries[activeTabId] || '';
        if (!query.trim()) return;
        const blob = new Blob([query], { type: 'text/sql' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `query-${Date.now()}.sql`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // handleDragEnd provided by useTabs

    // DnD Sensors are managed in TabBar now, and Resize Logic is in useResultsPane
    // Cleaned up.

    useEffect(() => {
        fetchTables();
    }, [connection]);

    useEffect(() => {
        fetchConnections();
        fetchSavedItems(); // Fetch saved items on connection load
    }, [connection]);

    // Reset view state on tab switch
    useEffect(() => {
        setSelectedIndices(new Set());
        setSortState(null);
        setShowEditWindow(false);
        setEditData(undefined);
    }, [activeTabId]);

    // activeTab provided by useTabs

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



    const fetchConnections = async () => {
        try {
            const conns = await invoke<Connection[]>('list_connections');
            setSavedConnections(conns);
        } catch (e) {
            console.error("Failed to fetch connections", e);
        }
    };

    // fetchTableData provided by useTableData hook

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
        runQuery(activeTabId, query);
    };

    // handleAddTableTab and handleAddQuery provided by useTabs

    const handleRefresh = () => {
        if (!activeTab) return;
        if (activeTab.type === 'table') {
            fetchTableData(activeTab.id, activeTab.title);
        } else if (activeTab.type === 'query') {
            const query = tabQueries[activeTab.id];
            if (query && query.trim()) runQuery(activeTab.id, query);
        } else if (activeTab.type === 'function-output') {
            // For function output, we would ideally re-execute the function.
            // Currently we rely on savedFunctions list.
            const func = savedFunctions.find(f => f.id === activeTab.savedFunctionId);
            if (func) handleExecuteFunction(func);
        }
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
            addLog(`SHOW COLUMNS FROM ${tableName}`, 'Success', tableName, undefined, 0, 'System');
        } catch (e) {
            console.error('Failed to get table schema:', e);
            addLog(`SHOW COLUMNS FROM ${tableName}`, 'Error', tableName, String(e), 0, 'System');
        }
    };

    // Edit Table Schema - Opens the TableCreator with existing schema
    const handleEditTableSchema = async (tableName: string) => {
        try {
            // Fetch existing schema
            const schema = await invoke<ColumnSchema[]>('get_table_schema', {
                connectionString: connection.connection_string,
                tableName
            });

            // Convert ColumnSchema to ColumnDef format
            const columns = schema.map(col => ({
                name: col.name,
                type: col.data_type.toUpperCase().replace(/\(.*\)/, ''), // Strip length from type
                length: col.data_type.match(/\((\d+)\)/)?.[1] || '', // Extract length if exists
                defaultValue: col.column_default || '',
                isNullable: col.is_nullable.toLowerCase() === 'yes' || col.is_nullable === '1',
                isPrimaryKey: col.column_key === 'PRI' || col.column_key.toLowerCase().includes('pk'),
                isAutoIncrement: (col.column_default || '').toLowerCase().includes('auto_increment') ||
                    col.data_type.toLowerCase().includes('serial'),
                isUnique: col.column_key === 'UNI' || col.column_key.toLowerCase().includes('unique')
            }));

            const tabId = `edit-table-${Date.now()}`;
            const initialState: TableCreatorState = {
                tableName,
                columns,
                foreignKeys: []
            };

            // Store both current and original state
            setTableCreatorStates(prev => ({ ...prev, [tabId]: initialState }));
            setOriginalSchemas(prev => ({ ...prev, [tabId]: JSON.parse(JSON.stringify(initialState)) }));

            setTabs([...tabs, { id: tabId, type: 'create-table', title: `Edit: ${tableName}` }]);
            setActiveTabId(tabId);
        } catch (e) {
            console.error('Failed to fetch table schema:', e);
            alert(`Failed to fetch table schema: ${e}`);
        }
    };



    const closeTab = (e: React.MouseEvent, id: string) => {
        closeTabState(e, id); // Call hook's close logic

        // Clean up results
        setResults(prev => {
            const newResults = { ...prev };
            delete newResults[id];
            return newResults;
        });
    };

    const handleTableCreated = () => {
        fetchTables();
        if (activeTabId) {
            closeTab({ stopPropagation: () => { } } as React.MouseEvent, activeTabId);
        }
    };

    const handleInsertRow = () => {
        if (!activeTab || activeTab.type !== 'table') return;
        const currentData = results[activeTab.id]?.data!;

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
            setRenderEditWindow(true);
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

            setShowEditWindow(false);
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
            setShowEditWindow(false);
            setEditData(undefined);
            fetchTableData(activeTab.id, activeTab.title);
            addLog(query, 'Success', activeTab.title, undefined, valueGroups.length);
        } catch (e) {
            alert(`Insert failed: ${e}`);
            addLog(`Insert failed: ${e}`, 'Error', activeTab.title, String(e));
        }
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

        try {
            for (const [tabId, changes] of Object.entries(pendingChanges)) {
                if (changes.length === 0) continue;

                // Handle schema changes first (they have generatedSql and don't need res.data)
                const schemaChanges = changes.filter(c => c.type === 'ADD_COLUMN' || c.type === 'DROP_COLUMN');
                for (const change of schemaChanges) {
                    if (change.generatedSql) {
                        await invoke('execute_query', { connectionString: connection.connection_string, query: change.generatedSql });
                        addLog(change.generatedSql, 'Success', change.tableName, undefined, 1);
                    }
                }

                // If there were schema changes, refresh tables and update original schemas
                if (schemaChanges.length > 0) {
                    fetchTables();
                    // Clear original schemas to force re-fetch on next edit
                    setOriginalSchemas(prev => {
                        const newSchemas = { ...prev };
                        delete newSchemas[tabId];
                        return newSchemas;
                    });
                }

                // Handle row changes (UPDATE, DELETE, INSERT) - these need res.data
                const rowChanges = changes.filter(c => c.type !== 'ADD_COLUMN' && c.type !== 'DROP_COLUMN');
                if (rowChanges.length === 0) continue;

                const res = results[tabId];
                if (!res || !res.data) continue;

                const cols = res.data.columns;

                for (const change of rowChanges) {
                    const query = generateRowChangeSql(change, cols, isMysql);

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

    const handleRowDelete = (rowIndex: number) => {
        if (!activeTab || activeTab.type !== 'table') return;
        const existRows = results[activeTabId]?.data?.rows?.length || 0;

        // Check if this is an INSERT (virtual) row
        if (rowIndex >= existRows) {
            // Remove the INSERT pending change for this row
            const insertRowOffset = rowIndex - existRows;
            setPendingChanges(prev => {
                const tabChanges = [...(prev[activeTabId] || [])];
                const insertChanges = tabChanges.filter(c => c.type === 'INSERT');
                if (insertRowOffset < insertChanges.length) {
                    const insertToRemove = insertChanges[insertRowOffset];
                    return {
                        ...prev,
                        [activeTabId]: tabChanges.filter(c => c !== insertToRemove)
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
        const displayRows = [...(results[activeTabId]?.data?.rows || []), ...(pendingChanges[activeTabId] || []).filter(c => c.type === 'INSERT').map(c => c.rowData)];
        const rowData = displayRows[rowIndex];
        if (rowData) {
            const newChange: PendingChange = { type: 'DELETE', tableName: activeTab.title, rowIndex, rowData };
            setPendingChanges(prev => ({
                ...prev,
                [activeTabId]: [...(prev[activeTabId] || []), newChange]
            }));
        }
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
                    // Open Database Schema Diagram tab
                    const tabId = 'schema-diagram';
                    const existingTab = tabs.find(t => t.id === tabId);
                    if (existingTab) {
                        setActiveTabId(tabId);
                    } else {
                        // Fetch all table schemas first
                        Promise.all(tables.map(async (tableName) => {
                            if (!tableSchemas[tableName]) {
                                try {
                                    const schema = await invoke<ColumnSchema[]>('get_table_schema', {
                                        connectionString: connection.connection_string,
                                        tableName
                                    });
                                    setTableSchemas(prev => ({ ...prev, [tableName]: schema }));
                                } catch (e) {
                                    console.error(`Failed to get schema for ${tableName}`, e);
                                }
                            }
                        })).then(() => {
                            setTabs([...tabs, { id: tabId, type: 'schema-diagram' as any, title: 'Database Schema' }]);
                            setActiveTabId(tabId);
                        });
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
                    savedQueries={savedQueries}
                    savedFunctions={savedFunctions}
                    onQueryClick={handleOpenSavedQuery}
                    onFunctionClick={handleExecuteFunction}
                    onDeleteQuery={handleDeleteQuery}
                    onDeleteFunction={handleDeleteFunction}
                    onEditFunction={handleEditFunction}
                />

                <div className={styles.content}>
                    <TabBar
                        tabs={tabs}
                        activeTabId={activeTabId}
                        onTabClick={setActiveTabId}
                        onTabClose={closeTab}
                        onTabDoubleClick={pinTab}
                        onDragEnd={handleDragEnd}
                        tags={tags}
                        tableTags={tableTags}
                    />

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
                                            onDeleteRow={handleRowDelete}
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
                            <TableCreator
                                key={activeTab.id}
                                connectionString={connection.connection_string}
                                onSuccess={handleTableCreated}
                                mode={activeTab.title.startsWith('Edit:') ? 'edit' : 'create'}
                                initialState={tableCreatorStates[activeTab.id]}
                                onStateChange={(state) => setTableCreatorStates(prev => ({ ...prev, [activeTab.id]: state }))}
                                originalColumns={originalSchemas[activeTab.id]?.columns}
                                tabId={activeTab.id}
                                onSchemaChange={(changes) => {
                                    setPendingChanges(prev => {
                                        // Get existing changes for this tab
                                        const existing = prev[activeTab.id] || [];
                                        // Filter out schema changes for this table (prevent duplicates on re-save)
                                        const nonSchemaChanges = existing.filter(c =>
                                            c.type !== 'ADD_COLUMN' && c.type !== 'DROP_COLUMN'
                                        );
                                        return {
                                            ...prev,
                                            [activeTab.id]: [...nonSchemaChanges, ...changes]
                                        };
                                    });
                                    setShowChangelog(true); // Open changelog sidebar
                                }}
                            />
                        ) : (activeTab as any).type === 'schema-diagram' ? (
                            <div style={{ height: '100%', width: '100%' }}>
                                <SchemaVisualizer
                                    tables={tables}
                                    tableSchemas={tableSchemas}
                                    onTableClick={(tableName) => handleTableClick(tableName)}
                                    theme={theme}
                                />
                            </div>
                        ) : (activeTab as any).type === 'function-output' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                {/* Query Toolbar */}
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
                                        onSaveQuery={() => setSaveModal({ type: 'query' })}
                                        onSaveFunction={() => setSaveModal({ type: 'function' })}
                                        onExportSql={handleExportQuery}
                                        isSaved={!!(tabs.find(t => t.id === activeTabId)?.savedQueryId || tabs.find(t => t.id === activeTabId)?.savedFunctionId)}
                                        onSaveChanges={tabs.find(t => t.id === activeTabId)?.savedQueryId ? handleUpdateQuery : tabs.find(t => t.id === activeTabId)?.savedFunctionId ? handleUpdateFunction : undefined}
                                    />
                                </div>

                                {/* Resizer and Results Pane moved to ResultsPane component */}
                                <ResultsPane
                                    activeTabId={activeTabId}
                                    activeTabType={activeTab?.type}
                                    results={results}
                                    resultsVisible={resultsVisible}
                                    resultsHeight={resultsHeight}
                                    isResizing={isResizing}
                                    paginationMap={paginationMap}
                                    toggleResults={toggleResults}
                                    startResizing={startResizing}
                                    onRefresh={handleRefresh}
                                    // Use 'current' page effectively
                                    onPageChange={(p) => activeTab && fetchTableData(activeTab.id, activeTab.title, p)}
                                    onPageSizeChange={(s) => activeTab && fetchTableData(activeTab.id, activeTab.title, 1, s)}
                                    onSort={handleSort}
                                    selectedIndices={selectedIndices}
                                    setSelectedIndices={setSelectedIndices}
                                    activeDropdown={activeDropdown}
                                    setActiveDropdown={setActiveDropdown}
                                    onUpdateValue={(rowIdx, col, val) => activeTab && handleCellEdit(rowIdx, col, val)}
                                    pendingChanges={pendingChanges}
                                    onExport={(format) => handleExport(format as any)} // Cast if needed, or update handleExport sig
                                    onCopy={(format) => handleCopy(format as any)}
                                />
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

            {renderEditWindow && (() => {
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
                        onClose={() => setRenderEditWindow(false)}
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

            {/* Save Query/Function Modal */}
            <SaveQueryModal
                isOpen={saveModal !== null}
                onClose={() => setSaveModal(null)}
                onSave={(name) => {
                    if (saveModal?.type === 'query') {
                        handleSaveQuery(name);
                    } else if (saveModal?.type === 'function') {
                        handleSaveFunction(name);
                    }
                }}
                type={saveModal?.type || 'query'}
            />


        </div>
    );
};
