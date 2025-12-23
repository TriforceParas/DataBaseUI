import React from 'react';
import { Loader2 } from 'lucide-react';

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
            backgroundColor: 'transparent',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontFamily: 'sans-serif',
            height: '100vh',
            width: '100vw',
            overflow: 'hidden'
        }}>
            <div style={{
                background: 'rgba(30, 30, 40, 0.95)',
                padding: '1.5rem',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
                width: '100%',
                height: '100%',
                justifyContent: 'center'
            }}>
                <div style={{ position: 'relative' }}>
                    <Loader2 className="animate-spin" size={48} style={{ color: '#3b82f6' }} />
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        borderRadius: '50%',
                        boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)',
                        opacity: 0.5,
                        animation: 'pulse 2s infinite'
                    }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', textAlign: 'center' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, letterSpacing: '0.5px', margin: 0 }}>Generating Screenshot...</h3>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)' }}>Please wait...</span>
                </div>

                {/* Refined Progress Bar */}
                <div style={{
                    width: '100%',
                    height: '6px',
                    background: 'rgba(255, 255, 255, 0.1)',
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
                        background: 'linear-gradient(90deg, #3b82f6, #60a5fa, #3b82f6)',
                        backgroundSize: '200% 100%',
                        borderRadius: '10px',
                        animation: 'shimmer 1.5s infinite linear',
                        boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)'
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
