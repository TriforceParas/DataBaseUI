import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import styles from '../styles/ConnectionForm.module.css';
import { Connection } from '../types';

interface ConnectionFormProps {
    connectionToEdit?: Connection | null;
    onSuccess: () => void;
    onCancel: () => void;
}

export const ConnectionForm: React.FC<ConnectionFormProps> = ({ connectionToEdit, onSuccess }) => {
    // Form State
    const [newConnName, setNewConnName] = useState('');
    const [newConnStr, setNewConnStr] = useState('');
    const [error, setError] = useState<string | null>(null);

    const [newConnProp, setNewConnProp] = useState({
        protocol: '',
        host: 'localhost',
        port: '5432',
        username: 'postgres',
        password: '',
        database: 'postgres'
    });
    const [useUrlMode, setUseUrlMode] = useState(false);

    // Init Logic
    useEffect(() => {
        if (connectionToEdit) {
            setNewConnName(connectionToEdit.name);
            setNewConnStr(connectionToEdit.connection_string);
            const parsed = parseConnectionString(connectionToEdit.connection_string);
            if (parsed) {
                setNewConnProp(parsed);
                setUseUrlMode(false);
            } else {
                setUseUrlMode(true);
            }
        } else {
            // Reset logic could go here if needed
        }
    }, [connectionToEdit]);

    const parseConnectionString = (str: string) => {
        try {
            const regex = /^([a-z0-9]+):\/\/([^:]+)(?::([^@]+))?@([^:]+):(\d+)\/(.+)$/;
            const match = str.match(regex);

            if (match) {
                return {
                    protocol: match[1],
                    username: match[2],
                    password: match[3] || '',
                    host: match[4],
                    port: match[5],
                    database: match[6]
                };
            }

            const simpleRegex = /^([a-z0-9]+):\/\/([^@]+)@([^:]+):(\d+)\/(.+)$/;
            const simpleMatch = str.match(simpleRegex);
            if (simpleMatch) {
                return {
                    protocol: simpleMatch[1],
                    username: simpleMatch[2],
                    password: '',
                    host: simpleMatch[3],
                    port: simpleMatch[4],
                    database: simpleMatch[5]
                };
            }

            if (str.startsWith('sqlite://')) {
                return {
                    protocol: 'sqlite',
                    host: '',
                    port: '',
                    username: '',
                    password: '',
                    database: str.replace('sqlite://', '')
                };
            }
            return null;
        } catch (e) {
            console.error(e);
            return null;
        }
    };

    // Auto-generate connection string in builder mode
    useEffect(() => {
        if (!useUrlMode) {
            const { protocol, host, port, username, password, database } = newConnProp;
            if (!protocol) {
                // Don't clear if editing initial load? No, builder should drive string.
                // But avoid clearing if we just switched FROM url mode without changes?
                // Logic: One way sync if builder active.
                if (newConnName === '' && newConnStr !== '') return; // rudimentary check
                // return;
            }
            if (!protocol) return;

            let str = `${protocol}://`;
            if (username || password) {
                str += `${username}${password ? `:${password}` : ''}@`;
            }
            str += `${host}:${port}/${database}`;

            // Should valid sqlite be handled differently?
            if (protocol === 'sqlite') {
                str = `sqlite://${database}`;
            }

            setNewConnStr(str);
        }
    }, [newConnProp, useUrlMode]);

    const switchToFormBuilder = () => {
        const parsed = parseConnectionString(newConnStr);
        if (parsed) {
            setNewConnProp(parsed);
        }
        setUseUrlMode(false);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            if (connectionToEdit) {
                await invoke('update_connection', { id: connectionToEdit.id, name: newConnName, connectionString: newConnStr });
            } else {
                await invoke('save_connection', { name: newConnName, connectionString: newConnStr });
            }
            onSuccess();
        } catch (e) {
            console.error("Failed to save:", e);
            setError(typeof e === 'string' ? e : `Failed to save: ${JSON.stringify(e)}`);
        }
    };

    return (
        <form className={styles.form} onSubmit={handleSave}>
            <h3 className={styles.sectionTitle}>
                {connectionToEdit ? 'Edit Connection' : 'Add Connection'}
            </h3>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <button
                    type="button"
                    className={styles.addButton}
                    style={{ opacity: !useUrlMode ? 1 : 0.5, flex: 1 }}
                    onClick={switchToFormBuilder}
                >
                    Form Builder
                </button>
                <button
                    type="button"
                    className={styles.addButton}
                    style={{ opacity: useUrlMode ? 1 : 0.5, flex: 1 }}
                    onClick={() => setUseUrlMode(true)}
                >
                    Raw URL
                </button>
            </div>

            <input
                className={styles.input}
                placeholder="Connection Name"
                value={newConnName}
                onChange={e => setNewConnName(e.target.value)}
                required
            />

            {!useUrlMode ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <select
                        className={styles.input}
                        value={newConnProp.protocol}
                        onChange={e => setNewConnProp({ ...newConnProp, protocol: e.target.value })}
                    >
                        <option value="" disabled>DB Engine</option>
                        <option value="postgres">PostgreSQL</option>
                        <option value="mysql">MySQL</option>
                        <option value="sqlite">SQLite</option>
                    </select>
                    <input
                        className={styles.input}
                        placeholder="Host"
                        value={newConnProp.host}
                        onChange={e => setNewConnProp({ ...newConnProp, host: e.target.value })}
                        disabled={newConnProp.protocol === 'sqlite'}
                    />
                    <input
                        className={styles.input}
                        placeholder="Port"
                        value={newConnProp.port}
                        onChange={e => setNewConnProp({ ...newConnProp, port: e.target.value })}
                        disabled={newConnProp.protocol === 'sqlite'}
                    />
                    <input
                        className={styles.input}
                        placeholder="Database"
                        value={newConnProp.database}
                        onChange={e => setNewConnProp({ ...newConnProp, database: e.target.value })}
                    />
                    <input
                        className={styles.input}
                        placeholder="Username"
                        value={newConnProp.username}
                        onChange={e => setNewConnProp({ ...newConnProp, username: e.target.value })}
                        disabled={newConnProp.protocol === 'sqlite'}
                    />
                    <input
                        type="password"
                        className={styles.input}
                        placeholder="Password"
                        value={newConnProp.password}
                        onChange={e => setNewConnProp({ ...newConnProp, password: e.target.value })}
                        disabled={newConnProp.protocol === 'sqlite'}
                    />
                </div>
            ) : (
                <input
                    className={styles.input}
                    placeholder="Connection String (e.g., sqlite://file.db)"
                    value={newConnStr}
                    onChange={e => setNewConnStr(e.target.value)}
                    required
                />
            )}

            {!useUrlMode && (
                <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '1rem', wordBreak: 'break-all' }}>
                    Preview: {newConnStr}
                </div>
            )}

            <button type="submit" className={styles.addButton}>
                {connectionToEdit ? 'Update Connection' : 'Save Connection'}
            </button>

            {error && (
                <div style={{ color: '#ff4d4d', marginTop: '1rem', fontSize: '0.9rem', padding: '0.5rem', border: '1px solid #ff4d4d', borderRadius: '4px', backgroundColor: 'rgba(255, 77, 77, 0.1)' }}>
                    ⚠️ {error}
                </div>
            )}
        </form>
    );
};
