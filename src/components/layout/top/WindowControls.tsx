import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X } from 'lucide-react';
import styles from '../../../styles/WindowControls.module.css';

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
    const [showModal, setShowModal] = useState(false);

    const handleControl = async (e: React.MouseEvent, action: 'minimize' | 'maximize' | 'close') => {
        e.stopPropagation();
        if (action === 'close') {
            setShowModal(true);
            return;
        }
        try {
            const win = getCurrentWindow();
            if (action === 'minimize') await win.minimize();
            if (action === 'maximize') await win.toggleMaximize();
        } catch (err) {
            console.error("Window control error:", err);
        }
    };

    const confirmClose = async () => {
        try {
            const win = getCurrentWindow();
            await win.close();
        } catch (err) {
            console.error("Failed to close window:", err);
        }
    };

    const stopDrag = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    return (
        <>
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

            {showModal && createPortal(
                <div
                    className={styles.modalOverlay}
                    onClick={() => setShowModal(false)}
                    data-tauri-drag-region={false}
                    onMouseDown={(e) => e.stopPropagation()} // Stop drag interaction with overlay
                >
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <h3 className={styles.modalTitle}>Close Window?</h3>
                        <p className={styles.modalText}>Are you sure you want to close this connection?</p>
                        <div className={styles.modalButtons}>
                            <button className={styles.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
                            <button className={styles.confirmBtn} onClick={confirmClose}>Yes, Close</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};
