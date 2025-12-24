import React from 'react';
import styles from '../../styles/MainLayout.module.css';
import { ZoomIn, ZoomOut, X } from 'lucide-react';

interface PreferencesModalProps {
    isOpen: boolean;
    onClose: () => void;
    theme: string;
    setTheme: (t: string) => void;
    zoom: number;
    setZoom: React.Dispatch<React.SetStateAction<number>>;
    availableThemes: { id: string, name: string, type: string, colors: { bg: string, text: string, accent: string } }[];
}

export const PreferencesModal: React.FC<PreferencesModalProps> = ({ isOpen, onClose, theme, setTheme, zoom, setZoom, availableThemes }) => {
    // Determine current mode based on active theme
    const currentThemeObj = availableThemes.find(t => t.id === theme);
    const currentMode = currentThemeObj?.type || 'dark';

    if (!isOpen) return null;

    const handleZoom = (delta: number) => {
        setZoom(prev => Math.max(0.5, Math.min(2.0, prev + delta)));
    };

    const toggleMode = () => {
        const newMode = currentMode === 'light' ? 'dark' : 'light';
        const baseName = currentThemeObj?.name.replace(/ \((Light|Dark)\)/, '').trim();

        // Try to find counterpart
        const counterpart = availableThemes.find(t =>
            t.type === newMode &&
            t.name.replace(/ \((Light|Dark)\)/, '').trim() === baseName
        );

        if (counterpart) {
            setTheme(counterpart.id);
        } else {
            const firstAvailable = availableThemes.find(t => t.type === newMode);
            if (firstAvailable) setTheme(firstAvailable.id);
        }
    };

    const displayedThemes = availableThemes.filter(t => t.type === currentMode);

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '2rem', borderRadius: '8px', width: '400px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)', userSelect: 'none' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Preferences</h2>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase' }}>Theme</h3>

                        <div style={{ display: 'flex', backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px', padding: '2px' }}>
                            <button onClick={() => currentMode !== 'light' && toggleMode()} style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '0.85rem', backgroundColor: currentMode === 'light' ? 'var(--bg-secondary)' : 'transparent', color: currentMode === 'light' ? 'var(--text-primary)' : 'var(--text-secondary)', boxShadow: currentMode === 'light' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer', border: 'none' }}>Light</button>
                            <button onClick={() => currentMode !== 'dark' && toggleMode()} style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '0.85rem', backgroundColor: currentMode === 'dark' ? 'var(--bg-secondary)' : 'transparent', color: currentMode === 'dark' ? 'var(--text-primary)' : 'var(--text-secondary)', boxShadow: currentMode === 'dark' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer', border: 'none' }}>Dark</button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '5px' }}>
                        {displayedThemes.map(t => (
                            <div key={t.id} onClick={() => setTheme(t.id)} style={{ padding: '0.8rem', borderRadius: '6px', border: `2px solid ${theme === t.id ? t.colors.accent : 'var(--border-color)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', backgroundColor: t.colors.bg, color: t.colors.text, transition: 'all 0.2s ease' }}>
                                {theme === t.id && <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.colors.accent }} />}
                                {t.name.replace(/ \((Light|Dark)\)/, '')}
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
