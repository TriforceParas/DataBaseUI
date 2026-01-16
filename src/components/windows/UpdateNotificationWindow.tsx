import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-shell';
import { relaunch } from '@tauri-apps/plugin-process';
import { RiRefreshLine } from 'react-icons/ri';
import { applyTheme, getSavedTheme } from '../../utils/themeUtils';
import { getPendingUpdate, clearPendingUpdate } from '../../utils/updateManager';

export const UpdateNotificationWindow = () => {
    const [currentVersion, setCurrentVersion] = useState("0.0.0");
    const [newVersion, setNewVersion] = useState("0.0.0");
    const [isUpdating, setIsUpdating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState("");

    useEffect(() => {
        const savedTheme = getSavedTheme();
        applyTheme(savedTheme);
        getCurrentWindow().center();
        getCurrentWindow().setFocus();

        const unlisten = listen('update-available', (event: any) => {
            const { current, new: newly } = event.payload;
            if (current) setCurrentVersion(current);
            if (newly) setNewVersion(newly);
        });

        const params = new URLSearchParams(window.location.search);
        const c = params.get('current');
        const n = params.get('new');
        if (c) setCurrentVersion(c);
        if (n) setNewVersion(n);

        return () => {
            unlisten.then(f => f());
        };
    }, []);

    const handleUpdate = async () => {
        const update = getPendingUpdate();
        if (!update) {
            setStatusText("Error: No update available");
            return;
        }

        setIsUpdating(true);
        setStatusText("Starting download...");

        try {
            let downloaded = 0;
            let contentLength = 0;

            await update.downloadAndInstall((event) => {
                switch (event.event) {
                    case 'Started':
                        contentLength = event.data.contentLength || 0;
                        setStatusText(`Downloading... 0%`);
                        break;
                    case 'Progress':
                        downloaded += event.data.chunkLength;
                        const percent = contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : 0;
                        setProgress(percent);
                        setStatusText(`Downloading... ${percent}%`);
                        break;
                    case 'Finished':
                        setProgress(100);
                        setStatusText("Installing update...");
                        break;
                }
            });

            setStatusText("Restarting...");
            clearPendingUpdate();

            // Short delay before restart
            setTimeout(async () => {
                await relaunch();
            }, 1000);

        } catch (e) {
            console.error("Update failed:", e);
            setStatusText(`Error: ${e}`);
            setIsUpdating(false);
        }
    };

    const handleLater = async () => {
        if (!isUpdating) {
            clearPendingUpdate();
            await getCurrentWindow().close();
        }
    };

    const openChangelog = async () => {
        if (!isUpdating) {
            try {
                await open('https://github.com/TriforceParas/DataBaseUI/releases');
            } catch (e) {
                console.error('Failed to open link:', e);
            }
        }
    };

    return (
        <div style={{
            height: '100vh',
            width: '100vw',
            display: 'flex',
            flexDirection: 'column',
            padding: '16px 24px',
            boxSizing: 'border-box',
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
            userSelect: 'none',
            overflow: 'hidden'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>

                {/* Icon Circle */}
                <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary, var(--accent-primary)) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '20px',
                    flexShrink: 0
                }}>
                    <RiRefreshLine size={24} color="#ffffff" />
                </div>

                {/* Main Text Content */}
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Update Available</h2>

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '12px',
                            fontWeight: '600',
                            background: 'var(--bg-secondary)',
                            padding: '2px 10px',
                            borderRadius: '99px',
                            border: '1px solid var(--border-color)'
                        }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{currentVersion}</span>
                            <span style={{ color: 'var(--text-tertiary)' }}>&rarr;</span>
                            <span style={{ color: 'var(--success, #10b981)' }}>{newVersion}</span>
                        </div>
                    </div>

                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        A new version is ready to install. Update now for the latest features.
                    </p>
                </div>
            </div>

            {/* Footer Row */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: '1px solid var(--border-color)'
            }}>
                {/* Left: Changelog or Status Text */}
                <div style={{ fontSize: '13px' }}>
                    {isUpdating ? (
                        <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                            {statusText}
                        </span>
                    ) : (
                        <span
                            onClick={openChangelog}
                            style={{
                                color: 'var(--accent-primary)',
                                cursor: 'pointer',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                        >
                            View Changelog
                        </span>
                    )}
                </div>

                {/* Right: Buttons or Progress Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '200px', justifyContent: 'flex-end' }}>
                    {isUpdating ? (
                        <div style={{
                            width: '100%',
                            height: '6px',
                            background: 'var(--bg-tertiary)',
                            borderRadius: '3px',
                            overflow: 'hidden',
                            position: 'relative'
                        }}>
                            <div style={{
                                width: `${progress}%`,
                                height: '100%',
                                background: 'var(--accent-primary)',
                                transition: 'width 0.2s linear'
                            }} />
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={handleLater}
                                style={{
                                    padding: '6px 16px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-secondary)',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                            >
                                Later
                            </button>
                            <button
                                onClick={handleUpdate}
                                style={{
                                    padding: '6px 16px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: 'var(--accent-primary)',
                                    color: '#ffffff',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                                    transition: 'transform 0.1s'
                                }}
                                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
                                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                Update Now
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
