import { useCallback } from 'react';
import { QueryResult, SystemLog, Tab } from '../types/index';
import { saveExportFile } from '../utils/screenshotHelper';
import { generateDataText } from '../utils/dataHandlers';

interface UsePersistenceActionsProps {
    activeTab: Tab | undefined;
    tabQueries: Record<string, string>;
    results: Record<string, { data: QueryResult | null }>;
    saveQuery: (name: string, query: string) => Promise<number | null>;
    updateQuery: (id: number, name: string, query: string) => Promise<void>;
    saveFunction: (name: string, body: string) => Promise<number | null>;
    updateFunction: (id: number, name: string, body: string) => Promise<void>;
    setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
    addToast: (title: string, message: string, filePath?: string, type?: 'info' | 'success' | 'error') => void;
    logs: SystemLog[];
    selectedIndices: Set<number>;
}

export const usePersistenceActions = ({
    activeTab,
    tabQueries,
    results,
    saveQuery,
    updateQuery,
    saveFunction,
    updateFunction,
    setTabs,
    addToast,
    logs,
    selectedIndices
}: UsePersistenceActionsProps) => {

    const handleSaveQuery = useCallback(async (name: string) => {
        if (!activeTab) return;
        const query = tabQueries[activeTab.id] || '';
        if (!query.trim()) return;
        try {
            const savedId = await saveQuery(name, query);
            if (savedId) {
                setTabs(prev => prev.map(t =>
                    t.id === activeTab.id ? { ...t, title: name, savedQueryId: savedId } : t
                ));
            }
        } catch (e) {
            // Error logged in hook
        }
    }, [activeTab, tabQueries, saveQuery, setTabs]);

    const handleUpdateQuery = useCallback(async () => {
        if (!activeTab?.savedQueryId) return;
        const query = tabQueries[activeTab.id] || '';
        if (!query.trim()) return;
        await updateQuery(activeTab.savedQueryId, activeTab.title, query);
    }, [activeTab, tabQueries, updateQuery]);

    const handleSaveFunction = useCallback(async (name: string) => {
        if (!activeTab) return;
        const functionBody = tabQueries[activeTab.id] || '';
        if (!functionBody.trim()) return;
        try {
            const savedId = await saveFunction(name, functionBody);
            if (savedId) {
                setTabs(prev => prev.map(t =>
                    t.id === activeTab.id ? { ...t, title: `ƒ ${name}`, savedFunctionId: savedId } : t
                ));
            }
        } catch (e) { }
    }, [activeTab, tabQueries, saveFunction, setTabs]);

    const handleUpdateFunction = useCallback(async () => {
        if (!activeTab?.savedFunctionId) return;
        const functionBody = tabQueries[activeTab.id] || '';
        if (!functionBody.trim()) return;
        const name = activeTab.title.replace(/^ƒ /, '');
        await updateFunction(activeTab.savedFunctionId, name, functionBody);
    }, [activeTab, tabQueries, updateFunction]);

    const handleCopy = useCallback(async (format: 'CSV' | 'JSON') => {
        let data: QueryResult | null = null;
        let indices: number[] = [];

        if (activeTab?.type === 'log') {
            data = {
                columns: ['Time', 'Status', 'Table', 'Query', 'Error', 'User', 'Rows'],
                rows: logs.map(l => [l.time, l.status, l.table || '-', l.query, l.error || '', l.user || '', l.rows ? String(l.rows) : '']),
                duration_ms: 0
            };
            indices = selectedIndices.size > 0 ? Array.from(selectedIndices) : logs.map((_, i) => i);
        } else if (activeTab && results[activeTab.id]?.data) {
            data = results[activeTab.id].data!;
            indices = Array.from(selectedIndices);
        }

        if (!data || indices.length === 0) return;
        const text = generateDataText(format, data, indices);
        try {
            await navigator.clipboard.writeText(text);
        } catch (e) {
            console.error(e);
        }
    }, [activeTab, results, logs, selectedIndices]);

    const handleExport = useCallback(async (format: 'CSV' | 'JSON') => {
        let data: QueryResult | null = null;
        let indices: number[] = [];

        if (activeTab?.type === 'log') {
            data = {
                columns: ['Time', 'Status', 'Table', 'Query', 'Error', 'User', 'Rows'],
                rows: logs.map(l => [l.time, l.status, l.table || '-', l.query, l.error || '', l.user || '', l.rows ? String(l.rows) : '']),
                duration_ms: 0
            };
            indices = selectedIndices.size > 0 ? Array.from(selectedIndices) : logs.map((_, i) => i);
        } else if (activeTab && results[activeTab.id]?.data) {
            data = results[activeTab.id].data!;
            indices = Array.from(selectedIndices);
        }

        if (!data || indices.length === 0) return;
        const text = generateDataText(format, data, indices);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const fileName = `${activeTab?.title || 'export'}_${timestamp}.${format.toLowerCase()}`;

        await saveExportFile(
            fileName,
            text,
            (filePath) => addToast('Export Saved', 'Click to open folder', filePath, 'success'),
            (err) => addToast('Export Failed', err, undefined, 'error')
        );
    }, [activeTab, results, logs, selectedIndices, addToast]);

    return {
        handleSaveQuery,
        handleUpdateQuery,
        handleSaveFunction,
        handleUpdateFunction,
        handleCopy,
        handleExport
    };
};
