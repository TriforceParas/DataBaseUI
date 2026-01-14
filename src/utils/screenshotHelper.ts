import { toPng } from 'html-to-image';
import { pictureDir, documentDir } from '@tauri-apps/api/path';
import { writeFile, mkdir, exists, BaseDirectory } from '@tauri-apps/plugin-fs';

/**
 * Capture schema diagram as a high-quality PNG using html-to-image
 * This library handles SVG edges better than html2canvas
 */
export const captureSchemaScreenshot = async (
    containerRef: HTMLElement,
    onSuccess: (filePath: string) => void,
    onError: (error: string) => void,
    customPath?: string
) => {
    try {
        // Define filter to exclude controls
        const filter = (node: HTMLElement) => {
            // Ignore React Flow controls
            if (node.classList && node.classList.contains('react-flow__controls')) return false;
            // Ignore the download button itself logic (managed by controls mostly but good to be safe)
            if (node.tagName === 'BUTTON' && node.getAttribute('title') === 'Save Image') return false;
            return true;
        };

        // Capture using html-to-image
        // pixelRatio: 2 ensures high quality
        const dataUrl = await toPng(containerRef, {
            quality: 1.0,
            pixelRatio: 2,
            filter: filter,
            backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-primary') || '#1a1a2e',
            skipFonts: true, // Prevent CORS errors from remote webfonts
        });

        // Convert Data URL to Uint8Array
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        let filePath = '';
        let fileWritePath = '';
        let options = undefined;
        let timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        let fileName = `schema_${timestamp}.png`;

        if (customPath && customPath.trim() !== '') {
            // Use custom path (Absolute)
            // Ensure directory exists
            try {
                await mkdir(customPath, { recursive: true });
            } catch (e) {
                // Ignore if exists, or fail on write
                console.log("Mkdir check:", e);
            }

            // Handle separators
            const sep = customPath.includes('\\') ? '\\' : '/';
            const cleanPath = customPath.endsWith(sep) ? customPath : customPath + sep;

            filePath = `${cleanPath}${fileName}`;
            fileWritePath = filePath;
            // No options = absolute path usually
        } else {
            // Default: Pictures/SQL-UI
            const picturesPath = await pictureDir();
            const sqlUiDir = `${picturesPath}SQL-UI`;

            // Ensure directory exists
            const dirExists = await exists('SQL-UI', { baseDir: BaseDirectory.Picture });
            if (!dirExists) {
                await mkdir('SQL-UI', { baseDir: BaseDirectory.Picture, recursive: true });
            }

            filePath = `${sqlUiDir}\\${fileName}`;
            // Relative path for BaseDirectory.Picture
            fileWritePath = `SQL-UI\\${fileName}`;
            options = { baseDir: BaseDirectory.Picture };
        }

        // Write file
        await writeFile(fileWritePath, bytes, options);

        onSuccess(filePath);
    } catch (error) {
        console.error('Screenshot failed:', error);
        onError(error instanceof Error ? error.message : 'Screenshot failed');
    }
};

/**
 * Get the documents directory path for table exports
 */
export const getExportDirectory = async (): Promise<string> => {
    const documentsPath = await documentDir();
    const sqlUiDir = `${documentsPath}SQL-UI`;

    // Ensure directory exists
    const dirExists = await exists('SQL-UI', { baseDir: BaseDirectory.Document });
    if (!dirExists) {
        await mkdir('SQL-UI', { baseDir: BaseDirectory.Document, recursive: true });
    }

    return sqlUiDir;
};

/**
 * Save export file (CSV/JSON) to Documents/SQL-UI or Custom Path
 */
export const saveExportFile = async (
    fileName: string,
    content: string,
    onSuccess: (filePath: string) => void,
    onError: (error: string) => void,
    customPath?: string
) => {
    try {
        let filePath = '';
        let fileWritePath = '';
        let options = undefined;

        if (customPath && customPath.trim() !== '') {
            // Use custom path
            try {
                await mkdir(customPath, { recursive: true });
            } catch (e) {
                console.log("Mkdir check:", e);
            }

            const sep = customPath.includes('\\') ? '\\' : '/';
            const cleanPath = customPath.endsWith(sep) ? customPath : customPath + sep;
            filePath = `${cleanPath}${fileName}`;
            fileWritePath = filePath;
        } else {
            const sqlUiDir = await getExportDirectory();
            filePath = `${sqlUiDir}\\${fileName}`;
            fileWritePath = `SQL-UI\\${fileName}`;
            options = { baseDir: BaseDirectory.Document };
        }

        const encoder = new TextEncoder();
        const uint8Array = encoder.encode(content);
        await writeFile(fileWritePath, uint8Array, options);

        onSuccess(filePath);
    } catch (error) {
        console.error('Export failed:', error);
        onError(error instanceof Error ? error.message : 'Export failed');
    }
};
