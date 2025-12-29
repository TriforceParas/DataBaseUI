import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { Connection } from '../../types';
import { X, Upload, Download, Loader2, AlertTriangle, FolderOpen } from 'lucide-react';

interface SchemaImportExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'import' | 'export';
    connection: Connection;
    onSuccess?: () => void;
}

export const SchemaImportExportModal: React.FC<SchemaImportExportModalProps> = ({
    isOpen, onClose, mode, connection, onSuccess
}) => {
    const [directoryPath, setDirectoryPath] = useState('');
    const [isExecuting, setIsExecuting] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    // const [resultStatus, setResultStatus] = useState<'idle' | 'success' | 'error'>('idle'); // Unused

    useEffect(() => {
        if (isOpen) {
            setLogs([]);
            setDirectoryPath('');
            setIsExecuting(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleBrowseDirectory = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: mode === 'export' ? 'Select Export Directory' : 'Select Import Directory'
            });
            
            if (selected && typeof selected === 'string') {
                setDirectoryPath(selected);
            }
        } catch (e) {
            console.error('Failed to open directory picker:', e);
        }
    };

    const handleExecute = async () => {
        if (!directoryPath.trim()) return;

        setIsExecuting(true);
        setLogs(prev => [...prev, `Starting ${mode} operation...`]);

        try {
            const command = mode === 'export' ? 'export_schema' : 'import_schema';
            const result = await invoke<string>(command, {
                connectionString: connection.connection_string,
                directoryPath: directoryPath
            });

            setLogs(prev => [...prev, ...result.split('\n')]);
            if (onSuccess) onSuccess();
        } catch (e) {
            console.error(e);
            setLogs(prev => [...prev, `Error: ${e}`]);
        } finally {
            setIsExecuting(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={onClose}>
            <div style={{
                width: '800px', minHeight: '500px', maxHeight: '90vh',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '8px', border: '1px solid var(--border-color)',
                display: 'flex', flexDirection: 'column',
                boxShadow: 'var(--shadow-xl)'
            }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{
                    padding: '1rem', borderBottom: '1px solid var(--border-color)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {mode === 'export' ? <Upload size={20} /> : <Download size={20} />}
                        Schema {mode === 'export' ? 'Export' : 'Import'}
                    </h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '1.5rem', flex: 1, overflow: 'visible' }}>

                    <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Target Connection</div>
                        <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>{connection.name}</div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.7, wordBreak: 'break-all' }}>{connection.connection_string}</div>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                            {mode === 'export' ? 'Destination Directory' : 'Source Directory'}
                        </label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                value={directoryPath}
                                onChange={e => setDirectoryPath(e.target.value)}
                                placeholder="/absolute/path/to/folder"
                                style={{
                                    flex: 1, padding: '0.5rem',
                                    backgroundColor: 'var(--input-bg)', border: '1px solid var(--border-color)',
                                    borderRadius: '4px', color: 'var(--text-primary)'
                                }}
                            />
                            <button
                                onClick={handleBrowseDirectory}
                                type="button"
                                style={{
                                    padding: '0.5rem 1rem',
                                    backgroundColor: 'var(--bg-tertiary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '4px',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    whiteSpace: 'nowrap'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                            >
                                <FolderOpen size={16} /> Browse
                            </button>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                            {mode === 'export' 
                                ? 'Select a directory where the schema files will be exported' 
                                : 'Select a directory containing .sql files to import'}
                        </p>
                    </div>

                    {mode === 'import' && (
                        <div style={{
                            marginBottom: '1rem', 
                            padding: '1rem',
                            borderLeft: '3px solid #f59e0b', 
                            backgroundColor: 'rgba(245, 158, 11, 0.1)',
                            borderRadius: '4px',
                            fontSize: '0.9rem',
                            lineHeight: '1.6'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: '#f59e0b', marginBottom: '0.5rem' }}>
                                <AlertTriangle size={18} /> Warning
                            </div>
                            <div style={{ color: 'var(--text-primary)', wordBreak: 'break-word', whiteSpace: 'normal' }}>
                                Importing will execute all .sql files in the directory against the selected database. This might modify data or structure. Ensure the source is trusted.
                            </div>
                        </div>
                    )}

                    {logs.length > 0 && (
                        <div style={{
                            marginTop: '1rem', padding: '0.75rem',
                            backgroundColor: '#1e293b', color: '#e2e8f0',
                            borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.8rem',
                            maxHeight: '150px', overflowY: 'auto'
                        }}>
                            {logs.map((log, i) => <div key={i}>{log}</div>)}
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div style={{
                    padding: '1rem', borderTop: '1px solid var(--border-color)',
                    display: 'flex', justifyContent: 'flex-end', gap: '0.75rem'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '0.5rem 1rem', borderRadius: '4px',
                            background: 'transparent', border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)', cursor: 'pointer'
                        }}
                    >
                        Close
                    </button>
                    <button
                        onClick={handleExecute}
                        disabled={isExecuting || !directoryPath.trim()}
                        style={{
                            padding: '0.5rem 1rem', borderRadius: '4px',
                            background: isExecuting ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
                            border: 'none', color: '#fff', cursor: isExecuting ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: '0.5rem'
                        }}
                    >
                        {isExecuting && <Loader2 size={16} className="animate-spin" />}
                        {mode === 'export' ? 'Start Export' : 'Start Import'}
                    </button>
                </div>

            </div>
        </div>
    );
};
