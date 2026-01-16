/**
 * SQL Helper Utilities
 * 
 * Note: SQL generation for CRUD operations is handled by the backend.
 * This file provides minimal frontend utilities for display purposes.
 */

import { PendingChange } from '../types';

/**
 * Escapes a value for safe SQL string display.
 * Handles NULL values and escapes single quotes.
 */
export const escapeSqlValue = (value: unknown): string => {
    if (value === null || value === 'NULL') return 'NULL';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string' && value !== '' && !isNaN(Number(value))) return value;
    return `'${String(value).replace(/'/g, "''")}'`;
};

/**
 * Generates a display-friendly SQL string for a pending change.
 * Used only for UI display in the changelog, not for actual execution.
 */
export const getChangeDisplaySql = (change: PendingChange, isMysql: boolean): string => {
    const q = isMysql ? '`' : '"';
    const table = `${q}${change.tableName}${q}`;

    switch (change.type) {
        case 'INSERT':
            return `INSERT INTO ${table} ...`;
        case 'UPDATE':
            return `UPDATE ${table} SET ${q}${change.column}${q} = ${escapeSqlValue(change.newValue)} ...`;
        case 'DELETE':
            return `DELETE FROM ${table} WHERE ...`;
        case 'ADD_COLUMN':
        case 'DROP_COLUMN':
            return change.generatedSql || `ALTER TABLE ${table} ...`;
        default:
            return '';
    }
};
