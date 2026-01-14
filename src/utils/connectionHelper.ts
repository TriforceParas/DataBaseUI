import { invoke } from '@tauri-apps/api/core';
import { Connection } from '../types';

/**
 * Get the connection string for a connection by ID.
 * This fetches credentials from the keyring and builds the full connection string.
 */
export async function getConnectionString(connectionId: number): Promise<string> {
    // The backend builds the connection string using stored metadata + keyring credentials
    // This is handled by the verify_connection_by_id command internally
    // For now, we build a simplified version for display/use
    return await invoke<string>('get_connection_string', { connectionId });
}

/**
 * Build a display-friendly connection string from connection metadata.
 * This does NOT include credentials (safe for display).
 */
export function buildDisplayConnectionString(conn: Connection): string {
    if (conn.db_type === 'sqlite') {
        return `sqlite://${conn.host}`;
    }

    let url = `${conn.db_type}://`;
    url += `${conn.host}:${conn.port}`;

    if (conn.database_name) {
        url += `/${conn.database_name}`;
    }

    if (conn.ssl_mode) {
        url += `?sslmode=${conn.ssl_mode}`;
    }

    return url;
}
