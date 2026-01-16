/**
 * Results Pane Hook
 * 
 * Manages the resizable results pane UI state including
 * height, visibility, and drag-to-resize functionality.
 */

import { useState, useEffect, useCallback } from 'react';

export const useResultsPane = (initialHeight: number = 300) => {
    const [resultsHeight, setResultsHeight] = useState(initialHeight);
    const [isResizing, setIsResizing] = useState(false);
    const [resultsVisible, setResultsVisible] = useState(true);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            setResultsHeight(h => Math.max(100, Math.min(800, h - e.movementY)));
        };
        const handleMouseUp = () => setIsResizing(false);

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    const startResizing = useCallback(() => setIsResizing(true), []);
    const toggleResults = useCallback(() => setResultsVisible(prev => !prev), []);

    return {
        resultsHeight,
        isResizing,
        resultsVisible,
        setResultsVisible, // Exposed for external control if needed
        startResizing,
        toggleResults
    };
};
