import { QueryResult } from '../types';

/**
 * Format a value for inclusion in a SQL string.
 * Handles escaping quotes and converting nulls.
 */
export const formatSqlValue = (v: any): string => {
    if (v === null || v === 'NULL') return 'NULL';
    if (!isNaN(Number(v)) && v !== '') return v;
    return `'${String(v).replace(/'/g, "''")}'`;
};

/**
 * Generate CSV or JSON text from a QueryResult and selected indices.
 */
export const generateDataText = (format: 'CSV' | 'JSON', data: QueryResult, indices: number[]): string => {
    if (format === 'JSON') {
        const rows = indices.map(i => {
            const r = data.rows[i];
            const obj: any = {};
            data.columns.forEach((c, idx) => obj[c] = r[idx]);
            return obj;
        });
        return JSON.stringify(rows, null, 2);
    } else {
        let text = data.columns.join(',') + '\n';
        text += indices.map(i => {
            return data.rows[i].map(cell => {
                if (cell === null) return 'NULL';
                if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))) {
                    return `"${cell.replace(/"/g, '""')}"`;
                }
                return cell;
            }).join(',');
        }).join('\n');
        return text;
    }
};

/**
 * Build a DELETE SQL statement for a specific row.
 * Tries to use ID column if available, otherwise uses all columns in WHERE clause.
 */
export const buildDeleteSql = (tableName: string, row: any[], columns: string[], isMysql: boolean): string => {
    const q = isMysql ? '`' : '"';
    const idColIdx = columns.findIndex(c => c.toLowerCase() === 'id');
    const idColName = idColIdx !== -1 ? columns[idColIdx] : null;

    if (idColName) {
        const idVal = row[idColIdx];
        return `DELETE FROM ${q}${tableName}${q} WHERE ${q}${idColName}${q} = ${formatSqlValue(idVal)}`;
    } else {
        const whereClause = columns.map((c, i) => {
            const val = row[i];
            return `${q}${c}${q} ${val === null ? 'IS NULL' : `= ${formatSqlValue(val)}`}`;
        }).join(' AND ');
        return `DELETE FROM ${q}${tableName}${q} WHERE ${whereClause}`;
    }
};

/**
 * Build an UPDATE SQL statement for a single cell change.
 * Only generates SQL if an ID column is present to safely identify the row.
 */
export const buildUpdateSql = (tableName: string, column: string, value: any, row: any[], columns: string[], isMysql: boolean): string => {
    const q = isMysql ? '`' : '"';
    const idColIdx = columns.findIndex(c => c.toLowerCase() === 'id');
    const idColName = idColIdx !== -1 ? columns[idColIdx] : null;

    if (idColName && row[idColIdx] !== undefined) {
        const idVal = row[idColIdx];
        return `UPDATE ${q}${tableName}${q} SET ${q}${column}${q} = ${formatSqlValue(value)} WHERE ${q}${idColName}${q} = ${formatSqlValue(idVal)}`;
    }

    // Future improvement: Implement fallback to WHERE all columns if no ID, similar to DELETE
    return '';
};
