import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { emit } from '@tauri-apps/api/event';
import { check, Update } from '@tauri-apps/plugin-updater';

// Store the update globally so the notification window can access it
let pendingUpdate: Update | null = null;

export const getPendingUpdate = () => pendingUpdate;
export const clearPendingUpdate = () => { pendingUpdate = null; };

export const checkForUpdates = async (): Promise<Update | null> => {
    console.log("Checking for updates...");

    try {
        const update = await check();

        if (update) {
            console.log(`Update available: ${update.version}`);
            pendingUpdate = update;

            // Open notification window
            const label = 'update-notification';
            let updateWindow = await WebviewWindow.getByLabel(label);

            const currentVersion = update.currentVersion;
            const newVersion = update.version;

            if (updateWindow) {
                await updateWindow.show();
                await updateWindow.setFocus();
            } else {
                updateWindow = new WebviewWindow(label, {
                    url: `index.html?window=update-notification&current=${currentVersion}&new=${newVersion}`,
                    title: 'Update Available',
                    width: 800,
                    height: 200,
                    resizable: false,
                    alwaysOnTop: true,
                    skipTaskbar: true,
                    center: true
                });
            }

            // Emit version info to the window
            setTimeout(async () => {
                await emit('update-available', {
                    current: currentVersion,
                    new: newVersion,
                    body: update.body
                });
            }, 1000);

            return update;
        } else {
            console.log("No updates available.");
            return null;
        }
    } catch (e) {
        console.error("Failed to check for updates:", e);
        return null;
    }
};
