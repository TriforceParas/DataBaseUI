import React, { useState } from 'react';
import { RiFileCopyLine } from 'react-icons/ri';
import styles from '../../styles/Form.module.css';
import { BaseModal } from './BaseModal';

interface DuplicateTableModalProps {
    tableName: string;
    existingTables: string[]; // Pass existing tables to check for duplicates
    onConfirm: (newName: string, includeData: boolean) => void;
    onCancel: () => void;
}

export const DuplicateTableModal: React.FC<DuplicateTableModalProps> = ({
    tableName,
    existingTables,
    onConfirm,
    onCancel
}) => {
    const [newName, setNewName] = useState(`${tableName}_copy`);
    const [duplicateType, setDuplicateType] = useState<'schema' | 'everything'>('everything');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const name = newName.trim();
        if (name) {
            if (existingTables.includes(name)) {
                setError(`Table "${name}" already exists.`);
                return;
            }
            onConfirm(name, duplicateType === 'everything');
        }
    };

    return (
        <BaseModal
            title="Duplicate Table"
            icon={<div className={styles.iconWrapper}><RiFileCopyLine size={32} color="var(--accent-primary)" /></div>}
            onClose={onCancel}
        >
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
                    {error && (
                        <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>⚠️</span> {error}
                        </div>
                    )}
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
        </BaseModal>
    );
};
