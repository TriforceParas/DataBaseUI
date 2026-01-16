import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

import { Credential } from '../../types';
import { RiDeleteBin7Line, RiKey2Line, RiAddLine, RiShieldKeyholeLine, RiSearchLine } from 'react-icons/ri';

export const VaultWindow: React.FC = () => {
    const [credentials, setCredentials] = useState<Credential[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // New Credential Form
    const [newName, setNewName] = useState('');
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchCredentials();
    }, []);

    const fetchCredentials = async () => {
        try {
            const creds = await invoke<Credential[]>('list_credentials');
            setCredentials(creds);
        } catch (e) {
            console.error("Failed to fetch credentials", e);
        }
    };



    const handleSave = async () => {
        if (!newName || !newUsername || !newPassword) {
            setError("All fields are required");
            return;
        }
        setError(null);
        try {
            await invoke('save_credential', {
                name: newName,
                username: newUsername,
                password: newPassword
            });
            setIsAdding(false);
            setNewName('');
            setNewUsername('');
            setNewPassword('');
            fetchCredentials();
        } catch (e) {
            setError(typeof e === 'string' ? e : "Failed to save");
            console.error(e);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (confirm(`Are you sure you want to delete credential "${name}"?`)) {
            try {
                await invoke('delete_credential', { id });
                fetchCredentials();
            } catch (e) {
                console.error("Failed to delete", e);
            }
        }
    };



    const filteredCreds = credentials.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div style={{
            height: '100vh',
            background: '#1a1b1e', // Dark metallic theme
            color: '#e2e8f0',
            fontFamily: 'Inter, sans-serif',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Header */}
            <div style={{
                padding: '1rem 1.5rem',
                borderBottom: '1px solid #2d3748',
                background: '#2d3748',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
                        padding: '0.4rem',
                        borderRadius: '6px',
                        boxShadow: '0 0 10px rgba(217, 119, 6, 0.3)'
                    }}>
                        <RiShieldKeyholeLine size={24} color="#fff" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Credential Vault</h1>
                        <div style={{ fontSize: '0.75rem', color: '#a0aec0' }}>Secure Storage</div>
                    </div>
                </div>

            </div>

            {/* Main Content */}
            <div style={{ flex: 1, padding: '1.5rem 1.5rem 1.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }} className="vault-content">

                {/* Search & Actions */}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <RiSearchLine size={18} style={{ position: 'absolute', left: '10px', top: '10px', color: '#718096' }} />
                        <input
                            type="text"
                            placeholder="Search credentials..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.6rem 0.6rem 0.6rem 2.2rem',
                                background: '#2d3748',
                                border: '1px solid #4a5568',
                                borderRadius: '6px',
                                color: 'white',
                                fontSize: '0.9rem'
                            }}
                        />
                    </div>
                    <button
                        onClick={() => setIsAdding(true)}
                        style={{
                            background: '#3182ce',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '0 1rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontWeight: 600,
                            fontSize: '0.9rem'
                        }}
                    >
                        <RiAddLine size={18} /> Add New
                    </button>
                </div>

                <style>{`
                    .vault-content::-webkit-scrollbar {
                        width: 8px;
                    }
                    .vault-content::-webkit-scrollbar-track {
                        background: transparent;
                    }
                    .vault-content::-webkit-scrollbar-thumb {
                        background: #4a5568;
                        border-radius: 10px;
                        border: 2px solid #1a1b1e;
                    }
                    .vault-content::-webkit-scrollbar-thumb:hover {
                        background: #718096;
                    }
                `}</style>

                {/* List or Form */}
                <div style={{ flex: 1 }}>
                    {isAdding ? (
                        <div style={{
                            background: '#2d3748',
                            borderRadius: '8px',
                            padding: '1.5rem',
                            border: '1px solid #4a5568',
                            animation: 'slideIn 0.2s ease-out'
                        }}>
                            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f7fafc' }}>
                                <RiKey2Line size={20} /> New Credential
                            </h3>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e0', marginBottom: '0.4rem' }}>Friendly Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Production DB"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid #4a5568', background: '#1a1b1e', color: 'white' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e0', marginBottom: '0.4rem' }}>Username</label>
                                        <input
                                            type="text"
                                            placeholder="admin"
                                            value={newUsername}
                                            onChange={(e) => setNewUsername(e.target.value)}
                                            style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid #4a5568', background: '#1a1b1e', color: 'white' }}
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e0', marginBottom: '0.4rem' }}>Password</label>
                                        <input
                                            type="password"
                                            placeholder="••••••••"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid #4a5568', background: '#1a1b1e', color: 'white' }}
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <div style={{ color: '#fc8181', fontSize: '0.9rem' }}>{error}</div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                                    <button
                                        onClick={() => setIsAdding(false)}
                                        style={{ padding: '0.6rem 1rem', background: 'transparent', border: '1px solid #4a5568', color: '#cbd5e0', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        style={{ padding: '0.6rem 1rem', background: '#2b6cb0', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                                    >
                                        Save Securely
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {filteredCreds.map(cred => (
                                <div key={cred.id} style={{
                                    background: '#2d3748',
                                    borderRadius: '8px',
                                    padding: '1rem',
                                    display: 'flex', // Flex layout
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    border: '1px solid transparent',
                                    transition: 'all 0.2s',
                                    cursor: 'default'
                                }}
                                    onMouseEnter={(e) => e.currentTarget.style.borderColor = '#4a5568'}
                                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{
                                            background: '#4a5568',
                                            padding: '0.5rem',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <RiKey2Line size={20} color="#e2e8f0" />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, color: '#f7fafc' }}>{cred.name}</div>
                                            <div style={{ fontSize: '0.85rem', color: '#a0aec0' }}>User: {cred.username}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#718096', marginTop: '2px' }}>ID: {cred.id.substring(0, 8)}...</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(cred.id, cred.name)}
                                        style={{
                                            background: 'rgba(245, 101, 101, 0.1)',
                                            color: '#fc8181',
                                            border: 'none',
                                            padding: '0.5rem',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            transition: 'background 0.2s'
                                        }}
                                        title="Delete Credential"
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(245, 101, 101, 0.2)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(245, 101, 101, 0.1)'}
                                    >
                                        <RiDeleteBin7Line size={18} />
                                    </button>
                                </div>
                            ))}

                            {filteredCreds.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '3rem', color: '#718096' }}>
                                    <RiShieldKeyholeLine size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                                    <div>No credentials found in vault.</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
