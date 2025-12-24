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
    type_name: string;
    is_nullable: boolean;
    is_primary_key: boolean;
    is_auto_increment: boolean;
    is_unique: boolean;
    default_value: string | null;
}
