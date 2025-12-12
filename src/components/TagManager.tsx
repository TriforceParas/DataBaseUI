import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import styles from '../styles/ConnectionForm.module.css'; // Reusing form styles

interface TagManagerProps {
    onSuccess: () => void;
    onCancel: () => void;
}

export const TagManager: React.FC<TagManagerProps> = ({ onSuccess, onCancel }) => {
    const [tagName, setTagName] = useState('');
    const [tagColor, setTagColor] = useState('#6366f1'); // Default indigo
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await invoke('create_tag', { name: tagName, color: tagColor });
            onSuccess();
        } catch (e) {
            console.error(e);
            setError("Failed to create tag");
        }
    };

    return (
        <form className={styles.form} onSubmit={handleSubmit} style={{ minWidth: '300px' }}>
            <h3 className={styles.sectionTitle}>Create New Tag</h3>

            <input
                className={styles.input}
                placeholder="Tag Name"
                value={tagName}
                onChange={e => setTagName(e.target.value)}
                required
                autoFocus
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Color:</span>
                <input
                    type="color"
                    value={tagColor}
                    onChange={e => setTagColor(e.target.value)}
                    style={{
                        border: 'none',
                        width: '40px',
                        height: '30px',
                        cursor: 'pointer',
                        background: 'transparent'
                    }}
                />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className={styles.addButton} onClick={onCancel} style={{ flex: 1, backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                    Cancel
                </button>
                <button type="submit" className={styles.addButton} style={{ flex: 1 }}>
                    Create Tag
                </button>
            </div>

            {error && <div style={{ color: 'red', fontSize: '0.8rem', marginTop: '0.5rem' }}>{error}</div>}
        </form>
    );
};
