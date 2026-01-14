import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Connection, Credential, DbType } from '../../types';
import styles from '../../styles/Welcome.module.css';
import { RiCheckLine } from 'react-icons/ri';
import { CiFloppyDisk } from 'react-icons/ci';
import { IoFlaskOutline } from 'react-icons/io5';
import { openErrorWindow, openVaultWindow } from '../../utils/windowManager';
import { DiMysql } from 'react-icons/di';
import { BiLogoPostgresql } from 'react-icons/bi';
import { SiSqlite } from 'react-icons/si';

export const ConnectionWindow: React.FC = () => {
    // Parse connection ID from URL
    const params = new URLSearchParams(window.location.search);
    const connectionId = params.get('id');

    // State

    const [dbType, setDbType] = useState<DbType>('mysql');
    const [name, setName] = useState('');
    const [host, setHost] = useState('localhost');
    const [port, setPort] = useState(3306);
    const [databaseName, setDatabaseName] = useState('');
    const [credentialId, setCredentialId] = useState<string | undefined>();
    const [sslMode, setSslMode] = useState('');

    // Credential List
    const [credentials, setCredentials] = useState<Credential[]>([]);

    // UI State
    const [isLoading, setIsLoading] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testSuccess, setTestSuccess] = useState<boolean | null>(null);

    // Reset status on any change
    const resetStatus = () => {
        setTestSuccess(null);
    };

    // Initial Load
    useEffect(() => {
        fetchCredentials();
        if (connectionId) {
            loadConnection(parseInt(connectionId));
        }
    }, [connectionId]);

    // Update default port
    useEffect(() => {
        if (!connectionId) {
            const defaultPorts: Record<DbType, number> = {
                mysql: 3306,
                postgres: 5432,
                sqlite: 0
            };
            setPort(defaultPorts[dbType]);
        }
    }, [dbType, connectionId]);

    const fetchCredentials = async () => {
        try {
            const creds = await invoke<Credential[]>('list_credentials');
            setCredentials(creds);
        } catch (e) {
            console.error(e);
        }
    };

    const loadConnection = async (id: number) => {
        try {
            // Need a command to get connection by ID or list and find
            // Using list_connections for simplicity for now
            const conns = await invoke<Connection[]>('list_connections');
            const target = conns.find(c => c.id === id);
            if (target) {
                setDbType(target.db_type);
                setName(target.name);
                setHost(target.host);
                setPort(target.port);
                setDatabaseName(target.database_name || '');
                setCredentialId(target.credential_id);
                setSslMode(target.ssl_mode || '');
            }
        } catch (e) {
            console.error(e);
            openErrorWindow("Failed to load connection data", typeof e === 'string' ? e : 'An unknown error occurred.');
        }
    };

    const buildConnectionString = (): string => {
        if (dbType === 'sqlite') {
            return `sqlite://${host}`;
        }

        let url = `${dbType}://`;

        // Get credentials if selected
        if (credentialId) {
            const cred = credentials.find(c => c.id === credentialId);
            if (cred) {
                // Note: For testing, this is unsafe if cred is logged
                // Backend should ideally handle 'verify_with_creds'
                url += `${cred.username}@`;
            }
        }
        url += `${host}:${port}`;
        if (databaseName) url += `/${databaseName}`;
        if (sslMode) url += `?sslmode=${sslMode}`;

        return url;
    };

    const handleTestConnection = async () => {
        setIsTesting(true);
        setTestSuccess(null);

        try {
            const tempConnStr = buildConnectionString();
            // Pass credentialId separately so backend can inject password securely
            await invoke('verify_connection', {
                connectionString: tempConnStr,
                credentialId: credentialId
            });
            setTestSuccess(true);
        } catch (e) {
            setTestSuccess(false);
            const msg = typeof e === 'string' ? e : 'Connection test failed';
            // Show inline error for small feedback, but also open window if critical

            // Open separate Error Window as requested
            openErrorWindow('Connection Failed', msg);
        } finally {
            setIsTesting(false);
        }
    };

    const handleSave = async () => {
        if (!name || !host) {
            openErrorWindow('Validation Error', 'Name and Host are required');
            return;
        }

        setIsLoading(true);

        try {
            if (connectionId) {
                await invoke('update_connection', {
                    id: parseInt(connectionId),
                    name,
                    dbType,
                    host,
                    port,
                    databaseName: databaseName || null,
                    credentialId: credentialId || null,
                    sslMode: sslMode || null
                });
            } else {
                await invoke('save_connection', {
                    name,
                    dbType,
                    host,
                    port,
                    databaseName: databaseName || null,
                    credentialId: credentialId || null,
                    sslMode: sslMode || null
                });
            }
            // Close window on success
            const win = getCurrentWindow();
            await win.close();
        } catch (e) {
            const msg = typeof e === 'string' ? e : 'Failed to save connection';
            openErrorWindow('Save Failed', msg);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = async () => {
        const win = getCurrentWindow();
        await win.close();
    };

    const handleOpenVault = () => {
        openVaultWindow();
    };

    return (
        <div style={{
            height: '100vh',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'Inter, system-ui, sans-serif'
        }}>
            <h2 className={styles.sectionTitle} style={{ marginBottom: '1.5rem' }}>
                {connectionId ? 'Edit Connection' : 'New Connection'}
            </h2>

            <div style={{ flex: 1, overflowY: 'auto' }}>
                {/* Database Type */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>
                        Database Type
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {(['mysql', 'postgres', 'sqlite'] as DbType[]).map(type => (
                            <button
                                key={type}
                                onClick={() => setDbType(type)}
                                style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    border: `2px solid ${dbType === type ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                                    borderRadius: '8px',
                                    background: dbType === type ? 'var(--accent-primary)15' : 'var(--bg-tertiary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    color: 'var(--text-primary)',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                {type === 'mysql' && <DiMysql size={36} color="#00758F" />}
                                {type === 'postgres' && <BiLogoPostgresql size={36} color="#336791" />}
                                {type === 'sqlite' && <SiSqlite size={32} color="#003B57" />}
                                <span style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>
                                    {type === 'postgres' ? 'PostgreSQL' : type === 'mysql' ? 'MySQL' : 'SQLite'}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Form Fields */}
                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>
                        Connection Name
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={e => { setName(e.target.value); resetStatus(); }}
                        placeholder="My Database"
                        style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                    />
                </div>

                {dbType !== 'sqlite' ? (
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                        <div style={{ flex: 2 }}>
                            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>Host</label>
                            <input
                                type="text"
                                value={host}
                                onChange={e => { setHost(e.target.value); resetStatus(); }}
                                placeholder="localhost"
                                style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>Port</label>
                            <input
                                type="number"
                                value={port}
                                onChange={e => { setPort(parseInt(e.target.value) || 0); resetStatus(); }}
                                style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                            />
                        </div>
                    </div>
                ) : (
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>Database File Path</label>
                        <input
                            type="text"
                            value={host}
                            onChange={e => { setHost(e.target.value); resetStatus(); }}
                            placeholder="/path/to/database.db"
                            style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                        />
                    </div>
                )}

                {dbType !== 'sqlite' && (
                    <>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>
                                Database Name <span style={{ color: 'var(--text-tertiary)' }}>(optional)</span>
                            </label>
                            <input
                                type="text"
                                value={databaseName}
                                onChange={e => setDatabaseName(e.target.value)}
                                placeholder="mydb"
                                style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                            />
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Credentials</label>
                                <button
                                    onClick={handleOpenVault}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--accent-primary)',
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        textDecoration: 'underline'
                                    }}
                                >
                                    Open Vault
                                </button>
                            </div>
                            <select
                                value={credentialId || ''}
                                onChange={e => setCredentialId(e.target.value || undefined)}
                                style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                            >
                                <option value="">No credentials</option>
                                {credentials.map(cred => (
                                    <option key={cred.id} value={cred.id}>🔑 {cred.name} ({cred.username})</option>
                                ))}
                            </select>
                            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                                Manage your usernames and passwords securely in the Vault.
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Error & Test Status */}
            {/* Error & Test Status (Error is now handled by popup, but we keep error state for button logic if needed) */}
            {/* Inline messages removed as per request */}

            {/* Footer Actions */}
            <div style={{ display: 'flex', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <button
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    style={{
                        flex: 1,
                        padding: '0.75rem',
                        border: testSuccess ? '1px solid #22c55e' : '1px solid var(--border-color)',
                        borderRadius: '6px',
                        background: testSuccess ? '#22c55e' : 'var(--bg-tertiary)',
                        color: testSuccess ? 'white' : 'var(--text-primary)',
                        cursor: isTesting ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s'
                    }}
                >
                    {isTesting ? (
                        <>Testing...</>
                    ) : testSuccess ? (
                        <><RiCheckLine size={20} /> Connected</>
                    ) : (
                        <><IoFlaskOutline size={20} /> Test Connection</>
                    )}
                </button>
                <div style={{ flex: 0.5 }}></div>
                <button onClick={handleCancel} style={{ flex: 1, padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    Cancel
                </button>
                <button onClick={handleSave} disabled={isLoading} style={{ flex: 1, padding: '0.75rem', border: 'none', borderRadius: '6px', background: 'var(--accent-primary)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <CiFloppyDisk size={20} /> Save
                </button>
            </div>
        </div>
    );
};
