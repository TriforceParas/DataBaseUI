import { QueryResult } from './api';

export interface TabResult {
    data: QueryResult | null;
    allData?: QueryResult[];
    loading: boolean;
    error: string | null;
}

export interface SortState {
    column: string;
    direction: 'ASC' | 'DESC';
}

export interface TabItem {
    id: string;
    type: string;
    title: string;
    isPreview?: boolean;
    savedQueryId?: number;
    savedFunctionId?: number;
}

export interface PaginationState {
    page: number;
    pageSize: number;
    total: number;
}

// Aliases for compatibility
export type Tab = TabItem;
export type TableDataState = TabResult;
