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
            const t = await api.getTags();
            setTags(t);
            const tt = await api.getTableTags(connection.id);
            setTableTags(tt);
        } catch (e) { console.error(e); }
    }, [connection.id]);

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
