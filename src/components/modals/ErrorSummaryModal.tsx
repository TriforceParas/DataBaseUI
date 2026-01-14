import React from 'react';
import { BaseModal } from './BaseModal';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import styles from '../../styles/MainLayout.module.css';
import { PendingChange } from '../../types/index';

export interface ChangeError {
    change: PendingChange;
    error: string;
    isForeignKeyError?: boolean;
}

interface ErrorSummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    errors: ChangeError[];
    onRetryWithFKDisabled?: (errors: ChangeError[]) => void;
}

export const ErrorSummaryModal: React.FC<ErrorSummaryModalProps> = ({
    isOpen,
    onClose,
    errors,
    onRetryWithFKDisabled
}) => {
    // Handle conditional rendering at component level
    if (!isOpen || errors.length === 0) return null;

    const fkErrors = errors.filter(e => e.isForeignKeyError);
    const otherErrors = errors.filter(e => !e.isForeignKeyError);

    const getChangeDescription = (change: PendingChange): string => {
        switch (change.type) {
            case 'INSERT':
                return `Insert row in "${change.tableName}"`;
            case 'UPDATE':
                return `Update "${change.column}" in "${change.tableName}" (row ${change.rowIndex + 1})`;
            case 'DELETE':
                return `Delete row ${change.rowIndex + 1} from "${change.tableName}"`;
            case 'ADD_COLUMN':
                return `Add column "${change.column}" to "${change.tableName}"`;
            case 'DROP_COLUMN':
                return `Drop column "${change.column}" from "${change.tableName}"`;
            default:
                return `Change in "${change.tableName}"`;
        }
    };

    return (
        <BaseModal onClose={onClose} title="Some Changes Failed" maxWidth="560px">
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                maxHeight: '60vh',
                overflow: 'auto'
            }}>
                <p style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem',
                    margin: 0
                }}>
                    {errors.length} change(s) could not be applied. Successfully applied changes have been saved.
                </p>

                {/* FK Errors Section */}
                {fkErrors.length > 0 && (
                    <div style={{
                        padding: '1rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '8px'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '0.75rem',
                            color: '#ef4444',
                            fontWeight: 600
                        }}>
                            <AlertTriangle size={16} />
                            Foreign Key Constraint Errors ({fkErrors.length})
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {fkErrors.map((err, idx) => (
                                <div key={idx} style={{
                                    padding: '0.5rem',
                                    background: 'var(--bg-primary)',
                                    borderRadius: '4px',
                                    fontSize: '0.85rem'
                                }}>
                                    <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                                        {getChangeDescription(err.change)}
                                    </div>
                                    <div style={{
                                        color: 'var(--text-secondary)',
                                        fontFamily: 'monospace',
                                        fontSize: '0.8rem',
                                        wordBreak: 'break-word'
                                    }}>
                                        {err.error}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {onRetryWithFKDisabled && (
                            <button
                                className={styles.primaryBtn}
                                onClick={() => onRetryWithFKDisabled(fkErrors)}
                                style={{
                                    marginTop: '0.75rem',
                                    background: '#ef4444',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                <RefreshCw size={14} />
                                Retry with FK Checks Disabled
                            </button>
                        )}
                    </div>
                )}

                {/* Other Errors Section */}
                {otherErrors.length > 0 && (
                    <div style={{
                        padding: '1rem',
                        background: 'rgba(251, 191, 36, 0.1)',
                        border: '1px solid rgba(251, 191, 36, 0.3)',
                        borderRadius: '8px'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '0.75rem',
                            color: '#fbbf24',
                            fontWeight: 600
                        }}>
                            <AlertTriangle size={16} />
                            Other Errors ({otherErrors.length})
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {otherErrors.map((err, idx) => (
                                <div key={idx} style={{
                                    padding: '0.5rem',
                                    background: 'var(--bg-primary)',
                                    borderRadius: '4px',
                                    fontSize: '0.85rem'
                                }}>
                                    <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                                        {getChangeDescription(err.change)}
                                    </div>
                                    <div style={{
                                        color: 'var(--text-secondary)',
                                        fontFamily: 'monospace',
                                        fontSize: '0.8rem',
                                        wordBreak: 'break-word'
                                    }}>
                                        {err.error}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: '1.5rem'
            }}>
                <button className={styles.secondaryBtn} onClick={onClose}>
                    Close
                </button>
            </div>
        </BaseModal>
    );
};
