import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, Check, Pencil } from 'lucide-react';
import styles from '../../../styles/ConnectionForm.module.css';
import { Tag } from '../../../types';

interface TagManagerProps {
    onSuccess: () => void;
    onCancel: () => void;
    editTag?: Tag;
}

export const TagManager: React.FC<TagManagerProps> = ({ onSuccess, onCancel, editTag }) => {
    const [name, setName] = useState(editTag?.name || '');
    const [color, setColor] = useState(editTag?.color || '#3b82f6');
    const [error, setError] = useState<string>('');
    const [customColorMode, setCustomColorMode] = useState(false);

    const isEditMode = !!editTag;

    const PRESET_COLORS = [
        '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
        '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#cbd5e1', '#0f172a'
    ];

    useEffect(() => {
        if (editTag && !PRESET_COLORS.includes(editTag.color)) {
            setCustomColorMode(true);
        }
    }, [editTag]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (isEditMode) {
                await invoke('update_tag', { id: editTag.id, name, color });
            } else {
                await invoke('create_tag', { name, color });
            }
            onSuccess();
            setName('');
            setColor('#3b82f6');
            setCustomColorMode(false);
            setError('');
        } catch (e) {
            console.error(e);
            setError(String(e));
        }
    };

    return (
        <form className={styles.form} onSubmit={handleSubmit} style={{ minWidth: '300px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 className={styles.sectionTitle} style={{ margin: 0 }}>{isEditMode ? 'Edit Tag' : 'Create New Tag'}</h3>
                <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    <X size={18} />
                </button>
            </div>

            <input
                className={styles.input}
                placeholder="Tag Name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoFocus
            />

            <div style={{ marginTop: '1rem' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Color:</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginTop: '10px', justifyItems: 'center' }}>
                    {PRESET_COLORS.map(c => (
                        <div
                            key={c}
                            onClick={() => { setColor(c); setCustomColorMode(false); }}
                            style={{
                                width: '36px',
                                height: '36px',
                                backgroundColor: c,
                                borderRadius: '50%',
                                cursor: 'pointer',
                                border: (color === c && !customColorMode) ? '2px solid white' : '2px solid transparent',
                                boxShadow: (color === c && !customColorMode) ? '0 0 0 2px var(--accent-primary)' : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'transform 0.1s'
                            }}
                        >
                            {(color === c && !customColorMode) && <Check size={18} color={['#eab308', '#cbd5e1'].includes(c) ? 'black' : 'white'} strokeWidth={3} />}
                        </div>
                    ))}
                    <div style={{ position: 'relative', width: '36px', height: '36px' }}>
                        <input
                            type="color"
                            value={color}
                            onChange={e => { setColor(e.target.value); setCustomColorMode(true); }}
                            style={{
                                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                                opacity: 0, cursor: 'pointer', zIndex: 10
                            }}
                        />
                        <div style={{
                            width: '100%', height: '100%', borderRadius: '50%',
                            background: customColorMode ? color : 'conic-gradient(red, orange, yellow, green, blue, indigo, violet, red)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: customColorMode ? '2px solid white' : '1px solid var(--border-color)',
                            boxShadow: customColorMode ? '0 0 0 2px var(--accent-primary)' : 'none'
                        }}>
                            {customColorMode ? <Check size={18} color="white" strokeWidth={3} style={{ mixBlendMode: 'difference' }} /> : <Pencil size={16} color="white" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />}
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className={styles.addButton} onClick={onCancel} style={{ flex: 1, backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                    Cancel
                </button>
                <button type="submit" className={styles.addButton} style={{ flex: 1 }}>
                    {isEditMode ? 'Save Changes' : 'Create Tag'}
                </button>
            </div>

            {error && <div style={{ color: 'red', fontSize: '0.8rem', marginTop: '0.5rem' }}>{error}</div>}
        </form>
    );
};
