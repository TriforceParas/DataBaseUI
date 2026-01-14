import React from 'react';
import { RiErrorWarningLine } from 'react-icons/ri';
import styles from '../../styles/Form.module.css';
import { BaseModal } from './BaseModal';

interface ConfirmModalProps {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    isDangerous?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
    isDangerous = true
}) => {
    return (
        <BaseModal
            title={title}
            icon={isDangerous ? <RiErrorWarningLine size={24} color="#ef4444" /> : undefined}
            onClose={onCancel}
        >
            <p style={{
                color: 'var(--text-secondary)',
                fontSize: '0.95rem',
                lineHeight: 1.5,
                marginBottom: '1.5rem'
            }}>
                {message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                    onClick={onCancel}
                    style={{
                        padding: '0.5rem 1rem',
                        background: 'transparent',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        height: '36px'
                    }}
                >
                    {cancelText}
                </button>
                <button
                    onClick={onConfirm}
                    className={styles.addButton}
                    style={{
                        flex: 'none',
                        backgroundColor: isDangerous ? '#ef4444' : 'var(--accent-primary)',
                        padding: '0.5rem 1rem'
                    }}
                >
                    {confirmText}
                </button>
            </div>
        </BaseModal>
    );
};
