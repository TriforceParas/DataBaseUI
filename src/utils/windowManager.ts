import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

export const openConnectionWindow = async (connectionId?: number) => {
    const label = connectionId ? `connection-${connectionId}` : 'connection-new';
    const url = connectionId ? `/?window=connection&id=${connectionId}` : '/?window=connection';

    // Check if window exists
    const existing = await WebviewWindow.getByLabel(label);
    if (existing) {
        await existing.setFocus();
        return;
    }

    const webview = new WebviewWindow(label, {
        url,
        title: connectionId ? 'Edit Connection' : 'New Connection',
        width: 800,
        height: 700,
        resizable: true,
        center: true
    });

    webview.once('tauri://created', function () {
        // Window created
    });

    webview.once('tauri://error', function (e) {
        // Error creating window
        console.error("Error creating window", e);
    });
};

export const openVaultWindow = async () => {
    const label = 'vault-window';
    const existing = await WebviewWindow.getByLabel(label);
    if (existing) {
        await existing.setFocus();
        return;
    }

    new WebviewWindow(label, {
        url: '/?window=vault',
        title: 'Credential Vault',
        width: 800,
        height: 600,
        resizable: true,
        center: true
    });
};

export const openErrorWindow = async (title: string, message: string) => {
    const label = `error-${Date.now()}`;
    const encodedMessage = encodeURIComponent(message);
    const encodedTitle = encodeURIComponent(title);

    new WebviewWindow(label, {
        url: `/?window=error&title=${encodedTitle}&message=${encodedMessage}`,
        title: 'Connection Error',
        width: 450,
        height: 300,
        resizable: false,
        center: true,
        alwaysOnTop: true // Make sure it pops up over other windows
    });
};
