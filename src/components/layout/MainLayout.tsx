import React, { useMemo, useState } from 'react';
import { ToastContainer, ToastMessage } from '../common/Toast';
import { TableConfirmModal, DuplicateTableModal, ModalManager } from '../modals';
import { Navbar, TabBar, Sidebar, ChangelogSidebar, EditPaneSidebar } from '.';
import { MainViewContent } from '../views';
import { FilterCondition } from '../modals/FilterModal';
import styles from '../../styles/MainLayout.module.css';
import { Connection, PendingChange, TabItem, Tag, TableTag, SavedQuery, SavedFunction, LogEntry, TableDataState, PaginationState, ColumnSchema, SortState } from '../../types/index';
import { TableCreatorState } from '../editors';

interface MainLayoutProps {
    // System / UI
    theme: string;
    setTheme: React.Dispatch<React.SetStateAction<string>>;
    availableThemes: { id: string, name: string, type: string, colors: { bg: string, text: string, accent: string } }[];
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    zoomLevel: number;
    setZoom: React.Dispatch<React.SetStateAction<number>>;
    enableChangeLog: boolean;
    setEnableChangeLog: React.Dispatch<React.SetStateAction<boolean>>;
    defaultExportPath: string;
    setDefaultExportPath: React.Dispatch<React.SetStateAction<string>>;

    // Navbar State
    showDbMenu: boolean;
    setShowDbMenu: (show: boolean) => void;
    setShowPreferences: (show: boolean) => void;
    showChangelog: boolean;

    setShowChangelog: React.Dispatch<React.SetStateAction<boolean>>;

    // Data
    connection: Connection;
    tabs: TabItem[];
    activeTabId: string | null;
    activeTab: TabItem | undefined;

    // Navbar Actions
    handleAddTableTab: () => void;
    handleAddQuery: () => void;
    handleOpenLogs: () => void;
    handleOpenEditWindow: () => void;
    handleOpenSchema: () => void;
    onRefresh: () => void; // For data refresh (active tab)
    onRefreshConnection: () => void; // For connection refresh (tables list)

    // Sidebar Props
    tables: string[];
    tags: Tag[];
    tableTags: TableTag[];
    onSwitchConnection: (conn: Connection) => void;
    onSwitchDatabase: (dbName: string) => void;
    onTableClick: (tableName: string) => void;
    onAddConnection: () => void;
    onGetTableSchema: (tableName: string) => void;
    onEditTableSchema: (tableName: string) => void;
    onDuplicateTable: (tableName: string) => void;
    onTruncateTable: (tableName: string) => void;
    onDropTable: (tableName: string) => void;
    savedQueries: SavedQuery[];
    savedFunctions: SavedFunction[];
    savedConnections: Connection[];
    onQueryClick: (savedQuery: SavedQuery) => void;
    onFunctionClick: (savedFunction: SavedFunction) => void;
    onDeleteQuery: (id: number) => void;
    onDeleteFunction: (id: number) => void;
    onEditFunction: (func: SavedFunction) => void;

    // TabBar Props
    setActiveTabId: (id: string) => void;
    closeTab: (e: React.MouseEvent, id: string) => void;
    pinTab: (id: string) => void;
    handleDragEnd: (event: any) => void;
    currentDbName?: string;

    // MainViewContent Props
    results: Record<string, TableDataState>;
    selectedIndices: Set<number>;
    setSelectedIndices: React.Dispatch<React.SetStateAction<Set<number>>>;
    paginationMap: Record<string, PaginationState>;
    setPaginationMap: React.Dispatch<React.SetStateAction<Record<string, PaginationState>>>;
    pendingChanges: Record<string, PendingChange[]>;
    setPendingChanges: React.Dispatch<React.SetStateAction<Record<string, PendingChange[]>>>;
    highlightRowIndex: number | null;
    tableSchemas: Record<string, ColumnSchema[]>;
    activeDropdown: 'copy' | 'export' | 'pageSize' | null;
    setActiveDropdown: React.Dispatch<React.SetStateAction<'copy' | 'export' | 'pageSize' | null>>;
    logs: LogEntry[];
    tableCreatorStates: Record<string, TableCreatorState>;
    originalSchemas: Record<string, TableCreatorState>;
    setTableCreatorStates: React.Dispatch<React.SetStateAction<Record<string, TableCreatorState>>>;
    tabQueries: Record<string, string>;
    setTabQueries: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    resultsVisible: boolean;
    resultsHeight: number;
    isResizing: boolean;
    toggleResults: () => void;
    startResizing: (e: React.MouseEvent) => void;
    handleInsertRow: () => void;
    handleDeleteRows: () => void;
    handleCopy: (format: 'CSV' | 'JSON') => void;
    handleExport: (format: 'CSV' | 'JSON') => void;
    fetchTableData: (id: string, table: string, page?: number, pageSize?: number, filtersOverride?: any[]) => Promise<void>;
    setSortState: React.Dispatch<React.SetStateAction<SortState | null>>;
    handleCellEdit: (rowIndex: number, column: string, value: any) => void;
    handleRowDelete: (rowIndex: number) => void;
    handleRunQuery: (tabId: string, query: string) => void;
    handleTableCreated: () => void;
    handleSaveQuery: () => void;
    handleSaveFunction: () => void;
    handleUpdateQuery: ((id: number, name: string, sql: string) => void) | undefined;
    handleUpdateFunction: ((id: number, name: string, body: string) => void) | undefined;
    handleExportQuery: () => void;
    handleSort: (column: string) => void;
    setIsCapturing: React.Dispatch<React.SetStateAction<boolean>>;
    addToast: (title: string, message: string, filePath?: string, type?: 'success' | 'error' | 'info') => void;

    // Filter props
    filtersMap: Record<string, FilterCondition[]>;
    updateFilters: (tabId: string, tableName: string, filters: FilterCondition[]) => void;

    // Changelog Actions
    handleConfirmChanges: () => void;
    handleDiscardChanges: () => void;
    handleRevertChange: (tabId: string, index: number) => void;
    handleNavigateToChange: (tabId: string, rowIndex: number) => void;
    handleExecuteConfirm: () => void;
    handleExecuteDiscard: () => void;
    handleConfirmSelected: (selected: { tabId: string; indices: number[] }[]) => void;
    handleDiscardSelected: (selected: { tabId: string; indices: number[] }[]) => void;
    changelogConfirm: { type: 'confirm' | 'discard' } | null;
    setChangelogConfirm: React.Dispatch<React.SetStateAction<{ type: 'confirm' | 'discard' } | null>>;

    // Modals props
    tableConfirmModal: { type: 'truncate' | 'drop'; tableName: string } | null;
    setTableConfirmModal: (val: { type: 'truncate' | 'drop'; tableName: string } | null) => void;
    confirmTableOperation: () => void;
    duplicateTableModal: string | null;
    setDuplicateTableModal: (val: string | null) => void;
    confirmDuplicateTable: (newName: string, includeData: boolean) => void;

    // ModalManager Props
    saveModal: { type: 'query' | 'function' } | null;
    setSaveModal: (val: { type: 'query' | 'function' } | null) => void;

    showEditWindow: boolean;
    setShowEditWindow: (val: boolean) => void;
    panelColumns: string[];
    handlePanelSubmit: (data: Record<string, any>[]) => void;
    saveQuery: (name: string) => void;
    saveFunction: (name: string) => void;
    showPreferences: boolean;

    // Misc
    isCapturing: boolean;
    toasts: ToastMessage[];
    onDismissToast: (id: string) => void;
    sessionId: string | null;
}

export const MainLayout: React.FC<MainLayoutProps> = (props) => {

    const totalChanges = useMemo(() =>
        Object.values(props.pendingChanges).reduce((acc, curr) => acc + curr.length, 0),
        [props.pendingChanges]
    );

    const [searchQuery, setSearchQuery] = useState('');

    return (
        <div
            style={{
                width: '100vw',
                height: '100vh',
                overflow: 'hidden',
                background: 'var(--bg-primary)'
            }}
        >
            <div
                className={styles.container}
                data-theme={props.theme}
                style={{
                    transform: `scale(${props.zoomLevel})`,
                    transformOrigin: 'top left',
                    width: `${100 / props.zoomLevel}vw`,
                    height: `${100 / props.zoomLevel}vh`
                }}
            >
                <ToastContainer toasts={props.toasts} onDismiss={props.onDismissToast} />

                {/* Modals */}
                <TableConfirmModal
                    isOpen={!!props.tableConfirmModal}
                    onClose={() => props.setTableConfirmModal(null)}
                    onConfirm={props.confirmTableOperation}
                    tableName={props.tableConfirmModal?.tableName || ''}
                    action={props.tableConfirmModal?.type || null}
                />

                {props.duplicateTableModal && (
                    <DuplicateTableModal
                        tableName={props.duplicateTableModal}
                        existingTables={props.tables}
                        onConfirm={props.confirmDuplicateTable}
                        onCancel={() => props.setDuplicateTableModal(null)}
                    />
                )}

                <ModalManager
                    preferences={{
                        isOpen: props.showPreferences,
                        onClose: () => props.setShowPreferences(false),
                        theme: props.theme,
                        setTheme: props.setTheme,
                        zoom: props.zoomLevel,
                        setZoom: props.setZoom,
                        availableThemes: props.availableThemes,
                        enableChangeLog: props.enableChangeLog,
                        setEnableChangeLog: props.setEnableChangeLog,
                        defaultExportPath: props.defaultExportPath,
                        setDefaultExportPath: props.setDefaultExportPath
                    }}

                    tableConfirm={{
                        modal: props.tableConfirmModal,
                        setModal: props.setTableConfirmModal,
                        onConfirm: props.confirmTableOperation
                    }}
                    duplicateTable={{
                        tableName: props.duplicateTableModal,
                        setTableName: props.setDuplicateTableModal,
                        existingTables: props.tables,
                        onConfirm: props.confirmDuplicateTable
                    }}
                    changelogConfirm={{
                        modal: props.changelogConfirm,
                        setModal: props.setChangelogConfirm,
                        pendingChangesCount: totalChanges,
                        onConfirm: props.handleExecuteConfirm,
                        onDiscard: props.handleExecuteDiscard
                    }}
                    saveItem={{
                        modal: props.saveModal,
                        setModal: props.setSaveModal,
                        onSaveQuery: props.saveQuery,
                        onSaveFunction: props.saveFunction
                    }}
                />

                {!props.isCapturing && (
                    <Navbar
                        sidebarOpen={props.sidebarOpen}
                        setSidebarOpen={props.setSidebarOpen}
                        showDbMenu={props.showDbMenu}
                        setShowDbMenu={props.setShowDbMenu}
                        setShowPreferences={props.setShowPreferences}
                        handleAddTableTab={props.handleAddTableTab}
                        fetchTables={props.onRefreshConnection}
                        handleAddQuery={props.handleAddQuery}
                        showChangelog={props.showChangelog}
                        setShowChangelog={props.setShowChangelog}
                        totalChanges={totalChanges}
                        handleOpenLogs={props.handleOpenLogs}
                        handleOpenEditWindow={props.handleOpenEditWindow}
                        showEditWindow={props.showEditWindow}
                        handleOpenSchema={props.handleOpenSchema}
                        connection={props.connection}
                        savedConnections={props.savedConnections}
                        onSwitchConnection={props.onSwitchConnection}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        enableChangeLog={props.enableChangeLog}
                    />
                )}

                <div className={styles.body}>
                    <Sidebar
                        sidebarOpen={props.sidebarOpen}
                        onSwitchConnection={props.onSwitchConnection}
                        onSwitchDatabase={props.onSwitchDatabase}
                        onTableClick={props.onTableClick}
                        onAddConnection={props.onAddConnection}
                        onGetTableSchema={props.onGetTableSchema}
                        onEditTableSchema={props.onEditTableSchema}
                        onDuplicateTable={props.onDuplicateTable}
                        onTruncateTable={props.onTruncateTable}
                        onDropTable={props.onDropTable}
                        savedQueries={props.savedQueries}
                        savedFunctions={props.savedFunctions}
                        onQueryClick={props.onQueryClick}
                        onFunctionClick={props.onFunctionClick}
                        onDeleteQuery={props.onDeleteQuery}
                        onDeleteFunction={props.onDeleteFunction}
                        onEditFunction={props.onEditFunction}
                        connection={props.connection}
                        sessionId={props.sessionId}
                        savedConnections={props.savedConnections}
                        searchQuery={searchQuery}
                    />

                    <div className={styles.content}>
                        <TabBar
                            tabs={props.tabs}
                            activeTabId={props.activeTabId || ''}
                            onTabClick={props.setActiveTabId}
                            onTabClose={props.closeTab}
                            onTabDoubleClick={props.pinTab}
                            onDragEnd={props.handleDragEnd}
                            tags={props.tags}
                            tableTags={props.tableTags}
                            currentDatabaseName={props.currentDbName}
                        />

                        <div className={styles.mainView}>
                            <MainViewContent
                                activeTab={props.activeTab}
                                activeTabId={props.activeTabId || ''}
                                tabs={props.tabs}
                                results={props.results}
                                selectedIndices={props.selectedIndices}
                                setSelectedIndices={props.setSelectedIndices}
                                paginationMap={props.paginationMap}
                                setPaginationMap={props.setPaginationMap}
                                pendingChanges={props.pendingChanges}
                                setPendingChanges={props.setPendingChanges}
                                highlightRowIndex={props.highlightRowIndex}
                                tableSchemas={props.tableSchemas}
                                activeDropdown={props.activeDropdown}
                                setActiveDropdown={props.setActiveDropdown}
                                logs={props.logs}
                                tables={props.tables}
                                theme={props.theme}
                                tableCreatorStates={props.tableCreatorStates}
                                originalSchemas={props.originalSchemas}
                                setTableCreatorStates={props.setTableCreatorStates}
                                connection={props.connection}
                                tabQueries={props.tabQueries}
                                setTabQueries={props.setTabQueries}
                                resultsVisible={props.resultsVisible}
                                resultsHeight={props.resultsHeight}
                                isResizing={props.isResizing}
                                toggleResults={props.toggleResults}
                                startResizing={props.startResizing}
                                onInsertRow={props.handleInsertRow}
                                onDeleteRows={props.handleDeleteRows}
                                onCopy={props.handleCopy}
                                onExport={props.handleExport}
                                fetchTableData={props.fetchTableData}
                                setSortState={props.setSortState}
                                onCellEdit={props.handleCellEdit}
                                onRowDelete={props.handleRowDelete}
                                onRunQuery={(q) => props.activeTabId && props.handleRunQuery(props.activeTabId, q)}
                                onTableClick={props.onTableClick}
                                onTableCreated={props.handleTableCreated}
                                setShowChangelog={props.setShowChangelog}
                                handleAddQuery={props.handleAddQuery}
                                handleSaveQuery={props.handleSaveQuery}
                                handleSaveFunction={props.handleSaveFunction}
                                handleUpdateQuery={props.handleUpdateQuery}
                                handleUpdateFunction={props.handleUpdateFunction}
                                handleExportQuery={props.handleExportQuery}
                                handleSort={props.handleSort}
                                handleRefresh={props.onRefresh}
                                setIsCapturing={props.setIsCapturing}
                                addToast={props.addToast}
                                filtersMap={props.filtersMap}
                                updateFilters={props.updateFilters}
                            />
                        </div>
                    </div>

                    {/* Sidebars - always rendered for animation, isOpen controls visibility */}
                    <ChangelogSidebar
                        isOpen={props.showChangelog}
                        onClose={() => props.setShowChangelog(false)}
                        changes={props.pendingChanges}
                        tabs={props.tabs}
                        onConfirm={props.handleConfirmChanges}
                        onDiscard={props.handleDiscardChanges}
                        onConfirmSelected={props.handleConfirmSelected}
                        onDiscardSelected={props.handleDiscardSelected}
                        onRevert={props.handleRevertChange}
                        onNavigate={props.handleNavigateToChange}
                    />

                    <EditPaneSidebar
                        isOpen={props.showEditWindow}
                        onClose={() => props.setShowEditWindow(false)}
                        activeTabId={props.activeTabId || ''}
                        activeTabType={props.activeTab?.type}
                        activeTabTitle={props.activeTab?.title || ''}
                        results={props.results}
                        selectedIndices={props.selectedIndices}
                        setSelectedIndices={props.setSelectedIndices}
                        pendingChanges={props.pendingChanges}
                        setPendingChanges={props.setPendingChanges}
                        panelColumns={props.panelColumns}
                        onInsert={props.handlePanelSubmit}
                        onAddRow={props.handleInsertRow}
                        onCellEdit={props.handleCellEdit}
                    />
                </div>
            </div>
        </div>
    );
};
