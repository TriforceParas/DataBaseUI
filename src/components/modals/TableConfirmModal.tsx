import React from 'react';
import { ConfirmModal } from './ConfirmModal';

interface TableConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    tableName: string;
    action: 'truncate' | 'drop' | null;
}

export const TableConfirmModal: React.FC<TableConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    tableName,
    action
}) => {
    if (!isOpen || !action) return null;

    const isDrop = action === 'drop';
    const title = isDrop ? 'Drop Table' : 'Truncate Table';
    const message = isDrop
        ? `Are you sure you want to drop table "${tableName}"? This action cannot be undone.`
        : `Are you sure you want to truncate table "${tableName}"? All data will be lost.`;

    return (
        <ConfirmModal
            title={title}
            message={message}
            onConfirm={onConfirm}
            onCancel={onClose}
            confirmText={isDrop ? 'Drop' : 'Truncate'}
            isDangerous={true}
        />
    );
};
