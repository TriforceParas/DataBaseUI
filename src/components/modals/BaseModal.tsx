import React, { ReactNode } from 'react';
import { RiCloseLine } from 'react-icons/ri';
import { Portal } from '../common/Portal';


interface BaseModalProps {
    title: string;
    icon?: ReactNode;
    onClose: () => void;
    children: ReactNode;
    maxWidth?: string;
}

export const BaseModal: React.FC<BaseModalProps> = ({
    title,
    icon,
    onClose,
    children,
    maxWidth = '480px'
}) => {
    return (
        <Portal>
            <div style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 3000
            }}>
                <div
                    onClick={e => e.stopPropagation()}
                    style={{
                        backgroundColor: 'var(--bg-secondary)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        padding: '1.5rem',
                        minWidth: '360px',
                        maxWidth: maxWidth,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {icon}
                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{title}</h3>
                        </div>
                        <button
                            onClick={onClose}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--text-secondary)',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <RiCloseLine size={18} />
                        </button>
                    </div>
                    {children}
                </div>
            </div>
        </Portal >
    );
};
