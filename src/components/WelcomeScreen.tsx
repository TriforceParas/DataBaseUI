import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import styles from '../styles/Welcome.module.css';
import { Connection } from '../types';
import { Pencil, Trash2 } from 'lucide-react';
import { ConnectionForm } from './ConnectionForm';

interface WelcomeScreenProps {
    onConnect: (connection: Connection) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onConnect }) => {
    const [connections, setConnections] = useState<Connection[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Keep track of connection being edited
    const [connectionToEdit, setConnectionToEdit] = useState<Connection | null>(null);

    const fetchConnections = async () => {
        try {
            const conns = await invoke<Connection[]>('list_connections');
            setConnections(conns);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchConnections();
        getCurrentWindow().center();
    }, []);

    const handleEdit = (conn: Connection) => {
        setConnectionToEdit(conn);
        setEditId(conn.id);
        setShowForm(true);
        setError(null);
    };

    const handleFormSuccess = () => {
        setShowForm(false);
        setEditId(null);
        setConnectionToEdit(null);
        fetchConnections();
    };

    const handleFormCancel = () => {
        setShowForm(false);
        setEditId(null);
        setConnectionToEdit(null);
    };

    const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

    const handleDeleteClick = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        setDeleteTargetId(id);
    };

    const confirmDelete = async () => {
        if (deleteTargetId) {
            try {
                await invoke('delete_connection', { id: deleteTargetId });
                fetchConnections();
            } catch (err) {
                console.error(err);
            } finally {
                setDeleteTargetId(null);
            }
        }
    };

    const toggleForm = () => {
        if (showForm) {
            handleFormCancel();
        } else {
            setShowForm(true);
            setConnectionToEdit(null);
            setError(null);
        }
    };

    const handleConnect = async (conn: Connection) => {
        setError(null);
        setIsConnecting(true);
        try {
            await invoke('verify_connection', { connectionString: conn.connection_string });
            onConnect(conn);
        } catch (e) {
            console.error("Failed to connect:", e);
            setError(typeof e === 'string' ? e : `Failed to connect: ${JSON.stringify(e)}`);
        } finally {
            setIsConnecting(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.leftPanel}>
                <h1 className={styles.title}>DB+</h1>
                <p className={styles.subtitle}>Premium SQL Client</p>
                <div style={{ marginTop: '2rem', fontSize: '5rem', color: 'var(--accent-primary)' }}>
                    ❖
                </div>
            </div>
            <div className={styles.rightPanel}>
                <div className={styles.headerContainer}>
                    <h2 className={styles.sectionTitle} style={{ marginBottom: 0 }}>Saved Connections</h2>
                    <button
                        className={`${styles.addButton} ${showForm ? styles.closeButton : ''}`}
                        onClick={toggleForm}
                    >
                        {showForm ? 'X Close' : '+ New Connection'}
                    </button>
                </div>

                {/* Form opens on top */}
                {showForm && (
                    <div style={{ marginBottom: '1.5rem' }}>
                        <ConnectionForm
                            connectionToEdit={connectionToEdit}
                            onSuccess={handleFormSuccess}
                            onCancel={handleFormCancel}
                        />
                    </div>
                )}

                {error && (
                    <div style={{ color: '#ff4d4d', marginBottom: '1rem', fontSize: '0.9rem', padding: '0.5rem', border: '1px solid #ff4d4d', borderRadius: '4px', backgroundColor: 'rgba(255, 77, 77, 0.1)' }}>
                        ⚠️ {error}
                    </div>
                )}

                {isConnecting && (
                    <div style={{ color: 'var(--accent-primary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                        Connecting<span className={styles.dots}></span>
                    </div>
                )}

                <div className={styles.connectionList}>
                    {connections.map(conn => (
                        <div
                            key={conn.id}
                            className={styles.connectionItem}
                            onClick={() => handleConnect(conn)}
                            style={{ pointerEvents: isConnecting ? 'none' : 'auto', opacity: isConnecting ? 0.7 : 1 }}
                        >
                            <div>
                                <strong>{conn.name}</strong>
                                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{conn.connection_string}</div>
                            </div>
                            <div className={styles.actionButtons}>
                                <button
                                    className={styles.actionIcon}
                                    onClick={(e) => { e.stopPropagation(); handleEdit(conn); }}
                                    title="Edit"
                                >
                                    <Pencil size={14} />
                                </button>
                                <button
                                    className={styles.actionIcon}
                                    onClick={(e) => handleDeleteClick(e, conn.id)}
                                    title="Delete"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {connections.length === 0 && !showForm && (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>
                            No connections yet. Click "+ New Connection" to start.
                        </p>
                    )}
                </div>

                {deleteTargetId && (
                    <div className={styles.modalOverlay} onClick={() => setDeleteTargetId(null)}>
                        <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                            <h3 className={styles.sectionTitle}>Delete Connection?</h3>
                            <p style={{ color: 'var(--text-secondary)' }}>
                                Are you sure you want to delete this connection? This action cannot be undone.
                            </p>
                            <div className={styles.modalActions}>
                                <button className={styles.cancelButton} onClick={() => setDeleteTargetId(null)}>Cancel</button>
                                <button className={styles.deleteButton} onClick={confirmDelete}>Delete</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
