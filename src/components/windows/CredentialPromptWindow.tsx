import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { RiShieldKeyholeLine, RiLockPasswordLine, RiUserLine } from 'react-icons/ri';

export const CredentialPromptWindow: React.FC = () => {
    const params = new URLSearchParams(window.location.search);
    const connectionId = params.get('connectionId');
    const connectionName = params.get('name') || 'Database';

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConnect = async () => {
        if (!username || !password) {
            setError("Both fields are required");
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            await invoke('verify_connection_manual', {
                connectionId: Number(connectionId),
                username,
                password
            });

            // If successful, open the main window with these credentials
            await invoke('open_connection_window', {
                connectionId: Number(connectionId),
                username,
                password
            });

            // Close this window
            import('@tauri-apps/api/window').then(win => {
                win.getCurrentWindow().close();
            });

        } catch (e) {
            setError(typeof e === 'string' ? e : "Connection failed");
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div style={{
            height: '100vh',
            background: '#1a1b1e',
            color: '#e2e8f0',
            fontFamily: 'Inter, sans-serif',
            display: 'flex',
            flexDirection: 'column',
            padding: '2rem'
        }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <RiShieldKeyholeLine size={48} color="#fbbf24" style={{ marginBottom: '1rem' }} />
                <h1 style={{ fontSize: '1.25rem', margin: '0 0 0.5rem 0' }}>Credentials Required</h1>
                <p style={{ fontSize: '0.9rem', color: '#a0aec0', margin: 0 }}>
                    Enter credentials for <strong>{connectionName}</strong>
                </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e0', marginBottom: '0.5rem' }}>Username</label>
                    <div style={{ position: 'relative' }}>
                        <RiUserLine style={{ position: 'absolute', left: '12px', top: '12px', color: '#718096' }} />
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Username"
                            style={{
                                width: '100%',
                                padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                                background: '#2d3748',
                                border: '1px solid #4a5568',
                                borderRadius: '8px',
                                color: 'white',
                                outline: 'none'
                            }}
                        />
                    </div>
                </div>

                <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e0', marginBottom: '0.5rem' }}>Password</label>
                    <div style={{ position: 'relative' }}>
                        <RiLockPasswordLine style={{ position: 'absolute', left: '12px', top: '12px', color: '#718096' }} />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            style={{
                                width: '100%',
                                padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                                background: '#2d3748',
                                border: '1px solid #4a5568',
                                borderRadius: '8px',
                                color: 'white',
                                outline: 'none'
                            }}
                        />
                    </div>
                </div>

                {error && (
                    <div style={{ color: '#fc8181', fontSize: '0.85rem', textAlign: 'center' }}>
                        {error}
                    </div>
                )}

                <button
                    disabled={isSaving}
                    onClick={handleConnect}
                    style={{
                        marginTop: '1rem',
                        background: '#3182ce',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '0.8rem',
                        fontWeight: 600,
                        cursor: isSaving ? 'not-allowed' : 'pointer',
                        opacity: isSaving ? 0.7 : 1,
                        transition: 'background 0.2s'
                    }}
                >
                    {isSaving ? 'Connecting...' : 'Connect to Database'}
                </button>
            </div>

            <p style={{ fontSize: '0.75rem', color: '#718096', textAlign: 'center', marginTop: 'auto' }}>
                Credentials entered here are not stored.
            </p>
        </div>
    );
};
