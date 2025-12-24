import React from 'react';
import { PreferencesModal } from './PreferencesModal';
import { ConfirmModal } from './ConfirmModal';
import { DuplicateTableModal } from './DuplicateTableModal';
import { SaveQueryModal } from './SaveQueryModal';
import { NewConnectionModal } from './NewConnectionModal';
import { TableEditRowModal } from './TableEditRowModal';
import { TabResult, PendingChange } from '../../types/index';

interface ModalManagerProps {
    preferences: {
        isOpen: boolean;
        onClose: () => void;
        theme: string;
        setTheme: (t: string) => void;
        zoom: number;
        setZoom: React.Dispatch<React.SetStateAction<number>>;
        availableThemes: { id: string, name: string, type: string, colors: { bg: string, text: string, accent: string } }[];
    };
    newConnection: {
        isOpen: boolean;
        onClose: () => void;
        onSuccess: () => void;
    };
    tableConfirm: {
        modal: { type: 'truncate' | 'drop', tableName: string } | null;
        setModal: (val: { type: 'truncate' | 'drop', tableName: string } | null) => void;
        onConfirm: () => void;
    };
    duplicateTable: {
        tableName: string | null;
        setTableName: (val: string | null) => void;
        existingTables: string[];
        onConfirm: (newName: string, includeData: boolean) => void;
    };
    changelogConfirm: {
        modal: { type: 'confirm' | 'discard' } | null;
        setModal: (val: { type: 'confirm' | 'discard' } | null) => void;
        pendingChangesCount: number;
        onConfirm: () => void;
        onDiscard: () => void;
    };
    saveItem: {
        modal: { type: 'query' | 'function' } | null;
        setModal: (val: { type: 'query' | 'function' } | null) => void;
        onSaveQuery: (name: string) => void;
        onSaveFunction: (name: string) => void;
    };
    editRow: {
        isOpen: boolean;
        onClose: () => void;
        activeTabId: string;
        activeTabType?: string;
        activeTabTitle: string;
        results: Record<string, TabResult>;
        selectedIndices: Set<number>;
        setSelectedIndices: (indices: Set<number>) => void;
        pendingChanges: Record<string, PendingChange[]>;
        setPendingChanges: React.Dispatch<React.SetStateAction<Record<string, PendingChange[]>>>;
        panelColumns: string[];
        onInsert: (data: Record<string, any>[]) => void;
        onAddRow: () => void;
        onCellEdit: (rowIndex: number, column: string, value: any) => void;
    };
}

export const ModalManager: React.FC<ModalManagerProps> = ({
    preferences,
    newConnection,
    tableConfirm,
    duplicateTable,
    changelogConfirm,
    saveItem,
    editRow
}) => {
    return (
        <>
            <PreferencesModal
                isOpen={preferences.isOpen}
                onClose={preferences.onClose}
                theme={preferences.theme}
                setTheme={preferences.setTheme}
                zoom={preferences.zoom}
                setZoom={preferences.setZoom}
                availableThemes={preferences.availableThemes}
            />

            <NewConnectionModal
                isOpen={newConnection.isOpen}
                onClose={newConnection.onClose}
                onSuccess={newConnection.onSuccess}
            />

            {tableConfirm.modal && (
                <ConfirmModal
                    title={tableConfirm.modal.type === 'truncate' ? 'Truncate Table' : 'Drop Table'}
                    message={
                        tableConfirm.modal.type === 'truncate'
                            ? `Are you sure you want to TRUNCATE "${tableConfirm.modal.tableName}"? This will permanently delete ALL data in the table but keep the table structure.`
                            : `Are you sure you want to DROP "${tableConfirm.modal.tableName}"? This will permanently delete the table and ALL its data. This action cannot be undone.`
                    }
                    confirmText={tableConfirm.modal.type === 'truncate' ? 'Truncate' : 'Drop'}
                    onConfirm={tableConfirm.onConfirm}
                    onCancel={() => tableConfirm.setModal(null)}
                />
            )}

            {changelogConfirm.modal && (
                <ConfirmModal
                    title={changelogConfirm.modal.type === 'confirm' ? 'Confirm Changes' : 'Discard Changes'}
                    message={
                        changelogConfirm.modal.type === 'confirm'
                            ? `Are you sure you want to apply ${changelogConfirm.pendingChangesCount} pending changes?`
                            : `Are you sure you want to discard ALL ${changelogConfirm.pendingChangesCount} pending changes? This action cannot be undone.`
                    }
                    confirmText={changelogConfirm.modal.type === 'confirm' ? 'Apply' : 'Discard'}
                    onConfirm={changelogConfirm.modal.type === 'confirm' ? changelogConfirm.onConfirm : changelogConfirm.onDiscard}
                    onCancel={() => changelogConfirm.setModal(null)}
                />
            )}

            {duplicateTable.tableName && (
                <DuplicateTableModal
                    tableName={duplicateTable.tableName}
                    existingTables={duplicateTable.existingTables}
                    onConfirm={duplicateTable.onConfirm}
                    onCancel={() => duplicateTable.setTableName(null)}
                />
            )}

            <SaveQueryModal
                isOpen={saveItem.modal !== null}
                onClose={() => saveItem.setModal(null)}
                onSave={(name) => {
                    if (saveItem.modal?.type === 'query') {
                        saveItem.onSaveQuery(name);
                    } else if (saveItem.modal?.type === 'function') {
                        saveItem.onSaveFunction(name);
                    }
                }}
                type={saveItem.modal?.type || 'query'}
            />

            <TableEditRowModal
                isOpen={editRow.isOpen}
                onClose={editRow.onClose}
                activeTabId={editRow.activeTabId}
                activeTabType={editRow.activeTabType}
                activeTabTitle={editRow.activeTabTitle}
                results={editRow.results}
                selectedIndices={editRow.selectedIndices}
                setSelectedIndices={editRow.setSelectedIndices}
                pendingChanges={editRow.pendingChanges}
                setPendingChanges={editRow.setPendingChanges}
                panelColumns={editRow.panelColumns}
                onInsert={editRow.onInsert}
                onAddRow={editRow.onAddRow}
                onCellEdit={editRow.onCellEdit}
            />
        </>
    );
};
