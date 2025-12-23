import React from 'react';
import styles from '../../styles/MainLayout.module.css';
import { ZoomIn, ZoomOut, X } from 'lucide-react';

interface PreferencesModalProps {
    isOpen: boolean;
    onClose: () => void;
    theme: 'blue' | 'gray' | 'amoled' | 'light';
    setTheme: (t: 'blue' | 'gray' | 'amoled' | 'light') => void;
    zoom: number;
    setZoom: (z: number) => void;
}

export const PreferencesModal: React.FC<PreferencesModalProps> = ({ isOpen, onClose, theme, setTheme, zoom, setZoom }) => {
    if (!isOpen) return null;

    const handleZoom = (delta: number) => {
        setZoom(Math.max(0.5, Math.min(2.0, zoom + delta)));
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '2rem', borderRadius: '8px', width: '400px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Preferences</h2>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.8rem', textTransform: 'uppercase' }}>Theme</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                        {[
                            { id: 'blue', label: 'Midnight Blue', color: '#0f111a' },
                            { id: 'gray', label: 'Dark', color: '#202020' },
                            { id: 'amoled', label: 'AMOLED', color: '#000' },
                            { id: 'light', label: 'Light', color: '#fff' }
                        ].map(t => (
                            <div
                                key={t.id}
                                onClick={() => setTheme(t.id as any)}
                                style={{
                                    padding: '0.8rem', borderRadius: '6px', border: `2px solid ${theme === t.id ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem',
                                    backgroundColor: t.color, color: t.id === 'light' ? '#000' : '#fff'
                                }}
                            >
                                {theme === t.id && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-primary)' }} />}
                                {t.label}
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.8rem', textTransform: 'uppercase' }}>Interface Scale</h3>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-tertiary)', padding: '0.5rem', borderRadius: '6px' }}>
                        <button className={styles.iconBtn} onClick={() => handleZoom(-0.1)}><ZoomOut size={18} /></button>
                        <span style={{ fontWeight: 600 }}>{Math.round(zoom * 100)}%</span>
                        <button className={styles.iconBtn} onClick={() => handleZoom(0.1)}><ZoomIn size={18} /></button>
                    </div>
                    <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                        <button style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '0.85rem', cursor: 'pointer' }} onClick={() => setZoom(1)}>Reset to Default</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
