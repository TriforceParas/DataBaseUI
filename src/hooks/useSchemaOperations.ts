import { useCallback } from 'react';
import * as api from '../api';
import { Connection, QueryResult, TabItem, TableDataState, ColumnSchema } from '../types/index';
import { TableCreatorState } from '../components/editors/TableCreator';

interface UseSchemaOperationsProps {
    connection: Connection;
    tabs: TabItem[];
    setTabs: (tabs: TabItem[]) => void;
    setActiveTabId: (id: string) => void;
    setResults: React.Dispatch<React.SetStateAction<Record<string, TableDataState>>>;
    setTableCreatorStates: React.Dispatch<React.SetStateAction<Record<string, TableCreatorState>>>;
    setOriginalSchemas: React.Dispatch<React.SetStateAction<Record<string, TableCreatorState>>>;
    addLog: (query: string, status: 'Success' | 'Error', table?: string, error?: string, rows?: number, user?: string) => void;
}

export const useSchemaOperations = ({
    connection,
    tabs,
    setTabs,
    setActiveTabId,
    setResults,
    setTableCreatorStates,
    setOriginalSchemas,
    addLog
}: UseSchemaOperationsProps) => {

    const handleGetTableSchema = useCallback(async (tableName: string) => {
        try {
            const schema = await api.getTableSchema(connection.connection_string, tableName);

            // Convert schema to QueryResult format for display in DataGrid
            const schemaResult: QueryResult = {
                columns: ['Column', 'Type', 'Nullable', 'Default', 'Key'],
                rows: schema.map((col: ColumnSchema) => [
                    col.name,
                    col.data_type,
                    col.is_nullable,
                    col.column_default || 'NULL',
                    col.column_key
                ])
            };

            // Create a schema tab
            const tabId = `schema-${tableName}`;
            const existingTab = tabs.find(t => t.id === tabId);
            if (!existingTab) {
                setTabs([...tabs, { id: tabId, type: 'table', title: `Schema: ${tableName}` }]);
            }
            setActiveTabId(tabId);
            setResults(prev => ({
                ...prev,
                [tabId]: { data: schemaResult, loading: false, error: null }
            }));
            addLog(`SHOW COLUMNS FROM ${tableName}`, 'Success', tableName, undefined, 0, 'System');
        } catch (e) {
            console.error('Failed to get table schema:', e);
            addLog(`SHOW COLUMNS FROM ${tableName}`, 'Error', tableName, String(e), 0, 'System');
        }
    }, [connection, tabs, setTabs, setActiveTabId, setResults, addLog]);

    const handleEditTableSchema = useCallback(async (tableName: string) => {
        try {
            // Fetch existing schema
            const schema = await api.getTableSchema(connection.connection_string, tableName);

            // Convert ColumnSchema to ColumnDef format
            const columns = schema.map((col: ColumnSchema) => ({
                name: col.name,
                type: col.data_type.toUpperCase().replace(/\(.*\)/, ''), // Strip length from type
                length: col.data_type.match(/\((\d+)\)/)?.[1] || '', // Extract length if exists
                defaultValue: col.column_default || '',
                isNullable: col.is_nullable.toLowerCase() === 'yes' || col.is_nullable === '1',
                isPrimaryKey: col.column_key === 'PRI' || col.column_key.toLowerCase().includes('pk'),
                isAutoIncrement: (col.column_default || '').toLowerCase().includes('auto_increment') ||
                    col.data_type.toLowerCase().includes('serial'),
                isUnique: col.column_key === 'UNI' || col.column_key.toLowerCase().includes('unique')
            }));

            const tabId = `edit-table-${Date.now()}`;
            const initialState: TableCreatorState = {
                tableName,
                columns,
                foreignKeys: []
            };

            // Store both current and original state
            setTableCreatorStates(prev => ({ ...prev, [tabId]: initialState }));
            setOriginalSchemas(prev => ({ ...prev, [tabId]: JSON.parse(JSON.stringify(initialState)) }));

            setTabs([...tabs, { id: tabId, type: 'create-table', title: `Edit: ${tableName}` }]);
            setActiveTabId(tabId);
        } catch (e) {
            console.error('Failed to fetch table schema:', e);
            alert(`Failed to fetch table schema: ${e}`);
        }
    }, [connection, tabs, setTabs, setActiveTabId, setTableCreatorStates, setOriginalSchemas]);

    return {
        handleGetTableSchema,
        handleEditTableSchema
    };
};
