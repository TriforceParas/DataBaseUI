/**
 * API Response Types
 * 
 * Types for backend API responses, pending changes, and batch operations.
 */

export interface QueryResult {
    columns: string[];
    rows: any[][];
    duration_ms?: number;
}

export interface PendingChange {
    type: 'UPDATE' | 'DELETE' | 'INSERT' | 'ADD_COLUMN' | 'DROP_COLUMN';
    tableName: string;
    rowIndex: number;
    rowData: any;
    column?: string;
    oldValue?: any;
    newValue?: any;
    generatedSql?: string;
    identifier?: RowIdentifier;
    updates?: CellUpdate[];
    insert_values?: Record<string, string | null>;
}

export interface RowIdentifier {
    columns: string[];
    values: (string | null)[];
}

export interface CellUpdate {
    column: string;
    value: string | null;
}

export interface BatchChange {
    operation: 'UPDATE' | 'DELETE' | 'INSERT';
    table_name: string;
    identifier?: RowIdentifier;
    updates?: CellUpdate[];
    insert_values?: Record<string, string | null>;
}

export interface LogEntry {
    id: string;
    time: string;
    status: 'Success' | 'Error';
    table?: string;
    query: string;
    error?: string;
    rows?: number;
    user?: string;
}

export interface TagGroupView {
    tag: import('./models').Tag;
    tables: string[];
}

export interface SidebarView {
    groups: TagGroupView[];
    untagged: string[];
    databases: string[];
}

// Alias for compatibility
export type SystemLog = LogEntry;
