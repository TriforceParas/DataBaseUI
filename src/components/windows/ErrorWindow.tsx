import React from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { RiErrorWarningLine } from 'react-icons/ri';

export const ErrorWindow: React.FC = () => {
    // We'll pass error details via URL params for simplicity 
    // (since it's a separate window, passing complex objects is harder without state management or event bus)
    const params = new URLSearchParams(window.location.search);
    const title = params.get('title') || 'Error';
    const message = params.get('message') || 'An unexpected error occurred.';

    const handleClose = () => {
        getCurrentWindow().close();
    };

    return (
        <div style={{
            height: '100vh',
            background: '#fff',
            color: '#333',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'Inter, system-ui, sans-serif'
        }}>
            <div style={{
                background: '#fee2e2',
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                borderBottom: '1px solid #fecaca'
            }}>
                <RiErrorWarningLine size={48} color="#f56565" />
                <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#991b1b' }}>{title}</h2>
            </div>

            <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
                <p style={{ margin: 0, lineHeight: 1.5, fontSize: '0.95rem' }}>
                    {decodeURIComponent(message)}
                </p>
            </div>

            <div style={{
                padding: '1rem',
                background: '#f9fafb',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'flex-end'
            }}>
                <button
                    onClick={handleClose}
                    style={{
                        padding: '0.5rem 1.5rem',
                        background: '#dc2626',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                    }}
                >
                    OK
                </button>
            </div>
        </div>
    );
};
