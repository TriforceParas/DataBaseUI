import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { open } from '@tauri-apps/plugin-shell';

export interface ToastMessage {
    id: string;
    title: string;
    message: string;
    filePath?: string;
    type?: 'success' | 'error' | 'info';
}

interface ToastProps {
    toast: ToastMessage;
    onDismiss: (id: string) => void;
}

const ToastIcon = ({ type }: { type?: 'success' | 'error' | 'info' }) => {
    switch (type) {
        case 'error': return <AlertCircle size={20} style={{ color: '#ef4444', flexShrink: 0 }} />; // Red
        case 'info': return <Info size={20} style={{ color: '#3b82f6', flexShrink: 0 }} />; // Blue
        case 'success':
        default: return <CheckCircle size={20} style={{ color: '#22c55e', flexShrink: 0 }} />; // Green
    }
};

const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        // Slide in
        requestAnimationFrame(() => setIsVisible(true));

        // Auto dismiss after 3 seconds
        const timer = setTimeout(() => {
            handleDismiss();
        }, 3000);

        return () => clearTimeout(timer);
    }, []);

    const handleDismiss = () => {
        setIsExiting(true);
        setTimeout(() => onDismiss(toast.id), 300);
    };

    const handleClick = async () => {
        if (toast.filePath) {
            try {
                // Open parent directory with file selected
                await open(toast.filePath);
            } catch (e) {
                console.error('Failed to open file:', e);
            }
        }
        handleDismiss();
    };

    return (
        <div
            onClick={handleClick}
            style={{
                transform: isVisible && !isExiting ? 'translateY(0)' : 'translateY(-100%)',
                opacity: isVisible && !isExiting ? 1 : 0,
                transition: 'transform 0.3s ease, opacity 0.3s ease',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderLeft: `4px solid ${toast.type === 'error' ? '#ef4444' : toast.type === 'info' ? '#3b82f6' : '#22c55e'}`,
                borderRadius: '8px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                cursor: toast.filePath ? 'pointer' : 'default',
                minWidth: '280px',
                maxWidth: '400px'
            }}
        >
            <ToastIcon type={toast.type} />
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {toast.title}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {toast.message}
                </div>
            </div>
            <button
                onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
                style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-secondary)',
                    borderRadius: '4px'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            >
                <X size={16} />
            </button>
        </div>
    );
};

interface ToastContainerProps {
    toasts: ToastMessage[];
    onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
    return (
        <div style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            alignItems: 'center'
        }}>
            {toasts.map(toast => (
                <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
            ))}
        </div>
    );
};

// Hook for managing toasts
export const useToast = () => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const addToast = (title: string, message: string, filePath?: string, type: 'success' | 'error' | 'info' = 'success') => {
        const id = crypto.randomUUID();
        setToasts(prev => [...prev, { id, title, message, filePath, type }]);
        return id;
    };

    const dismissToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return { toasts, addToast, dismissToast };
};
