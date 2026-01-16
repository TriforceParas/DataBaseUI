/**
 * Theme Management Utilities
 * 
 * Handles theme loading, application, and persistence.
 * Auto-loads all theme JSON files from the themes directory.
 */

const themeFiles = import.meta.glob('../themes/*.json', { eager: true });

export const THEMES: Record<string, any> = Object.values(themeFiles).reduce((acc: Record<string, any>, module: any) => {
    const theme = module.default || module;
    if (theme.id) {
        acc[theme.id] = theme;
    }
    return acc;
}, {});

export const applyTheme = (themeId: string) => {
    const themeObj = THEMES[themeId];
    if (themeObj) {
        const root = document.documentElement;
        Object.entries(themeObj.colors).forEach(([key, value]) => {
            root.style.setProperty(`--${key}`, String(value));
        });
        root.dataset.theme = themeId;
        localStorage.setItem('app-theme', themeId);
    }
};

export const getSavedTheme = (): string => {
    const saved = localStorage.getItem('app-theme');
    return saved && THEMES[saved] ? saved : 'midnight-blues';
};
