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
    onError: (error: string) => void
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

        // Get save path
        const picturesPath = await pictureDir();
        const sqlUiDir = `${picturesPath}SQL-UI`;

        // Ensure directory exists
        const dirExists = await exists('SQL-UI', { baseDir: BaseDirectory.Picture });
        if (!dirExists) {
            await mkdir('SQL-UI', { baseDir: BaseDirectory.Picture, recursive: true });
        }

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const fileName = `schema_${timestamp}.png`;
        const filePath = `${sqlUiDir}\\${fileName}`;

        // Write file
        await writeFile(`SQL-UI\\${fileName}`, bytes, { baseDir: BaseDirectory.Picture });

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
 * Save export file (CSV/JSON) to Documents/SQL-UI
 */
export const saveExportFile = async (
    fileName: string,
    content: string,
    onSuccess: (filePath: string) => void,
    onError: (error: string) => void
) => {
    try {
        const sqlUiDir = await getExportDirectory();

        // Ensure directory exists again inside the save function just in case
        const dirExists = await exists('SQL-UI', { baseDir: BaseDirectory.Document });
        if (!dirExists) {
            await mkdir('SQL-UI', { baseDir: BaseDirectory.Document, recursive: true });
        }

        const filePath = `${sqlUiDir}\\${fileName}`;

        const encoder = new TextEncoder();
        const uint8Array = encoder.encode(content);
        await writeFile(`SQL-UI\\${fileName}`, uint8Array, { baseDir: BaseDirectory.Document });

        onSuccess(filePath);
    } catch (error) {
        console.error('Export failed:', error);
        onError(error instanceof Error ? error.message : 'Export failed');
    }
};
