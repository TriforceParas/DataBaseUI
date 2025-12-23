import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

import styles from '../styles/MainLayout.module.css';

import { Connection, QueryResult, PendingChange, ColumnSchema, SavedFunction } from '../types';
import { Sidebar, Navbar, TabBar, ChangelogSidebar } from './layout';
import { TableCreatorState } from './editors';
import { ModalManager } from './modals/ModalManager';
import { MainViewContent } from './views';
import { useSystemLogs, useSavedItems, useTableOperations, useTableData, useResultsPane, useTabs, useTableActions, usePersistenceActions, useDatabaseRegistry, useChangeManager, useAppSystem } from '../hooks';
import { ToastContainer, useToast } from './Toast';

interface MainInterfaceProps {
    connection: Connection;
    onSwitchConnection: (conn: Connection) => void;
}

export const MainInterface: React.FC<MainInterfaceProps> = ({ connection, onSwitchConnection }) => {
    // --- System UI (Theme, Zoom, Sidebar, Dropdowns) ---
    const {
        sidebarOpen, setSidebarOpen,
        theme, setTheme,
        zoom, setZoom,
        showDbMenu, setShowDbMenu,
        isCapturing, setIsCapturing,
        handleZoom
    } = useAppSystem(connection);

    // --- Modal State ---
    const [showNewConnModal, setShowNewConnModal] = useState(false);
    const [showPreferences, setShowPreferences] = useState(false);
    const [tableSchemas, setTableSchemas] = useState<Record<string, ColumnSchema[]>>({});
    const [showEditWindow, setShowEditWindow] = useState(false);

    const { toasts, addToast, dismissToast } = useToast();

    // --- Orchestration: Registry (Pure Data) ---
    const registry = useDatabaseRegistry(connection);
    const { tables, savedConnections, tags, tableTags, fetchTables, fetchConnections } = registry;

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

    // --- Orchestration: Change Manager (Action Engine) ---
    const changeManager = useChangeManager(connection, { onSuccess: fetchTables });
    const {
        pendingChanges, setPendingChanges,
        showChangelog, setShowChangelog,
        changelogConfirm, setChangelogConfirm,
        highlightRowIndex, setHighlightRowIndex,
        handleRevertChange,
        handleConfirmChanges,
        handleDiscardChanges
    } = changeManager;

    // TableCreator state persistence per tab
    const [tableCreatorStates, setTableCreatorStates] = useState<Record<string, TableCreatorState>>({});
    const [originalSchemas, setOriginalSchemas] = useState<Record<string, TableCreatorState>>({});

    const {
        handleInsertRow,
        handleCellEdit,
        handleRowDelete,
        handleDeleteRows
    } = useTableActions({
        activeTab,
        results,
        pendingChanges,
        setPendingChanges,
        selectedIndices,
        setSelectedIndices,
        connection
    });

    const {
        handleSaveQuery,
        handleUpdateQuery,
        handleSaveFunction,
        handleUpdateFunction,
        handleCopy,
        handleExport
    } = usePersistenceActions({
        activeTab,
        tabQueries,
        results,
        saveQuery,
        updateQuery,
        saveFunction,
        updateFunction,
        setTabs,
        addToast,
        logs,
        selectedIndices
    });

    const handleDeleteQuery = deleteQuery;
    const handleDeleteFunction = deleteFunction;

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


    // fetchTableData provided by useTableData hook
    // fetchConnections provided by useDatabaseRegistry

    // fetchTableData provided by useTableData hook



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

    // executeConfirmChanges wrapper (calls hook's method with runtime dependencies)
    const executeConfirmChangesWrapper = () => {
        changeManager.executeConfirmChanges(tabs, results, addLog, fetchTableData);
    };

    // executeDiscardChanges wrapper
    const executeDiscardChangesWrapper = () => {
        changeManager.executeDiscardChanges(setSelectedIndices);
    };

    // handleNavigateToChange wrapper (needs handleTableClick which is local)
    const handleNavigateToChangeWrapper = (tabId: string, rowIndex: number) => {
        const existingTab = tabs.find(t => t.id === tabId);
        if (existingTab) {
            setActiveTabId(tabId);
        } else {
            const changes = pendingChanges[tabId];
            if (changes && changes.length > 0) {
                const tableName = changes[0].tableName;
                if (tableName) handleTableClick(tableName);
            }
        }
        setHighlightRowIndex(rowIndex);
        setTimeout(() => setHighlightRowIndex(null), 2000);
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
        <div className={styles.container} style={{
            zoom: zoom,
            width: `calc(100vw / ${zoom})`,
            height: `calc(100vh / ${zoom})`,
            filter: isCapturing ? 'blur(5px)' : 'none', // Apply blur when capturing
            pointerEvents: isCapturing ? 'none' : 'auto', // Disable interaction
            transition: 'filter 0.3s ease'
        } as any}>
            <ModalManager
                preferences={{
                    isOpen: showPreferences,
                    onClose: () => setShowPreferences(false),
                    theme,
                    setTheme,
                    zoom,
                    setZoom
                }}
                newConnection={{
                    isOpen: showNewConnModal,
                    onClose: () => setShowNewConnModal(false),
                    onSuccess: () => { setShowNewConnModal(false); fetchConnections(); }
                }}
                tableConfirm={{
                    modal: tableConfirmModal,
                    setModal: setTableConfirmModal,
                    onConfirm: confirmTableOperation
                }}
                duplicateTable={{
                    tableName: duplicateTableModal,
                    setTableName: setDuplicateTableModal,
                    existingTables: tables,
                    onConfirm: confirmDuplicateTable
                }}
                changelogConfirm={{
                    modal: changelogConfirm,
                    setModal: setChangelogConfirm,
                    pendingChangesCount: Object.values(pendingChanges).flat().length,
                    onConfirm: executeConfirmChangesWrapper,
                    onDiscard: executeDiscardChangesWrapper
                }}
                saveItem={{
                    modal: saveModal,
                    setModal: setSaveModal,
                    onSaveQuery: (name) => handleSaveQuery(name),
                    onSaveFunction: (name) => handleSaveFunction(name)
                }}
                editRow={{
                    isOpen: renderEditWindow && !!activeTabId,
                    onClose: () => setRenderEditWindow(false),
                    activeTabId: activeTabId,
                    activeTabType: activeTab?.type,
                    activeTabTitle: activeTab?.title || '',
                    results: results,
                    selectedIndices: selectedIndices,
                    setSelectedIndices: setSelectedIndices,
                    pendingChanges: pendingChanges,
                    setPendingChanges: setPendingChanges,
                    panelColumns: panelColumns,
                    onInsert: handlePanelSubmit,
                    onAddRow: handleInsertRow,
                    onCellEdit: handleCellEdit
                }}
            />
            {/* <FullscreenLoader isVisible={isCapturing} message="Generating High-Quality Screenshot..." /> */}
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />


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
                        <MainViewContent
                            activeTab={activeTab}
                            activeTabId={activeTabId}
                            tabs={tabs}
                            results={results}
                            selectedIndices={selectedIndices}
                            setSelectedIndices={setSelectedIndices}
                            paginationMap={paginationMap}
                            setPaginationMap={setPaginationMap}
                            pendingChanges={pendingChanges}
                            setPendingChanges={setPendingChanges}
                            highlightRowIndex={highlightRowIndex}
                            tableSchemas={tableSchemas}
                            activeDropdown={activeDropdown}
                            setActiveDropdown={setActiveDropdown}
                            logs={logs}
                            tables={tables}
                            theme={theme}
                            tableCreatorStates={tableCreatorStates}
                            originalSchemas={originalSchemas}
                            setTableCreatorStates={setTableCreatorStates}
                            connectionString={connection.connection_string}
                            tabQueries={tabQueries}
                            setTabQueries={setTabQueries}
                            resultsVisible={resultsVisible}
                            resultsHeight={resultsHeight}
                            isResizing={isResizing}
                            toggleResults={toggleResults}
                            startResizing={startResizing}
                            onInsertRow={handleInsertRow}
                            onDeleteRows={handleDeleteRows}
                            onCopy={handleCopy}
                            onExport={handleExport}
                            fetchTableData={fetchTableData}
                            setSortState={setSortState}
                            onCellEdit={handleCellEdit}
                            onRowDelete={handleRowDelete}
                            onRunQuery={handleRunQuery}
                            onTableClick={handleTableClick}
                            onTableCreated={handleTableCreated}
                            setShowChangelog={setShowChangelog}
                            handleAddQuery={handleAddQuery}
                            handleSaveQuery={() => setSaveModal({ type: 'query' })}
                            handleSaveFunction={() => setSaveModal({ type: 'function' })}
                            handleUpdateQuery={tabs.find(t => t.id === activeTabId)?.savedQueryId ? handleUpdateQuery : undefined}
                            handleUpdateFunction={tabs.find(t => t.id === activeTabId)?.savedFunctionId ? handleUpdateFunction : undefined}
                            handleExportQuery={handleExportQuery}
                            handleSort={handleSort}
                            handleRefresh={handleRefresh}
                            setIsCapturing={setIsCapturing}
                            addToast={addToast}
                        />
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
                    onNavigate={handleNavigateToChangeWrapper}
                />
            </div>

        </div>
    );
};
