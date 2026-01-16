/**
 * Session Management Hook
 * 
 * Creates and manages database session IDs for connection pooling.
 * Sessions allow efficient connection reuse without re-authentication.
 */

import { useState, useEffect, useRef } from 'react';
import { Connection } from '../types';
import * as api from '../api';

export const useSession = (connection: Connection) => {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Track the connection that the current session belongs to
    const currentConnectionRef = useRef<{ id: number; dbName?: string } | null>(null);

    useEffect(() => {
        let isMounted = true;
        
        // Don't reset sessionId to null immediately - this prevents double state changes
        // that cause multiple rapid fetches when DevTools is open

        const initSession = async () => {
            if (!connection || !connection.id) {
                if (isMounted) setSessionId(null);
                return;
            }
            
            // Skip if we already have a session for this exact connection
            const currentConn = currentConnectionRef.current;
            if (currentConn && 
                currentConn.id === connection.id && 
                currentConn.dbName === connection.database_name &&
                sessionId) {
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                const dbName = connection.database_name || undefined;
                const sid = await api.createSession(connection.id, dbName);

                if (isMounted) {
                    currentConnectionRef.current = { id: connection.id, dbName: connection.database_name };
                    setSessionId(sid);
                }
            } catch (e) {
                console.error("Failed to create session:", e);
                if (isMounted) {
                    setError(String(e));
                    currentConnectionRef.current = null;
                    setSessionId(null);
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        initSession();

        return () => { isMounted = false; };
    }, [connection.id, connection.database_name]);

    return { sessionId, isLoading, error };
};
