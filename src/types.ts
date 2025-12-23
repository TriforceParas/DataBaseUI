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
    rows: any[][]; // Changed to any[][] to support various data types
    duration_ms?: number;
}

export interface ColumnSchema {
    name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
    column_key: string;
}

export interface PendingChange {
    type: 'UPDATE' | 'DELETE' | 'INSERT' | 'ADD_COLUMN' | 'DROP_COLUMN';
    tableName: string;
    rowIndex: number; // Index in the current results array (or column index for schema changes)
    rowData: any; // Full row data (for deletes or reference) or column definition for schema changes
    column?: string; // For updates or column name for schema changes
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

export interface SavedQuery {
    id: number;
    name: string;
    query: string;
    connection_id: number;
}

export interface SavedFunction {
    id: number;
    name: string;
    function_body: string;
    connection_id: number;
}

// Moved from MainInterface
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
