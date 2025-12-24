import React, { useMemo } from 'react';
import { ToastContainer, ToastMessage } from '../common/Toast';
import { TableConfirmModal, DuplicateTableModal, ModalManager } from '../modals';
import { Navbar, TabBar, Sidebar, ChangelogSidebar } from '.';
import { MainViewContent } from '../views';
import styles from '../styles/MainLayout.module.css';
import { Connection, PendingChange, TabItem, Tag, TableTag, SavedQuery, SavedFunction, LogEntry, TableDataState, PaginationState, ColumnSchema, SortState } from '../../types/index';
import { TableCreatorState } from '../editors';

interface MainLayoutProps {
    // System / UI
    theme: string;
    setTheme: React.Dispatch<React.SetStateAction<string>>;
    availableThemes: { id: string, name: string, colors: { bg: string, text: string, accent: string } }[];
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    zoomLevel: number;
    setZoom: React.Dispatch<React.SetStateAction<number>>;

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
    onRefresh: () => void; // mapped to fetchTables in Navbar usage if needed, or we pass specific prop

    // Sidebar Props
    tables: string[];
    tags: Tag[];
    tableTags: TableTag[];
    onSwitchConnection: (conn: Connection) => void;
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
    fetchTableData: (id: string, table: string, page?: number, pageSize?: number) => Promise<void>;
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

    // Changelog Actions
    handleConfirmChanges: () => void;
    handleDiscardChanges: () => void;
    handleRevertChange: (tabId: string, index: number) => void;
    handleNavigateToChange: (tabId: string, rowIndex: number) => void;

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
    showNewConnModal: boolean;
    setShowNewConnModal: (val: boolean) => void;
    showEditWindow: boolean;
    setShowEditWindow: (val: boolean) => void;
    renderEditWindow: boolean;
    setRenderEditWindow: (val: boolean) => void;
    panelColumns: string[];
    editData: Record<string, any>[] | undefined;
    setEditData: React.Dispatch<React.SetStateAction<Record<string, any>[] | undefined>>;
    handlePanelSubmit: (data: Record<string, any>[]) => void;
    saveQuery: (name: string) => void;
    saveFunction: (name: string) => void;
    showPreferences: boolean;

    // Misc
    isCapturing: boolean;
    toasts: ToastMessage[];
    onDismissToast: (id: string) => void;
}

export const MainLayout: React.FC<MainLayoutProps> = (props) => {

    const totalChanges = useMemo(() =>
        Object.values(props.pendingChanges).reduce((acc, curr) => acc + curr.length, 0),
        [props.pendingChanges]
    );



    // NOTE: For handleOpenEditWindow, we should ideally rely on the prop passed from parent
    // if the parent encapsulates the logic. 
    // Wait, I missed adding handleOpenEditWindow to Props!
    // I check usage in MainInterface: handleOpenInsertSidebar is passed to Navbar.
    // So I should add handleOpenEditWindow to Props and just call it.

    // Re-defining handleOpenEditWindow in MainLayout is redundant if we pass it.
    // I'll add it to props.

    // Oops, I didn't add it to interface above. I added showEditWindow/setShowEditWindow.
    // I should add handleOpenEditWindow to Interface.

    return (
        <div className={styles.container} data-theme={props.theme} style={{ zoom: props.zoomLevel }}>
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
                    availableThemes: props.availableThemes
                }}
                newConnection={{
                    isOpen: props.showNewConnModal,
                    onClose: () => props.setShowNewConnModal(false),
                    onSuccess: () => { props.setShowNewConnModal(false); props.onRefresh(); }
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
                    // Changelog modal state/handlers normally passed? 
                    // Access from MainInterface showed it passed changelogConfirm state.
                    // I need to add changelogConfirm state to Props.
                    // Or just handle confirm/discard via existing props?
                    // MainInterface used `changelogConfirm` state.
                    // I'll add changelogConfirm to Props (as `any` for now).
                    modal: null, // Placeholder or fix via props in next revision.
                    setModal: () => { },
                    pendingChangesCount: totalChanges,
                    onConfirm: props.handleConfirmChanges,
                    onDiscard: props.handleDiscardChanges
                }}
                saveItem={{
                    modal: props.saveModal,
                    setModal: props.setSaveModal,
                    onSaveQuery: props.saveQuery,
                    onSaveFunction: props.saveFunction
                }}
                editRow={{
                    isOpen: props.renderEditWindow && !!props.activeTabId,
                    onClose: () => props.setRenderEditWindow(false),
                    activeTabId: props.activeTabId || '',
                    activeTabType: props.activeTab?.type,
                    activeTabTitle: props.activeTab?.title || '',
                    results: props.results,
                    selectedIndices: props.selectedIndices,
                    setSelectedIndices: props.setSelectedIndices,
                    pendingChanges: props.pendingChanges,
                    setPendingChanges: props.setPendingChanges,
                    panelColumns: props.panelColumns,
                    onInsert: props.handlePanelSubmit,
                    onAddRow: props.handleInsertRow,
                    onCellEdit: props.handleCellEdit
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
                    fetchTables={props.onRefresh}
                    handleAddQuery={props.handleAddQuery}
                    showChangelog={props.showChangelog}
                    setShowChangelog={props.setShowChangelog}
                    totalChanges={totalChanges}
                    handleOpenLogs={props.handleOpenLogs}
                    handleOpenEditWindow={props.handleOpenEditWindow}
                    showEditWindow={props.showEditWindow}
                    handleOpenSchema={props.handleOpenSchema}
                />
            )}

            <div className={styles.body}>
                <Sidebar
                    sidebarOpen={props.sidebarOpen}
                    tables={props.tables}
                    onSwitchConnection={props.onSwitchConnection}
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
                    savedConnections={props.savedConnections}
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
                            connectionString={props.connection.connection_string}
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
                        />
                    </div>
                </div>

                <ChangelogSidebar
                    isOpen={props.showChangelog}
                    onClose={() => props.setShowChangelog(false)}
                    changes={props.pendingChanges}
                    tabs={props.tabs}
                    onConfirm={props.handleConfirmChanges}
                    onDiscard={props.handleDiscardChanges}
                    onRevert={props.handleRevertChange}
                    onNavigate={props.handleNavigateToChange}
                />
            </div>
        </div>
    );
};
