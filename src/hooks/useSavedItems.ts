
import { useState, useEffect, useCallback } from 'react';
import { Connection, SavedQuery, SavedFunction } from '../types/index';
import * as api from '../api';

export const useSavedItems = (connection: Connection) => {
    const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
    const [savedFunctions, setSavedFunctions] = useState<SavedFunction[]>([]);

    const fetchSavedItems = useCallback(async () => {
        try {
            const queries = await api.listQueries(connection.id);
            setSavedQueries(queries);
            const funcs = await api.listFunctions(connection.id);
            setSavedFunctions(funcs);
        } catch (e) { console.error('Failed to load saved items:', e); }
    }, [connection.id]);

    useEffect(() => {
        fetchSavedItems();
    }, [fetchSavedItems]);

    const saveQuery = async (name: string, query: string): Promise<number | null> => {
        try {
            const savedId = await api.saveQuery(name, query, connection.id);
            fetchSavedItems();
            return savedId;
        } catch (e) {
            console.error('Failed to save query:', e);
            throw e;
        }
    };

    const saveFunction = async (name: string, functionBody: string): Promise<number | null> => {
        try {
            const savedId = await api.saveFunction(name, functionBody, connection.id);
            fetchSavedItems();
            return savedId;
        } catch (e) {
            console.error('Failed to save function:', e);
            throw e;
        }
    };

    const deleteQuery = async (id: number) => {
        try {
            await api.deleteQuery(id);
            fetchSavedItems();
        } catch (e) { console.error('Failed to delete query:', e); throw e; }
    };

    const deleteFunction = async (id: number) => {
        try {
            await api.deleteFunction(id);
            fetchSavedItems();
        } catch (e) { console.error('Failed to delete function:', e); throw e; }
    };

    const updateQuery = async (id: number, name: string, query: string) => {
        try {
            await api.updateQuery(id, name, query);
            fetchSavedItems();
        } catch (e) { console.error('Failed to update query:', e); throw e; }
    };

    const updateFunction = async (id: number, name: string, functionBody: string) => {
        try {
            await api.updateFunction(id, name, functionBody);
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
