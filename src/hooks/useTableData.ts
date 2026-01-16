/**
 * Table Data Hook
 * 
 * Manages table data fetching, pagination, sorting, filtering, and query execution.
 * Handles connection string/session resolution and schema caching.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Connection, SortState, TabResult, ColumnSchema } from '../types/index';
import { FilterCondition } from '../components/modals/FilterModal';
import * as api from '../api';

interface UseTableDataProps {
    connection: Connection;
    sessionId?: string | null;
    addLog: (query: string, status: 'Success' | 'Error', table?: string, error?: string, rows?: number, user?: string) => void;
    tableSchemas: Record<string, ColumnSchema[]>;
    setTableSchemas: React.Dispatch<React.SetStateAction<Record<string, ColumnSchema[]>>>;
}

export const useTableData = ({ connection, sessionId, addLog, tableSchemas, setTableSchemas }: UseTableDataProps) => {
    const [results, setResults] = useState<Record<string, TabResult>>({});
    const [paginationMap, setPaginationMap] = useState<Record<string, { page: number, pageSize: number, total: number }>>({});
    const [sortState, setSortState] = useState<SortState | null>(null);
    const [filtersMap, setFiltersMap] = useState<Record<string, FilterCondition[]>>({});

    const connectionStringRef = useRef<string | null>(null);

    const getConnectionString = useCallback(async (): Promise<string> => {
        if (sessionId) return sessionId;
        if (connectionStringRef.current) return connectionStringRef.current;
        const { getConnectionString: getConn } = await import('../utils/connectionHelper');
        const connStr = await getConn(connection.id, connection.database_name);
        connectionStringRef.current = connStr;
        return connStr;
    }, [connection.id, connection.database_name, sessionId]);

    useEffect(() => {
        connectionStringRef.current = null;
    }, [connection.id, connection.database_name]);

    const resetConnectionCache = useCallback(() => {
        connectionStringRef.current = null;
    }, []);

    const initTabResult = (tabId: string) => {
        setResults(prev => ({ ...prev, [tabId]: { ...prev[tabId], loading: true, error: null, data: prev[tabId]?.data || null } }));
    };

    const updateTabResult = (tabId: string, data: Partial<TabResult>) => {
        setResults(prev => ({ ...prev, [tabId]: { ...prev[tabId], ...data } }));
    };

    const fetchTableData = useCallback(async (tabId: string, tableName: string, pageOverride?: number, pageSizeOverride?: number, filtersOverride?: FilterCondition[]) => {
        if (tableName.startsWith('Schema: ')) return;

        initTabResult(tabId);

        const currentPag = paginationMap[tabId] || { page: 1, pageSize: 20, total: 0 };
        const page = pageOverride !== undefined ? pageOverride : currentPag.page;
        const pageSize = pageSizeOverride !== undefined ? pageSizeOverride : currentPag.pageSize;

        try {
            const connectionString = await getConnectionString();

            if (!tableSchemas[tableName]) {
                api.getTableSchema(connectionString, tableName)
                    .then(schema => {
                        setTableSchemas(prev => ({ ...prev, [tableName]: schema }));
                    }).catch(err => console.error("Failed to background fetch schema:", err));
            }

            const currentFilters = filtersOverride !== undefined ? filtersOverride : (filtersMap[tabId] || []);

            const response = await api.getTableData(
                connectionString,
                tableName,
                page,
                pageSize,
                currentFilters,
                sortState ? { column: sortState.column, direction: sortState.direction } : null
            );

            let lastRes = response.data;

            if ((!lastRes || !lastRes.columns || lastRes.columns.length === 0) && tableSchemas[tableName]) {
                if (!lastRes) {
                    lastRes = { columns: [], rows: [] };
                }
                if (!lastRes.columns || lastRes.columns.length === 0) {
                    lastRes.columns = tableSchemas[tableName].map(c => c.name);
                }
            }

            updateTabResult(tabId, { data: lastRes, allData: [lastRes], loading: false, error: null });
            setPaginationMap(prev => ({ ...prev, [tabId]: { page, pageSize, total: response.total_count } }));

            addLog(`SELECT * FROM ${tableName}`, 'Success', tableName, undefined, lastRes ? lastRes.rows.length : 0, 'System');

        } catch (e) {
            console.error("Failed to fetch table data:", e);
            updateTabResult(tabId, { loading: false, error: String(e) });
            addLog(`SELECT * FROM ${tableName}`, 'Error', tableName, String(e), 0, 'System');
        }
    }, [connection.id, paginationMap, sortState, addLog, tableSchemas, setTableSchemas, getConnectionString, filtersMap]);

    const handleRunQuery = useCallback(async (tabId: string, query: string) => {
        if (!query.trim()) return;
        initTabResult(tabId);

        try {
            const connectionString = await getConnectionString();
            const res = await api.executeQuery(connectionString, query);
            const lastRes = res.length > 0 ? res[res.length - 1] : null;

            updateTabResult(tabId, { data: lastRes, allData: res, loading: false, error: null });
            addLog(query, 'Success', undefined, undefined, lastRes ? lastRes.rows.length : 0, 'User');
        } catch (e) {
            updateTabResult(tabId, { loading: false, error: String(e) });
            addLog(query, 'Error', undefined, String(e), 0, 'User');
        }
    }, [addLog, getConnectionString]);

    const handleSort = useCallback((column: string) => {
        setSortState(prev => ({
            column,
            direction: prev?.column === column && prev.direction === 'ASC' ? 'DESC' : 'ASC'
        }));
    }, []);

    const updateFilters = useCallback(async (tabId: string, tableName: string, filters: FilterCondition[]) => {
        setFiltersMap(prev => ({ ...prev, [tabId]: filters }));

        const databaseName = connection.database_name || connection.name || '';
        try {
            if (filters.length > 0) {
                await api.saveTableFilters(connection.id, databaseName, tableName, filters);
            } else {
                await api.deleteTableFilters(connection.id, databaseName, tableName);
            }
        } catch (e) {
            console.error('Failed to persist filters:', e);
        }
    }, [connection.id, connection.database_name, connection.name]);

    const loadFilters = useCallback(async (tabId: string, tableName: string) => {
        const databaseName = connection.database_name || connection.name || '';
        try {
            const filters = await api.getTableFilters(connection.id, databaseName, tableName);
            if (filters && filters.length > 0) {
                const mappedFilters: FilterCondition[] = filters.map(f => ({
                    id: f.id,
                    enabled: f.enabled,
                    column: f.column,
                    operator: f.operator as any,
                    value: f.value
                }));
                setFiltersMap(prev => ({ ...prev, [tabId]: mappedFilters }));
                return mappedFilters;
            }
        } catch (e) {
            console.error('Failed to load filters:', e);
        }
        return [];
    }, [connection.id, connection.database_name, connection.name]);

    return {
        results,
        setResults,
        paginationMap,
        setPaginationMap,
        sortState,
        setSortState,
        handleSort,
        fetchTableData,
        handleRunQuery,
        resetConnectionCache,
        filtersMap,
        setFiltersMap,
        updateFilters,
        loadFilters
    };
};
