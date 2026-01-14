import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import styles from '../styles/Welcome.module.css';
import { Connection, DbType } from '../types/index';
import { RiEdit2Line, RiDeleteBin7Line, RiAddLine, RiShieldKeyholeLine } from 'react-icons/ri';
import { openConnectionWindow, openVaultWindow } from '../utils/windowManager';
import { DiMysql } from 'react-icons/di';
import { BiLogoPostgresql } from 'react-icons/bi';
import { SiSqlite } from 'react-icons/si';

const getDbIcon = (dbType: DbType) => {
    switch (dbType) {
        case 'mysql': return <DiMysql size={30} color="#00758F" />;
        case 'postgres': return <BiLogoPostgresql size={30} color="#336791" />;
        case 'sqlite': return <SiSqlite size={26} color="#003B57" />;
        default: return <DiMysql size={30} color="#00758F" />;
    }
};

const formatConnectionDisplay = (conn: Connection): string => {
    if (conn.db_type === 'sqlite') {
        const parts = conn.host.split('/');
        return parts[parts.length - 1] || conn.host;
    }
    let display = `${conn.host}:${conn.port}`;
    if (conn.database_name) {
        display += `/${conn.database_name}`;
    }
    return display;
};

interface WelcomeScreenProps {
    onConnect: (connection: Connection) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onConnect }) => {
    const [connections, setConnections] = useState<Connection[]>([]);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchConnections = async () => {
        try {
            const conns = await invoke<Connection[]>('list_connections');
            setConnections(conns);
        } catch (e) {
            console.error(e);
        }
    };

    // Auto-refresh when window gains focus (e.g. after adding connection)
    useEffect(() => {
        fetchConnections();
        getCurrentWindow().center();

        const unlisten = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
            if (focused) fetchConnections();
        });

        return () => {
            unlisten.then(f => f());
        };
    }, []);

    const handleEdit = (conn: Connection) => {
        openConnectionWindow(conn.id);
    };

    const handleDeleteClick = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        setDeleteTargetId(id);
    };

    const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

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

    const openNewConnection = () => {
        openConnectionWindow();
    };

    const handleConnect = async (conn: Connection) => {
        setError(null);
        setIsConnecting(true);
        try {
            // Check connection first
            await invoke('verify_connection_by_id', { connectionId: conn.id });
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

            {/* Right Panel - Connections */}
            <div className={styles.rightPanel}>
                <div className={styles.headerRow}>
                    <h2 className={styles.sectionTitle}>Recent Connections</h2>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className={styles.newBtn} onClick={openNewConnection}>
                            <RiAddLine size={18} /> New Connection
                        </button>
                    </div>
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

                {/* Connections List */}
                <div className={styles.connectionList}>
                    {connections.map(conn => (
                        <div key={conn.id} className={styles.connectionCard} onClick={() => handleConnect(conn)}>
                            <div className={styles.iconPlaceholder}>
                                {getDbIcon(conn.db_type)}
                            </div>
                            <div className={styles.cardDetails}>
                                <div className={styles.cardTitle}>{conn.name}</div>
                                <div className={styles.cardSubtitle}>{formatConnectionDisplay(conn)}</div>
                            </div>

                            <div className={styles.cardActions}>
                                <button className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); handleEdit(conn); }}>
                                    <RiEdit2Line size={16} />
                                </button>
                                <button className={styles.actionBtn} onClick={(e) => handleDeleteClick(e, conn.id)}>
                                    <RiDeleteBin7Line size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {connections.length === 0 && (
                        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
                            <div style={{ marginBottom: '1rem' }}>No recent connections.</div>
                            <button className={styles.newBtn} onClick={openNewConnection}>
                                Create First Connection
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className={styles.footer}>
                    <div>Version 0.1.0</div>
                    <div className={styles.footerRight}>
                        <div
                            className={styles.testConnection}
                            onClick={openVaultWindow}
                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            <RiShieldKeyholeLine size={16} /> Credential Vault
                        </div>
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal - Kept minimal for safety */}
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
