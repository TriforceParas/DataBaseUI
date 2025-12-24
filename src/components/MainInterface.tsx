import React, { useState, useEffect } from 'react';
import * as api from '../api';

import { Connection, PendingChange, ColumnSchema, SavedFunction } from '../types/index';
import { MainLayout } from './layout/MainLayout';
import { TableCreatorState } from './editors';
import { useSystemLogs, useSavedItems, useTableOperations, useTableData, useResultsPane, useTabs, useTableActions, usePersistenceActions, useDatabaseRegistry, useChangeManager, useAppSystem, useSchemaOperations, useDataMutation } from '../hooks';
import { useToast } from './common/Toast';
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
        availableThemes
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
    const [renderEditWindow, setRenderEditWindow] = useState(false);
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
            setTabs(tabs.filter(t => t.title !== tableName));
        },
        addLog
    });

    // --- Orchestration: Change Manager (Action Engine) ---
    const changeManager = useChangeManager(connection, { onSuccess: fetchTables });
    const {
        pendingChanges, setPendingChanges,
        showChangelog, setShowChangelog,
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
            const res = await api.executeQuery(connection.connection_string, func.function_body);
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

    const { handleGetTableSchema, handleEditTableSchema } = useSchemaOperations({
        connection,
        tabs,
        setTabs,
        setActiveTabId,
        setResults,
        setTableCreatorStates,
        setOriginalSchemas,
        addLog
    });

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
        <MainLayout
            // System / UI
            theme={theme}
            setTheme={setTheme}
            availableThemes={availableThemes}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            zoomLevel={zoom}
            setZoom={setZoom}

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
            handleAddTableTab={handleAddTableTab}
            handleAddQuery={handleAddQuery}
            handleOpenLogs={handleOpenLogs}
            handleOpenEditWindow={handleOpenInsertSidebar}
            handleOpenSchema={handleOpenSchema}
            onRefresh={handleRefresh}

            // Sidebar Props
            tables={tables}
            tags={tags}
            tableTags={tableTags}
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
            handleRevertChange={handleRevertChange}
            handleNavigateToChange={handleNavigateToChangeWrapper}

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
            renderEditWindow={renderEditWindow}
            setRenderEditWindow={setRenderEditWindow}
            panelColumns={panelColumns}
            editData={editData}
            setEditData={setEditData}
            handlePanelSubmit={handlePanelSubmit}
            saveQuery={handleSaveQuery}
            saveFunction={handleSaveFunction}
            showPreferences={showPreferences}

            // Misc
            isCapturing={isCapturing}
            toasts={toasts}
            onDismissToast={dismissToast}
        />
    );
};
