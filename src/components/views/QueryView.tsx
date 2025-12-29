import React from 'react';
import { QueryEditor } from '../editors';
import { ResultsPane } from '../layout';
import { Tab, TableDataState, PendingChange, PaginationState } from '../../types/index';

interface QueryViewProps {
    activeTab: Tab;
    tabQuery: string;
    onQueryChange: (val: string) => void;
    onRunQuery: (query: string) => void;
    selectedIndices: Set<number>;
    setSelectedIndices: (indices: Set<number> | ((prev: Set<number>) => Set<number>)) => void;
    onCopy: (format: 'CSV' | 'JSON') => void;
    onExport: (format: 'CSV' | 'JSON') => void;
    theme: string;
    tables: string[];
    onSaveQuery: () => void;
    onSaveFunction: () => void;
    onExportSql: () => void;
    isSaved: boolean;
    onSaveChanges?: () => void;

    // ResultsPane props
    results: Record<string, TableDataState>;
    resultsVisible: boolean;
    resultsHeight: number;
    isResizing: boolean;
    paginationMap: Record<string, PaginationState>;
    toggleResults: () => void;
    startResizing: (e: React.MouseEvent) => void;
    onRefresh: () => void;
    onPageChange: (p: number) => void;
    onPageSizeChange: (s: number) => void;
    onSort: (col: string) => void;
    activeDropdown: 'copy' | 'export' | 'pageSize' | null;
    setActiveDropdown: (d: 'copy' | 'export' | 'pageSize' | null) => void;
    onUpdateValue: (rowIdx: number, col: string, val: any) => void;
    pendingChanges: Record<string, PendingChange[]>;
}

export const QueryView: React.FC<QueryViewProps> = ({
    activeTab,
    tabQuery,
    onQueryChange,
    onRunQuery,
    selectedIndices,
    setSelectedIndices,
    onCopy,
    onExport,
    theme,
    tables,
    onSaveQuery,
    onSaveFunction,
    onExportSql,
    isSaved,
    onSaveChanges,
    results,
    resultsVisible,
    resultsHeight,
    isResizing,
    paginationMap,
    toggleResults,
    startResizing,
    onRefresh,
    onPageChange,
    onPageSizeChange,
    onSort,
    activeDropdown,
    setActiveDropdown,
    onUpdateValue,
    pendingChanges
}) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Query Toolbar */}
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <QueryEditor
                    value={tabQuery}
                    onChange={onQueryChange}
                    onRunQuery={onRunQuery}
                    selectedRowCount={selectedIndices.size}
                    onCopy={() => onCopy('CSV')}
                    onExport={onExport}
                    theme={theme}
                    tables={tables}
                    onSaveQuery={onSaveQuery}
                    onSaveFunction={onSaveFunction}
                    onExportSql={onExportSql}
                    isSaved={isSaved}
                    onSaveChanges={onSaveChanges}
                />
            </div>

            <ResultsPane
                activeTabId={activeTab.id}
                activeTabType={activeTab.type}
                results={results}
                resultsVisible={resultsVisible}
                resultsHeight={resultsHeight}
                isResizing={isResizing}
                paginationMap={paginationMap}
                toggleResults={toggleResults}
                startResizing={startResizing}
                onRefresh={onRefresh}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
                onSort={onSort}
                selectedIndices={selectedIndices}
                setSelectedIndices={setSelectedIndices}
                activeDropdown={activeDropdown}
                setActiveDropdown={setActiveDropdown}
                onUpdateValue={onUpdateValue}
                pendingChanges={pendingChanges}
                onExport={onExport}
                onCopy={onCopy}
            />
        </div>
    );
};
