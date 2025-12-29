import React from 'react';
import { DataGrid } from '../datagrid/DataGrid';
import { TableDataState } from '../../types/index';

interface FunctionOutputViewProps {
    tabId: string;
    results: Record<string, TableDataState>;
    selectedIndices: Set<number>;
    setSelectedIndices: (indices: Set<number>) => void;
    onSort: (col: string) => void;
}

export const FunctionOutputView: React.FC<FunctionOutputViewProps> = ({
    tabId,
    results,
    selectedIndices,
    setSelectedIndices,
    onSort
}) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1, overflow: 'hidden' }}>
                <DataGrid
                    key={tabId}
                    data={results[tabId]?.data || null}
                    loading={results[tabId]?.loading || false}
                    error={results[tabId]?.error || null}
                    selectedIndices={selectedIndices}
                    onSelectionChange={setSelectedIndices}
                    onSort={onSort}
                />
            </div>
        </div>
    );
};
