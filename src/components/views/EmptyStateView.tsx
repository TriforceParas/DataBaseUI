import React from 'react';
import styles from '../../styles/MainLayout.module.css';

interface EmptyStateViewProps {
    onOpenNewQuery: () => void;
}

export const EmptyStateView: React.FC<EmptyStateViewProps> = ({ onOpenNewQuery }) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', userSelect: 'none' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.2 }}>❖</div>
            <p>No tabs open</p>
            <button className={styles.outlineBtn} onClick={onOpenNewQuery} style={{ marginTop: '1rem' }}>Open New Query</button>
        </div>
    );
};
