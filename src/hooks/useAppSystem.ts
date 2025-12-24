import { useState, useEffect, useCallback } from 'react';
import { Connection } from '../types/index';
import { THEMES, applyTheme, getSavedTheme } from '../utils/themeUtils';

interface UseAppSystemReturn {
    sidebarOpen: boolean;
    setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
    theme: string;
    setTheme: React.Dispatch<React.SetStateAction<string>>;
    zoom: number;
    setZoom: React.Dispatch<React.SetStateAction<number>>;
    showDbMenu: boolean;
    setShowDbMenu: React.Dispatch<React.SetStateAction<boolean>>;
    isCapturing: boolean;
    setIsCapturing: React.Dispatch<React.SetStateAction<boolean>>;
    handleZoom: (delta: number) => void;
    availableThemes: { id: string, name: string, type: string, colors: { bg: string, text: string, accent: string } }[];
}

export const useAppSystem = (connection: Connection): UseAppSystemReturn => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [showDbMenu, setShowDbMenu] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);

    // Preference State - Load from localStorage
    const [theme, setTheme] = useState<string>(getSavedTheme);
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
        applyTheme(theme);
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
        handleZoom,
        availableThemes: Object.values(THEMES).map((t: any) => ({
            id: t.id,
            name: t.name,
            type: t.type,
            colors: {
                bg: t.colors['bg-primary'],
                text: t.colors['text-primary'],
                accent: t.colors['accent-primary']
            }
        }))
    };
};
