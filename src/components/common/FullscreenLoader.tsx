import React from 'react';
import { RiLoader4Line } from 'react-icons/ri';

interface FullscreenLoaderProps {
    isVisible: boolean;
    message?: string;
}

export const FullscreenLoader: React.FC<FullscreenLoaderProps> = ({ isVisible, message = 'Processing...' }) => {
    if (!isVisible) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)', // Dim backdrop
            backdropFilter: 'blur(4px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-primary)',
            fontFamily: 'sans-serif',
            height: '100vh',
            width: '100vw',
            zIndex: 9999,
            overflow: 'hidden'
        }}>
            <div style={{
                background: 'var(--bg-secondary)',
                padding: '2.5rem',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1.5rem',
                width: 'auto',
                minWidth: '400px',
                maxWidth: '90%',
                justifyContent: 'center',
                boxSizing: 'border-box'
            }}>
                <div style={{ position: 'relative' }}>
                    <RiLoader4Line className="animate-spin" size={48} style={{ color: 'var(--accent-primary)' }} />
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        borderRadius: '50%',
                        boxShadow: '0 0 20px var(--accent-primary)',
                        opacity: 0.4,
                        animation: 'pulse 2s infinite'
                    }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textAlign: 'center' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, letterSpacing: '0.5px', margin: 0, color: 'var(--text-primary)' }}>
                        {message}
                    </h3>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Please wait...</span>
                </div>

                {/* Refined Progress Bar */}
                <div style={{
                    width: '100%',
                    height: '6px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    position: 'relative'
                }}>
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        height: '100%',
                        width: '30%',
                        background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary), var(--accent-primary))',
                        backgroundSize: '200% 100%',
                        borderRadius: '10px',
                        animation: 'shimmer 1.5s infinite linear',
                        boxShadow: '0 0 10px var(--accent-primary)'
                    }} />
                </div>
            </div>

            <style>
                {`
                    @keyframes shimmer {
                        0% { left: -30%; background-position: 100% 0; }
                        50% { left: 35%; }
                        100% { left: 100%; background-position: -100% 0; }
                    }
                    @keyframes pulse {
                        0% { transform: scale(0.8); opacity: 0.5; }
                        50% { transform: scale(1.2); opacity: 0.2; }
                        100% { transform: scale(0.8); opacity: 0.5; }
                    }
                    .animate-spin {
                        animation: spin 1s linear infinite;
                    }
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                `}
            </style>
        </div>
    );
};
