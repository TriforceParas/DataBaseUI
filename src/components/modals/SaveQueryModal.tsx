import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import styles from '../../styles/ConnectionForm.module.css';

interface SaveQueryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string) => void;
    type: 'query' | 'function';
    initialName?: string;
}

export const SaveQueryModal: React.FC<SaveQueryModalProps> = ({
    isOpen,
    onClose,
    onSave,
    type,
    initialName = ''
}) => {
    const [name, setName] = useState(initialName);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setName(initialName);
            setError(null);
        }
    }, [isOpen, initialName]);

    if (!isOpen) return null;

    const handleSave = () => {
        const trimmed = name.trim();
        if (!trimmed) {
            setError('Name is required');
            return;
        }
        onSave(trimmed);
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    return (
        <div
            style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
            onClick={onClose}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '8px',
                    padding: '1.5rem',
                    width: '400px',
                    border: '1px solid var(--border-color)'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>
                        Save {type === 'query' ? 'Query' : 'Function'}
                    </h3>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Name
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={e => { setName(e.target.value); setError(null); }}
                        onKeyDown={handleKeyDown}
                        placeholder={type === 'query' ? 'My Query' : 'My Function'}
                        autoFocus
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            backgroundColor: 'var(--bg-primary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            color: 'var(--text-primary)',
                            fontSize: '1rem',
                            boxSizing: 'border-box'
                        }}
                    />
                    {error && <span style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.5rem', display: 'block' }}>{error}</span>}
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button
                        onClick={onClose}
                        className={styles.cancelBtn}
                        style={{ padding: '0.5rem 1rem' }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className={styles.addButton}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
                    >
                        <Save size={16} /> Save
                    </button>
                </div>
            </div>
        </div>
    );
};
