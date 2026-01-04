import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { Connection } from '../../types';
import { X, Plus, Copy, Trash2, Upload, Download, Database, Loader2, AlertTriangle, FolderOpen, ChevronRight } from 'lucide-react';

interface DatabaseManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    connection: Connection;
    onSuccess?: () => void;
    onDatabaseChange?: (dbName: string) => void;
}

type TabType = 'create' | 'import' | 'export' | 'duplicate' | 'delete';

const SYSTEM_DATABASES = ['sys', 'information_schema', 'mysql', 'performance_schema'];

export const DatabaseManagementModal: React.FC<DatabaseManagementModalProps> = ({
    isOpen, onClose, connection, onSuccess, /* onDatabaseChange */
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('create');
    const [databases, setDatabases] = useState<string[]>([]);
    const [, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);

    // Create Database
    const [newDbName, setNewDbName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Duplicate Database
    const [selectedDbToDuplicate, setSelectedDbToDuplicate] = useState('');
    const [duplicateNewName, setDuplicateNewName] = useState('');
    const [isDuplicating, setIsDuplicating] = useState(false);

    // Delete Database
    const [selectedDbToDelete, setSelectedDbToDelete] = useState('');
    const [confirmDeleteName, setConfirmDeleteName] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    // Import/Export
    const [directoryPath, setDirectoryPath] = useState('');
    const [isExecuting, setIsExecuting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchDatabases();
            setError(null);
            setLogs([]);
            setNewDbName('');
            setSelectedDbToDuplicate('');
            setDuplicateNewName('');
            setSelectedDbToDelete('');
            setConfirmDeleteName('');
            setDirectoryPath('');
        }
    }, [isOpen, connection]);

    const fetchDatabases = async () => {
        setIsLoading(true);
        try {
            const dbs = await invoke<string[]>('get_databases', { connectionString: connection.connection_string });
            const filteredDbs = dbs.filter(db => !SYSTEM_DATABASES.includes(db.toLowerCase()));
            setDatabases(filteredDbs);
        } catch (e) {
            setError(`Failed to fetch databases: ${e}`);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    const addLog = (message: string) => {
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
    };

    const handleCreateDatabase = async () => {
        if (!newDbName.trim()) return;

        if (SYSTEM_DATABASES.includes(newDbName.toLowerCase())) {
            setError('Cannot create a database with a system database name');
            return;
        }

        setIsCreating(true);
        setError(null);
        try {
            addLog(`Creating database "${newDbName}"...`);
            await invoke('create_database', {
                connectionString: connection.connection_string,
                databaseName: newDbName
            });
            addLog(`Database "${newDbName}" created successfully!`);
            setNewDbName('');
            await fetchDatabases();
            onSuccess?.();
        } catch (e) {
            setError(`Failed to create database: ${e}`);
            addLog(`Error: ${e}`);
        } finally {
            setIsCreating(false);
        }
    };

    const handleDuplicateDatabase = async () => {
        if (!selectedDbToDuplicate || !duplicateNewName.trim()) return;

        if (SYSTEM_DATABASES.includes(duplicateNewName.toLowerCase())) {
            setError('Cannot create a database with a system database name');
            return;
        }

        setIsDuplicating(true);
        setError(null);
        try {
            addLog(`Duplicating database "${selectedDbToDuplicate}" to "${duplicateNewName}"...`);
            await invoke('duplicate_database', {
                connectionString: connection.connection_string,
                sourceDatabase: selectedDbToDuplicate,
                targetDatabase: duplicateNewName
            });
            addLog(`Database duplicated successfully!`);
            setSelectedDbToDuplicate('');
            setDuplicateNewName('');
            await fetchDatabases();
            onSuccess?.();
        } catch (e) {
            setError(`Failed to duplicate database: ${e}`);
            addLog(`Error: ${e}`);
        } finally {
            setIsDuplicating(false);
        }
    };

    const handleDeleteDatabase = async () => {
        if (!selectedDbToDelete || confirmDeleteName !== selectedDbToDelete) return;

        setIsDeleting(true);
        setError(null);
        try {
            addLog(`Deleting database "${selectedDbToDelete}"...`);
            await invoke('delete_database', {
                connectionString: connection.connection_string,
                databaseName: selectedDbToDelete
            });
            addLog(`Database "${selectedDbToDelete}" deleted successfully!`);
            setSelectedDbToDelete('');
            setConfirmDeleteName('');
            await fetchDatabases();
            onSuccess?.();
        } catch (e) {
            setError(`Failed to delete database: ${e}`);
            addLog(`Error: ${e}`);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleBrowseDirectory = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: activeTab === 'export' ? 'Select Export Directory' : 'Select Import Directory'
            });

            if (selected && typeof selected === 'string') {
                setDirectoryPath(selected);
            }
        } catch (e) {
            console.error('Failed to open directory picker:', e);
        }
    };

    const handleImportExport = async () => {
        if (!directoryPath.trim()) return;

        setIsExecuting(true);
        setError(null);
        try {
            if (activeTab === 'export') {
                addLog(`Exporting schemas to "${directoryPath}"...`);
                const result = await invoke<string>('export_schema', {
                    connectionString: connection.connection_string,
                    directoryPath: directoryPath
                });
                addLog(result);
            } else {
                addLog(`Importing schemas from "${directoryPath}"...`);
                const result = await invoke<string>('import_schema', {
                    connectionString: connection.connection_string,
                    directoryPath: directoryPath
                });
                addLog(result);
            }
            onSuccess?.();
        } catch (e) {
            setError(`Operation failed: ${e}`);
            addLog(`Error: ${e}`);
        } finally {
            setIsExecuting(false);
        }
    };

    const modalOverlayStyle: React.CSSProperties = {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
    };

    const modalStyle: React.CSSProperties = {
        backgroundColor: 'var(--bg-primary)',
        borderRadius: '12px',
        width: '650px',
        minHeight: '40vh',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
        border: '1px solid var(--border-color)'
    };

    const headerStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem 1.25rem',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)'
    };

    const tabsStyle: React.CSSProperties = {
        display: 'flex',
        gap: '0.25rem',
        padding: '0.75rem 1rem',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)',
        overflowX: 'auto'
    };

    const tabStyle = (isActive: boolean): React.CSSProperties => ({
        padding: '0.5rem 0.75rem',
        borderRadius: '6px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '0.8rem',
        fontWeight: 500,
        backgroundColor: isActive ? 'var(--accent-primary)' : 'transparent',
        color: isActive ? '#fff' : 'var(--text-secondary)',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        whiteSpace: 'nowrap'
    });

    const bodyStyle: React.CSSProperties = {
        padding: '1.25rem',
        overflowY: 'auto',
        maxHeight: 'calc(80vh - 180px)'
    };

    const sectionStyle: React.CSSProperties = {
        padding: '1rem',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)'
    };

    const sectionTitleStyle: React.CSSProperties = {
        fontSize: '0.9rem',
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginBottom: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '0.6rem 0.75rem',
        borderRadius: '6px',
        border: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-tertiary)',
        color: 'var(--text-primary)',
        fontSize: '0.9rem',
        outline: 'none'
    };

    const selectStyle: React.CSSProperties = {
        width: '100%',
        padding: '0.6rem 0.75rem',
        borderRadius: '6px',
        border: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-tertiary)',
        color: 'var(--text-primary)',
        fontSize: '0.9rem',
        outline: 'none',
        cursor: 'pointer',
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.75rem center',
        paddingRight: '2rem'
    };

    const buttonStyle = (variant: 'primary' | 'danger' | 'secondary'): React.CSSProperties => ({
        padding: '0.6rem 1rem',
        borderRadius: '6px',
        border: variant === 'secondary' ? '1px solid var(--border-color)' : 'none',
        cursor: 'pointer',
        fontSize: '0.85rem',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        backgroundColor: variant === 'primary' ? 'var(--accent-primary)' :
            variant === 'danger' ? '#dc2626' : 'var(--bg-tertiary)',
        color: variant === 'secondary' ? 'var(--text-primary)' : '#fff',
        transition: 'all 0.2s ease'
    });

    const inputGroupStyle: React.CSSProperties = {
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'center'
    };

    const tabData: { id: TabType; label: string; icon: React.ReactNode }[] = [
        { id: 'create', label: 'Create', icon: <Plus size={14} /> },
        { id: 'import', label: 'Import', icon: <Upload size={14} /> },
        { id: 'export', label: 'Export', icon: <Download size={14} /> },
        { id: 'duplicate', label: 'Duplicate', icon: <Copy size={14} /> },
        { id: 'delete', label: 'Delete', icon: <Trash2 size={14} /> },
    ];

    return (
        <div style={modalOverlayStyle} onClick={onClose}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div style={headerStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Database size={20} style={{ color: 'var(--accent-primary)' }} />
                        <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Database Manager
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)',
                            padding: '0.25rem'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div style={tabsStyle}>
                    {tabData.map(tab => (
                        <button
                            key={tab.id}
                            style={tabStyle(activeTab === tab.id)}
                            onClick={() => {
                                setActiveTab(tab.id);
                                setError(null);
                            }}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div style={bodyStyle}>
                    {/* Error Display */}
                    {error && (
                        <div style={{
                            padding: '0.75rem',
                            backgroundColor: 'rgba(220, 38, 38, 0.1)',
                            border: '1px solid rgba(220, 38, 38, 0.3)',
                            borderRadius: '6px',
                            marginBottom: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            color: '#dc2626',
                            fontSize: '0.85rem'
                        }}>
                            <AlertTriangle size={16} />
                            {error}
                        </div>
                    )}

                    {/* Create Tab */}
                    {activeTab === 'create' && (
                        <div style={sectionStyle}>
                            <div style={sectionTitleStyle}>
                                <Plus size={16} /> Create New Database
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '2rem', marginTop: 0 }}>
                                Create a new empty database on the connected server.
                            </p>
                            <div style={inputGroupStyle}>
                                <input
                                    type="text"
                                    placeholder="Enter database name..."
                                    value={newDbName}
                                    onChange={(e) => setNewDbName(e.target.value)}
                                    style={{ ...inputStyle, flex: 1 }}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreateDatabase()}
                                />
                                <button
                                    style={buttonStyle('primary')}
                                    onClick={handleCreateDatabase}
                                    disabled={!newDbName.trim() || isCreating}
                                >
                                    {isCreating ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
                                    Create
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Import Tab */}
                    {activeTab === 'import' && (
                        <div style={sectionStyle}>
                            <div style={sectionTitleStyle}>
                                <Upload size={16} /> Import Schemas
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', marginTop: 0 }}>
                                Select a directory containing SQL schema files to import into the current database.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={inputGroupStyle}>
                                    <input
                                        type="text"
                                        placeholder="Select import directory..."
                                        value={directoryPath}
                                        readOnly
                                        style={{ ...inputStyle, flex: 1, cursor: 'pointer' }}
                                        onClick={handleBrowseDirectory}
                                    />
                                    <button style={buttonStyle('secondary')} onClick={handleBrowseDirectory}>
                                        <FolderOpen size={14} />
                                        Browse
                                    </button>
                                </div>
                                <button
                                    style={{ ...buttonStyle('primary'), alignSelf: 'flex-end' }}
                                    onClick={handleImportExport}
                                    disabled={!directoryPath.trim() || isExecuting}
                                >
                                    {isExecuting ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
                                    Import
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Export Tab */}
                    {activeTab === 'export' && (
                        <div style={sectionStyle}>
                            <div style={sectionTitleStyle}>
                                <Download size={16} /> Export Schemas
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', marginTop: 0 }}>
                                Export all table schemas from the current database to SQL files.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={inputGroupStyle}>
                                    <input
                                        type="text"
                                        placeholder="Select export directory..."
                                        value={directoryPath}
                                        readOnly
                                        style={{ ...inputStyle, flex: 1, cursor: 'pointer' }}
                                        onClick={handleBrowseDirectory}
                                    />
                                    <button style={buttonStyle('secondary')} onClick={handleBrowseDirectory}>
                                        <FolderOpen size={14} />
                                        Browse
                                    </button>
                                </div>
                                <button
                                    style={{ ...buttonStyle('primary'), alignSelf: 'flex-end' }}
                                    onClick={handleImportExport}
                                    disabled={!directoryPath.trim() || isExecuting}
                                >
                                    {isExecuting ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                                    Export
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Duplicate Tab */}
                    {activeTab === 'duplicate' && (
                        <div style={sectionStyle}>
                            <div style={sectionTitleStyle}>
                                <Copy size={16} /> Duplicate Database
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', marginTop: 0 }}>
                                Create a copy of an existing database with a new name.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={inputGroupStyle}>
                                    <select
                                        value={selectedDbToDuplicate}
                                        onChange={(e) => setSelectedDbToDuplicate(e.target.value)}
                                        style={{ ...selectStyle, flex: 1 }}
                                    >
                                        <option value="">Select source database...</option>
                                        {databases.map(db => (
                                            <option key={db} value={db}>{db}</option>
                                        ))}
                                    </select>
                                    <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                    <input
                                        type="text"
                                        placeholder="New database name..."
                                        value={duplicateNewName}
                                        onChange={(e) => setDuplicateNewName(e.target.value)}
                                        style={{ ...inputStyle, flex: 1 }}
                                    />
                                </div>
                                <button
                                    style={{ ...buttonStyle('primary'), alignSelf: 'flex-end' }}
                                    onClick={handleDuplicateDatabase}
                                    disabled={!selectedDbToDuplicate || !duplicateNewName.trim() || isDuplicating}
                                >
                                    {isDuplicating ? <Loader2 size={14} className="spin" /> : <Copy size={14} />}
                                    Duplicate
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Delete Tab */}
                    {activeTab === 'delete' && (
                        <div style={{ ...sectionStyle, borderColor: 'rgba(220, 38, 38, 0.3)' }}>
                            <div style={{ ...sectionTitleStyle, color: '#dc2626' }}>
                                <Trash2 size={16} /> Delete Database
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', marginTop: 0 }}>
                                Permanently delete a database. This action cannot be undone.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <select
                                    value={selectedDbToDelete}
                                    onChange={(e) => {
                                        setSelectedDbToDelete(e.target.value);
                                        setConfirmDeleteName('');
                                    }}
                                    style={selectStyle}
                                >
                                    <option value="">Select database to delete...</option>
                                    {databases.map(db => (
                                        <option key={db} value={db}>{db}</option>
                                    ))}
                                </select>
                                {selectedDbToDelete && (
                                    <>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                                            Type <strong style={{ color: '#dc2626' }}>{selectedDbToDelete}</strong> to confirm deletion:
                                        </p>
                                        <div style={inputGroupStyle}>
                                            <input
                                                type="text"
                                                placeholder="Type database name to confirm..."
                                                value={confirmDeleteName}
                                                onChange={(e) => setConfirmDeleteName(e.target.value)}
                                                style={{ ...inputStyle, flex: 1, borderColor: 'rgba(220, 38, 38, 0.3)' }}
                                            />
                                            <button
                                                style={buttonStyle('danger')}
                                                onClick={handleDeleteDatabase}
                                                disabled={confirmDeleteName !== selectedDbToDelete || isDeleting}
                                            >
                                                {isDeleting ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                                                Delete
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Logs */}
                    {logs.length > 0 && (
                        <div style={{
                            marginTop: '1rem',
                            padding: '0.75rem',
                            backgroundColor: 'var(--bg-tertiary)',
                            borderRadius: '6px',
                            maxHeight: '150px',
                            overflowY: 'auto',
                            fontFamily: 'monospace',
                            fontSize: '0.8rem'
                        }}>
                            {logs.map((log, idx) => (
                                <div key={idx} style={{
                                    color: log.includes('Error') ? '#dc2626' :
                                        log.includes('successfully') ? '#16a34a' : 'var(--text-secondary)',
                                    marginBottom: '0.25rem'
                                }}>
                                    {log}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
