import React from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X } from 'lucide-react';
import styles from '../styles/WindowControls.module.css';

interface WindowControlsProps {
    showMinimize?: boolean;
    showMaximize?: boolean;
    showClose?: boolean;
}

export const WindowControls: React.FC<WindowControlsProps> = ({
    showMinimize = true,
    showMaximize = true,
    showClose = true
}) => {
    const handleControl = async (e: React.MouseEvent, action: 'minimize' | 'maximize' | 'close') => {
        e.stopPropagation();
        try {
            const win = getCurrentWindow();
            if (action === 'minimize') await win.minimize();
            if (action === 'maximize') await win.toggleMaximize();
            if (action === 'close') await win.close();
        } catch (err) {
            console.error("Window control error:", err);
        }
    };

    const stopDrag = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    return (
        <div
            className={styles.container}
            onMouseDown={stopDrag}
            data-tauri-drag-region={false}
        >
            {showMinimize && (
                <button
                    type="button"
                    onClick={(e) => handleControl(e, 'minimize')}
                    className={styles.button}
                    title="Minimize"
                >
                    <Minus size={16} />
                </button>
            )}
            {showMaximize && (
                <button
                    type="button"
                    onClick={(e) => handleControl(e, 'maximize')}
                    className={styles.button}
                    title="Maximize"
                >
                    <Square size={14} />
                </button>
            )}
            {showClose && (
                <button
                    type="button"
                    onClick={(e) => handleControl(e, 'close')}
                    className={`${styles.button} ${styles.closeButton}`}
                    title="Close"
                >
                    <X size={18} />
                </button>
            )}
        </div>
    );
};
