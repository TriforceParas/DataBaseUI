
import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Connection } from '../types/index';
import * as api from '../api';

interface UseTableOperationsProps {
    connection: Connection;
    onRefreshTables: () => void;
    onTableDropped: (tableName: string) => void;
    addLog: (query: string, status: 'Success' | 'Error', table?: string, error?: string, rows?: number, user?: string) => void;
}

export const useTableOperations = ({ connection, onRefreshTables, onTableDropped, addLog }: UseTableOperationsProps) => {
    // Table Operation Confirmation Modal State
    const [tableConfirmModal, setTableConfirmModal] = useState<{
        type: 'truncate' | 'drop';
        tableName: string;
    } | null>(null);

    // Duplicate Table Modal State
    const [duplicateTableModal, setDuplicateTableModal] = useState<string | null>(null);

    const getConnectionString = useCallback(async (): Promise<string> => {
        return await invoke<string>('get_connection_string', { connectionId: connection.id });
    }, [connection.id]);

    // Duplicate Table - Show modal
    const handleDuplicateTable = (tableName: string) => {
        setDuplicateTableModal(tableName);
    };

    // Confirm Duplicate Table
    const confirmDuplicateTable = async (newName: string, includeData: boolean) => {
        if (!duplicateTableModal) return;

        try {
            const connectionString = await getConnectionString();
            await api.duplicateTable({
                connectionString,
                sourceTable: duplicateTableModal,
                newTable: newName,
                includeData
            });
            onRefreshTables();
            addLog(`CREATE TABLE ${newName} LIKE ${duplicateTableModal}`, 'Success', newName, undefined, 0, 'System');
        } catch (e) {
            console.error('Failed to duplicate table:', e);
            alert(`Failed to duplicate table: ${e}`);
            addLog(`CREATE TABLE ${newName} LIKE ${duplicateTableModal}`, 'Error', duplicateTableModal, String(e), 0, 'System');
        }
        setDuplicateTableModal(null);
    };

    // Truncate Table - Show confirmation modal
    const handleTruncateTable = (tableName: string) => {
        setTableConfirmModal({ type: 'truncate', tableName });
    };

    // Drop Table - Show confirmation modal
    const handleDropTable = (tableName: string) => {
        setTableConfirmModal({ type: 'drop', tableName });
    };

    // Confirm table operation
    const confirmTableOperation = async () => {
        if (!tableConfirmModal) return;

        try {
            const connectionString = await getConnectionString();
            if (tableConfirmModal.type === 'truncate') {
                await api.truncateTable(connectionString, tableConfirmModal.tableName);
                onRefreshTables();
                addLog(`TRUNCATE TABLE ${tableConfirmModal.tableName}`, 'Success', tableConfirmModal.tableName, undefined, 0, 'System');
            } else if (tableConfirmModal.type === 'drop') {
                await api.dropTable(connectionString, tableConfirmModal.tableName);
                // Close any tabs for this table
                onTableDropped(tableConfirmModal.tableName);
                onRefreshTables();
                addLog(`DROP TABLE ${tableConfirmModal.tableName}`, 'Success', tableConfirmModal.tableName, undefined, 0, 'System');
            }
        } catch (e) {
            console.error(`Failed to ${tableConfirmModal.type} table:`, e);
            alert(`Failed to ${tableConfirmModal.type} table: ${e}`);
            addLog(`${tableConfirmModal.type.toUpperCase()} TABLE ${tableConfirmModal.tableName}`, 'Error', tableConfirmModal.tableName, String(e), 0, 'System');
        }
        setTableConfirmModal(null);
    };

    return {
        tableConfirmModal,
        setTableConfirmModal,
        duplicateTableModal,
        setDuplicateTableModal,
        handleDuplicateTable,
        confirmDuplicateTable,
        handleTruncateTable,
        handleDropTable,
        confirmTableOperation
    };
};
