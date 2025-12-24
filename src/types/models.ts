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

export interface ColumnSchema {
    name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
    column_key: string;
}
