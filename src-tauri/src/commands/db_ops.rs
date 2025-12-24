use crate::models::{ColumnSchema, QueryResult};
use crate::utils::{connect_to_db, detect_db_type, split_sql_statements};
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
        "postgres" => (format!("SELECT column_name FROM information_schema.columns WHERE table_name = '{}' AND table_schema = 'public'", table_name), 0),
        "mysql" => (format!("SHOW COLUMNS FROM {}", table_name), 0),
        "sqlite" => (format!("PRAGMA table_info(\"{}\")", table_name), 1),
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
        is_auto_increment: false, // SQLite doesn't explicitly expose AI in pragma easily without parsing sql
        is_unique: false,         // Requires index check
        default_value: row.try_get::<Option<String>, _>(4).ok().flatten(),
    }
}

fn parse_standard_schema_row(row: &AnyRow) -> ColumnSchema {
    // For postgres/mysql info schema
    let is_nullable_str: String = row.try_get(2).unwrap_or_default();
    let col_key: String = row.try_get(4).unwrap_or_default();
    let user_default: Option<String> = row.try_get(3).ok();
    let extra: String = row.try_get(5).unwrap_or_default(); // Extra info like auto_increment

    ColumnSchema {
        name: row.try_get(0).unwrap_or_default(),
        type_name: row.try_get(1).unwrap_or_default(),
        is_nullable: is_nullable_str == "YES",
        is_primary_key: col_key == "PRI",
        is_auto_increment: extra.contains("auto_increment") || extra.contains("nextval"),
        is_unique: col_key == "UNI",
        default_value: user_default,
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
            "SELECT column_name, data_type, is_nullable, column_default, '' as column_key, '' as extra
             FROM information_schema.columns WHERE table_name = '{}' ORDER BY ordinal_position",
            table_name
        ),
        "mysql" => format!(
            "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY, EXTRA
             FROM information_schema.COLUMNS WHERE TABLE_NAME = '{}' ORDER BY ORDINAL_POSITION",
            table_name
        ),
        "sqlite" => format!("PRAGMA table_info('{}')", table_name),
        _ => return Ok(vec![]),
    };

    let rows = sqlx::query(&query)
        .fetch_all(&mut conn)
        .await
        .map_err(|e| format!("Failed to fetch schema: {}", e))?;

    let schema = rows
        .iter()
        .map(|row| {
            if db_type == "sqlite" {
                parse_sqlite_schema_row(row)
            } else {
                parse_standard_schema_row(row)
            }
        })
        .collect();

    Ok(schema)
}

#[tauri::command]
pub async fn truncate_table(connection_string: String, table_name: String) -> Result<(), String> {
    let db_type = detect_db_type(&connection_string)?;
    let mut conn = connect_to_db(&connection_string).await?;

    let query = if db_type == "sqlite" {
        format!("DELETE FROM \"{}\"", table_name)
    } else if db_type == "mysql" {
        format!("TRUNCATE TABLE `{}`", table_name)
    } else {
        format!("TRUNCATE TABLE \"{}\"", table_name)
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

    let query = if db_type == "mysql" {
        format!("DROP TABLE `{}`", table_name)
    } else {
        format!("DROP TABLE \"{}\"", table_name)
    };

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

    let query = match db_type {
        "postgres" | "sqlite" => format!(
            "CREATE TABLE \"{}\" AS SELECT * FROM \"{}\"{}",
            new_table,
            source_table,
            if include_data { "" } else { " WHERE 1=0" }
        ),
        "mysql" => format!(
            "CREATE TABLE `{}` AS SELECT * FROM `{}`{}",
            new_table,
            source_table,
            if include_data { "" } else { " WHERE 1=0" }
        ),
        _ => return Err("Unsupported database".to_string()),
    };

    sqlx::query(&query)
        .execute(&mut conn)
        .await
        .map_err(|e| format!("Failed to duplicate table: {}", e))?;

    Ok(())
}
