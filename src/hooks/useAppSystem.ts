import { useState, useEffect, useCallback } from 'react';
import { Connection } from '../types';

type Theme = 'blue' | 'gray' | 'amoled' | 'light';

interface UseAppSystemReturn {
    sidebarOpen: boolean;
    setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
    theme: Theme;
    setTheme: React.Dispatch<React.SetStateAction<Theme>>;
    zoom: number;
    setZoom: React.Dispatch<React.SetStateAction<number>>;
    showDbMenu: boolean;
    setShowDbMenu: React.Dispatch<React.SetStateAction<boolean>>;
    isCapturing: boolean;
    setIsCapturing: React.Dispatch<React.SetStateAction<boolean>>;
    handleZoom: (delta: number) => void;
}

export const useAppSystem = (connection: Connection): UseAppSystemReturn => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [showDbMenu, setShowDbMenu] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);

    // Preference State - Load from localStorage
    const [theme, setTheme] = useState<Theme>(() => {
        const saved = localStorage.getItem('app-theme');
        return (saved as Theme) || 'blue';
    });
    const [zoom, setZoom] = useState(() => {
        const saved = localStorage.getItem('app-zoom');
        return saved ? parseFloat(saved) : 1;
    });

    // Window Management
    useEffect(() => {
        const maximize = async () => {
            try {
                // const win = getCurrentWindow();
                // await win.maximize();
            } catch (e) { console.error(e) }
        };
        maximize();
    }, [connection]);

    // Save and apply theme
    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem('app-theme', theme);
    }, [theme]);

    // Save zoom
    useEffect(() => {
        localStorage.setItem('app-zoom', zoom.toString());
    }, [zoom]);

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (target.closest('[data-dropdown="true"]') || target.closest('[data-dropdown-trigger="true"]')) {
                return;
            }
            if (showDbMenu) setShowDbMenu(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showDbMenu]);

    const handleZoom = useCallback((delta: number) => {
        setZoom(prev => Math.max(0.5, Math.min(2.0, prev + delta)));
    }, []);

    // Keyboard Shortcuts for Zoom
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey) {
                if (e.key === '=' || e.key === '+') {
                    e.preventDefault();
                    handleZoom(0.1);
                } else if (e.key === '-') {
                    e.preventDefault();
                    handleZoom(-0.1);
                } else if (e.key === '0') {
                    e.preventDefault();
                    setZoom(1);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleZoom]);

    return {
        sidebarOpen,
        setSidebarOpen,
        theme,
        setTheme,
        zoom,
        setZoom,
        showDbMenu,
        setShowDbMenu,
        isCapturing,
        setIsCapturing,
        handleZoom
    };
};
