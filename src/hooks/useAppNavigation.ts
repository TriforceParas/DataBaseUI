import { useCallback } from 'react';
import { Connection, Tab, PendingChange, QueryResult } from '../types/index';

interface UseAppNavigationProps {
    tabs: Tab[];
    setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
    setActiveTabId: (id: string) => void;
    results: Record<string, { data: QueryResult | null; loading: boolean; error: string | null }>;
    setResults: React.Dispatch<React.SetStateAction<Record<string, { data: QueryResult | null; loading: boolean; error: string | null }>>>;
    pendingChanges: Record<string, PendingChange[]>;
    setHighlightRowIndex: React.Dispatch<React.SetStateAction<number | null>>;
    onSwitchConnection: (conn: Connection) => void;
}

interface UseAppNavigationReturn {
    handleTableClick: (tableName: string) => void;
    pinTab: (tabId: string) => void;
    handleOpenLogs: () => void;
    handleSwitchConnectionWrapper: (conn: Connection) => void;
    handleNavigateToChangeWrapper: (tabId: string, rowIndex: number) => void;
}

export const useAppNavigation = ({
    tabs,
    setTabs,
    setActiveTabId,
    results,
    setResults,
    pendingChanges,
    setHighlightRowIndex,
    onSwitchConnection
}: UseAppNavigationProps): UseAppNavigationReturn => {

    // Single click opens table in preview mode
    const handleTableClick = useCallback((tableName: string) => {
        // Check if already exists as a pinned tab
        const existingPinned = tabs.find(t => t.title === tableName && t.type === 'table' && !t.isPreview);
        if (existingPinned) {
            setActiveTabId(existingPinned.id);
            return;
        }

        // Check if this table is already the preview tab
        const existingPreview = tabs.find(t => t.title === tableName && t.type === 'table' && t.isPreview);
        if (existingPreview) {
            setActiveTabId(existingPreview.id);
            return;
        }

        // Find any existing preview tab (to replace it)
        const previewTab = tabs.find(t => t.isPreview);

        if (previewTab) {
            // Replace the preview tab with the new table
            setTabs(tabs.map(t =>
                t.id === previewTab.id
                    ? { ...t, id: `table-${tableName}`, title: tableName, isPreview: true }
                    : t
            ));
            // Clear results for old preview tab
            const newResults = { ...results };
            delete newResults[previewTab.id];
            setResults(newResults);
            setActiveTabId(`table-${tableName}`);
        } else {
            // Create new preview tab
            const newTabId = `table-${tableName}`;
            setTabs([...tabs, { id: newTabId, type: 'table', title: tableName, isPreview: true }]);
            setActiveTabId(newTabId);
        }
    }, [tabs, setTabs, setActiveTabId, results, setResults]);

    // Pin tab (remove preview mode) - called on double-click
    const pinTab = useCallback((tabId: string) => {
        setTabs(tabs.map(t =>
            t.id === tabId ? { ...t, isPreview: false } : t
        ));
    }, [tabs, setTabs]);

    // Open logs tab
    const handleOpenLogs = useCallback(() => {
        const existingLogTab = tabs.find(t => t.type === 'logs');
        if (existingLogTab) {
            setActiveTabId(existingLogTab.id);
        } else {
            const newTabId = `logs-${Date.now()}`;
            setTabs([...tabs, { id: newTabId, type: 'logs', title: 'Logs' }]);
            setActiveTabId(newTabId);
        }
    }, [tabs, setTabs, setActiveTabId]);

    // Wrapper for switching connections with unsaved changes check
    const handleSwitchConnectionWrapper = useCallback((conn: Connection) => {
        const hasChanges = Object.values(pendingChanges).some(list => list.length > 0);
        if (hasChanges) {
            if (!confirm('You have unsaved changes that will be lost. Continue switching connection?')) {
                return;
            }
        }
        onSwitchConnection(conn);
    }, [pendingChanges, onSwitchConnection]);

    // Navigate to a change in the changelog
    const handleNavigateToChangeWrapper = useCallback((tabId: string, rowIndex: number) => {
        const existingTab = tabs.find(t => t.id === tabId);
        if (existingTab) {
            setActiveTabId(tabId);
        } else {
            const changes = pendingChanges[tabId];
            if (changes && changes.length > 0) {
                const tableName = changes[0].tableName;
                if (tableName) handleTableClick(tableName);
            }
        }
        setHighlightRowIndex(rowIndex);
        setTimeout(() => setHighlightRowIndex(null), 2000);
    }, [tabs, pendingChanges, setActiveTabId, setHighlightRowIndex, handleTableClick]);

    return {
        handleTableClick,
        pinTab,
        handleOpenLogs,
        handleSwitchConnectionWrapper,
        handleNavigateToChangeWrapper
    };
};
