import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Connection, Tag, TableTag, ColumnSchema } from '../types';

interface UseDatabaseRegistryReturn {
    tables: string[];
    savedConnections: Connection[];
    tableSchemas: Record<string, ColumnSchema[]>;
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
    const [tableSchemas, setTableSchemas] = useState<Record<string, ColumnSchema[]>>({});
    const [tags, setTags] = useState<Tag[]>([]);
    const [tableTags, setTableTags] = useState<TableTag[]>([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const fetchTables = useCallback(async () => {
        setRefreshTrigger(prev => prev + 1);
        try {
            const fetchedTables = await invoke<string[]>('get_tables', { connectionString: connection.connection_string });
            setTables(fetchedTables);
        } catch (e) {
            console.error("Failed to fetch tables:", e);
        }
    }, [connection.connection_string]);

    const fetchConnections = useCallback(async () => {
        try {
            const conns = await invoke<Connection[]>('list_connections');
            setSavedConnections(conns);
        } catch (e) {
            console.error("Failed to fetch connections", e);
        }
    }, []);

    const loadTags = useCallback(async () => {
        try {
            const t = await invoke<Tag[]>('get_tags');
            setTags(t);
            const tt = await invoke<TableTag[]>('get_table_tags', { connectionId: connection.id });
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
        tableSchemas,
        tags,
        tableTags,
        refreshTrigger,
        fetchTables,
        fetchConnections,
        loadTags
    };
};
