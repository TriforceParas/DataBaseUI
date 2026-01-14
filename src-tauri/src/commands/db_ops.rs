use crate::models::{ColumnSchema, QueryResult};
use crate::utils::{connect_to_db, detect_db_type, escape_identifier, split_sql_statements};
use sqlx::any::AnyRow;
use sqlx::{Column, Connection, Row, TypeInfo};
use tauri;

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
    connection_string: String,
    query: String,
) -> Result<Vec<QueryResult>, String> {
    if connection_string.starts_with("mysql:") {
        let mut conn = sqlx::mysql::MySqlConnection::connect(&connection_string)
            .await
            .map_err(|e| format!("Connection failed: {}", e))?;

        let stmts = split_sql_statements(&query, true);
        let mut results = Vec::new();

        for stmt in stmts {
            let rows = sqlx::query(&stmt)
                .fetch_all(&mut conn)
                .await
                .map_err(|e| format!("Query failed: {}", e))?;

            let res = process_rows_with_decimal!(rows);
            results.push(res);
        }
        Ok(results)
    } else if connection_string.starts_with("postgres:") {
        let mut conn = sqlx::postgres::PgConnection::connect(&connection_string)
            .await
            .map_err(|e| format!("Connection failed: {}", e))?;

        let stmts = split_sql_statements(&query, false);
        let mut results = Vec::new();

        for stmt in stmts {
            let rows = sqlx::query(&stmt)
                .fetch_all(&mut conn)
                .await
                .map_err(|e| format!("Query failed: {}", e))?;

            let res = process_rows_with_decimal!(rows);
            results.push(res);
        }
        Ok(results)
    } else if connection_string.starts_with("sqlite:") {
        let mut conn = sqlx::sqlite::SqliteConnection::connect(&connection_string)
            .await
            .map_err(|e| format!("Connection failed: {}", e))?;

        let stmts = split_sql_statements(&query, false);
        let mut results = Vec::new();

        for stmt in stmts {
            let rows = sqlx::query(&stmt)
                .fetch_all(&mut conn)
                .await
                .map_err(|e| format!("Query failed: {}", e))?;

            let res = process_rows_sqlite!(rows);
            results.push(res);
        }
        Ok(results)
    } else {
        Err(
            "Unsupported database protocol. Only mysql:, postgres:, and sqlite: are supported."
                .to_string(),
        )
    }
}

#[tauri::command]
pub async fn get_columns(
    connection_string: String,
    table_name: String,
) -> Result<Vec<String>, String> {
    let db_type = detect_db_type(&connection_string)?;
    let mut conn = connect_to_db(&connection_string).await?;

    let (query, col_idx) = match db_type {
        "postgres" => (format!("SELECT column_name FROM information_schema.columns WHERE table_name = '{}' AND table_schema = 'public'", table_name.replace('\'', "''")), 0),
        "mysql" => (format!("SHOW COLUMNS FROM {}", escape_identifier(&table_name, db_type)), 0),
        "sqlite" => (format!("PRAGMA table_info({})", escape_identifier(&table_name, db_type)), 1),
        _ => return Ok(vec![]),
    };

    let rows = sqlx::query(&query)
        .fetch_all(&mut conn)
        .await
        .map_err(|e| format!("Failed to fetch columns: {}", e))?;

    let columns: Vec<String> = rows
        .iter()
        .map(|row| row.try_get(col_idx).unwrap_or_default())
        .collect();

    Ok(columns)
}

#[tauri::command]
pub async fn get_tables(connection_string: String) -> Result<Vec<String>, String> {
    let db_type = detect_db_type(&connection_string)?;
    let mut conn = connect_to_db(&connection_string).await?;

    let query = match db_type {
        "postgres" => {
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
        }
        "mysql" => "SHOW TABLES",
        "sqlite" => "SELECT name FROM sqlite_master WHERE type='table'",
        _ => return Err("Unsupported database type".to_string()),
    };

    let rows = sqlx::query(query)
        .fetch_all(&mut conn)
        .await
        .map_err(|e| format!("Failed to fetch tables: {}", e))?;

    let tables: Vec<String> = rows
        .iter()
        .map(|row| row.try_get(0).unwrap_or_default())
        .collect();

    Ok(tables)
}

fn parse_sqlite_schema_row(row: &AnyRow) -> ColumnSchema {
    ColumnSchema {
        name: row.try_get::<String, _>(1).unwrap_or_default(),
        type_name: row.try_get::<String, _>(2).unwrap_or_default(),
        is_nullable: row.try_get::<i32, _>(3).unwrap_or(0) == 0, // 0 = YES, 1 = NO in sqlite table_info but let's assume
        // Wait, standard sqlite behavior: notnull is col 3. 0 means nullable, 1 means not null.
        // My previous logic: if row.try_get(3) == 0 => "YES" (nullable). Correct.
        // Adapting to boolean:
        // is_nullable: true if 0
        is_primary_key: row.try_get::<i32, _>(5).unwrap_or(0) == 1,
        is_auto_increment: false,
        is_unique: false,
        default_value: row.try_get::<Option<String>, _>(4).ok().flatten(),
        foreign_key: None, // Will be populated later for SQLite
    }
}

fn parse_standard_schema_row(row: &AnyRow) -> ColumnSchema {
    // For postgres/mysql info schema
    let is_nullable_str: String = row.try_get(2).unwrap_or_default();
    let col_key: String = row.try_get(4).unwrap_or_default();
    let user_default: Option<String> = row.try_get(3).ok();
    let extra: String = row.try_get(5).unwrap_or_default();

    let ref_table: Option<String> = row.try_get(6).ok();
    let ref_col: Option<String> = row.try_get(7).ok();

    let foreign_key = if let (Some(t), Some(c)) = (ref_table, ref_col) {
        if !t.is_empty() && !c.is_empty() {
            Some(crate::models::ForeignKey {
                referenced_table: t,
                referenced_column: c,
            })
        } else {
            None
        }
    } else {
        None
    };

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
}

#[tauri::command]
pub async fn get_table_schema(
    connection_string: String,
    table_name: String,
) -> Result<Vec<ColumnSchema>, String> {
    let db_type = detect_db_type(&connection_string)?;
    let mut conn = connect_to_db(&connection_string).await?;

    let query = match db_type {
        "postgres" => format!(
            "SELECT 
                c.column_name, 
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
                ccu.table_name AS referenced_table,
                ccu.column_name AS referenced_column
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
        ),
        "mysql" => format!(
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
        ),
        "sqlite" => format!("PRAGMA table_info('{}')", table_name),
        _ => return Ok(vec![]),
    };

    let rows = sqlx::query(&query)
        .fetch_all(&mut conn)
        .await
        .map_err(|e| format!("Failed to fetch schema: {}", e))?;

    let mut schema: Vec<ColumnSchema> = rows
        .iter()
        .map(|row| {
            if db_type == "sqlite" {
                parse_sqlite_schema_row(row)
            } else {
                parse_standard_schema_row(row)
            }
        })
        .collect();

    // Special handling for SQLite foreign keys as they require a separate PRAGMA
    if db_type == "sqlite" {
        let fk_query = format!("PRAGMA foreign_key_list('{}')", table_name);
        if let Ok(fk_rows) = sqlx::query(&fk_query).fetch_all(&mut conn).await {
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
    }

    Ok(schema)
}

#[tauri::command]
pub async fn truncate_table(connection_string: String, table_name: String) -> Result<(), String> {
    let db_type = detect_db_type(&connection_string)?;
    let mut conn = connect_to_db(&connection_string).await?;

    let escaped_table = escape_identifier(&table_name, db_type);
    let query = if db_type == "sqlite" {
        format!("DELETE FROM {}", escaped_table)
    } else {
        format!("TRUNCATE TABLE {}", escaped_table)
    };

    sqlx::query(&query)
        .execute(&mut conn)
        .await
        .map_err(|e| format!("Failed to truncate table: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn drop_table(connection_string: String, table_name: String) -> Result<(), String> {
    let db_type = detect_db_type(&connection_string)?;
    let mut conn = connect_to_db(&connection_string).await?;

    let query = format!("DROP TABLE {}", escape_identifier(&table_name, db_type));

    sqlx::query(&query)
        .execute(&mut conn)
        .await
        .map_err(|e| format!("Failed to drop table: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn duplicate_table(
    connection_string: String,
    source_table: String,
    new_table: String,
    include_data: bool,
) -> Result<(), String> {
    let db_type = detect_db_type(&connection_string)?;
    let mut conn = connect_to_db(&connection_string).await?;

    let escaped_new = escape_identifier(&new_table, db_type);
    let escaped_source = escape_identifier(&source_table, db_type);
    let query = format!(
        "CREATE TABLE {} AS SELECT * FROM {}{}",
        escaped_new,
        escaped_source,
        if include_data { "" } else { " WHERE 1=0" }
    );

    sqlx::query(&query)
        .execute(&mut conn)
        .await
        .map_err(|e| format!("Failed to duplicate table: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn get_databases(connection_string: String) -> Result<Vec<String>, String> {
    let db_type = detect_db_type(&connection_string)?;
    let mut conn = connect_to_db(&connection_string).await?;

    let query = match db_type {
        "postgres" => "SELECT datname FROM pg_database WHERE datistemplate = false AND datallowconn = true",
        "mysql" => "SHOW DATABASES",
        "sqlite" => "SELECT file FROM pragma_database_list WHERE name='main'", 
        _ => return Ok(vec![]), 
    };

    let rows = sqlx::query(query)
        .fetch_all(&mut conn)
        .await
        .map_err(|e| format!("Failed to fetch databases: {}", e))?;

    let dbs: Vec<String> = rows
        .iter()
        .map(|row| row.try_get(0).unwrap_or_default())
        .collect();

    Ok(dbs)
}

fn generate_create_table_sql(table_name: &str, columns: &[ColumnSchema], db_type: &str) -> String {
    let cols_sql: Vec<String> = columns.iter().map(|col| {
        // Handle PostgreSQL SERIAL types
        let type_str = if db_type == "postgres" && col.is_auto_increment {
            // Convert integer types to SERIAL equivalents
            match col.type_name.to_lowercase().as_str() {
                "integer" | "int" | "int4" => "SERIAL".to_string(),
                "bigint" | "int8" => "BIGSERIAL".to_string(),
                "smallint" | "int2" => "SMALLSERIAL".to_string(),
                _ => col.type_name.clone(),
            }
        } else {
            col.type_name.clone()
        };

        let col_name = escape_identifier(&col.name, db_type);
        let mut line = format!("{} {}", col_name, type_str);

        // For SERIAL types, don't add NOT NULL (it's implicit)
        let is_serial = db_type == "postgres" && col.is_auto_increment;
        if !col.is_nullable && !is_serial {
            line.push_str(" NOT NULL");
        }
        
        // Skip default value for SERIAL columns (handled by sequence)
        if !is_serial {
            if let Some(def) = &col.default_value {
                if !def.starts_with("nextval") && !def.contains("::") { 
                     line.push_str(&format!(" DEFAULT {}", def));
                }
            }
        }
        
        if col.is_primary_key {
            line.push_str(" PRIMARY KEY");
        }
        
        if col.is_auto_increment && db_type == "mysql" {
             line.push_str(" AUTO_INCREMENT");
        }
        
        line
    }).collect();

    let q_table_name = escape_identifier(table_name, db_type);
    format!("CREATE TABLE IF NOT EXISTS {} (\n    {}\n);", q_table_name, cols_sql.join(",\n    "))
}

#[tauri::command]
pub async fn export_schema(connection_string: String, directory_path: String) -> Result<String, String> {
    use std::fs;
    use std::path::Path;

    let db_type = detect_db_type(&connection_string)?;
    let tables = get_tables(connection_string.clone()).await?;
    
    let dir = Path::new(&directory_path);
    if !dir.exists() {
        return Err("Directory does not exist".to_string());
    }

    let mut log = String::new();
    let mut success_count = 0;

    for table in tables {
        match get_table_schema(connection_string.clone(), table.clone()).await {
            Ok(cols) => {
                let sql = generate_create_table_sql(&table, &cols, db_type);
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
pub async fn import_schema(connection_string: String, directory_path: String) -> Result<String, String> {
    use std::fs;
    use std::path::Path;

    let dir = Path::new(&directory_path);
    if !dir.exists() {
        return Err("Directory does not exist".to_string());
    }

    let mut conn = connect_to_db(&connection_string).await?;

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
                         let is_mysql = connection_string.starts_with("mysql:");
                         let stmts = split_sql_statements(&sql, is_mysql);
                         
                         let mut file_error = false;
                         for stmt in stmts {
                             if stmt.trim().is_empty() { continue; }
                             if let Err(e) = sqlx::query(&stmt).execute(&mut conn).await {
                                 log.push_str(&format!("Error in {}: {}\n", filename, e));
                                 file_error = true;
                                 break; 
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

#[tauri::command]
pub async fn create_database(connection_string: String, database_name: String) -> Result<(), String> {
    let db_type = detect_db_type(&connection_string)?;
    let mut conn = connect_to_db(&connection_string).await?;

    let query = match db_type {
        "mysql" => format!("CREATE DATABASE `{}`", database_name),
        "postgres" => format!("CREATE DATABASE \"{}\"", database_name),
        "sqlite" => return Err("SQLite does not support creating databases via SQL".to_string()),
        _ => return Err("Unsupported database type".to_string()),
    };

    sqlx::query(&query)
        .execute(&mut conn)
        .await
        .map_err(|e| format!("Failed to create database: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn duplicate_database(
    connection_string: String,
    source_database: String,
    target_database: String,
) -> Result<(), String> {
    let db_type = detect_db_type(&connection_string)?;
    let mut conn = connect_to_db(&connection_string).await?;

    match db_type {
        "mysql" => {
            // MySQL: Create new DB, then copy tables
            sqlx::query(&format!("CREATE DATABASE `{}`", target_database))
                .execute(&mut conn)
                .await
                .map_err(|e| format!("Failed to create target database: {}", e))?;

            // Get tables from source
            let rows = sqlx::query(&format!("SHOW TABLES FROM `{}`", source_database))
                .fetch_all(&mut conn)
                .await
                .map_err(|e| format!("Failed to get tables: {}", e))?;

            for row in rows {
                let table: String = row.try_get(0).unwrap_or_default();
                let copy_query = format!(
                    "CREATE TABLE `{}`.`{}` AS SELECT * FROM `{}`.`{}`",
                    target_database, table, source_database, table
                );
                if let Err(e) = sqlx::query(&copy_query).execute(&mut conn).await {
                    log::warn!("Failed to copy table {}: {}", table, e);
                }
            }
        }
        "postgres" => {
            // PostgreSQL: Use template
            let query = format!(
                "CREATE DATABASE \"{}\" WITH TEMPLATE \"{}\"",
                target_database, source_database
            );
            sqlx::query(&query)
                .execute(&mut conn)
                .await
                .map_err(|e| format!("Failed to duplicate database: {}", e))?;
        }
        "sqlite" => {
            return Err("SQLite does not support duplicating databases via SQL".to_string());
        }
        _ => return Err("Unsupported database type".to_string()),
    }

    Ok(())
}

#[tauri::command]
pub async fn delete_database(connection_string: String, database_name: String) -> Result<(), String> {
    let db_type = detect_db_type(&connection_string)?;
    let mut conn = connect_to_db(&connection_string).await?;

    let query = match db_type {
        "mysql" => format!("DROP DATABASE `{}`", database_name),
        "postgres" => format!("DROP DATABASE \"{}\"", database_name),
        "sqlite" => return Err("SQLite does not support deleting databases via SQL".to_string()),
        _ => return Err("Unsupported database type".to_string()),
    };

    sqlx::query(&query)
        .execute(&mut conn)
        .await
        .map_err(|e| format!("Failed to delete database: {}", e))?;

    Ok(())
}
