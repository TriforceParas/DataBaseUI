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
            const fetchedTables = await api.getTables(connection.connection_string);
            setTables(fetchedTables);
        } catch (e) {
            console.error("Failed to fetch tables:", e);
        }
    }, [connection.connection_string]);

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
            // Extract DB name from connection string if possible, or use empty string/default
            let dbName = '';
            try {
                const url = new URL(connection.connection_string);
                if (url.protocol.includes('sqlite')) dbName = connection.connection_string;
                else dbName = url.pathname.replace('/', '');
            } catch {
                const parts = connection.connection_string.split('/');
                dbName = parts.length > 0 ? parts[parts.length - 1] : '';
            }

            const t = await api.getTags(connection.id, dbName);
            setTags(t);


            const tt = await api.getTableTags(connection.id, dbName);
            setTableTags(tt);
        } catch (e) { console.error(e); }
    }, [connection.id, connection.connection_string]);

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
