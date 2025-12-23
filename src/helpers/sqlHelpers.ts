import { PendingChange } from '../types';

export const safeSqlValue = (v: any): string => {
    if (v === null || v === 'NULL') return 'NULL';
    if (!isNaN(Number(v)) && v !== '') return String(v);
    return `'${String(v).replace(/'/g, "''")}'`;
};

export const generateRowChangeSql = (
    change: PendingChange,
    columns: string[],
    isMysql: boolean
): string | null => {
    if (change.generatedSql) return change.generatedSql;

    const q = isMysql ? '`' : '"';
    const idColIdx = columns.findIndex(c => c.toLowerCase() === 'id');
    const idColName = idColIdx !== -1 ? columns[idColIdx] : null;

    const row = change.rowData as any[];
    if (!row && change.type !== 'INSERT') return null; // Insert might use rowData derived? No, PendingChange has rowData.

    if (idColName) {
        const idVal = row[idColIdx];
        if (change.type === 'DELETE') {
            return `DELETE FROM ${q}${change.tableName}${q} WHERE ${q}${idColName}${q} = ${safeSqlValue(idVal)}`;
        } else if (change.type === 'UPDATE') {
            if (!change.column) return null;
            return `UPDATE ${q}${change.tableName}${q} SET ${q}${change.column}${q} = ${safeSqlValue(change.newValue)} WHERE ${q}${idColName}${q} = ${safeSqlValue(idVal)}`;
        } else if (change.type === 'INSERT') {
            const colNames = columns.map(c => `${q}${c}${q}`).join(', ');
            const values = row.map((v: any) => safeSqlValue(v)).join(', ');
            return `INSERT INTO ${q}${change.tableName}${q} (${colNames}) VALUES (${values})`;
        }
    } else {
        // Fallback: Use all columns for WHERE clause
        const whereClause = columns.map((c, i) => {
            const val = row[i];
            return `${q}${c}${q} ${val === null ? 'IS NULL' : `= ${safeSqlValue(val)}`}`;
        }).join(' AND ');

        if (change.type === 'DELETE') {
            return `DELETE FROM ${q}${change.tableName}${q} WHERE ${whereClause}`;
        } else if (change.type === 'UPDATE') {
            if (!change.column) return null;
            return `UPDATE ${q}${change.tableName}${q} SET ${q}${change.column}${q} = ${safeSqlValue(change.newValue)} WHERE ${whereClause}`;
        } else if (change.type === 'INSERT') {
            const colNames = columns.map(c => `${q}${c}${q}`).join(', ');
            const values = row.map((v: any) => safeSqlValue(v)).join(', ');
            return `INSERT INTO ${q}${change.tableName}${q} (${colNames}) VALUES (${values})`;
        }
    }
    return null;
};
