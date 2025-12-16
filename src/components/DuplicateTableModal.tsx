import React, { useState } from 'react';
import { Copy, X } from 'lucide-react';
import styles from '../styles/ConnectionForm.module.css';

interface DuplicateTableModalProps {
    tableName: string;
    onConfirm: (newName: string, includeData: boolean) => void;
    onCancel: () => void;
}

export const DuplicateTableModal: React.FC<DuplicateTableModalProps> = ({
    tableName,
    onConfirm,
    onCancel
}) => {
    const [newName, setNewName] = useState(`${tableName}_copy`);
    const [duplicateType, setDuplicateType] = useState<'schema' | 'everything'>('everything');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newName.trim()) {
            onConfirm(newName.trim(), duplicateType === 'everything');
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000
        }}>
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    padding: '1.5rem',
                    minWidth: '400px',
                    maxWidth: '480px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Copy size={20} color="var(--accent-primary)" />
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Duplicate Table</h3>
                    </div>
                    <button
                        onClick={onCancel}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)',
                            padding: '4px'
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Source Table
                        </label>
                        <div style={{
                            padding: '0.75rem',
                            backgroundColor: 'var(--bg-tertiary)',
                            borderRadius: '6px',
                            color: 'var(--text-primary)',
                            fontFamily: 'monospace'
                        }}>
                            {tableName}
                        </div>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            New Table Name
                        </label>
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className={styles.input}
                            style={{ width: '100%' }}
                            autoFocus
                            required
                        />
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Duplicate Options
                        </label>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <label
                                style={{
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '6px',
                                    border: `2px solid ${duplicateType === 'schema' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                                    backgroundColor: duplicateType === 'schema' ? 'rgba(74, 144, 226, 0.1)' : 'transparent',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <input
                                    type="radio"
                                    name="duplicateType"
                                    checked={duplicateType === 'schema'}
                                    onChange={() => setDuplicateType('schema')}
                                    style={{ margin: 0 }}
                                />
                                <div>
                                    <div style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: '0.9rem' }}>Only Schema</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Structure only, no data</div>
                                </div>
                            </label>
                            <label
                                style={{
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '6px',
                                    border: `2px solid ${duplicateType === 'everything' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                                    backgroundColor: duplicateType === 'everything' ? 'rgba(74, 144, 226, 0.1)' : 'transparent',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <input
                                    type="radio"
                                    name="duplicateType"
                                    checked={duplicateType === 'everything'}
                                    onChange={() => setDuplicateType('everything')}
                                    style={{ margin: 0 }}
                                />
                                <div>
                                    <div style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: '0.9rem' }}>Everything</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Schema + all data</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                        <button
                            type="button"
                            onClick={onCancel}
                            className={styles.addButton}
                            style={{
                                flex: 'none',
                                backgroundColor: 'transparent',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-primary)',
                                padding: '0.5rem 1rem'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className={styles.addButton}
                            style={{
                                flex: 'none',
                                backgroundColor: 'var(--accent-primary)',
                                padding: '0.5rem 1rem'
                            }}
                        >
                            Duplicate
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
