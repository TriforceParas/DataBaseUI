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

// Alias for compatibility
export type SystemLog = LogEntry;
