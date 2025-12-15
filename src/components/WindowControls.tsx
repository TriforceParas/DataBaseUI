import React from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X } from 'lucide-react';

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
        // Prevent event from bubbling to drag regions
        e.stopPropagation();
        try {
            const win = getCurrentWindow();
            if (action === 'minimize') await win.minimize();
            if (action === 'maximize') await win.toggleMaximize();
            if (action === 'close') await win.close();
        } catch (e) {
            console.error("Window control error:", e);
        }
    };

    // Prevent drag on mouse down
    const stopDrag = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    return (
        <div
            onMouseDown={stopDrag}
            style={{ display: 'flex', gap: '4px', zIndex: 99999 }}
        >
            {showMinimize && (
                <button
                    type="button"
                    onClick={(e) => handleControl(e, 'minimize')}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                >
                    <Minus size={16} />
                </button>
            )}
            {showMaximize && (
                <button
                    type="button"
                    onClick={(e) => handleControl(e, 'maximize')}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                >
                    <Square size={14} />
                </button>
            )}
            {showClose && (
                <button
                    type="button"
                    onClick={(e) => handleControl(e, 'close')}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                >
                    <X size={18} />
                </button>
            )}
        </div>
    );
};
