import React from 'react';
import { BaseModal } from './BaseModal';
import { RiErrorWarningLine, RiRefreshLine } from 'react-icons/ri';
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
    onRetry?: () => void;
    onRetryWithFKDisabled?: (errors: ChangeError[]) => void;
}

const ErrorItem = ({ error, type }: { error: ChangeError, type: 'fk' | 'other' }) => {
    const borderColor = type === 'fk' ? '#ef4444' : '#f59e0b';

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
        <div style={{
            padding: '12px',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderLeft: `4px solid ${borderColor}`,
            borderRadius: '4px',
            marginBottom: '8px'
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '4px',
                fontWeight: 600,
                fontSize: '0.9rem',
                color: 'var(--text-primary)'
            }}>
                <span style={{ opacity: 0.8 }}>{getChangeDescription(error.change)}</span>
            </div>
            <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
                marginTop: '4px',
                paddingTop: '4px',
                borderTop: '1px solid var(--border-color)'
            }}>
                {error.error}
            </div>
        </div>
    );
};

export const ErrorSummaryModal: React.FC<ErrorSummaryModalProps> = ({
    isOpen,
    onClose,
    errors,
    onRetry,
    onRetryWithFKDisabled
}) => {
    if (!isOpen || errors.length === 0) return null;

    const fkErrors = errors.filter(e => e.isForeignKeyError);
    const otherErrors = errors.filter(e => !e.isForeignKeyError);

    return (
        <BaseModal onClose={onClose} title="Change Application Errors" maxWidth="600px">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '65vh', overflowY: 'auto', paddingRight: '4px' }}>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                    <div style={{ color: '#ef4444', marginTop: '2px' }}><RiErrorWarningLine size={20} /></div>
                    <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                            {errors.length} {errors.length === 1 ? 'change' : 'changes'} failed
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                            Some changes could not be applied to the database. Successful changes have been saved.
                            Review the errors below.
                        </div>
                    </div>
                </div>

                {/* FK Errors Section */}
                {fkErrors.length > 0 && (
                    <div>
                        <h4 style={{
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            marginBottom: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }}></span>
                            Foreign Key Constraints ({fkErrors.length})
                        </h4>
                        <div>
                            {fkErrors.map((err, idx) => (
                                <ErrorItem key={`fk-${idx}`} error={err} type="fk" />
                            ))}
                        </div>
                        {onRetryWithFKDisabled && (
                            <button
                                className={styles.primaryBtn}
                                onClick={() => onRetryWithFKDisabled(fkErrors)}
                                style={{
                                    marginTop: '12px',
                                    background: 'transparent', // Use transparent for outlined button
                                    color: '#ef4444',
                                    border: '1px solid #ef4444',
                                    width: '100%',
                                    justifyContent: 'center'
                                }}
                            >
                                <RiRefreshLine size={16} />
                                Retry Selection with Integrity Checks Disabled
                            </button>
                        )}
                    </div>
                )}

                {/* Other Errors Section */}
                {otherErrors.length > 0 && (
                    <div>
                        <h4 style={{
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            marginBottom: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }}></span>
                            General Errors ({otherErrors.length})
                        </h4>
                        <div>
                            {otherErrors.map((err, idx) => (
                                <ErrorItem key={`other-${idx}`} error={err} type="other" />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className={styles.actions} style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                {onRetry && (
                    <button className={styles.primaryBtn} onClick={onRetry} style={{ background: '#ef4444' }}>
                        <RiRefreshLine size={16} /> Retry All Failed
                    </button>
                )}
                <button
                    className={styles.secondaryBtn}
                    onClick={onClose}
                    style={{ marginLeft: 'auto' }}
                >
                    Close
                </button>
            </div>
        </BaseModal>
    );
};
