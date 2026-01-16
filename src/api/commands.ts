/**
 * Tauri Backend Command Bindings
 * 
 * This module provides TypeScript wrappers for all Rust backend commands.
 * Commands are organized by feature area for maintainability.
 */

import { invoke } from '@tauri-apps/api/core';
import {
    Connection,
    Tag,
    TableTag,
    QueryResult,
    ColumnSchema,
    SavedQuery,
    SavedFunction,
    RowIdentifier,
    CellUpdate,
    BatchChange
} from '../types/index';

// ============================================================================
// Connection Management
// ============================================================================

export const listConnections = () =>
    invoke<Connection[]>('list_connections');

export const verifyConnection = (connectionString: string, credentialId?: string) =>
    invoke<void>('verify_connection', { connectionString, credentialId });

export const saveConnection = (name: string, connectionString: string) =>
    invoke<number>('save_connection', { name, connectionString });

export const updateConnection = (id: number, name: string, connectionString: string) =>
    invoke<void>('update_connection', { id, name, connectionString });

export const deleteConnection = (id: number) =>
    invoke<void>('delete_connection', { id });

export const openConnectionWindow = (connectionId: number, username?: string, password?: string) =>
    invoke<void>('open_connection_window', { connectionId, username, password });

// ============================================================================
// Session Management
// ============================================================================

export const createSession = (connectionId: number, databaseName?: string) =>
    invoke<string>('create_session', { connectionId, databaseName });

// ============================================================================
// Schema & Data Operations
// ============================================================================

export interface FilterConditionAPI {
    id: string;
    enabled: boolean;
    column: string;
    operator: string;
    value: string;
}

export interface SortStateAPI {
    column: string;
    direction: string;
}

export interface TableDataResponse {
    data: QueryResult;
    total_count: number;
}

export const getTables = (connectionString: string) =>
    invoke<string[]>('get_tables', { connectionString });

export const getTableData = (
    connectionString: string,
    tableName: string,
    page: number,
    pageSize: number,
    filters: FilterConditionAPI[],
    sort?: SortStateAPI | null
) => invoke<TableDataResponse>('get_table_data', {
    connectionString,
    tableName,
    page,
    pageSize,
    filters,
    sort: sort || null
});

export const getColumns = (connectionString: string, tableName: string) =>
    invoke<string[]>('get_columns', { connectionString, tableName });

export const getTableSchema = (connectionString: string, tableName: string) =>
    invoke<ColumnSchema[]>('get_table_schema', { connectionString, tableName });

export const executeQuery = (connectionString: string, query: string) =>
    invoke<QueryResult[]>('execute_query', { connectionString, query });

export const truncateTable = (connectionString: string, tableName: string) =>
    invoke<void>('truncate_table', { connectionString, tableName });

export const dropTable = (connectionString: string, tableName: string) =>
    invoke<void>('drop_table', { connectionString, tableName });

export const duplicateTable = (params: {
    connectionString: string,
    sourceTable: string,
    newTable: string,
    includeData: boolean
}) => invoke<void>('duplicate_table', params);

// ============================================================================
// CRUD Operations
// ============================================================================

export const updateRecord = (
    connectionString: string,
    tableName: string,
    identifier: RowIdentifier,
    updates: CellUpdate[]
) => invoke<number>('update_record', { connectionString, tableName, identifier, updates });

export const deleteRecord = (
    connectionString: string,
    tableName: string,
    identifier: RowIdentifier
) => invoke<number>('delete_record', { connectionString, tableName, identifier });

export const insertRecord = (
    connectionString: string,
    tableName: string,
    values: Record<string, string | null>
) => invoke<number>('insert_record', { connectionString, tableName, values });

export const applyBatchChanges = (
    connectionString: string,
    changes: BatchChange[]
) => invoke<number>('apply_batch_changes', { connectionString, changes });

// ============================================================================
// Saved Queries
// ============================================================================

export const listQueries = (connectionId: number, databaseName?: string) =>
    invoke<SavedQuery[]>('list_queries', { connectionId, databaseName });

export const saveQuery = (name: string, query: string, connectionId: number, databaseName?: string) =>
    invoke<number>('save_query', { name, query, connectionId, databaseName });

export const updateQuery = (id: number, name: string, query: string) =>
    invoke<void>('update_query', { id, name, query });

export const deleteQuery = (id: number) =>
    invoke<void>('delete_query', { id });

// ============================================================================
// Saved Functions
// ============================================================================

export const listFunctions = (connectionId: number, databaseName?: string) =>
    invoke<SavedFunction[]>('list_functions', { connectionId, databaseName });

export const saveFunction = (name: string, functionBody: string, connectionId: number, databaseName?: string) =>
    invoke<number>('save_function', { name, functionBody, connectionId, databaseName });

export const updateFunction = (id: number, name: string, functionBody: string) =>
    invoke<void>('update_function', { id, name, functionBody });

export const deleteFunction = (id: number) =>
    invoke<void>('delete_function', { id });

// ============================================================================
// Tags
// ============================================================================

export const getTags = (connectionId?: number, databaseName?: string) =>
    invoke<Tag[]>('get_tags', { connectionId, databaseName });

export const createTag = (name: string, color: string, connectionId?: number, databaseName?: string) =>
    invoke<number>('create_tag', { name, color, connectionId, databaseName });

export const updateTag = (id: number, name: string, color: string) =>
    invoke<void>('update_tag', { id, name, color });

export const deleteTag = (id: number) =>
    invoke<void>('delete_tag', { id });

export const assignTag = (connectionId: number, tableName: string, tagId: number) =>
    invoke<void>('assign_tag', { connectionId, tableName, tagId });

export const removeTagFromTable = (connectionId: number, tableName: string, tagId: number) =>
    invoke<void>('remove_tag_from_table', { connectionId, tableName, tagId });

export const getTableTags = (connectionId: number, databaseName: string) =>
    invoke<TableTag[]>('get_table_tags', { connectionId, databaseName });

// ============================================================================
// Window Management
// ============================================================================

export const openLoadingWindow = () =>
    invoke<void>('open_loading_window');

export const closeLoadingWindow = () =>
    invoke<void>('close_loading_window');

// ============================================================================
// Table Filters (Persistence)
// ============================================================================

export const saveTableFilters = (
    connectionId: number,
    databaseName: string,
    tableName: string,
    filters: FilterConditionAPI[]
) => invoke<void>('save_table_filters', { connectionId, databaseName, tableName, filters });

export const getTableFilters = (connectionId: number, databaseName: string, tableName: string) =>
    invoke<FilterConditionAPI[]>('get_table_filters', { connectionId, databaseName, tableName });

export const deleteTableFilters = (connectionId: number, databaseName: string, tableName: string) =>
    invoke<void>('delete_table_filters', { connectionId, databaseName, tableName });
