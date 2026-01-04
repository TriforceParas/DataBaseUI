import React from 'react';
import { Tab, PendingChange, ColumnSchema, SystemLog, PaginationState, TableDataState } from '../../types/index';
import { TableCreatorState } from '../editors';
import { EmptyStateView } from './EmptyStateView';
import { TableTabView } from './TableTabView';
import { LogTabView } from './LogTabView';
import { TableCreatorView } from './TableCreatorView';
import { SchemaDiagramView } from './SchemaDiagramView';
import { FunctionOutputView } from './FunctionOutputView';
import { QueryView } from './QueryView';

interface MainViewContentProps {
    activeTab: Tab | undefined;
    activeTabId: string;
    tabs: Tab[];

    // Common State
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
    logs: SystemLog[];
    tables: string[];
    theme: string;

    // TableCreator State
    tableCreatorStates: Record<string, TableCreatorState>;
    originalSchemas: Record<string, TableCreatorState>;
    setTableCreatorStates: React.Dispatch<React.SetStateAction<Record<string, TableCreatorState>>>;
    connectionString: string;

    // Query State
    tabQueries: Record<string, string>;
    setTabQueries: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    resultsVisible: boolean;
    resultsHeight: number;
    isResizing: boolean;
    toggleResults: () => void;
    startResizing: (e: React.MouseEvent) => void;

    // All Handlers
    onInsertRow: () => void;
    onDeleteRows: () => void;
    onCopy: (format: 'CSV' | 'JSON') => void;
    onExport: (format: 'CSV' | 'JSON') => void;
    fetchTableData: (tabId: string, tableName: string, page?: number, pageSize?: number) => void;
    setSortState: React.Dispatch<React.SetStateAction<{ column: string; direction: 'ASC' | 'DESC' } | null>>;
    onCellEdit: (rowIndex: number, column: string, newValue: any) => void;
    onRowDelete: (rowIndex: number) => void;
    onRunQuery: (query: string) => void;
    onTableClick: (tableName: string) => void;
    onTableCreated: () => void;
    setShowChangelog: React.Dispatch<React.SetStateAction<boolean>>;
    handleAddQuery: () => void;
    handleSaveQuery: () => void;
    handleSaveFunction: () => void;
    handleUpdateQuery: ((id: number, name: string, sql: string) => void) | undefined;
    handleUpdateFunction: ((id: number, name: string, body: string) => void) | undefined;
    handleExportQuery: () => void;
    handleSort: (column: string) => void;
    handleRefresh: () => void;
    setIsCapturing: React.Dispatch<React.SetStateAction<boolean>>;
    addToast: (title: string, message: string, filePath?: string, type?: 'success' | 'error' | 'info') => void;
}

export const MainViewContent: React.FC<MainViewContentProps> = ({
    activeTab,
    activeTabId,
    tabs,
    results,
    selectedIndices,
    setSelectedIndices,
    paginationMap,
    setPaginationMap,
    pendingChanges,
    setPendingChanges,
    highlightRowIndex,
    tableSchemas,
    activeDropdown,
    setActiveDropdown,
    logs,
    tables,
    theme,
    tableCreatorStates,
    originalSchemas,
    setTableCreatorStates,
    connectionString,
    tabQueries,
    setTabQueries,
    resultsVisible,
    resultsHeight,
    isResizing,
    toggleResults,
    startResizing,
    onInsertRow,
    onDeleteRows,
    onCopy,
    onExport,
    fetchTableData,
    setSortState,
    onCellEdit,
    onRowDelete,
    onRunQuery,
    onTableClick,
    onTableCreated,
    setShowChangelog,
    handleAddQuery,
    handleSaveQuery,
    handleSaveFunction,
    handleUpdateQuery,
    handleUpdateFunction,
    handleExportQuery,
    handleSort,
    handleRefresh,
    setIsCapturing,
    addToast
}) => {
    if (!activeTab) {
        return <EmptyStateView onOpenNewQuery={handleAddQuery} />;
    }

    if (activeTab.type === 'table') {
        return (
            <TableTabView
                activeTab={activeTab}
                results={results}
                selectedIndices={selectedIndices}
                setSelectedIndices={setSelectedIndices}
                paginationMap={paginationMap}
                pendingChanges={pendingChanges}
                highlightRowIndex={highlightRowIndex}
                tableSchemas={tableSchemas}
                activeDropdown={activeDropdown}
                setActiveDropdown={setActiveDropdown}
                onInsertRow={onInsertRow}
                onRefresh={() => fetchTableData(activeTab.id, activeTab.title)}
                onDeleteRows={onDeleteRows}
                onCopy={onCopy}
                onExport={onExport}
                onPageChange={(p) => fetchTableData(activeTab.id, activeTab.title, p)}
                onPageSizeChange={(s) => fetchTableData(activeTab.id, activeTab.title, 1, s)}
                onSort={(col) => setSortState(prev => prev?.column === col && prev.direction === 'ASC' ? { column: col, direction: 'DESC' } : { column: col, direction: 'ASC' })}
                onCellEdit={onCellEdit}
                onRowDelete={onRowDelete}
                onRecoverRow={(rowIndex) => {
                    setPendingChanges(prev => ({
                        ...prev,
                        [activeTab.id]: (prev[activeTab.id] || []).filter(c => !(c.type === 'DELETE' && c.rowIndex === rowIndex))
                    }));
                }}
            />
        );
    }

    if (activeTab.type === 'logs') {
        return (
            <LogTabView
                activeTab={activeTab}
                logs={logs}
                paginationMap={paginationMap}
                setPaginationMap={setPaginationMap}
                activeDropdown={activeDropdown}
                setActiveDropdown={setActiveDropdown}
                onCopy={onCopy}
                onExport={onExport}
            />
        );
    }

    if (activeTab.type === 'create-table') {
        return (
            <TableCreatorView
                activeTabId={activeTab.id}
                activeTabTitle={activeTab.title}
                connectionString={connectionString}
                tableCreatorStates={tableCreatorStates}
                originalSchemas={originalSchemas}
                setTableCreatorStates={setTableCreatorStates}
                onSuccess={onTableCreated}
                setPendingChanges={setPendingChanges}
                setShowChangelog={setShowChangelog}
            />
        );
    }

    if ((activeTab as any).type === 'schema-diagram') {
        return (
            <SchemaDiagramView
                tables={tables}
                tableSchemas={tableSchemas}
                onTableClick={onTableClick}
                theme={theme}
                setIsCapturing={setIsCapturing}
                addToast={addToast}
            />
        );
    }

    if ((activeTab as any).type === 'function-output') {
        return (
            <FunctionOutputView
                tabId={activeTabId}
                results={results}
                selectedIndices={selectedIndices}
                setSelectedIndices={setSelectedIndices}
                onSort={(col) => setSortState(prev => prev?.column === col && prev.direction === 'ASC' ? { column: col, direction: 'DESC' } : { column: col, direction: 'ASC' })}
            />
        );
    }

    // Default: Query View
    return (
        <QueryView
            activeTab={activeTab}
            tabQuery={tabQueries[activeTabId] || ''}
            onQueryChange={(val) => setTabQueries(prev => ({ ...prev, [activeTabId]: val }))}
            onRunQuery={onRunQuery}
            selectedIndices={selectedIndices}
            setSelectedIndices={setSelectedIndices}
            onCopy={onCopy}
            onExport={onExport}
            theme={theme}
            tables={tables}
            onSaveQuery={handleSaveQuery}
            onSaveFunction={handleSaveFunction}
            onExportSql={handleExportQuery}
            isSaved={!!(tabs.find(t => t.id === activeTabId)?.savedQueryId || tabs.find(t => t.id === activeTabId)?.savedFunctionId)}
            onSaveChanges={() => {
                const query = tabQueries[activeTabId] || '';
                if (activeTab.savedQueryId && handleUpdateQuery) {
                    handleUpdateQuery(activeTab.savedQueryId, activeTab.title, query);
                } else if (activeTab.savedFunctionId && handleUpdateFunction) {
                    handleUpdateFunction(activeTab.savedFunctionId, activeTab.title, query);
                }
            }}
            results={results}
            resultsVisible={resultsVisible}
            resultsHeight={resultsHeight}
            isResizing={isResizing}
            paginationMap={paginationMap}
            toggleResults={toggleResults}
            startResizing={startResizing}
            onRefresh={handleRefresh}
            onPageChange={(p) => fetchTableData(activeTab.id, activeTab.title, p)}
            onPageSizeChange={(s) => fetchTableData(activeTab.id, activeTab.title, 1, s)}
            onSort={handleSort}
            activeDropdown={activeDropdown}
            setActiveDropdown={setActiveDropdown}
            onUpdateValue={(rowIdx, col, val) => onCellEdit(rowIdx, col, val)}
            pendingChanges={pendingChanges}
        />
    );
};
