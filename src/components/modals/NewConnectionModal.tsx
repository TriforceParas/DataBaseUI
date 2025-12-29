import React from 'react';
import { ConnectionForm } from '../ConnectionForm';

interface NewConnectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const NewConnectionModal: React.FC<NewConnectionModalProps> = ({ isOpen, onClose, onSuccess }) => {
    if (!isOpen) return null;

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
            <div style={{ width: '400px' }} onClick={e => e.stopPropagation()}>
                <ConnectionForm onSuccess={onSuccess} onCancel={onClose} />
            </div>
        </div>
    );
};
