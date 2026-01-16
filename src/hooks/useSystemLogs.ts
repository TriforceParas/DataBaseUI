/**
 * System Logs Hook
 * 
 * Manages the query execution log displayed in the UI.
 */

import { useState } from 'react';
import { LogEntry } from '../types/index';

export const useSystemLogs = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);

    const addLog = (
        query: string,
        status: 'Success' | 'Error',
        table?: string,
        error?: string,
        rows?: number,
        user: string = 'System'
    ) => {
        const newLog: LogEntry = {
            id: crypto.randomUUID(),
            time: new Date().toLocaleTimeString(),
            status,
            table,
            query,
            error,
            rows,
            user
        };
        setLogs(prev => [newLog, ...prev]);
    };

    const clearLogs = () => setLogs([]);

    return { logs, addLog, clearLogs };
};
