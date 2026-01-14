import React, { useState } from 'react';
import { RiCloseLine, RiZoomInLine, RiZoomOutLine, RiComputerLine, RiFolderLine, RiSettings3Line, RiPaletteLine, RiFolderOpenLine } from 'react-icons/ri';
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

type TabType = 'theme' | 'scaling' | 'directories' | 'settings';

export const PreferencesModal: React.FC<PreferencesModalProps> = ({
    isOpen, onClose, theme, setTheme, zoom, setZoom, availableThemes,
    enableChangeLog, setEnableChangeLog, defaultExportPath, setDefaultExportPath
}) => {
    const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
        { id: 'theme', label: 'Theme', icon: <RiPaletteLine size={18} /> },
        { id: 'scaling', label: 'Display', icon: <RiComputerLine size={18} /> },
        { id: 'directories', label: 'Directories', icon: <RiFolderLine size={18} /> },
        { id: 'settings', label: 'Settings', icon: <RiSettings3Line size={18} /> },
    ];

    const [activeTab, setActiveTab] = useState<TabType>('theme');

    // 1. Determine Current Mode and Base Name
    const currentThemeObj = availableThemes.find(t => t.id === theme);
    // Initialize viewMode lazily to avoid conditional hook issues, defaults to light
    const [viewMode, setViewMode] = useState<'light' | 'dark'>(() => {
        if (currentThemeObj?.type === 'dark') return 'dark';
        return 'light';
    });

    // Sync local viewMode when global theme changes (external changes)
    React.useEffect(() => {
        if (currentThemeObj && (currentThemeObj.type === 'light' || currentThemeObj.type === 'dark')) {
            setViewMode(currentThemeObj.type);
        }
    }, [currentThemeObj]);

    // 2. Group Themes by Base Name
    // This useMemo is now unconditional at the top level
    const baseThemes = React.useMemo(() => {
        const map = new Map<string, { light?: string, dark?: string, name: string, colors: any }>();
        availableThemes.forEach(t => {
            const baseName = t.name.replace(/ \((Light|Dark)\)/, '');
            if (!map.has(baseName)) {
                map.set(baseName, { name: baseName, colors: t.colors });
            }
            const entry = map.get(baseName)!;
            if (t.type === 'light') entry.light = t.id;
            else entry.dark = t.id;
        });
        return Array.from(map.values());
    }, [availableThemes]);

    // Helper to switch mode
    const toggleMode = () => {
        const newMode = viewMode === 'light' ? 'dark' : 'light';
        setViewMode(newMode);

        // Try to switch current theme to the new mode variant
        const currentBaseName = currentThemeObj?.name.replace(/ \((Light|Dark)\)/, '');
        const baseMatch = baseThemes.find(b => b.name === currentBaseName);

        if (baseMatch) {
            const targetId = newMode === 'light' ? baseMatch.light : baseMatch.dark;
            if (targetId) setTheme(targetId);
        }
    };



    const handleBrowseDefaultDir = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                defaultPath: defaultExportPath || undefined
            });
            if (selected && typeof selected === 'string') {
                setDefaultExportPath(selected);
            }
        } catch (err) {
            console.error('Failed to open directory picker:', err);
        }
    };

    if (!isOpen) return null;




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
                        <RiCloseLine size={24} />
                    </button>
                </div>

                {/* Content Area */}
                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {/* Sidebar */}
                    <div style={{ width: '250px', borderRight: '1px solid var(--border-color)', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                        {tabs.map(tab => (
                            renderSidebarItem(tab.id, tab.label, tab.icon)
                        ))}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>
                        {activeTab === 'theme' && (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <h3 style={{ fontSize: '1.5rem', margin: 0 }}>Application Theme</h3>

                                    {/* Mode Toggle Switch */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontSize: '0.9rem', color: viewMode === 'light' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>Light</span>
                                        <div
                                            onClick={toggleMode}
                                            style={{
                                                width: '44px',
                                                height: '24px',
                                                background: viewMode === 'dark' ? 'var(--accent-primary)' : '#ccc',
                                                borderRadius: '24px',
                                                position: 'relative',
                                                cursor: 'pointer',
                                                transition: 'background 0.3s'
                                            }}
                                        >
                                            <div style={{
                                                width: '18px',
                                                height: '18px',
                                                background: 'white',
                                                borderRadius: '50%',
                                                position: 'absolute',
                                                top: '3px',
                                                left: viewMode === 'dark' ? '23px' : '3px',
                                                transition: 'left 0.3s',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                                            }} />
                                        </div>
                                        <span style={{ fontSize: '0.9rem', color: viewMode === 'dark' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>Dark</span>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
                                    {baseThemes.map(base => {
                                        const targetId = viewMode === 'light' ? base.light : base.dark;
                                        // Use optional chaining for safe access
                                        const isActive = currentThemeObj?.name?.replace(/ \((Light|Dark)\)/, '') === base.name;

                                        // If a theme doesn't have a variant for the current mode, disable it or show placeholder
                                        if (!targetId) return null;

                                        // Find the actual theme object for colors to render correct preview
                                        const themeObj = availableThemes.find(t => t.id === targetId);

                                        return (
                                            <div
                                                key={base.name}
                                                onClick={() => setTheme(targetId)}
                                                style={{
                                                    padding: '15px',
                                                    borderRadius: '8px',
                                                    border: `2px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                                                    cursor: 'pointer',
                                                    backgroundColor: themeObj?.colors.bg || base.colors.bg,
                                                    color: themeObj?.colors.text || base.colors.text,
                                                    position: 'relative',
                                                    overflow: 'hidden',
                                                    opacity: isActive ? 1 : 0.8
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: themeObj?.colors.accent || base.colors.accent }} />
                                                    <span style={{ fontWeight: 500 }}>{base.name}</span>
                                                </div>
                                                <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                                                    {base.light && base.dark ? 'Auto-Switchable' : (viewMode === 'light' ? 'Light Only' : 'Dark Only')}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {
                            activeTab === 'scaling' && (
                                <div>
                                    <h3 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>Display Interface Scaling</h3>

                                    <div style={{ marginBottom: '30px' }}>
                                        <label style={{ display: 'block', marginBottom: '10px', color: 'var(--text-secondary)' }}>Scale Factor</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                            <button onClick={() => setZoom(Math.max(0.7, zoom - 0.1))} className={styles.zoomBtn}>
                                                <RiZoomOutLine size={16} />
                                            </button>
                                            <input
                                                type="range"
                                                min="0.7"
                                                max="1.5"
                                                step="0.05"
                                                value={zoom}
                                                onChange={(e) => setZoom(parseFloat(e.target.value))}
                                                style={{
                                                    flex: 1,
                                                    maxWidth: '200px',
                                                    cursor: 'pointer',
                                                    accentColor: 'var(--accent-primary)'
                                                }}
                                            />
                                            <span style={{ minWidth: '3rem', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
                                            <button onClick={() => setZoom(Math.min(1.5, zoom + 0.1))} className={styles.zoomBtn}>
                                                <RiZoomInLine size={16} />
                                            </button>
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
                                        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', marginBottom: `${(zoom - 1) * 80}px` }}>
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
                                                This is how your interface text will appear at {Math.round(zoom * 100)}% scale.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        }

                        {
                            activeTab === 'directories' && (
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
                                                readOnly
                                            />
                                            <button className={styles.browseBtn} onClick={handleBrowseDefaultDir}>
                                                <RiFolderOpenLine size={16} /> Browse
                                            </button>
                                        </div>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                                            Files will be saved in the following structure:<br />
                                            <code style={{ background: 'var(--bg-tertiary)', padding: '2px 4px', borderRadius: '4px' }}>SQL-UI-APP &gt; [Connection Name] &gt; [Database Name] &gt; [Type]</code>
                                        </p>
                                    </div>
                                </div>
                            )
                        }

                        {
                            activeTab === 'settings' && (
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
                            )
                        }
                    </div>
                </div>
            </div>
        </div>
    );
};
