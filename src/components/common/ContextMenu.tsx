import React, { useLayoutEffect, useRef, useState } from 'react';
import { Portal } from './Portal';

interface ContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    children: React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, children, style, className }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: y, left: x });

    useLayoutEffect(() => {
        if (menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            const { innerWidth, innerHeight } = window;
            let newTop = y;
            let newLeft = x;

            // Check vertical overflow (flip up)
            if (y + rect.height > innerHeight) {
                newTop = y - rect.height;
            }

            // Check horizontal overflow (shift left)
            if (x + rect.width > innerWidth) {
                newLeft = x - rect.width;
            }

            // Ensure it doesn't go off top/left edges
            if (newTop < 0) newTop = 0;
            if (newLeft < 0) newLeft = 0;

            setPosition({ top: newTop, left: newLeft });
        }
    }, [x, y, children]); // Re-run if content changes

    return (
        <Portal>
            {/* Backdrop for clicking outside */}
            <div
                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998 }}
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                onContextMenu={(e) => { e.preventDefault(); onClose(); }}
            />

            <div
                ref={menuRef}
                className={className}
                data-context-menu="true"
                style={{
                    position: 'fixed',
                    top: position.top,
                    left: position.left,
                    zIndex: 9999,
                    ...style
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </Portal>
    );
};
