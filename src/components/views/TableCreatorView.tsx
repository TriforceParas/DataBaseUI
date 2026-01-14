import React from 'react';
import { TableCreator, TableCreatorState } from '../editors';
import { PendingChange, Connection } from '../../types/index';

interface TableCreatorViewProps {
    activeTabId: string;
    activeTabTitle: string;
    connection: Connection;
    tableCreatorStates: Record<string, TableCreatorState>;
    originalSchemas: Record<string, any>;
    setTableCreatorStates: React.Dispatch<React.SetStateAction<Record<string, TableCreatorState>>>;
    onSuccess: () => void;
    setPendingChanges: React.Dispatch<React.SetStateAction<Record<string, PendingChange[]>>>;
    setShowChangelog: (show: boolean) => void;
}

export const TableCreatorView: React.FC<TableCreatorViewProps> = ({
    activeTabId,
    activeTabTitle,
    connection,
    tableCreatorStates,
    originalSchemas,
    setTableCreatorStates,
    onSuccess,
    setPendingChanges,
    setShowChangelog
}) => {
    return (
        <TableCreator
            key={activeTabId}
            connection={connection}
            onSuccess={onSuccess}
            mode={activeTabTitle.startsWith('Edit:') ? 'edit' : 'create'}
            initialState={tableCreatorStates[activeTabId]}
            onStateChange={(state) => setTableCreatorStates(prev => ({ ...prev, [activeTabId]: state }))}
            originalColumns={originalSchemas[activeTabId]?.columns}
            tabId={activeTabId}
            onSchemaChange={(changes) => {
                setPendingChanges(prev => {
                    const existing = prev[activeTabId] || [];
                    const nonSchemaChanges = existing.filter(c =>
                        c.type !== 'ADD_COLUMN' && c.type !== 'DROP_COLUMN'
                    );
                    return {
                        ...prev,
                        [activeTabId]: [...nonSchemaChanges, ...changes]
                    };
                });
                setShowChangelog(true);
            }}
        />
    );
};
