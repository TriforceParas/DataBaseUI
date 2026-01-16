/**
 * Database Registry Hook
 * 
 * Manages database metadata including tables, tags, and connections.
 * Automatically refreshes data when the active connection changes.
 */

import { useState, useEffect, useCallback } from 'react';
import { Connection, Tag, TableTag } from '../types/index';
import * as api from '../api';

interface UseDatabaseRegistryReturn {
    tables: string[];
    savedConnections: Connection[];
    tags: Tag[];
    tableTags: TableTag[];
    refreshTrigger: number;
    fetchTables: () => Promise<void>;
    fetchConnections: () => Promise<void>;
    loadTags: () => Promise<void>;
}

export const useDatabaseRegistry = (connection: Connection): UseDatabaseRegistryReturn => {
    const [tables, setTables] = useState<string[]>([]);
    const [savedConnections, setSavedConnections] = useState<Connection[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);
    const [tableTags, setTableTags] = useState<TableTag[]>([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const fetchTables = useCallback(async () => {
        setRefreshTrigger(prev => prev + 1);
        try {
            const { getConnectionString } = await import('../utils/connectionHelper');
            const connectionString = await getConnectionString(connection.id, connection.database_name);
            const fetchedTables = await api.getTables(connectionString);
            setTables(fetchedTables);
        } catch (e) {
            console.error("Failed to fetch tables:", e);
        }
    }, [connection.id, connection.database_name]);

    const fetchConnections = useCallback(async () => {
        try {
            const conns = await api.listConnections();
            setSavedConnections(conns);
        } catch (e) {
            console.error("Failed to fetch connections:", e);
        }
    }, []);

    const loadTags = useCallback(async () => {
        try {
            const dbName = connection.db_type === 'sqlite'
                ? connection.host
                : (connection.database_name || '');

            const [fetchedTags, fetchedTableTags] = await Promise.all([
                api.getTags(connection.id, dbName),
                api.getTableTags(connection.id, dbName)
            ]);

            setTags(fetchedTags);
            setTableTags(fetchedTableTags);
        } catch (e) {
            console.error("Failed to load tags:", e);
        }
    }, [connection.id, connection.db_type, connection.host, connection.database_name]);

    useEffect(() => {
        fetchTables();
        fetchConnections();
        loadTags();
    }, [connection.id, connection.database_name, fetchTables, fetchConnections, loadTags]);

    return {
        tables,
        savedConnections,
        tags,
        tableTags,
        refreshTrigger,
        fetchTables,
        fetchConnections,
        loadTags
    };
};
