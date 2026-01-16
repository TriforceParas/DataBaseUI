use crate::models::{ColumnSchema, QueryResult};
use crate::utils::{escape_identifier, split_sql_statements};
use sqlx::{Column, Row, TypeInfo};
use serde::{Deserialize, Serialize};
use tauri::{self, State};
use crate::db::{AppState, PoolWrapper};

// Filter types for get_table_data command
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterCondition {
    pub id: String,
    pub enabled: bool,
    pub column: String,
    pub operator: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SortState {
    pub column: String,
    pub direction: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct TableDataResponse {
    pub data: QueryResult,
    pub total_count: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ForeignKeyInput {
    pub column: String,
    pub ref_table: String,
    pub ref_column: String,
    pub on_delete: String,
    pub on_update: String,
}


#[tauri::command]
pub async fn export_schema(
    state: State<'_, AppState>,
    connection_string: String,
    directory_path: String
) -> Result<String, String> {
    use std::fs;
    use std::path::Path;

    let pool = crate::db::get_connection(&state, &connection_string).await.map_err(|e| e.to_string())?;
    
    let db_type = match pool {
        PoolWrapper::Mysql(_) => "mysql",
        PoolWrapper::Postgres(_) => "postgres",
        PoolWrapper::Sqlite(_) => "sqlite",
    };

    let tables = get_tables(state.clone(), connection_string.clone()).await?;
    
    let dir = Path::new(&directory_path);
    if !dir.exists() {
        return Err("Directory does not exist".to_string());
    }

    let mut log = String::new();
    let mut success_count = 0;

    for table in tables {
        match get_table_schema(state.clone(), connection_string.clone(), table.clone()).await {
            Ok(cols) => {
                let sql = generate_create_table_sql(&table, &cols, &[], db_type);
                let file_path = dir.join(format!("{}.sql", table));
                match fs::write(&file_path, sql) {
                    Ok(_) => {
                        success_count += 1;
                        log.push_str(&format!("Exported {}\n", table));
                    },
                    Err(e) => log.push_str(&format!("Failed to write {}: {}\n", table, e)),
                }
            },
            Err(e) => log.push_str(&format!("Failed to get schema for {}: {}\n", table, e)),
        }
    }

    log.push_str(&format!("Export compeleted. {} tables exported.", success_count));
    Ok(log)
}

#[tauri::command]
pub async fn import_schema(
    state: State<'_, AppState>,
    connection_string: String, 
    directory_path: String
) -> Result<String, String> {
    use std::fs;
    use std::path::Path;

    let dir = Path::new(&directory_path);
    if !dir.exists() {
        return Err("Directory does not exist".to_string());
    }

    let pool = crate::db::get_connection(&state, &connection_string).await.map_err(|e| e.to_string())?;

    let entries = fs::read_dir(dir).map_err(|e| format!("Failed to read directory: {}", e))?;
    let mut log = String::new();
    let mut success_count = 0;
    let mut error_count = 0;

    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "sql") {
                let filename = path.file_name().unwrap_or_default().to_string_lossy();
                match fs::read_to_string(&path) {
                    Ok(sql) => {
                         // match pool to execute
                         let mut file_error = false;
                         match pool {
                             PoolWrapper::Mysql(ref p) => {
                                 let stmts = split_sql_statements(&sql, true);
                                 for stmt in stmts {
                                     if stmt.trim().is_empty() { continue; }
                                     if let Err(e) = sqlx::query(&stmt).execute(p).await {
                                         log.push_str(&format!("Error in {}: {}\n", filename, e));
                                         file_error = true;
                                         break; 
                                     }
                                 }
                             },
                             PoolWrapper::Postgres(ref p) => {
                                 let stmts = split_sql_statements(&sql, false);
                                 for stmt in stmts {
                                     if stmt.trim().is_empty() { continue; }
                                     if let Err(e) = sqlx::query(&stmt).execute(p).await {
                                         log.push_str(&format!("Error in {}: {}\n", filename, e));
                                         file_error = true;
                                         break; 
                                     }
                                 }
                             },
                             PoolWrapper::Sqlite(ref p) => {
                                 let stmts = split_sql_statements(&sql, false);
                                 for stmt in stmts {
                                     if stmt.trim().is_empty() { continue; }
                                     if let Err(e) = sqlx::query(&stmt).execute(p).await {
                                         log.push_str(&format!("Error in {}: {}\n", filename, e));
                                         file_error = true;
                                         break; 
                                     }
                                 }
                             }
                        }
                         
                         if !file_error {
                             success_count += 1;
                             log.push_str(&format!("Imported {}\n", filename));
                         } else {
                             error_count += 1;
                         }
                    },
                    Err(e) => {
                        log.push_str(&format!("Failed to read {}: {}\n", filename, e));
                        error_count += 1;
                    }
                }
            }
        }
    }
    
    log.push_str(&format!("Import completed. {} success, {} errors.", success_count, error_count));
    Ok(log)
}

// Macro for MySQL and Postgres (supports rust_decimal)
macro_rules! process_rows_with_decimal {
    ($rows:expr) => {{
        if $rows.is_empty() {
            QueryResult {
                columns: vec![],
                rows: vec![],
            }
        } else {
            let columns: Vec<String> = $rows[0]
                .columns()
                .iter()
                .map(|c| c.name().to_string())
                .collect();

            let mut result_rows = Vec::new();

            for row in $rows {
                let mut result_row = Vec::new();
                for i in 0..columns.len() {
                    let val_str = if let Ok(v) = row.try_get::<String, _>(i) {
                        v
                    } else if let Ok(v) = row.try_get::<i64, _>(i) {
                        v.to_string()
                    } else if let Ok(v) = row.try_get::<i32, _>(i) {
                        v.to_string()
                    } else if let Ok(v) = row.try_get::<f64, _>(i) {
                        v.to_string()
                    } else if let Ok(v) = row.try_get::<bool, _>(i) {
                        v.to_string()
                    } else if let Ok(v) = row.try_get::<chrono::NaiveDate, _>(i) {
                        v.to_string()
                    } else if let Ok(v) = row.try_get::<chrono::NaiveDateTime, _>(i) {
                        v.to_string()
                    } else if let Ok(v) = row.try_get::<chrono::DateTime<chrono::Utc>, _>(i) {
                        v.to_string()
                    } else if let Ok(v) = row.try_get::<rust_decimal::Decimal, _>(i) {
                        v.to_string()
                    } else if let Ok(v) = row.try_get::<Vec<u8>, _>(i) {
                        String::from_utf8(v.clone())
                            .unwrap_or_else(|_| format!("<BINARY {} bytes>", v.len()))
                    } else {
                        match row.try_get::<Option<String>, _>(i) {
                            Ok(None) => "NULL".to_string(),
                            Err(_e) => {
                                let type_name = row.column(i).type_info().name();
                                format!("ERR[{}]", type_name)
                            }
                            Ok(Some(s)) => s,
                        }
                    };
                    result_row.push(val_str);
                }
                result_rows.push(result_row);
            }

            QueryResult {
                columns,
                rows: result_rows,
            }
        }
    }};
}

macro_rules! process_rows_sqlite {
    ($rows:expr) => {{
        if $rows.is_empty() {
            QueryResult {
                columns: vec![],
                rows: vec![],
            }
        } else {
            let columns: Vec<String> = $rows[0]
                .columns()
                .iter()
                .map(|c| c.name().to_string())
                .collect();

            let mut result_rows = Vec::new();

            for row in $rows {
                let mut result_row = Vec::new();
                for i in 0..columns.len() {
                    let val_str = if let Ok(v) = row.try_get::<String, _>(i) {
                        v
                    } else if let Ok(v) = row.try_get::<i64, _>(i) {
                        v.to_string()
                    } else if let Ok(v) = row.try_get::<i32, _>(i) {
                        v.to_string()
                    } else if let Ok(v) = row.try_get::<f64, _>(i) {
                        v.to_string()
                    } else if let Ok(v) = row.try_get::<bool, _>(i) {
                        v.to_string()
                    } else if let Ok(v) = row.try_get::<chrono::NaiveDate, _>(i) {
                        v.to_string()
                    } else if let Ok(v) = row.try_get::<chrono::NaiveDateTime, _>(i) {
                        v.to_string()
                    } else if let Ok(v) = row.try_get::<chrono::DateTime<chrono::Utc>, _>(i) {
                        v.to_string()
                    } else if let Ok(v) = row.try_get::<Vec<u8>, _>(i) {
                        String::from_utf8(v.clone())
                            .unwrap_or_else(|_| format!("<BINARY {} bytes>", v.len()))
                    } else {
                        match row.try_get::<Option<String>, _>(i) {
                            Ok(None) => "NULL".to_string(),
                            Err(_e) => {
                                let type_name = row.column(i).type_info().name();
                                format!("ERR[{}]", type_name)
                            }
                            Ok(Some(s)) => s,
                        }
                    };
                    result_row.push(val_str);
                }
                result_rows.push(result_row);
            }

            QueryResult {
                columns,
                rows: result_rows,
            }
        }
    }};
}

#[tauri::command]
pub async fn execute_query(
    state: State<'_, AppState>,
    connection_string: String,
    query: String,
) -> Result<Vec<QueryResult>, String> {
    let pool = crate::db::get_connection(&state, &connection_string).await.map_err(|e| e.to_string())?;

    match pool {
        PoolWrapper::Mysql(p) => {
            let stmts = split_sql_statements(&query, true);
            let mut results = Vec::new();

            for stmt in stmts {
                let rows = sqlx::query(&stmt)
                    .fetch_all(&p)
                    .await
                    .map_err(|e| format!("Query failed: {}", e))?;

                let res = process_rows_with_decimal!(rows);
                results.push(res);
            }
            Ok(results)
        },
        PoolWrapper::Postgres(p) => {
            let stmts = split_sql_statements(&query, false);
            let mut results = Vec::new();

            for stmt in stmts {
                let rows = sqlx::query(&stmt)
                    .fetch_all(&p)
                    .await
                    .map_err(|e| format!("Query failed: {}", e))?;

                let res = process_rows_with_decimal!(rows);
                results.push(res);
            }
            Ok(results)
        },
        PoolWrapper::Sqlite(p) => {
            let stmts = split_sql_statements(&query, false);
            let mut results = Vec::new();

            for stmt in stmts {
                let rows = sqlx::query(&stmt)
                    .fetch_all(&p)
                    .await
                    .map_err(|e| format!("Query failed: {}", e))?;

                let res = process_rows_sqlite!(rows);
                results.push(res);
            }
            Ok(results)
        }
    }
}

#[tauri::command]
pub async fn get_columns(
    state: State<'_, AppState>,
    connection_string: String,
    table_name: String,
) -> Result<Vec<String>, String> {
    let pool = crate::db::get_connection(&state, &connection_string).await.map_err(|e| e.to_string())?;

    match pool {
        PoolWrapper::Mysql(p) => {
             let query = format!("SHOW COLUMNS FROM {}", escape_identifier(&table_name, "mysql"));
             let rows = sqlx::query(&query).fetch_all(&p).await.map_err(|e| format!("Failed to fetch columns: {}", e))?;
             let columns: Vec<String> = rows.iter().map(|row| row.try_get(0).unwrap_or_default()).collect();
             Ok(columns)
        },
        PoolWrapper::Postgres(p) => {
             // Added ::TEXT cast to fix PostgreSQL type issue
             let query = format!("SELECT column_name::TEXT FROM information_schema.columns WHERE table_name = '{}' AND table_schema = 'public'", table_name.replace('\'', "''"));
             let rows = sqlx::query(&query).fetch_all(&p).await.map_err(|e| format!("Failed to fetch columns: {}", e))?;
             let columns: Vec<String> = rows.iter().map(|row| row.try_get(0).unwrap_or_default()).collect();
             Ok(columns)
        },
        PoolWrapper::Sqlite(p) => {
             let query = format!("PRAGMA table_info({})", escape_identifier(&table_name, "sqlite"));
             let rows = sqlx::query(&query).fetch_all(&p).await.map_err(|e| format!("Failed to fetch columns: {}", e))?;
             // PRAGMA table_info returns: cid, name, type, notnull, dflt_value, pk at indices 0,1,2,3,4,5
             // name is index 1
             let columns: Vec<String> = rows.iter().map(|row| row.try_get(1).unwrap_or_default()).collect();
             Ok(columns)
        }
    }
}

#[tauri::command]
pub async fn get_tables(
    state: State<'_, AppState>,
    connection_string: String
) -> Result<Vec<String>, String> {
    let pool = crate::db::get_connection(&state, &connection_string).await.map_err(|e| e.to_string())?;

    match pool {
        PoolWrapper::Mysql(p) => {
             let rows = sqlx::query("SHOW TABLES").fetch_all(&p).await.map_err(|e| format!("Failed to fetch tables: {}", e))?;
             let tables: Vec<String> = rows.iter().map(|row| row.try_get(0).unwrap_or_default()).collect();
             Ok(tables)
        },
        PoolWrapper::Postgres(p) => {
             // Added ::TEXT cast to fix PostgreSQL type issue
             let rows = sqlx::query("SELECT table_name::TEXT FROM information_schema.tables WHERE table_schema = 'public'")
                 .fetch_all(&p).await.map_err(|e| format!("Failed to fetch tables: {}", e))?;
             let tables: Vec<String> = rows.iter().map(|row| row.try_get(0).unwrap_or_default()).collect();
             Ok(tables)
        },
        PoolWrapper::Sqlite(p) => {
             let rows = sqlx::query("SELECT name FROM sqlite_master WHERE type='table'")
                 .fetch_all(&p).await.map_err(|e| format!("Failed to fetch tables: {}", e))?;
             let tables: Vec<String> = rows.iter().map(|row| row.try_get(0).unwrap_or_default()).collect();
             Ok(tables)
        }
    }
}

fn parse_sqlite_schema_row(row: &sqlx::sqlite::SqliteRow) -> ColumnSchema {
    ColumnSchema {
        name: row.try_get::<String, _>(1).unwrap_or_default(),
        type_name: row.try_get::<String, _>(2).unwrap_or_default(),
        is_nullable: row.try_get::<i32, _>(3).unwrap_or(0) == 0, 
        is_primary_key: row.try_get::<i32, _>(5).unwrap_or(0) == 1,
        is_auto_increment: false,
        is_unique: false,
        default_value: row.try_get::<Option<String>, _>(4).ok().flatten(),
        foreign_key: None, 
    }
}


#[tauri::command]
pub async fn get_table_schema(
    state: State<'_, AppState>,
    connection_string: String,
    table_name: String,
) -> Result<Vec<ColumnSchema>, String> {
    let pool = crate::db::get_connection(&state, &connection_string).await.map_err(|e| e.to_string())?;

    match pool {
        PoolWrapper::Postgres(p) => {
             let query = format!(
            "SELECT 
                c.column_name::TEXT, 
                CASE 
                    WHEN c.data_type = 'character varying' AND c.character_maximum_length IS NOT NULL 
                        THEN 'varchar(' || c.character_maximum_length || ')'
                    WHEN c.data_type = 'character varying' 
                        THEN 'varchar'
                    WHEN c.data_type = 'character' AND c.character_maximum_length IS NOT NULL 
                        THEN 'char(' || c.character_maximum_length || ')'
                    WHEN c.data_type = 'character' 
                        THEN 'char'
                    WHEN c.data_type = 'numeric' AND c.numeric_precision IS NOT NULL 
                        THEN 'numeric(' || c.numeric_precision || ',' || COALESCE(c.numeric_scale, 0) || ')'
                    WHEN c.data_type = 'decimal' AND c.numeric_precision IS NOT NULL 
                        THEN 'decimal(' || c.numeric_precision || ',' || COALESCE(c.numeric_scale, 0) || ')'
                    ELSE c.data_type
                END as data_type, 
                c.is_nullable, 
                c.column_default,
                CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN 'PRI' ELSE '' END as column_key,
                CASE WHEN c.column_default LIKE 'nextval%%' THEN 'auto_increment' ELSE '' END as extra,
                ccu.table_name::TEXT AS referenced_table,
                ccu.column_name::TEXT AS referenced_column
            FROM 
                information_schema.columns c
            LEFT JOIN 
                information_schema.key_column_usage kcu ON c.table_name = kcu.table_name AND c.column_name = kcu.column_name AND c.table_schema = kcu.table_schema
            LEFT JOIN 
                information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
            LEFT JOIN 
                information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema AND tc.constraint_type = 'FOREIGN KEY'
            WHERE 
                c.table_name = '{}' AND c.table_schema = 'public'
            ORDER BY 
                c.ordinal_position",
            table_name
            );
            
            let rows = sqlx::query(&query).fetch_all(&p).await.map_err(|e| e.to_string())?;
            
            let schema: Vec<ColumnSchema> = rows.iter().map(|row| {
                 let is_nullable_str: String = row.try_get(2).unwrap_or_default();
                 let col_key: String = row.try_get(4).unwrap_or_default();
                 let user_default: Option<String> = row.try_get(3).ok();
                 let extra: String = row.try_get(5).unwrap_or_default();
                 let ref_table: Option<String> = row.try_get(6).ok();
                 let ref_col: Option<String> = row.try_get(7).ok();
                 
                 let foreign_key = if let (Some(t), Some(c)) = (ref_table, ref_col) {
                      if !t.is_empty() && !c.is_empty() { Some(crate::models::ForeignKey { referenced_table: t, referenced_column: c }) } else { None }
                 } else { None };

                 ColumnSchema {
                    name: row.try_get(0).unwrap_or_default(),
                    type_name: row.try_get(1).unwrap_or_default(),
                    is_nullable: is_nullable_str == "YES",
                    is_primary_key: col_key == "PRI" || col_key == "PRIMARY KEY",
                    is_auto_increment: extra.contains("auto_increment") || extra.contains("nextval"),
                    is_unique: col_key == "UNI" || col_key == "UNIQUE",
                    default_value: user_default,
                    foreign_key,
                }
            }).collect();
            Ok(schema)
        },
        PoolWrapper::Mysql(p) => {
             let query = format!(
            "SELECT 
                c.COLUMN_NAME, 
                c.DATA_TYPE, 
                c.IS_NULLABLE, 
                c.COLUMN_DEFAULT, 
                c.COLUMN_KEY, 
                c.EXTRA,
                k.REFERENCED_TABLE_NAME,
                k.REFERENCED_COLUMN_NAME
            FROM 
                information_schema.COLUMNS c
            LEFT JOIN 
                information_schema.KEY_COLUMN_USAGE k ON c.TABLE_NAME = k.TABLE_NAME AND c.COLUMN_NAME = k.COLUMN_NAME AND c.TABLE_SCHEMA = k.TABLE_SCHEMA AND k.REFERENCED_TABLE_NAME IS NOT NULL
            WHERE 
                c.TABLE_NAME = '{}' AND c.TABLE_SCHEMA = DATABASE()
            ORDER BY 
                c.ORDINAL_POSITION",
            table_name
            );
            
            let rows = sqlx::query(&query).fetch_all(&p).await.map_err(|e| e.to_string())?;
            
            let schema: Vec<ColumnSchema> = rows.iter().map(|row| {
                 let is_nullable_str: String = row.try_get(2).unwrap_or_default();
                 let col_key: String = row.try_get(4).unwrap_or_default();
                 let user_default: Option<String> = row.try_get(3).ok();
                 let extra: String = row.try_get(5).unwrap_or_default();
                 let ref_table: Option<String> = row.try_get(6).ok();
                 let ref_col: Option<String> = row.try_get(7).ok();
                 
                 let foreign_key = if let (Some(t), Some(c)) = (ref_table, ref_col) {
                      if !t.is_empty() && !c.is_empty() { Some(crate::models::ForeignKey { referenced_table: t, referenced_column: c }) } else { None }
                 } else { None };
                 
                 ColumnSchema {
                    name: row.try_get(0).unwrap_or_default(),
                    type_name: row.try_get(1).unwrap_or_default(),
                    is_nullable: is_nullable_str == "YES",
                    is_primary_key: col_key == "PRI" || col_key == "PRIMARY KEY",
                    is_auto_increment: extra.contains("auto_increment") || extra.contains("nextval"),
                    is_unique: col_key == "UNI" || col_key == "UNIQUE",
                    default_value: user_default,
                    foreign_key,
                }
            }).collect();
            Ok(schema)
        },
        PoolWrapper::Sqlite(p) => {
             let query = format!("PRAGMA table_info('{}')", table_name);
             let rows = sqlx::query(&query).fetch_all(&p).await.map_err(|e| format!("Failed to fetch schema: {}", e))?;
             
             let mut schema: Vec<ColumnSchema> = rows.iter().map(|row| parse_sqlite_schema_row(row)).collect();

             // SQLite FK
             let fk_query = format!("PRAGMA foreign_key_list('{}')", table_name);
             if let Ok(fk_rows) = sqlx::query(&fk_query).fetch_all(&p).await {
                for fk_row in fk_rows {
                    let from_col: String = fk_row.try_get(3).unwrap_or_default();
                    let to_table: String = fk_row.try_get(2).unwrap_or_default();
                    let to_col: String = fk_row.try_get(4).unwrap_or_default();

                    if let Some(col) = schema.iter_mut().find(|c| c.name == from_col) {
                        col.foreign_key = Some(crate::models::ForeignKey {
                            referenced_table: to_table,
                            referenced_column: to_col,
                        });
                    }
                }
            }
            Ok(schema)
        }
    }
}

#[tauri::command]
pub async fn truncate_table(
    state: State<'_, AppState>,
    connection_string: String,
    table_name: String
) -> Result<(), String> {
    let pool = crate::db::get_connection(&state, &connection_string).await.map_err(|e| e.to_string())?;

    match pool {
        PoolWrapper::Mysql(p) => {
             let query = format!("TRUNCATE TABLE {}", escape_identifier(&table_name, "mysql"));
             sqlx::query(&query).execute(&p).await.map_err(|e| format!("Failed to truncate table: {}", e))?;
             Ok(())
        },
        PoolWrapper::Postgres(p) => {
             let query = format!("TRUNCATE TABLE {}", escape_identifier(&table_name, "postgres"));
             sqlx::query(&query).execute(&p).await.map_err(|e| format!("Failed to truncate table: {}", e))?;
             Ok(())
        },
        PoolWrapper::Sqlite(p) => {
             let query = format!("DELETE FROM {}", escape_identifier(&table_name, "sqlite"));
             sqlx::query(&query).execute(&p).await.map_err(|e| format!("Failed to truncate table: {}", e))?;
             Ok(())
        }
    }
}

#[tauri::command]
pub async fn drop_table(
    state: State<'_, AppState>,
    connection_string: String,
    table_name: String
) -> Result<(), String> {
    let pool = crate::db::get_connection(&state, &connection_string).await.map_err(|e| e.to_string())?;

    match pool {
        PoolWrapper::Mysql(p) => {
             let query = format!("DROP TABLE {}", escape_identifier(&table_name, "mysql"));
             sqlx::query(&query).execute(&p).await.map_err(|e| format!("Failed to drop table: {}", e))?;
             Ok(())
        },
        PoolWrapper::Postgres(p) => {
             let query = format!("DROP TABLE {}", escape_identifier(&table_name, "postgres"));
             sqlx::query(&query).execute(&p).await.map_err(|e| format!("Failed to drop table: {}", e))?;
             Ok(())
        },
        PoolWrapper::Sqlite(p) => {
             let query = format!("DROP TABLE {}", escape_identifier(&table_name, "sqlite"));
             sqlx::query(&query).execute(&p).await.map_err(|e| format!("Failed to drop table: {}", e))?;
             Ok(())
        }
    }
}

#[tauri::command]
pub async fn duplicate_table(
    state: State<'_, AppState>,
    connection_string: String,
    source_table: String,
    new_table: String,
    include_data: bool,
) -> Result<(), String> {
    let pool = crate::db::get_connection(&state, &connection_string).await.map_err(|e| e.to_string())?;

    match pool {
        PoolWrapper::Mysql(p) => {
            let escaped_new = escape_identifier(&new_table, "mysql");
            let escaped_source = escape_identifier(&source_table, "mysql");
            let query = format!(
                "CREATE TABLE {} AS SELECT * FROM {}{}",
                escaped_new,
                escaped_source,
                if include_data { "" } else { " WHERE 1=0" }
            );
            sqlx::query(&query).execute(&p).await.map_err(|e| format!("Failed to duplicate table: {}", e))?;
            Ok(())
        },
        PoolWrapper::Postgres(p) => {
            let escaped_new = escape_identifier(&new_table, "postgres");
            let escaped_source = escape_identifier(&source_table, "postgres");
            let query = format!(
                "CREATE TABLE {} AS SELECT * FROM {}{}",
                escaped_new,
                escaped_source,
                if include_data { "" } else { " WITH NO DATA" } // Postgres uses WITH NO DATA
            );
            sqlx::query(&query).execute(&p).await.map_err(|e| format!("Failed to duplicate table: {}", e))?;
            Ok(())
        },
        PoolWrapper::Sqlite(p) => {
            let escaped_new = escape_identifier(&new_table, "sqlite");
            let escaped_source = escape_identifier(&source_table, "sqlite");
            let query = format!(
                "CREATE TABLE {} AS SELECT * FROM {}{}",
                escaped_new,
                escaped_source,
                if include_data { "" } else { " WHERE 1=0" }
            );
            sqlx::query(&query).execute(&p).await.map_err(|e| format!("Failed to duplicate table: {}", e))?;
            Ok(())
        }
    }
}

#[tauri::command]
pub async fn get_databases(
    state: State<'_, AppState>,
    connection_string: String
) -> Result<Vec<String>, String> {
    let pool = crate::db::get_connection(&state, &connection_string).await.map_err(|e| e.to_string())?;

    match pool {
        PoolWrapper::Mysql(p) => {
             let rows = sqlx::query("SHOW DATABASES").fetch_all(&p).await.map_err(|e| format!("Failed to fetch databases: {}", e))?;
             let dbs: Vec<String> = rows.iter().map(|row| row.try_get(0).unwrap_or_default()).collect();
             Ok(dbs)
        },
        PoolWrapper::Postgres(p) => {
             // Added ::TEXT cast to fix PostgreSQL type issue
             let rows = sqlx::query("SELECT datname::TEXT FROM pg_database WHERE datistemplate = false AND datallowconn = true")
                 .fetch_all(&p).await.map_err(|e| format!("Failed to fetch databases: {}", e))?;
             let dbs: Vec<String> = rows.iter().map(|row| row.try_get(0).unwrap_or_default()).collect();
             Ok(dbs)
        },
        PoolWrapper::Sqlite(p) => {
             let rows = sqlx::query("SELECT file FROM pragma_database_list WHERE name='main'")
                 .fetch_all(&p).await.map_err(|e| format!("Failed to fetch databases: {}", e))?;
             let dbs: Vec<String> = rows.iter().map(|row| row.try_get(0).unwrap_or_default()).collect();
             Ok(dbs)
        }
    }
}

fn generate_create_table_sql(table_name: &str, columns: &[ColumnSchema], foreign_keys: &[ForeignKeyInput], db_type: &str) -> String {
    let cols_sql: Vec<String> = columns.iter().map(|col| {
        // Handle PostgreSQL SERIAL types
        let is_postgres_auto = db_type == "postgres" && (col.is_auto_increment || col.default_value.as_deref() == Some("AUTO_INCREMENT"));
        
        // Correctly handling type names for Postgres SERIAL/BIGSERIAL
        let type_str = if is_postgres_auto {
            match col.type_name.to_lowercase().as_str() {
                "integer" | "int" | "int4" => "SERIAL".to_string(),
                "bigint" | "int8" => "BIGSERIAL".to_string(),
                "smallint" | "int2" => "SMALLSERIAL".to_string(),
                "serial" => "SERIAL".to_string(),
                "bigserial" => "BIGSERIAL".to_string(),
                _ => col.type_name.clone(),
            }
        } else {
            col.type_name.clone()
        };

        let col_name = escape_identifier(&col.name, db_type);
        let mut line = format!("{} {}", col_name, type_str);

        // For SERIAL types, don't add NOT NULL (it's implicit) or DEFAULT
        if !col.is_nullable && !is_postgres_auto {
            line.push_str(" NOT NULL");
        }
        
        if !is_postgres_auto {
            if let Some(def) = &col.default_value {
                if !def.is_empty() && def != "AUTO_INCREMENT" && !def.starts_with("nextval") && !def.contains("::") { 
                    // Handle special defaults
                    let def_val = if def == "CURRENT_TIMESTAMP" || def == "NULL" || def == "TRUE" || def == "FALSE" {
                        def.clone()
                    } else if def.chars().all(|c| c.is_numeric() || c == '.') {
                        def.clone()
                    } else {
                        format!("'{}'", def)
                    };
                    line.push_str(&format!(" DEFAULT {}", def_val));
                }
            }
        }
        
        if col.is_primary_key {
            line.push_str(" PRIMARY KEY");
        }
        
        if col.is_auto_increment && db_type == "mysql" {
             line.push_str(" AUTO_INCREMENT");
        }
        
        if col.is_unique && !col.is_primary_key {
            line.push_str(" UNIQUE");
        }
        
        line
    }).collect();

    let mut defs = cols_sql;

    // Add Foreign Keys
    for fk in foreign_keys {
        let fk_clause = format!(
            "FOREIGN KEY ({}) REFERENCES {}({}) ON DELETE {} ON UPDATE {}",
            escape_identifier(&fk.column, db_type),
            escape_identifier(&fk.ref_table, db_type),
            escape_identifier(&fk.ref_column, db_type),
            fk.on_delete,
            fk.on_update
        );
        defs.push(fk_clause);
    }

    let q_table_name = escape_identifier(table_name, db_type);
    format!("CREATE TABLE IF NOT EXISTS {} (\n    {}\n);", q_table_name, defs.join(",\n    "))
}

#[tauri::command]
pub async fn create_database(
    state: State<'_, AppState>,
    connection_string: String, 
    database_name: String
) -> Result<(), String> {
    let pool = crate::db::get_connection(&state, &connection_string).await.map_err(|e| e.to_string())?;

    match pool {
        PoolWrapper::Mysql(p) => {
             let query = format!("CREATE DATABASE `{}`", database_name);
             sqlx::query(&query).execute(&p).await.map_err(|e| format!("Failed to create database: {}", e))?;
             Ok(())
        },
        PoolWrapper::Postgres(p) => {
             let query = format!("CREATE DATABASE \"{}\"", database_name);
             sqlx::query(&query).execute(&p).await.map_err(|e| format!("Failed to create database: {}", e))?;
             Ok(())
        },
        PoolWrapper::Sqlite(_) => {
             return Err("SQLite does not support creating databases via SQL".to_string());
        }
    }
}

#[tauri::command]
pub async fn duplicate_database(
    state: State<'_, AppState>,
    connection_string: String,
    source_database: String,
    target_database: String,
) -> Result<(), String> {
    let pool = crate::db::get_connection(&state, &connection_string).await.map_err(|e| e.to_string())?;

    match pool {
        PoolWrapper::Mysql(p) => {
            // MySQL: Create new DB, then copy tables
            sqlx::query(&format!("CREATE DATABASE `{}`", target_database))
                .execute(&p)
                .await
                .map_err(|e| format!("Failed to create target database: {}", e))?;

            let rows = sqlx::query(&format!("SHOW TABLES FROM `{}`", source_database))
                .fetch_all(&p)
                .await
                .map_err(|e| format!("Failed to fetch tables: {}", e))?;
            
            for row in rows {
                let table: String = row.try_get(0).unwrap_or_default();
                // Copy table structure and data
                let query = format!("CREATE TABLE `{}`.`{}` AS SELECT * FROM `{}`.`{}`", 
                    target_database, table, source_database, table);
                sqlx::query(&query).execute(&p).await.map_err(|e| format!("Failed to copy table {}: {}", table, e))?;
            }
            Ok(())
        },
        PoolWrapper::Postgres(p) => {
             // Postgres: Use TEMPLATE to duplicate database
             // First, we might need to disconnect other sessions, but for a simple UI this is usually okay if not in use.
             let query = format!("CREATE DATABASE \"{}\" WITH TEMPLATE \"{}\"", target_database, source_database);
             sqlx::query(&query).execute(&p).await.map_err(|e| format!("Failed to duplicate database: {}", e))?;
             Ok(())
        },
        PoolWrapper::Sqlite(_) => {
             // Copy file? 
             Err("Duplicate database not supported for SQLite in this mode".to_string())
        }
    }
}

#[tauri::command]
pub async fn create_table(
    state: State<'_, AppState>,
    connection_string: String,
    table_name: String,
    columns: Vec<ColumnSchema>,
    foreign_keys: Vec<ForeignKeyInput>
) -> Result<(), String> {
    let pool = crate::db::get_connection(&state, &connection_string).await.map_err(|e| e.to_string())?;

    let db_type = match pool {
        PoolWrapper::Mysql(_) => "mysql",
        PoolWrapper::Postgres(_) => "postgres",
        PoolWrapper::Sqlite(_) => "sqlite",
    };

    let sql = generate_create_table_sql(&table_name, &columns, &foreign_keys, db_type);

    match pool {
        PoolWrapper::Mysql(p) => {
             sqlx::query(&sql).execute(&p).await.map_err(|e| format!("Failed to create table: {}", e))?;
        },
        PoolWrapper::Postgres(p) => {
             // Execute. Note: SERIAL implies sequence creation automatically.
             sqlx::query(&sql).execute(&p).await.map_err(|e| format!("Failed to create table: {}", e))?;
        },
        PoolWrapper::Sqlite(p) => {
             sqlx::query(&sql).execute(&p).await.map_err(|e| format!("Failed to create table: {}", e))?;
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn delete_database(
    state: State<'_, AppState>,
    connection_string: String, 
    database_name: String
) -> Result<(), String> {
    let pool = crate::db::get_connection(&state, &connection_string).await.map_err(|e| e.to_string())?;

    match pool {
        PoolWrapper::Mysql(p) => {
             let query = format!("DROP DATABASE `{}`", database_name);
             sqlx::query(&query).execute(&p).await.map_err(|e| format!("Failed to delete database: {}", e))?;
             Ok(())
        },
        PoolWrapper::Postgres(p) => {
             let query = format!("DROP DATABASE \"{}\"", database_name);
             sqlx::query(&query).execute(&p).await.map_err(|e| format!("Failed to delete database: {}", e))?;
             Ok(())
        },
        PoolWrapper::Sqlite(_) => {
             Err("SQLite does not support deleting databases via SQL".to_string())
        }
    }
}

/// Build SQL WHERE clause from filter conditions
fn build_where_clause(filters: &[FilterCondition], quote_char: &str) -> String {
    let enabled_filters: Vec<&FilterCondition> = filters.iter()
        .filter(|f| f.enabled && !f.column.is_empty())
        .collect();

    if enabled_filters.is_empty() {
        return String::new();
    }

    let conditions: Vec<String> = enabled_filters.iter().map(|f| {
        let col = format!("{}{}{}", quote_char, f.column, quote_char);
        let val = f.value.replace("'", "''"); // Basic SQL escaping

        match f.operator.as_str() {
            "equals" => format!("{} = '{}'", col, val),
            "not_equals" => format!("{} != '{}'", col, val),
            "contains" => format!("{} LIKE '%{}%'", col, val),
            "not_contains" => format!("{} NOT LIKE '%{}%'", col, val),
            "starts_with" => format!("{} LIKE '{}%'", col, val),
            "ends_with" => format!("{} LIKE '%{}'", col, val),
            "greater_than" => format!("{} > '{}'", col, val),
            "less_than" => format!("{} < '{}'", col, val),
            "greater_than_or_equal" => format!("{} >= '{}'", col, val),
            "less_than_or_equal" => format!("{} <= '{}'", col, val),
            "is_null" => format!("{} IS NULL", col),
            "is_not_null" => format!("{} IS NOT NULL", col),
            _ => String::new(),
        }
    })
    .filter(|s| !s.is_empty())
    .collect();

    if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    }
}

#[tauri::command]
pub async fn get_table_data(
    state: State<'_, AppState>,
    connection_string: String,
    table_name: String,
    page: i32,
    page_size: i32,
    filters: Vec<FilterCondition>,
    sort: Option<SortState>,
) -> Result<TableDataResponse, String> {
    let pool = crate::db::get_connection(&state, &connection_string).await.map_err(|e| e.to_string())?;
    let offset = (page as i64 - 1) * page_size as i64;

    match pool {
        PoolWrapper::Mysql(p) => {
            let quote_char = "`";
            let escaped_table = format!("`{}`", table_name);
            let where_clause = build_where_clause(&filters, quote_char);
            
            let order_by = match &sort {
                Some(s) if !s.column.is_empty() => format!("ORDER BY `{}` {}", s.column, s.direction),
                _ => String::new(),
            };
            
            let data_query = format!(
                "SELECT * FROM {} {} {} LIMIT {} OFFSET {}",
                escaped_table, where_clause, order_by, page_size, offset
            );
            let count_query = format!("SELECT COUNT(*) FROM {} {}", escaped_table, where_clause);

            let data_rows: Vec<sqlx::mysql::MySqlRow> = sqlx::query(&data_query)
                .fetch_all(&p)
                .await
                .map_err(|e| format!("Data fetch failed: {}", e))?;

            let mut result_data = process_rows_with_decimal!(data_rows);

            // If no rows, fetch column names from schema
            if result_data.columns.is_empty() {
                let cols_query = format!("DESCRIBE {}", escaped_table);
                let col_rows: Vec<sqlx::mysql::MySqlRow> = sqlx::query(&cols_query)
                    .fetch_all(&p)
                    .await
                    .unwrap_or_default();
                result_data.columns = col_rows.iter()
                    .filter_map(|r| r.try_get::<String, _>(0).ok())
                    .collect();
            }

            let count_row: (i64,) = sqlx::query_as(&count_query)
                .fetch_one(&p)
                .await
                .map_err(|e| format!("Count fetch failed: {}", e))?;

            Ok(TableDataResponse {
                data: result_data,
                total_count: count_row.0,
            })
        },
        PoolWrapper::Postgres(p) => {
            let quote_char = "\"";
            let escaped_table = format!("\"{}\"", table_name);
            let where_clause = build_where_clause(&filters, quote_char);
            
            let order_by = match &sort {
                Some(s) if !s.column.is_empty() => format!("ORDER BY \"{}\" {}", s.column, s.direction),
                _ => String::new(),
            };
            
            let data_query = format!(
                "SELECT * FROM {} {} {} LIMIT {} OFFSET {}",
                escaped_table, where_clause, order_by, page_size, offset
            );
            let count_query = format!("SELECT COUNT(*) FROM {} {}", escaped_table, where_clause);

            let data_rows: Vec<sqlx::postgres::PgRow> = sqlx::query(&data_query)
                .fetch_all(&p)
                .await
                .map_err(|e| format!("Data fetch failed: {}", e))?;

            let mut result_data = process_rows_with_decimal!(data_rows);

            // If no rows, fetch column names from information_schema
            if result_data.columns.is_empty() {
                let cols_query = format!(
                    "SELECT column_name::TEXT FROM information_schema.columns WHERE table_name = '{}' ORDER BY ordinal_position",
                    table_name
                );
                let col_rows: Vec<sqlx::postgres::PgRow> = sqlx::query(&cols_query)
                    .fetch_all(&p)
                    .await
                    .unwrap_or_default();
                result_data.columns = col_rows.iter()
                    .filter_map(|r| r.try_get::<String, _>(0).ok())
                    .collect();
            }

            let count_row: (i64,) = sqlx::query_as(&count_query)
                .fetch_one(&p)
                .await
                .map_err(|e| format!("Count fetch failed: {}", e))?;

            Ok(TableDataResponse {
                data: result_data,
                total_count: count_row.0,
            })
        },
        PoolWrapper::Sqlite(p) => {
            let quote_char = "\"";
            let escaped_table = format!("\"{}\"", table_name);
            let where_clause = build_where_clause(&filters, quote_char);
            
            let order_by = match &sort {
                Some(s) if !s.column.is_empty() => format!("ORDER BY \"{}\" {}", s.column, s.direction),
                _ => String::new(),
            };
            
            let data_query = format!(
                "SELECT * FROM {} {} {} LIMIT {} OFFSET {}",
                escaped_table, where_clause, order_by, page_size, offset
            );
            let count_query = format!("SELECT COUNT(*) FROM {} {}", escaped_table, where_clause);

            let data_rows: Vec<sqlx::sqlite::SqliteRow> = sqlx::query(&data_query)
                .fetch_all(&p)
                .await
                .map_err(|e| format!("Data fetch failed: {}", e))?;

            let mut result_data = process_rows_sqlite!(data_rows);

            // If no rows, fetch column names from PRAGMA table_info
            if result_data.columns.is_empty() {
                let cols_query = format!("PRAGMA table_info({})", escaped_table);
                let col_rows: Vec<sqlx::sqlite::SqliteRow> = sqlx::query(&cols_query)
                    .fetch_all(&p)
                    .await
                    .unwrap_or_default();
                // PRAGMA table_info returns: cid, name, type, notnull, dflt_value, pk
                // Column name is at index 1
                result_data.columns = col_rows.iter()
                    .filter_map(|r| r.try_get::<String, _>(1).ok())
                    .collect();
            }

            let count_row: (i64,) = sqlx::query_as(&count_query)
                .fetch_one(&p)
                .await
                .map_err(|e| format!("Count fetch failed: {}", e))?;

            Ok(TableDataResponse {
                data: result_data,
                total_count: count_row.0,
            })
        }
    }
}
