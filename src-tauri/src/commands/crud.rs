use crate::db::PoolWrapper;
use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::{State, command};

#[derive(Debug, Serialize, Deserialize)]
pub struct RowIdentifier {
    pub columns: Vec<String>,
    pub values: Vec<Option<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CellUpdate {
    pub column: String,
    pub value: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchChange {
    pub operation: String, // "INSERT", "UPDATE", "DELETE"
    pub table_name: String,
    pub identifier: Option<RowIdentifier>, // For UPDATE/DELETE
    pub updates: Option<Vec<CellUpdate>>,  // For UPDATE
    pub insert_values: Option<std::collections::HashMap<String, Option<String>>>, // For INSERT
}

fn build_update_query(
    db_type: &str, 
    table: &str, 
    identifier: &RowIdentifier, 
    updates: &Vec<CellUpdate>
) -> (String, Vec<Option<String>>) {
    let q = if db_type == "mysql" { "`" } else { "\"" };
    let mut set_clauses = Vec::new();
    let mut args = Vec::new();

    for update in updates {
        set_clauses.push(format!("{}{}{} = ?", q, update.column.trim(), q));
        args.push(update.value.clone());
    }

    let mut where_clauses = Vec::new();
    for (i, col) in identifier.columns.iter().enumerate() {
        let val = &identifier.values[i];
        if val.is_none() {
            where_clauses.push(format!("{}{}{} IS NULL", q, col.trim(), q));
        } else {
            where_clauses.push(format!("{}{}{} = ?", q, col.trim(), q));
            args.push(val.clone());
        }
    }

    let sql = format!(
        "UPDATE {}{}{} SET {} WHERE {}",
        q, table, q,
        set_clauses.join(", "),
        where_clauses.join(" AND ")
    );

    (sql, args)
}

fn build_delete_query(
    db_type: &str,
    table: &str,
    identifier: &RowIdentifier
) -> (String, Vec<Option<String>>) {
    let q = if db_type == "mysql" { "`" } else { "\"" };
    let mut where_clauses = Vec::new();
    let mut args = Vec::new();

    for (i, col) in identifier.columns.iter().enumerate() {
        let val = &identifier.values[i];
        if val.is_none() {
            where_clauses.push(format!("{}{}{} IS NULL", q, col.trim(), q));
        } else {
            where_clauses.push(format!("{}{}{} = ?", q, col.trim(), q));
            args.push(val.clone());
        }
    }

    let sql = format!(
        "DELETE FROM {}{}{} WHERE {}",
        q, table, q,
        where_clauses.join(" AND ")
    );

    (sql, args)
}

fn build_insert_query(
    db_type: &str,
    table: &str,
    values: &std::collections::HashMap<String, Option<String>>
) -> (String, Vec<Option<String>>) {
    let q = if db_type == "mysql" { "`" } else { "\"" };
    let mut cols = Vec::new();
    let mut placeholders = Vec::new();
    let mut args = Vec::new();

    for (col, val) in values {
        cols.push(format!("{}{}{}", q, col.trim(), q));
        placeholders.push("?");
        args.push(val.clone());
    }

    let sql = format!(
        "INSERT INTO {}{}{} ({}) VALUES ({})",
        q, table, q,
        cols.join(", "),
        placeholders.join(", ")
    );

    (sql, args)
}

#[command]
pub async fn update_record(
    state: State<'_, AppState>,
    connection_string: String,
    table_name: String,
    identifier: RowIdentifier,
    updates: Vec<CellUpdate>,
) -> Result<u64, String> {
    let pool = crate::db::get_connection(&state, &connection_string).await.map_err(|e| e.to_string())?;
    
    let db_type = match pool {
        PoolWrapper::Sqlite(_) => "sqlite",
        PoolWrapper::Mysql(_) => "mysql",
        PoolWrapper::Postgres(_) => "postgres",
    };
    
    let (sql, args) = build_update_query(db_type, &table_name, &identifier, &updates);

    let rows_affected = match pool {
        PoolWrapper::Sqlite(p) => {
            let mut query = sqlx::query(&sql);
            for arg in args {
                query = query.bind(arg);
            }
            let res = query.execute(&p).await.map_err(|e| e.to_string())?;
            res.rows_affected()
        },
        PoolWrapper::Mysql(p) => {
            let mut query = sqlx::query(&sql);
            for arg in args {
                query = query.bind(arg);
            }
            let res = query.execute(&p).await.map_err(|e| e.to_string())?;
            res.rows_affected()
        },
        PoolWrapper::Postgres(_) => {
             return Err("Postgres CRUD not fully implemented yet".into());
        }
    };

    Ok(rows_affected)
}

#[command]
pub async fn delete_record(
    state: State<'_, AppState>,
    connection_string: String,
    table_name: String,
    identifier: RowIdentifier,
) -> Result<u64, String> {
    let pool = crate::db::get_connection(&state, &connection_string).await.map_err(|e| e.to_string())?;
    let db_type = match pool {
        PoolWrapper::Sqlite(_) => "sqlite",
        PoolWrapper::Mysql(_) => "mysql",
        PoolWrapper::Postgres(_) => "postgres",
    };
    
    let (sql, args) = build_delete_query(db_type, &table_name, &identifier);

    let rows_affected = match pool {
        PoolWrapper::Sqlite(p) => {
            let mut query = sqlx::query(&sql);
            for arg in args { query = query.bind(arg); }
            let res = query.execute(&p).await.map_err(|e| e.to_string())?;
            res.rows_affected()
        },
        PoolWrapper::Mysql(p) => {
            let mut query = sqlx::query(&sql);
            for arg in args { query = query.bind(arg); }
            let res = query.execute(&p).await.map_err(|e| e.to_string())?;
            res.rows_affected()
        },
        _ => return Err("Unsupported DB for CRUD".into())
    };

    Ok(rows_affected)
}

#[command]
pub async fn insert_record(
    state: State<'_, AppState>,
    connection_string: String,
    table_name: String,
    values: std::collections::HashMap<String, Option<String>>,
) -> Result<u64, String> {
    let pool = crate::db::get_connection(&state, &connection_string).await.map_err(|e| e.to_string())?;
    let db_type = match pool {
        PoolWrapper::Sqlite(_) => "sqlite",
        PoolWrapper::Mysql(_) => "mysql",
        PoolWrapper::Postgres(_) => "postgres",
    };

    let (sql, args) = build_insert_query(db_type, &table_name, &values);

    let rows_affected = match pool {
        PoolWrapper::Sqlite(p) => {
             let mut query = sqlx::query(&sql);
             for arg in args { query = query.bind(arg); }
             let res = query.execute(&p).await.map_err(|e| e.to_string())?;
             res.rows_affected()
        },
        PoolWrapper::Mysql(p) => {
             let mut query = sqlx::query(&sql);
             for arg in args { query = query.bind(arg); }
             let res = query.execute(&p).await.map_err(|e| e.to_string())?;
             res.rows_affected()
        },
        _ => return Err("Unsupported DB for CRUD".into())
    };

    Ok(rows_affected)
}

#[command]
pub async fn apply_batch_changes(
    state: State<'_, AppState>,
    connection_string: String,
    changes: Vec<BatchChange>
) -> Result<u64, String> {
    let pool = crate::db::get_connection(&state, &connection_string).await.map_err(|e| e.to_string())?;
    let db_type = match pool {
        PoolWrapper::Sqlite(_) => "sqlite",
        PoolWrapper::Mysql(_) => "mysql",
        PoolWrapper::Postgres(_) => "postgres",
    };

    // Transactional Execution
    match pool {
        PoolWrapper::Sqlite(p) => {
            let mut tx = p.begin().await.map_err(|e| e.to_string())?;
            let mut total_affected = 0;

            for change in changes {
                let (sql, args) = match change.operation.as_str() {
                    "UPDATE" => {
                        if change.identifier.is_none() || change.updates.is_none() {
                             return Err(format!("Invalid UPDATE payload for table {}", change.table_name));
                        }
                        build_update_query(db_type, &change.table_name, change.identifier.as_ref().unwrap(), change.updates.as_ref().unwrap())
                    },
                    "DELETE" => {
                        if change.identifier.is_none() {
                             return Err(format!("Invalid DELETE payload for table {}", change.table_name));
                        }
                        build_delete_query(db_type, &change.table_name, change.identifier.as_ref().unwrap())
                    },
                    "INSERT" => {
                        if change.insert_values.is_none() {
                             return Err(format!("Invalid INSERT payload for table {}", change.table_name));
                        }
                        build_insert_query(db_type, &change.table_name, change.insert_values.as_ref().unwrap())
                    },
                    _ => return Err(format!("Unknown operation: {}", change.operation))
                };

                // Execute in transaction
                let mut query = sqlx::query(&sql);
                for arg in args {
                    query = query.bind(arg);
                }
                
                let res = query.execute(&mut *tx).await.map_err(|e| e.to_string())?;
                total_affected += res.rows_affected();
            }

            tx.commit().await.map_err(|e: sqlx::Error| e.to_string())?;
            Ok(total_affected)
        },
        PoolWrapper::Mysql(p) => {
            let mut tx = p.begin().await.map_err(|e| e.to_string())?;
            let mut total_affected = 0;

            for change in changes {
                let (sql, args) = match change.operation.as_str() {
                    "UPDATE" => {
                        if change.identifier.is_none() || change.updates.is_none() {
                             return Err(format!("Invalid UPDATE payload for table {}", change.table_name));
                        }
                         build_update_query(db_type, &change.table_name, change.identifier.as_ref().unwrap(), change.updates.as_ref().unwrap())
                    },
                    "DELETE" => {
                        if change.identifier.is_none() {
                             return Err(format!("Invalid DELETE payload for table {}", change.table_name));
                        }
                        build_delete_query(db_type, &change.table_name, change.identifier.as_ref().unwrap())
                    },
                    "INSERT" => {
                         if change.insert_values.is_none() {
                             return Err(format!("Invalid INSERT payload for table {}", change.table_name));
                        }
                        build_insert_query(db_type, &change.table_name, change.insert_values.as_ref().unwrap())
                    },
                    _ => return Err(format!("Unknown operation: {}", change.operation))
                };

                let mut query = sqlx::query(&sql);
                for arg in args {
                    query = query.bind(arg);
                }
                
                let res = query.execute(&mut *tx).await.map_err(|e| e.to_string())?;
                total_affected += res.rows_affected();
            }

            tx.commit().await.map_err(|e: sqlx::Error| e.to_string())?;
            Ok(total_affected)
        },
        _ => Err("Unsupported DB for Batch Operations".into())
    }
}
