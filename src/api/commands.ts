import { invoke } from '@tauri-apps/api/core';
import {
    Connection,
    Tag,
    TableTag,
    QueryResult,
    ColumnSchema,
    SavedQuery,
    SavedFunction
} from '../types/index';

/**
 * DATABASE CONNECTIONS
 */

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

export const openConnectionWindow = (connectionId: number) =>
    invoke<void>('open_connection_window', { connectionId });

/**
 * SCHEMA & DATA
 */

export const getTables = (connectionString: string) =>
    invoke<string[]>('get_tables', { connectionString });

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

/**
 * SAVED QUERIES
 */

export const listQueries = (connectionId: number) =>
    invoke<SavedQuery[]>('list_queries', { connectionId });

export const saveQuery = (name: string, query: string, connectionId: number) =>
    invoke<number>('save_query', { name, query, connectionId });

export const updateQuery = (id: number, name: string, query: string) =>
    invoke<void>('update_query', { id, name, query });

export const deleteQuery = (id: number) =>
    invoke<void>('delete_query', { id });

/**
 * SAVED FUNCTIONS
 */

export const listFunctions = (connectionId: number) =>
    invoke<SavedFunction[]>('list_functions', { connectionId });

export const saveFunction = (name: string, functionBody: string, connectionId: number) =>
    invoke<number>('save_function', { name, functionBody, connectionId });

export const updateFunction = (id: number, name: string, functionBody: string) =>
    invoke<void>('update_function', { id, name, functionBody });

export const deleteFunction = (id: number) =>
    invoke<void>('delete_function', { id });

/**
 * TAGS
 */

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

/**
 * WINDOW MANAGEMENT
 */

export const openLoadingWindow = () =>
    invoke<void>('open_loading_window');

export const closeLoadingWindow = () =>
    invoke<void>('close_loading_window');
