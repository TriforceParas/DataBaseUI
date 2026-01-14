import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
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
            const connectionString = await invoke<string>('get_connection_string', {
                connectionId: connection.id,
                databaseName: connection.database_name
            });
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
            console.error("Failed to fetch connections", e);
        }
    }, []);

    const loadTags = useCallback(async () => {
        try {
            // Get DB name from connection model
            let dbName = '';
            if (connection.db_type === 'sqlite') {
                dbName = connection.host;
            } else {
                dbName = connection.database_name || '';
            }

            const t = await api.getTags(connection.id, dbName);
            setTags(t);


            const tt = await api.getTableTags(connection.id, dbName);
            setTableTags(tt);
        } catch (e) { console.error(e); }
    }, [connection.id, connection.db_type, connection.host, connection.database_name]);

    // Auto-load on connection change
    useEffect(() => {
        fetchTables();
        fetchConnections();
        loadTags();
    }, [connection, fetchTables, fetchConnections, loadTags]);

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
