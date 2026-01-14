import React, { useState, useEffect } from 'react';
import * as api from '../api';

import { Connection, ColumnSchema, SavedFunction } from '../types/index';
import { MainLayout } from './layout/MainLayout';
import { TableCreatorState } from './editors';
import { useSystemLogs, useSavedItems, useTableOperations, useTableData, useResultsPane, useTabs, useTableActions, usePersistenceActions, useDatabaseRegistry, useChangeManager, useAppSystem, useSchemaOperations, useDataMutation, ChangeError } from '../hooks';
import { useToast } from './common/Toast';
import { ErrorSummaryModal } from './modals/ErrorSummaryModal';
interface MainInterfaceProps {
    connection: Connection;
    onSwitchConnection: (conn: Connection) => void;
}

export const MainInterface: React.FC<MainInterfaceProps> = ({ connection: initialConnection, onSwitchConnection }) => {
    // --- Connection State Management (Database Switching) ---
    // We maintain a local connection object that can change its connection string when switching databases
    const [connection, setConnection] = useState<Connection>(initialConnection);

    useEffect(() => {
        setConnection(initialConnection);
    }, [initialConnection]);

    const handleSwitchDatabase = (dbName: string) => {
        // Update connection string with new database
        // Assuming connection string format: protocol://user:pass@host:port/dbname
        // We need robust replacement.
        try {
            const url = new URL(connection.connection_string);
            // URL object might act weird with some protocols, but usually 'postgres:', 'mysql:' work enough to parse.
            // SQLite is 'sqlite://path', pathname is path.
            // If postgres/mysql:
            if (url.protocol.includes('postgres') || url.protocol.includes('mysql')) {
                url.pathname = `/${dbName}`;
                // Keep the rest
                let newStr = url.toString();
                // URL.toString() might add execution slashes or encode things.
                // Reconstruct manually if needed to be safe and clean.
                // But for now let's try standard replacement if simple.

                // Fallback manual replacement if URL fails or we want to be sure about format
                const parts = connection.connection_string.split('://');
                if (parts.length === 2) {
                    const protocol = parts[0];
                    const rest = parts[1];
                    const atSplit = rest.split('@');
                    if (atSplit.length === 2) {
                        const credentials = atSplit[0];
                        const hostPart = atSplit[1];
                        const slashIdx = hostPart.indexOf('/');
                        if (slashIdx !== -1) {
                            newStr = `${protocol}://${credentials}@${hostPart.substring(0, slashIdx)}/${dbName}`;
                        } else {
                            newStr = `${protocol}://${credentials}@${hostPart}/${dbName}`;
                        }
                    } else {
                        // No auth
                        const slashIdx = rest.indexOf('/');
                        if (slashIdx !== -1) {
                            newStr = `${protocol}://${rest.substring(0, slashIdx)}/${dbName}`;
                        } else {
                            newStr = `${protocol}://${rest}/${dbName}`;
                        }
                    }
                }

                setConnection({ ...connection, connection_string: newStr });
            }
        } catch (e) {
            console.error("Failed to switch database string", e);
        }
    };


    // --- System UI (Theme, Zoom, Sidebar, Dropdowns) ---
    const {
        sidebarOpen, setSidebarOpen,
        theme, setTheme,
        zoom, setZoom,
        showDbMenu, setShowDbMenu,
        isCapturing, setIsCapturing,
        availableThemes,
        enableChangeLog, setEnableChangeLog,
        defaultExportPath, setDefaultExportPath
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

    let currentDbName = '';
    try {
        const url = new URL(connection.connection_string || '');
        currentDbName = url.pathname.substring(1);
    } catch (e) { }

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
    } = useTableData({ connection, addLog, tableSchemas, setTableSchemas });

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
    const [panelColumns, setPanelColumns] = useState<string[]>([]);
    const [editData, setEditData] = useState<Record<string, any>[] | undefined>(undefined);

    // Dropdown state for Table View
    const [activeDropdown, setActiveDropdown] = useState<'copy' | 'export' | 'pageSize' | null>(null);

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
            setTabs(tabs.filter(t => !(t.title === tableName && t.databaseName === currentDbName)));
        },
        addLog
    });

    // --- Orchestration: Change Manager (Action Engine) ---
    // TableCreator state persistence per tab - moved here to be available for onSuccess
    const [tableCreatorStates, setTableCreatorStates] = useState<Record<string, TableCreatorState>>({});
    const [originalSchemas, setOriginalSchemas] = useState<Record<string, TableCreatorState>>({});

    // Use ref to access current tableCreatorStates in callback without dependency issues
    const tableCreatorStatesRef = React.useRef(tableCreatorStates);
    React.useEffect(() => {
        tableCreatorStatesRef.current = tableCreatorStates;
    }, [tableCreatorStates]);

    // State for error modal
    const [changeErrors, setChangeErrors] = useState<ChangeError[]>([]);
    const [showErrorModal, setShowErrorModal] = useState(false);

    // Ref for refresh function to avoid circular dependency
    const refreshEditTableSchemaRef = React.useRef<((tabId: string, tableName: string) => Promise<void>) | null>(null);

    // Enhanced onSuccess: Refresh edit tabs from database to clear highlights and sync state
    const handleChangeManagerSuccess = React.useCallback(() => {
        fetchTables();

        // Refresh all edit tabs from database to get current schema state
        // This properly removes deleted columns and syncs everything
        const tabsRef = tabs;
        Object.keys(tableCreatorStatesRef.current).forEach(tabId => {
            const state = tableCreatorStatesRef.current[tabId];
            if (state && refreshEditTableSchemaRef.current) {
                // Check if this is an edit tab (has a table name)
                const tab = tabsRef.find(t => t.id === tabId);
                if (tab && tab.title.startsWith('Edit:')) {
                    refreshEditTableSchemaRef.current(tabId, state.tableName);
                }
            }
        });
    }, [fetchTables, tabs]);

    // Handle errors from change confirmation
    const handleChangeErrors = React.useCallback((errors: ChangeError[]) => {
        setChangeErrors(errors);
        setShowErrorModal(true);
    }, []);

    const changeManager = useChangeManager(connection, {
        onSuccess: handleChangeManagerSuccess,
        onErrors: handleChangeErrors
    });
    const {
        pendingChanges, setPendingChanges,
        showChangelog, setShowChangelog,
        highlightRowIndex, setHighlightRowIndex,
        handleRevertChange,
        handleConfirmChanges,
        handleDiscardChanges,
        executeConfirmChanges,
        executeConfirmSelected,
        executeDiscardChanges,
        executeDiscardSelected,
        retryWithFKDisabled
    } = changeManager;

    // Wrapper to execute confirm with the required arguments
    const handleExecuteConfirm = React.useCallback(() => {
        executeConfirmChanges(tabs, results, addLog, fetchTableData);
    }, [executeConfirmChanges, tabs, results, addLog, fetchTableData]);

    // Wrapper to execute discard with the required arguments  
    const handleExecuteDiscard = React.useCallback(() => {
        // Capture tabs with changes before they are cleared
        const tabsToRefresh = Object.keys(pendingChanges);

        executeDiscardChanges(setSelectedIndices);

        // Refresh data for all tabs that had changes
        tabsToRefresh.forEach(tabId => {
            const tab = tabs.find(t => t.id === tabId);
            if (tab && tab.type === 'table') {
                fetchTableData(tabId, tab.title);
            }
        });
    }, [executeDiscardChanges, setSelectedIndices, pendingChanges, tabs, fetchTableData]);

    // Wrapper for selective confirm
    const handleConfirmSelected = React.useCallback((selected: { tabId: string; indices: number[] }[]) => {
        executeConfirmSelected(selected, tabs, results, addLog, fetchTableData);
    }, [executeConfirmSelected, tabs, results, addLog, fetchTableData]);

    // Wrapper for selective discard
    const handleDiscardSelected = React.useCallback((selected: { tabId: string; indices: number[] }[]) => {
        executeDiscardSelected(selected);

        // Refresh data for affected tabs
        const uniqueTabs = new Set(selected.map(s => s.tabId));
        uniqueTabs.forEach(tabId => {
            const tab = tabs.find(t => t.id === tabId);
            if (tab && tab.type === 'table') {
                fetchTableData(tabId, tab.title);
            }
        });
    }, [executeDiscardSelected, tabs, fetchTableData]);

    // Wrapper for revert change (single)
    const handleRevertChangeWrapper = React.useCallback((tabId: string, index: number) => {
        handleRevertChange(tabId, index);
        const tab = tabs.find(t => t.id === tabId);
        if (tab && tab.type === 'table') {
            fetchTableData(tabId, tab.title);
        }
    }, [handleRevertChange, tabs, fetchTableData]);


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
        connection,
        enableChangeLog,
        addLog,
        fetchTableData
    });

    const {
        handleSaveQuery,
        handleUpdateQuery,
        handleSaveFunction,
        handleUpdateFunction,
        handleCopy,
        handleExport,
        handleExportQueryToFile
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
        selectedIndices,
        defaultExportPath
    });

    const handleDeleteQuery = deleteQuery;
    const handleDeleteFunction = deleteFunction;

    // Execute saved function and show results (or switch to existing)
    const handleExecuteFunction = async (func: SavedFunction) => {
        // Check if tab already exists for this function
        const existingTab = tabs.find(t => t.savedFunctionId === func.id);
        if (existingTab) {
            setActiveTabId(existingTab.id);
            return;
        }
        const tabId = `func-${func.id}-${Date.now()}`;
        setTabs([...tabs, { id: tabId, type: 'function-output', title: func.name, savedFunctionId: func.id }]);
        setTabQueries(prev => ({ ...prev, [tabId]: func.function_body }));
        setActiveTabId(tabId);
        setResults(prev => ({ ...prev, [tabId]: { data: null, loading: true, error: null } }));

        try {
            const res = await api.executeQuery(connection.connection_string, func.function_body);
            const lastRes = res.length > 0 ? res[res.length - 1] : null;
            setResults(prev => ({ ...prev, [tabId]: { data: lastRes, allData: res, loading: false, error: null } }));
            addLog(func.function_body, 'Success', `fn:${func.name}`, undefined, lastRes ? lastRes.rows.length : 0, 'User');
        } catch (e) {
            setResults(prev => ({ ...prev, [tabId]: { data: null, loading: false, error: String(e) } }));
            addLog(func.function_body, 'Error', `fn:${func.name}`, String(e), 0, 'User');
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
        setTabs([...tabs, { id: tabId, type: 'function', title: func.name, savedFunctionId: func.id }]);
        setTabQueries(prev => ({ ...prev, [tabId]: func.function_body }));
        setActiveTabId(tabId);
    };

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
        // Check if already exists as a pinned tab for THIS database
        const existingPinned = tabs.find(t => t.title === tableName && t.type === 'table' && !t.isPreview && t.databaseName === currentDbName);
        if (existingPinned) {
            setActiveTabId(existingPinned.id);
            return;
        }

        // Check if this table is already the preview tab for THIS database
        const existingPreview = tabs.find(t => t.title === tableName && t.type === 'table' && t.isPreview && t.databaseName === currentDbName);
        if (existingPreview) {
            setActiveTabId(existingPreview.id);
            return;
        }

        // Find any existing preview tab (to replace it)
        const previewTab = tabs.find(t => t.isPreview);

        const newTabId = `table-${currentDbName}-${tableName}`;

        if (previewTab) {
            // Replace the preview tab with the new table
            setTabs(tabs.map(t =>
                t.id === previewTab.id
                    ? { ...t, id: newTabId, title: tableName, isPreview: true, databaseName: currentDbName }
                    : t
            ));
            // Clear results for old preview tab if it's different
            if (previewTab.id !== newTabId) {
                const newResults = { ...results };
                delete newResults[previewTab.id];
                setResults(newResults);
            }
            setActiveTabId(newTabId);
        } else {
            // Create new preview tab
            setTabs([...tabs, { id: newTabId, type: 'table', title: tableName, isPreview: true, databaseName: currentDbName }]);
            setActiveTabId(newTabId);
        }
    };

    // Pin tab (remove preview mode) - called on double-click
    const pinTab = (tabId: string) => {
        setTabs(tabs.map(t =>
            t.id === tabId ? { ...t, isPreview: false } : t
        ));
    };

    const { handleGetTableSchema, handleEditTableSchema, refreshEditTableSchema } = useSchemaOperations({
        connection,
        tabs,
        setTabs,
        setActiveTabId,
        setResults,
        setTableCreatorStates,
        setOriginalSchemas,
        addLog
    });

    // Update ref with actual function (avoids circular dependency)
    React.useEffect(() => {
        refreshEditTableSchemaRef.current = refreshEditTableSchema;
    }, [refreshEditTableSchema]);

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
        // Toggle: if already open, just close it
        if (showEditWindow) {
            setShowEditWindow(false);
            return;
        }

        // Close changelog if open, then open edit pane
        setShowChangelog(false);

        // Check if we have an active table tab
        if (!activeTab || activeTab.type !== 'table') {
            // Still allow opening the pane, but with no data
            setPanelColumns([]);
            setEditData(undefined);
            setShowEditWindow(true);
            return;
        }

        const currentData = results[activeTab.id]?.data;
        setPanelColumns(currentData?.columns || []);

        // Populate editData from selection to signal "Edit Mode" to mutation hooks
        if (currentData && selectedIndices.size > 0) {
            const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);
            const selectionData = sortedIndices.map(idx => {
                const rowObj: Record<string, any> = {};
                if (idx < currentData.rows.length) {
                    currentData.columns.forEach((col, cIdx) => {
                        rowObj[col] = currentData.rows[idx][cIdx];
                    });
                }
                return rowObj;
            }).filter(obj => Object.keys(obj).length > 0);

            if (selectionData.length > 0) {
                setEditData(selectionData);
            } else {
                setEditData(undefined);
            }
        } else {
            setEditData(undefined);
        }

        setShowEditWindow(true);
    };

    const { handlePanelSubmit } = useDataMutation({
        activeTab,
        results,
        selectedIndices,
        editData,
        connection,
        setPendingChanges,
        setShowEditWindow,
        setEditData,
        setSelectedIndices,
        fetchTableData,
        addLog
    });

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

    const handleExportQuery = handleExportQueryToFile;

    const handleOpenLogs = () => {
        const logTabId = 'system-logs';
        const existing = tabs.find(t => t.id === logTabId);
        if (!existing) {
            setTabs([...tabs, { id: logTabId, type: 'logs', title: 'System Logs' }]);
        }
        setActiveTabId(logTabId);
    };

    const handleOpenSchema = () => {
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
                        const schema = await api.getTableSchema(connection.connection_string, tableName);
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
    };

    // totalChanges is calculated inside MainLayout now if needed, or we pass pendingChanges. 
    // MainLayout computes it.

    return (
        <>
            <MainLayout
                // System / UI
                theme={theme}
                setTheme={setTheme}
                availableThemes={availableThemes}
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                zoomLevel={zoom}
                setZoom={setZoom}
                enableChangeLog={enableChangeLog}
                setEnableChangeLog={setEnableChangeLog}
                defaultExportPath={defaultExportPath}
                setDefaultExportPath={setDefaultExportPath}

                // Navbar State
                showDbMenu={showDbMenu}
                setShowDbMenu={setShowDbMenu}
                setShowPreferences={setShowPreferences}
                showChangelog={showChangelog}
                setShowChangelog={setShowChangelog}

                // Data
                connection={connection}
                tabs={tabs}
                activeTabId={activeTabId}
                activeTab={activeTab}

                // Navbar Actions
                handleAddTableTab={() => handleAddTableTab(currentDbName)}
                handleAddQuery={handleAddQuery}
                handleOpenLogs={handleOpenLogs}
                handleOpenEditWindow={handleOpenInsertSidebar}
                handleOpenSchema={handleOpenSchema}
                onRefresh={handleRefresh}
                onRefreshConnection={fetchTables}

                // Sidebar Props
                tables={tables}
                tags={tags}
                tableTags={tableTags}
                onSwitchConnection={handleSwitchConnectionWrapper}
                onSwitchDatabase={handleSwitchDatabase}
                onTableClick={handleTableClick}
                onAddConnection={() => setShowNewConnModal(true)}
                onGetTableSchema={handleGetTableSchema}
                onEditTableSchema={handleEditTableSchema}
                onDuplicateTable={handleDuplicateTable}
                onTruncateTable={handleTruncateTable}
                onDropTable={handleDropTable}
                savedQueries={savedQueries}
                savedFunctions={savedFunctions}
                savedConnections={savedConnections}
                onQueryClick={handleOpenSavedQuery}
                onFunctionClick={handleExecuteFunction}
                onDeleteQuery={handleDeleteQuery}
                onDeleteFunction={handleDeleteFunction}
                onEditFunction={handleEditFunction}

                // TabBar Props
                setActiveTabId={setActiveTabId}
                closeTab={closeTab}
                pinTab={pinTab}
                handleDragEnd={handleDragEnd}
                currentDbName={currentDbName}

                // MainViewContent Props
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
                tableCreatorStates={tableCreatorStates}
                originalSchemas={originalSchemas}
                setTableCreatorStates={setTableCreatorStates}
                tabQueries={tabQueries}
                setTabQueries={setTabQueries}
                resultsVisible={resultsVisible}
                resultsHeight={resultsHeight}
                isResizing={isResizing}
                toggleResults={toggleResults}
                startResizing={startResizing}
                handleInsertRow={handleInsertRow}
                handleDeleteRows={handleDeleteRows}
                handleCopy={handleCopy}
                handleExport={handleExport}
                fetchTableData={fetchTableData}
                setSortState={setSortState}
                handleCellEdit={handleCellEdit}
                handleRowDelete={handleRowDelete}
                handleRunQuery={runQuery}
                handleTableCreated={handleTableCreated}
                handleSaveQuery={() => setSaveModal({ type: 'query' })}
                handleSaveFunction={() => setSaveModal({ type: 'function' })}
                handleUpdateQuery={tabs.find(t => t.id === activeTabId)?.savedQueryId ? handleUpdateQuery : undefined}
                handleUpdateFunction={tabs.find(t => t.id === activeTabId)?.savedFunctionId ? handleUpdateFunction : undefined}
                handleExportQuery={handleExportQuery}
                handleSort={handleSort}
                setIsCapturing={setIsCapturing}
                addToast={addToast}

                // Changelog Actions
                handleConfirmChanges={handleConfirmChanges}
                handleDiscardChanges={handleDiscardChanges}
                handleExecuteConfirm={handleExecuteConfirm}
                handleExecuteDiscard={handleExecuteDiscard}
                handleConfirmSelected={handleConfirmSelected}
                handleDiscardSelected={handleDiscardSelected}
                handleRevertChange={handleRevertChangeWrapper}
                handleNavigateToChange={handleNavigateToChangeWrapper}
                changelogConfirm={changeManager.changelogConfirm}
                setChangelogConfirm={changeManager.setChangelogConfirm}

                // Modals props
                tableConfirmModal={tableConfirmModal}
                setTableConfirmModal={setTableConfirmModal}
                confirmTableOperation={confirmTableOperation}
                duplicateTableModal={duplicateTableModal}
                setDuplicateTableModal={setDuplicateTableModal}
                confirmDuplicateTable={confirmDuplicateTable}

                // ModalManager Props
                saveModal={saveModal}
                setSaveModal={setSaveModal}
                showNewConnModal={showNewConnModal}
                setShowNewConnModal={setShowNewConnModal}
                showEditWindow={showEditWindow}
                setShowEditWindow={setShowEditWindow}
                panelColumns={panelColumns}
                handlePanelSubmit={handlePanelSubmit}
                saveQuery={handleSaveQuery}
                saveFunction={handleSaveFunction}
                showPreferences={showPreferences}

                // Misc
                isCapturing={isCapturing}
                toasts={toasts}
                onDismissToast={dismissToast}
            />

            {/* Error Summary Modal */}
            <ErrorSummaryModal
                isOpen={showErrorModal}
                onClose={() => setShowErrorModal(false)}
                errors={changeErrors}
                onRetryWithFKDisabled={(errors) => {
                    setShowErrorModal(false);
                    retryWithFKDisabled(errors, addLog);
                }}
            />
        </>
    );
};
