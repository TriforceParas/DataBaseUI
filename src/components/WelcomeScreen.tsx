import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import styles from '../styles/Welcome.module.css';
import { Connection } from '../types/index';
import { Pencil, Trash2, Zap, Plus, FlaskConical } from 'lucide-react';
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
            {/* Left Panel - Branding */}
            <div className={styles.leftPanel}>
                <h1 className={styles.title}>DB+</h1>
                <p className={styles.subtitle}>Premium SQL Client</p>
                <div style={{ marginTop: '2rem', fontSize: '5rem', color: 'var(--accent-primary)' }}>
                    ❖
                </div>
            </div>

            {/* Right Panel - Form */}
            <div className={styles.rightPanel}>

                {/* Window Controls embedded nicely top right */}


                <div className={styles.headerRow}>
                    <h2 className={styles.sectionTitle}>Recent Connections</h2>
                    <button className={styles.newBtn} onClick={toggleForm}>
                        <Plus size={16} /> New
                    </button>
                </div>

                {isConnecting && (
                    <div style={{ color: 'var(--accent-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        Connecting<span className={styles.dots}></span>
                    </div>
                )}

                {error && (
                    <div style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.9rem' }}>
                        Error: {error}
                    </div>
                )}

                {/* Form */}
                {showForm && (
                    <div className={styles.formContainer}>
                        <ConnectionForm
                            connectionToEdit={connectionToEdit}
                            onSuccess={handleFormSuccess}
                            onCancel={handleFormCancel}
                        />
                    </div>
                )}

                {/* Connections List */}
                <div className={styles.connectionList}>
                    {connections.map(conn => (
                        <div key={conn.id} className={styles.connectionCard} onClick={() => handleConnect(conn)}>
                            <div className={styles.iconPlaceholder}>
                                <Zap size={20} fill="currentColor" />
                            </div>
                            <div className={styles.cardDetails}>
                                <div className={styles.cardTitle}>{conn.name}</div>
                                <div className={styles.cardSubtitle}>{conn.connection_string}</div>
                            </div>

                            <div className={styles.cardActions}>
                                <button className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); handleEdit(conn); }}>
                                    <Pencil size={14} />
                                </button>
                                <button className={styles.actionBtn} onClick={(e) => handleDeleteClick(e, conn.id)}>
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {connections.length === 0 && !showForm && (
                        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
                            No recent connections.
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className={styles.footer}>
                    <div>Version 0.1.0</div>
                    <div className={styles.footerRight}>
                        <div className={styles.testConnection}>
                            <FlaskConical size={14} /> Test Connections
                        </div>
                    </div>
                </div>
            </div>

            {/* Delete Modal */}
            {deleteTargetId && (
                <div className={styles.modalOverlay} onClick={() => setDeleteTargetId(null)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <h3 className={styles.sectionTitle} style={{ marginTop: 0 }}>Delete?</h3>
                        <p style={{ color: 'var(--text-secondary)' }}>Remove this connection?</p>
                        <div className={styles.modalActions}>
                            <button className={styles.cancelButton} onClick={() => setDeleteTargetId(null)}>Cancel</button>
                            <button className={styles.deleteButton} onClick={confirmDelete}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
