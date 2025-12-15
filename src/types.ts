export interface Connection {
    id: number;
    name: string;
    connection_string: string;
}

export interface Tag {
    id: number;
    name: string;
    color: string;
}

export interface TableTag {
    tag_id: number;
    table_name: string;
    connection_id: number;
}

export interface QueryResult {
    columns: string[];
    rows: string[][];
}

export interface PendingChange {
    type: 'UPDATE' | 'DELETE';
    tableName: string;
    rowIndex: number; // Index in the current results array
    rowData: any; // Full row data (for deletes or reference)
    column?: string; // For updates
    oldValue?: any;
    newValue?: any;
    generatedSql?: string; // Preview
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
