import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Monitor, Folder, Settings, Palette, FolderOpen } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import styles from '../../styles/MainLayout.module.css';

interface PreferencesModalProps {
    isOpen: boolean;
    onClose: () => void;
    theme: string;
    setTheme: (t: string) => void;
    zoom: number;
    setZoom: (z: number) => void;
    availableThemes: { id: string, name: string, type: string, colors: { bg: string, text: string, accent: string } }[];
    enableChangeLog: boolean;
    setEnableChangeLog: (enabled: boolean) => void;
    defaultExportPath: string;
    setDefaultExportPath: (path: string) => void;
}

type TabType = 'theme' | 'display' | 'directory' | 'settings';

export const PreferencesModal: React.FC<PreferencesModalProps> = ({
    isOpen, onClose, theme, setTheme, zoom, setZoom, availableThemes,
    enableChangeLog, setEnableChangeLog, defaultExportPath, setDefaultExportPath
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('theme');

    // Local zoom state for preview
    const [localZoom, setLocalZoom] = useState(zoom);

    // Sync local zoom when opening
    useEffect(() => {
        if (isOpen) setLocalZoom(zoom);
    }, [isOpen, zoom]);

    const handleApplyZoom = () => {
        setZoom(localZoom);
    };

    const handleRevertZoom = () => {
        setLocalZoom(zoom);
    };

    if (!isOpen) return null;

    const currentThemeObj = availableThemes.find(t => t.id === theme);
    const currentMode = currentThemeObj?.type || 'dark';

    const renderSidebarItem = (id: TabType, label: string, icon: React.ReactNode) => (
        <button
            onClick={() => setActiveTab(id)}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '12px 16px',
                background: activeTab === id ? 'var(--bg-tertiary)' : 'transparent',
                border: 'none',
                color: activeTab === id ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                textAlign: 'left',
                borderRadius: '6px',
                fontSize: '0.95rem',
                fontWeight: activeTab === id ? 500 : 400,
                marginBottom: '4px'
            }}
        >
            {icon}
            {label}
        </button>
    );



    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
            <div style={{
                backgroundColor: 'var(--bg-secondary)',
                width: '75vw',
                height: '75vh',
                maxWidth: '1900px',
                maxHeight: '800px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-xl)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transform: `scale(${1 / zoom})`,
                transformOrigin: 'center center'
            }} onClick={e => e.stopPropagation()}>

                {/* Fixed Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '20px 30px',
                    borderBottom: '1px solid var(--border-color)',
                    flexShrink: 0
                }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Preferences</h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content Area */}
                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {/* Sidebar */}
                    <div style={{ width: '250px', borderRight: '1px solid var(--border-color)', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                        {renderSidebarItem('theme', 'Appearance', <Palette size={18} />)}
                        {renderSidebarItem('display', 'Display & Scaling', <Monitor size={18} />)}
                        {renderSidebarItem('directory', 'File Locations', <Folder size={18} />)}
                        {renderSidebarItem('settings', 'App Settings', <Settings size={18} />)}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>
                        {activeTab === 'theme' && (
                            <div>
                                <h3 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>Application Theme</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
                                    {availableThemes.map(t => (
                                        <div
                                            key={t.id}
                                            onClick={() => setTheme(t.id)}
                                            style={{
                                                padding: '15px',
                                                borderRadius: '8px',
                                                border: `2px solid ${theme === t.id ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                                                cursor: 'pointer',
                                                backgroundColor: t.colors.bg,
                                                color: t.colors.text,
                                                position: 'relative',
                                                overflow: 'hidden'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                <div style={{ width: 12, height: 12, borderRadius: '50%', background: t.colors.accent }} />
                                                <span style={{ fontWeight: 500 }}>{t.name.replace(/ \((Light|Dark)\)/, '')}</span>
                                            </div>
                                            <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>{t.type === 'light' ? 'Light Mode' : 'Dark Mode'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'display' && (
                            <div>
                                <h3 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>Display Interface Scaling</h3>

                                <div style={{ marginBottom: '30px' }}>
                                    <label style={{ display: 'block', marginBottom: '10px', color: 'var(--text-secondary)' }}>Scale Factor</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                                        <button
                                            className={styles.secondaryBtn}
                                            onClick={() => setLocalZoom(0.75)}
                                            style={{
                                                border: localZoom === 0.75 ? '2px solid var(--accent-primary)' : undefined
                                            }}
                                        >S (75%)</button>
                                        <button
                                            className={styles.secondaryBtn}
                                            onClick={() => setLocalZoom(1.0)}
                                            style={{
                                                border: localZoom === 1.0 ? '2px solid var(--accent-primary)' : undefined
                                            }}
                                        >M (100%)</button>
                                        <button
                                            className={styles.secondaryBtn}
                                            onClick={() => setLocalZoom(1.5)}
                                            style={{
                                                border: localZoom === 1.5 ? '2px solid var(--accent-primary)' : undefined
                                            }}
                                        >L (150%)</button>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <ZoomOut size={20} style={{ cursor: 'pointer', opacity: localZoom <= 0.5 ? 0.3 : 1 }} onClick={() => setLocalZoom(Math.max(0.5, localZoom - 0.05))} />
                                        <input
                                            type="range"
                                            min="50"
                                            max="200"
                                            value={localZoom * 100}
                                            onChange={(e) => setLocalZoom(Number(e.target.value) / 100)}
                                            style={{ flex: 1, accentColor: 'var(--accent-primary)' }}
                                        />
                                        <ZoomIn size={20} style={{ cursor: 'pointer', opacity: localZoom >= 2.0 ? 0.3 : 1 }} onClick={() => setLocalZoom(Math.min(2.0, localZoom + 0.05))} />
                                        <span style={{ width: '60px', textAlign: 'right', fontWeight: 600, fontSize: '1rem' }}>{Math.round(localZoom * 100)}%</span>
                                    </div>
                                </div>

                                {/* Simple text-based preview */}
                                <div style={{
                                    padding: '24px',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    marginBottom: '20px'
                                }}>
                                    <div style={{ marginBottom: '16px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                        Live Preview
                                    </div>

                                    {/* Sample UI elements at selected scale */}
                                    <div style={{ transform: `scale(${localZoom})`, transformOrigin: 'top left', marginBottom: `${(localZoom - 1) * 80}px` }}>
                                        <div style={{ marginBottom: '12px' }}>
                                            <span style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>Database Tables</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                            <div style={{
                                                padding: '6px 12px',
                                                background: 'var(--bg-secondary)',
                                                borderRadius: '4px',
                                                fontSize: '0.9rem',
                                                color: 'var(--text-primary)'
                                            }}>users</div>
                                            <div style={{
                                                padding: '6px 12px',
                                                background: 'var(--bg-secondary)',
                                                borderRadius: '4px',
                                                fontSize: '0.9rem',
                                                color: 'var(--text-primary)'
                                            }}>orders</div>
                                            <div style={{
                                                padding: '6px 12px',
                                                background: 'var(--bg-secondary)',
                                                borderRadius: '4px',
                                                fontSize: '0.9rem',
                                                color: 'var(--text-primary)'
                                            }}>products</div>
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            This is how your interface text will appear at {Math.round(localZoom * 100)}% scale.
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                    <button className={styles.secondaryBtn} onClick={handleRevertZoom} disabled={localZoom === zoom}>Revert</button>
                                    <button className={styles.primaryBtn} onClick={handleApplyZoom}>Apply</button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'directory' && (
                            <div>
                                <h3 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>Default Save Locations</h3>

                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Root Directory</label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <input
                                            type="text"
                                            value={defaultExportPath}
                                            onChange={(e) => setDefaultExportPath(e.target.value)}
                                            placeholder="C:\\path\\to\\your\\folder"
                                            style={{
                                                flex: 1,
                                                padding: '10px',
                                                borderRadius: '6px',
                                                border: '1px solid var(--border-color)',
                                                background: 'var(--bg-tertiary)',
                                                color: 'var(--text-primary)'
                                            }}
                                        />
                                        <button
                                            className={styles.secondaryBtn}
                                            onClick={async () => {
                                                const selected = await open({
                                                    directory: true,
                                                    multiple: false,
                                                    title: 'Select Export Directory'
                                                });
                                                if (selected && typeof selected === 'string') {
                                                    setDefaultExportPath(selected);
                                                }
                                            }}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                        >
                                            <FolderOpen size={16} />
                                            Browse
                                        </button>
                                    </div>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                                        Files will be saved in the following structure:<br />
                                        <code style={{ background: 'var(--bg-tertiary)', padding: '2px 4px', borderRadius: '4px' }}>SQL-UI-APP &gt; [Connection Name] &gt; [Database Name] &gt; [Type]</code>
                                    </p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'settings' && (
                            <div>
                                <h3 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>Application Settings</h3>

                                <div style={{
                                    padding: '20px',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 600, marginBottom: '5px' }}>Enable Change Log</div>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '400px' }}>
                                            When enabled, data modifications (UPDATE/DELETE) are queued for review.
                                            When disabled, changes are applied immediately.
                                        </div>
                                    </div>
                                    <div style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px' }}>
                                        <input
                                            type="checkbox"
                                            checked={enableChangeLog}
                                            onChange={(e) => {
                                                if (!e.target.checked) {
                                                    if (confirm('WARNING: Disabling Change Log will cause all UPDATE and DELETE queries to execute IMMEDIATELY without review. Are you sure you want to proceed?')) {
                                                        setEnableChangeLog(false);
                                                    }
                                                } else {
                                                    setEnableChangeLog(true);
                                                }
                                            }}
                                            style={{ opacity: 0, width: 0, height: 0 }}
                                            id="changelog-toggle"
                                        />
                                        <label
                                            htmlFor="changelog-toggle"
                                            style={{
                                                position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                                                backgroundColor: enableChangeLog ? 'var(--accent-primary)' : '#ccc',
                                                borderRadius: '26px', transition: '.4s'
                                            }}
                                        >
                                            <span style={{
                                                position: 'absolute', content: '""', height: '18px', width: '18px',
                                                left: enableChangeLog ? '26px' : '4px', bottom: '4px',
                                                backgroundColor: 'white', borderRadius: '50%', transition: '.4s'
                                            }} />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
