import { useState, useCallback } from 'react';
import { Connection, SortState, TabResult, ColumnSchema } from '../types/index';
import * as api from '../api';

interface UseTableDataProps {
    connection: Connection;
    addLog: (query: string, status: 'Success' | 'Error', table?: string, error?: string, rows?: number, user?: string) => void;
    tableSchemas: Record<string, ColumnSchema[]>;
    setTableSchemas: React.Dispatch<React.SetStateAction<Record<string, ColumnSchema[]>>>;
}

export const useTableData = ({ connection, addLog, tableSchemas, setTableSchemas }: UseTableDataProps) => {
    const [results, setResults] = useState<Record<string, TabResult>>({});
    const [paginationMap, setPaginationMap] = useState<Record<string, { page: number, pageSize: number, total: number }>>({});
    const [sortState, setSortState] = useState<SortState | null>(null);

    // Initial Loading State Helper
    const initTabResult = (tabId: string) => {
        setResults(prev => ({ ...prev, [tabId]: { ...prev[tabId], loading: true, error: null, data: prev[tabId]?.data || null } }));
    };

    // Update Tab Result Helper
    const updateTabResult = (tabId: string, data: Partial<TabResult>) => {
        setResults(prev => ({ ...prev, [tabId]: { ...prev[tabId], ...data } }));
    };

    const fetchTableData = useCallback(async (tabId: string, tableName: string, pageOverride?: number, pageSizeOverride?: number) => {
        if (tableName.startsWith('Schema: ')) return;

        initTabResult(tabId);

        const currentPag = paginationMap[tabId] || { page: 1, pageSize: 20, total: 0 };
        const page = pageOverride !== undefined ? pageOverride : currentPag.page;
        const pageSize = pageSizeOverride !== undefined ? pageSizeOverride : currentPag.pageSize;

        try {
            // Check if we need to fetch schema (for keys info)
            if (!tableSchemas[tableName]) {
                api.getTableSchema(connection.connection_string, tableName)
                    .then(schema => {
                        setTableSchemas(prev => ({ ...prev, [tableName]: schema }));
                    }).catch(err => console.error("Failed to background fetch schema for keys:", err));
            }

            const isMysql = connection.connection_string.startsWith('mysql:');
            const q = isMysql ? '`' : '"';
            const offset = (page - 1) * pageSize;

            let orderByClause = '';
            if (sortState) {
                orderByClause = `ORDER BY ${q}${sortState.column}${q} ${sortState.direction}`;
            } else {
                // Try to find a primary key or reasonable default? For now, empty.
                // Ideally backend handles default sort if needed.
            }

            // Construct Query
            const query = `SELECT * FROM ${q}${tableName}${q} ${orderByClause} LIMIT ${pageSize} OFFSET ${offset}`;
            const countQuery = `SELECT COUNT(*) as count FROM ${q}${tableName}${q}`;

            // Execute
            const res = await api.executeQuery(connection.connection_string, query);
            const lastRes = res.length > 0 ? res[res.length - 1] : null;

            // Get total count (separate call is standard for pagination)
            const countRes = await api.executeQuery(connection.connection_string, countQuery);
            const total = countRes.length > 0 && countRes[0].rows.length > 0 ? Number(countRes[0].rows[0][0]) : 0;

            updateTabResult(tabId, { data: lastRes, allData: res, loading: false, error: null });
            setPaginationMap(prev => ({ ...prev, [tabId]: { page, pageSize, total } }));

            addLog(query, 'Success', tableName, undefined, lastRes ? lastRes.rows.length : 0, 'System');

        } catch (e) {
            console.error("Failed to fetch table data:", e);
            updateTabResult(tabId, { loading: false, error: String(e) });
            addLog(`SELECT * FROM ${tableName}`, 'Error', tableName, String(e), 0, 'System');
        }
    }, [connection, paginationMap, sortState, addLog, tableSchemas, setTableSchemas]); // Dependencies

    const handleRunQuery = useCallback(async (tabId: string, query: string) => {
        if (!query.trim()) return;
        initTabResult(tabId);

        try {
            // Simple naive check for table name for logging - inherently imprecise for arbitrary queries
            // But 'User' queries don't strictly require table matching for the 'Table' column in logs
            // as much as System actions do.
            const res = await api.executeQuery(connection.connection_string, query);
            const lastRes = res.length > 0 ? res[res.length - 1] : null;

            updateTabResult(tabId, { data: lastRes, allData: res, loading: false, error: null });
            addLog(query, 'Success', undefined, undefined, lastRes ? lastRes.rows.length : 0, 'User');
        } catch (e) {
            updateTabResult(tabId, { loading: false, error: String(e) });
            addLog(query, 'Error', undefined, String(e), 0, 'User');
        }
    }, [connection, addLog]);


    const handleSort = useCallback((column: string) => {
        setSortState(prev => ({
            column,
            direction: prev?.column === column && prev.direction === 'ASC' ? 'DESC' : 'ASC'
        }));
    }, []);

    return {
        results,
        setResults,
        paginationMap,
        setPaginationMap,
        sortState,
        setSortState,
        handleSort,
        fetchTableData,
        handleRunQuery
    };
};
