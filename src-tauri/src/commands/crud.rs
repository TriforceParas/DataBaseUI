use crate::db::PoolWrapper;
use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::{State, command};
use sqlx::Row;

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
    updates: &Vec<CellUpdate>,
    pg_types: Option<&std::collections::HashMap<String, String>>
) -> (String, Vec<Option<String>>) {
    let q = if db_type == "mysql" { "`" } else { "\"" };
    let mut set_clauses = Vec::new();
    let mut args = Vec::new();
    let mut placeholder_idx = 1usize;

    for update in updates {
        let placeholder = if db_type == "postgres" {
            let cast = get_postgres_cast(update.column.trim(), pg_types);
            format!("${}{}", placeholder_idx, cast)
        } else {
            "?".to_string()
        };
        placeholder_idx += 1;
        set_clauses.push(format!("{}{}{} = {}", q, update.column.trim(), q, placeholder));
        args.push(update.value.clone());
    }

    let mut where_clauses = Vec::new();
    for (i, col) in identifier.columns.iter().enumerate() {
        let val = &identifier.values[i];
        if val.is_none() {
            where_clauses.push(format!("{}{}{} IS NULL", q, col.trim(), q));
        } else {
            let placeholder = if db_type == "postgres" {
                let cast = get_postgres_cast(col.trim(), pg_types);
                format!("${}{}", placeholder_idx, cast)
            } else {
                "?".to_string()
            };
            placeholder_idx += 1;
            where_clauses.push(format!("{}{}{} = {}", q, col.trim(), q, placeholder));
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
    identifier: &RowIdentifier,
    pg_types: Option<&std::collections::HashMap<String, String>>
) -> (String, Vec<Option<String>>) {
    let q = if db_type == "mysql" { "`" } else { "\"" };
    let mut where_clauses = Vec::new();
    let mut args = Vec::new();
    let mut placeholder_idx = 1usize;

    for (i, col) in identifier.columns.iter().enumerate() {
        let val = &identifier.values[i];
        if val.is_none() {
            where_clauses.push(format!("{}{}{} IS NULL", q, col.trim(), q));
        } else {
            let placeholder = if db_type == "postgres" {
                let cast = get_postgres_cast(col.trim(), pg_types);
                format!("${}{}", placeholder_idx, cast)
            } else {
                "?".to_string()
            };
            placeholder_idx += 1;
            where_clauses.push(format!("{}{}{} = {}", q, col.trim(), q, placeholder));
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
    values: &std::collections::HashMap<String, Option<String>>,
    pg_types: Option<&std::collections::HashMap<String, String>>
) -> (String, Vec<Option<String>>) {
    let q = if db_type == "mysql" { "`" } else { "\"" };
    let mut cols = Vec::new();
    let mut placeholders = Vec::new();
    let mut args = Vec::new();
    let mut placeholder_idx = 1usize;

    for (col, val) in values {
        cols.push(format!("{}{}{}", q, col.trim(), q));
        let placeholder = if db_type == "postgres" {
            let cast = get_postgres_cast(col.trim(), pg_types);
            format!("${}{}", placeholder_idx, cast)
        } else {
            "?".to_string()
        };
        placeholder_idx += 1;
        placeholders.push(placeholder);
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
    
    let pg_types = if let PoolWrapper::Postgres(p) = &pool {
        Some(get_postgres_column_types(p, &table_name).await)
    } else {
        None
    };

    let (sql, args) = build_update_query(db_type, &table_name, &identifier, &updates, pg_types.as_ref());

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
        PoolWrapper::Postgres(p) => {
            let mut query = sqlx::query(&sql);
            for arg in args {
                query = query.bind(arg);
            }
            let res = query.execute(&p).await.map_err(|e| e.to_string())?;
            res.rows_affected()
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
    
    let pg_types = if let PoolWrapper::Postgres(p) = &pool {
        Some(get_postgres_column_types(p, &table_name).await)
    } else {
        None
    };

    let (sql, args) = build_delete_query(db_type, &table_name, &identifier, pg_types.as_ref());

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
        PoolWrapper::Postgres(p) => {
            let mut query = sqlx::query(&sql);
            for arg in args { query = query.bind(arg); }
            let res = query.execute(&p).await.map_err(|e| e.to_string())?;
            res.rows_affected()
        }
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

    let pg_types = if let PoolWrapper::Postgres(p) = &pool {
        Some(get_postgres_column_types(p, &table_name).await)
    } else {
        None
    };

    let (sql, args) = build_insert_query(db_type, &table_name, &values, pg_types.as_ref());

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
        PoolWrapper::Postgres(p) => {
            let mut query = sqlx::query(&sql);
            for arg in args { query = query.bind(arg); }
            let res = query.execute(&p).await.map_err(|e| e.to_string())?;
            res.rows_affected()
        }
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
                        build_update_query(db_type, &change.table_name, change.identifier.as_ref().unwrap(), change.updates.as_ref().unwrap(), None)
                    },
                    "DELETE" => {
                        if change.identifier.is_none() {
                             return Err(format!("Invalid DELETE payload for table {}", change.table_name));
                        }
                        build_delete_query(db_type, &change.table_name, change.identifier.as_ref().unwrap(), None)
                    },
                    "INSERT" => {
                        if change.insert_values.is_none() {
                             return Err(format!("Invalid INSERT payload for table {}", change.table_name));
                        }
                        build_insert_query(db_type, &change.table_name, change.insert_values.as_ref().unwrap(), None)
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
                         build_update_query(db_type, &change.table_name, change.identifier.as_ref().unwrap(), change.updates.as_ref().unwrap(), None)
                    },
                    "DELETE" => {
                        if change.identifier.is_none() {
                             return Err(format!("Invalid DELETE payload for table {}", change.table_name));
                        }
                        build_delete_query(db_type, &change.table_name, change.identifier.as_ref().unwrap(), None)
                    },
                    "INSERT" => {
                         if change.insert_values.is_none() {
                             return Err(format!("Invalid INSERT payload for table {}", change.table_name));
                        }
                        build_insert_query(db_type, &change.table_name, change.insert_values.as_ref().unwrap(), None)
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
        PoolWrapper::Postgres(p) => {
            let mut tx = p.begin().await.map_err(|e| e.to_string())?;
            let mut total_affected = 0;
            
            // Cache for table schemas to minimize queries
            let mut schema_cache: std::collections::HashMap<String, std::collections::HashMap<String, String>> = std::collections::HashMap::new();

            for change in changes {
                // Fetch schema if not in cache
                if !schema_cache.contains_key(&change.table_name) {
                    let map = get_postgres_column_types(&p, &change.table_name).await;
                    schema_cache.insert(change.table_name.clone(), map);
                }
                let pg_types = schema_cache.get(&change.table_name);

                let (sql, args) = match change.operation.as_str() {
                    "UPDATE" => {
                        if change.identifier.is_none() || change.updates.is_none() {
                            return Err(format!("Invalid UPDATE payload for table {}", change.table_name));
                        }
                        build_update_query(db_type, &change.table_name, change.identifier.as_ref().unwrap(), change.updates.as_ref().unwrap(), pg_types)
                    },
                    "DELETE" => {
                        if change.identifier.is_none() {
                            return Err(format!("Invalid DELETE payload for table {}", change.table_name));
                        }
                        build_delete_query(db_type, &change.table_name, change.identifier.as_ref().unwrap(), pg_types)
                    },
                    "INSERT" => {
                        if change.insert_values.is_none() {
                            return Err(format!("Invalid INSERT payload for table {}", change.table_name));
                        }
                        build_insert_query(db_type, &change.table_name, change.insert_values.as_ref().unwrap(), pg_types)
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
        }
    }
}
async fn get_postgres_column_types(pool: &sqlx::PgPool, table_name: &str) -> std::collections::HashMap<String, String> {
    let (schema, table) = if let Some((s, t)) = table_name.split_once('.') {
        (s.trim_matches('"'), t.trim_matches('"'))
    } else {
        ("public", table_name.trim_matches('"'))
    };

    let q = "SELECT column_name::TEXT, udt_name::TEXT FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2";
    let rows = sqlx::query(q)
        .bind(schema)
        .bind(table)
        .fetch_all(pool)
        .await
        .unwrap_or_default();

    let mut map = std::collections::HashMap::new();
    for row in rows {
        let name: String = row.get("column_name");
        let type_name: String = row.get("udt_name");
        map.insert(name, type_name);
    }
    map
}

fn get_postgres_cast(col_name: &str, type_map: Option<&std::collections::HashMap<String, String>>) -> String {
    if let Some(map) = type_map {
        if let Some(type_name) = map.get(col_name) {
            return match type_name.as_str() {
                "int4" | "int2" => "::integer".to_string(),
                "int8" => "::bigint".to_string(),
                "bool" => "::boolean".to_string(),
                "numeric" | "float4" | "float8" => "::numeric".to_string(),
                "uuid" => "::uuid".to_string(),
                "json" | "jsonb" => format!("::{}", type_name),
                "timestamp" | "timestamptz" | "date" | "time" | "timetz" => format!("::{}", type_name),
                "bytea" => "::bytea".to_string(),
                _ => String::new()
            };
        }
    }
    String::new()
}
