import React, { useState, useEffect } from 'react';
import { Icons } from '../../assets/icons';

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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 600 }}>
                        Save {type === 'query' ? 'Query' : 'Function'}
                    </h3>
                    <div
                        onClick={onClose}
                        style={{
                            cursor: 'pointer',
                            color: 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '4px',
                            borderRadius: '4px',
                            transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        <Icons.X size={18} />
                    </div>
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

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: 'transparent',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-secondary)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                            e.currentTarget.style.borderColor = 'var(--text-secondary)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.borderColor = 'var(--border-color)';
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        style={{
                            padding: '0.5rem 1.25rem',
                            backgroundColor: 'var(--accent-primary)',
                            border: '1px solid transparent',
                            color: 'white',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.6rem',
                            transition: 'all 0.2s',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = 'var(--accent-hover)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                        }}
                    >
                        <Icons.Save size={16} /> Save
                    </button>
                </div>
            </div>
        </div>
    );
};
