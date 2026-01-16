/**
 * Data Export Utilities
 * 
 * Provides data formatting functions for CSV and JSON export.
 */

import { QueryResult } from '../types';

/**
 * Generates CSV or JSON formatted text from query results.
 * 
 * @param format - Output format ('CSV' or 'JSON')
 * @param data - Query result containing columns and rows
 * @param indices - Row indices to include in the export
 * @returns Formatted string ready for export or clipboard
 */
export const generateDataText = (
    format: 'CSV' | 'JSON',
    data: QueryResult,
    indices: number[]
): string => {
    if (format === 'JSON') {
        const rows = indices.map(i => {
            const row = data.rows[i];
            const obj: Record<string, unknown> = {};
            data.columns.forEach((col, idx) => {
                obj[col] = row[idx];
            });
            return obj;
        });
        return JSON.stringify(rows, null, 2);
    }

    // CSV format
    const header = data.columns.join(',');
    const rows = indices.map(i => {
        return data.rows[i].map(cell => {
            if (cell === null) return 'NULL';
            if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))) {
                return `"${cell.replace(/"/g, '""')}"`;
            }
            return cell;
        }).join(',');
    }).join('\n');

    return `${header}\n${rows}`;
};
