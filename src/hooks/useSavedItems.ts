
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Connection, SavedQuery, SavedFunction } from '../types';

export const useSavedItems = (connection: Connection) => {
    const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
    const [savedFunctions, setSavedFunctions] = useState<SavedFunction[]>([]);

    const fetchSavedItems = useCallback(async () => {
        try {
            const queries = await invoke<SavedQuery[]>('list_queries', { connectionId: connection.id });
            setSavedQueries(queries);
            const funcs = await invoke<SavedFunction[]>('list_functions', { connectionId: connection.id });
            setSavedFunctions(funcs);
        } catch (e) { console.error('Failed to load saved items:', e); }
    }, [connection.id]);

    useEffect(() => {
        fetchSavedItems();
    }, [fetchSavedItems]);

    const saveQuery = async (name: string, query: string): Promise<number | null> => {
        try {
            const savedId = await invoke<number>('save_query', { name, query, connectionId: connection.id });
            fetchSavedItems();
            return savedId;
        } catch (e) {
            console.error('Failed to save query:', e);
            throw e;
        }
    };

    const saveFunction = async (name: string, functionBody: string): Promise<number | null> => {
        try {
            const savedId = await invoke<number>('save_function', { name, functionBody, connectionId: connection.id });
            fetchSavedItems();
            return savedId;
        } catch (e) {
            console.error('Failed to save function:', e);
            throw e;
        }
    };

    const deleteQuery = async (id: number) => {
        try {
            await invoke('delete_query', { id });
            fetchSavedItems();
        } catch (e) { console.error('Failed to delete query:', e); throw e; }
    };

    const deleteFunction = async (id: number) => {
        try {
            await invoke('delete_function', { id });
            fetchSavedItems();
        } catch (e) { console.error('Failed to delete function:', e); throw e; }
    };

    const updateQuery = async (id: number, name: string, query: string) => {
        try {
            await invoke('update_query', { id, name, query });
            fetchSavedItems();
        } catch (e) { console.error('Failed to update query:', e); throw e; }
    };

    const updateFunction = async (id: number, name: string, functionBody: string) => {
        try {
            await invoke('update_function', { id, name, functionBody });
            fetchSavedItems();
        } catch (e) { console.error('Failed to update function:', e); throw e; }
    };

    return {
        savedQueries,
        savedFunctions,
        fetchSavedItems,
        saveQuery,
        saveFunction,
        deleteQuery,
        deleteFunction,
        updateQuery,
        updateFunction
    };
};
