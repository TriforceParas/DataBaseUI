use crate::db::AppState;
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use sqlx::mysql::MySqlConnection;
use sqlx::postgres::PgConnection;
use sqlx::sqlite::SqliteConnection;
use sqlx::{AnyConnection, Column, Connection as SqlxConnection, FromRow, Row, TypeInfo};

use tauri::{Manager, State, WebviewUrl, WebviewWindowBuilder};

#[derive(Serialize, Deserialize, Clone, Debug, FromRow)]
pub struct Connection {
    pub id: i64,
    pub name: String,
    pub connection_string: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, FromRow)]
pub struct Tag {
    pub id: i64,
    pub name: String,
    pub color: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, FromRow)]
pub struct TableTag {
    pub tag_id: i64,
    pub table_name: String,
    pub connection_id: i64,
}

#[derive(Serialize, Clone, Debug)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<String>>,
}

#[tauri::command]
pub async fn verify_connection(connection_string: String) -> Result<(), String> {
    <AnyConnection as SqlxConnection>::connect(&connection_string)
        .await
        .map_err(|e| format!("Failed to connect: {}", e))
        .map(|_| ())
}

#[tauri::command]
pub async fn save_connection(
    state: State<'_, AppState>,
    name: String,
    connection_string: String,
) -> Result<i64, String> {
    let result = sqlx::query("INSERT INTO connections (name, connection_string) VALUES (?, ?)")
        .bind(name)
        .bind(connection_string)
        .execute(&state.db)
        .await
        .map_err(|e| format!("Failed to save connection: {}", e))?;

    Ok(result.last_insert_rowid())
}

#[tauri::command]
pub async fn list_connections(state: State<'_, AppState>) -> Result<Vec<Connection>, String> {
    sqlx::query_as::<_, Connection>(
        "SELECT id, name, connection_string FROM connections ORDER BY created_at DESC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| format!("Failed to list connections: {}", e))
}

#[tauri::command]
pub async fn delete_connection(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    sqlx::query("DELETE FROM connections WHERE id = ?")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| format!("Failed to delete connection: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn update_connection(
    state: State<'_, AppState>,
    id: i64,
    name: String,
    connection_string: String,
) -> Result<(), String> {
    sqlx::query("UPDATE connections SET name = ?, connection_string = ? WHERE id = ?")
        .bind(name)
        .bind(connection_string)
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| format!("Failed to update connection: {}", e))?;
    Ok(())
}

// ----- Tag Commands -----

#[tauri::command]
pub async fn create_tag(
    state: State<'_, AppState>,
    name: String,
    color: String,
) -> Result<i64, String> {
    let result = sqlx::query("INSERT INTO tags (name, color) VALUES (?, ?)")
        .bind(name)
        .bind(color)
        .execute(&state.db)
        .await
        .map_err(|e| format!("Failed to create tag: {}", e))?;
    Ok(result.last_insert_rowid())
}

#[tauri::command]
pub async fn update_tag(
    state: State<'_, AppState>,
    id: i64,
    name: String,
    color: String,
) -> Result<(), String> {
    sqlx::query("UPDATE tags SET name = ?, color = ? WHERE id = ?")
        .bind(name)
        .bind(color)
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| format!("Failed to update tag: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_tag(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    // First, remove all table_tags associations
    sqlx::query("DELETE FROM table_tags WHERE tag_id = ?")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| format!("Failed to remove tag associations: {}", e))?;

    // Then delete the tag itself
    sqlx::query("DELETE FROM tags WHERE id = ?")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| format!("Failed to delete tag: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn get_tags(state: State<'_, AppState>) -> Result<Vec<Tag>, String> {
    sqlx::query_as::<_, Tag>("SELECT id, name, color FROM tags ORDER BY name ASC")
        .fetch_all(&state.db)
        .await
        .map_err(|e| format!("Failed to fetch tags: {}", e))
}

#[tauri::command]
pub async fn assign_tag(
    state: State<'_, AppState>,
    connection_id: i64,
    table_name: String,
    tag_id: i64,
) -> Result<(), String> {
    // Check if tag exists
    let _ = sqlx::query("SELECT id FROM tags WHERE id = ?")
        .bind(tag_id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| "Tag not found".to_string())?;

    sqlx::query(
        "INSERT INTO table_tags (connection_id, table_name, tag_id) VALUES (?, ?, ?)
         ON CONFLICT(table_name, connection_id, tag_id) DO NOTHING",
    )
    .bind(connection_id)
    .bind(table_name)
    .bind(tag_id)
    .execute(&state.db)
    .await
    .map_err(|e| format!("Failed to assign tag: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn remove_tag_from_table(
    state: State<'_, AppState>,
    connection_id: i64,
    table_name: String,
    tag_id: i64,
) -> Result<(), String> {
    sqlx::query("DELETE FROM table_tags WHERE connection_id = ? AND table_name = ? AND tag_id = ?")
        .bind(connection_id)
        .bind(table_name)
        .bind(tag_id)
        .execute(&state.db)
        .await
        .map_err(|e| format!("Failed to remove tag: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn get_table_tags(
    state: State<'_, AppState>,
    connection_id: i64,
) -> Result<Vec<TableTag>, String> {
    sqlx::query_as::<_, TableTag>(
        "SELECT tag_id, table_name, connection_id FROM table_tags WHERE connection_id = ?",
    )
    .bind(connection_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| format!("Failed to fetch table tags: {}", e))
}

#[tauri::command]
pub async fn get_tables(connection_string: String) -> Result<Vec<String>, String> {
    let db_type = if connection_string.starts_with("postgres://") {
        "postgres"
    } else if connection_string.starts_with("mysql://") {
        "mysql"
    } else if connection_string.starts_with("sqlite://") {
        "sqlite"
    } else {
        return Err("Unsupported or unknown database type".to_string());
    };

    let mut conn = <AnyConnection as SqlxConnection>::connect(&connection_string)
        .await
        .map_err(|e| format!("Failed to connect: {}", e))?;

    let query = match db_type {
        "postgres" => {
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
        }
        "mysql" => "SHOW TABLES",
        "sqlite" => {
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        }
        _ => return Ok(vec![]),
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

#[tauri::command]
pub async fn execute_query(
    connection_string: String,
    query: String,
) -> Result<QueryResult, String> {
    // Macro for MySQL and Postgres (supports rust_decimal)
    macro_rules! process_rows_with_decimal {
        ($rows:expr) => {{
            if $rows.is_empty() {
                return Ok(QueryResult {
                    columns: vec![],
                    rows: vec![],
                });
            }

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

            Ok(QueryResult {
                columns,
                rows: result_rows,
            })
        }};
    }

    // Macro for SQLite (no rust_decimal support)
    macro_rules! process_rows_sqlite {
        ($rows:expr) => {{
            if $rows.is_empty() {
                return Ok(QueryResult {
                    columns: vec![],
                    rows: vec![],
                });
            }

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

            Ok(QueryResult {
                columns,
                rows: result_rows,
            })
        }};
    }

    if connection_string.starts_with("mysql:") {
        let mut conn = MySqlConnection::connect(&connection_string)
            .await
            .map_err(|e| format!("Connection failed: {}", e))?;
        let rows = sqlx::query(&query)
            .fetch_all(&mut conn)
            .await
            .map_err(|e| format!("Query failed: {}", e))?;
        process_rows_with_decimal!(rows)
    } else if connection_string.starts_with("postgres:") {
        let mut conn = PgConnection::connect(&connection_string)
            .await
            .map_err(|e| format!("Connection failed: {}", e))?;
        let rows = sqlx::query(&query)
            .fetch_all(&mut conn)
            .await
            .map_err(|e| format!("Query failed: {}", e))?;
        process_rows_with_decimal!(rows)
    } else if connection_string.starts_with("sqlite:") {
        let mut conn = SqliteConnection::connect(&connection_string)
            .await
            .map_err(|e| format!("Connection failed: {}", e))?;
        let rows = sqlx::query(&query)
            .fetch_all(&mut conn)
            .await
            .map_err(|e| format!("Query failed: {}", e))?;
        process_rows_sqlite!(rows)
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
    let db_type = if connection_string.starts_with("postgres://") {
        "postgres"
    } else if connection_string.starts_with("mysql://") {
        "mysql"
    } else if connection_string.starts_with("sqlite://") {
        "sqlite"
    } else {
        return Err("Unsupported database type".to_string());
    };

    let mut conn = <AnyConnection as SqlxConnection>::connect(&connection_string)
        .await
        .map_err(|e| format!("Failed to connect: {}", e))?;

    let (query, col_idx) = match db_type {
        "postgres" => (format!("SELECT column_name FROM information_schema.columns WHERE table_name = '{}' AND table_schema = 'public'", table_name), 0),
        "mysql" => (format!("SHOW COLUMNS FROM {}", table_name), 0),
        "sqlite" => (format!("PRAGMA table_info(\"{}\")", table_name), 1), // cid, name, type...
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
pub async fn open_connection_window<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    connection_id: i64,
) -> Result<(), String> {
    let label = format!("connection-{}", connection_id);
    let url = format!("index.html?connection_id={}", connection_id);

    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.set_focus();
        return Ok(());
    }

    WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(url.into()))
        .title("Connection")
        .inner_size(1200.0, 800.0)
        .decorations(false)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ----- Table Operations -----

#[derive(Serialize, Clone, Debug)]
pub struct ColumnSchema {
    pub name: String,
    pub data_type: String,
    pub is_nullable: String,
    pub column_default: Option<String>,
    pub column_key: String,
}

#[tauri::command]
pub async fn get_table_schema(
    connection_string: String,
    table_name: String,
) -> Result<Vec<ColumnSchema>, String> {
    let db_type = if connection_string.starts_with("postgres://") {
        "postgres"
    } else if connection_string.starts_with("mysql://") {
        "mysql"
    } else if connection_string.starts_with("sqlite://") {
        "sqlite"
    } else {
        return Err("Unsupported database type".to_string());
    };

    let mut conn = <AnyConnection as SqlxConnection>::connect(&connection_string)
        .await
        .map_err(|e| format!("Failed to connect: {}", e))?;

    let query = match db_type {
        "postgres" => format!(
            "SELECT column_name, data_type, is_nullable, column_default, '' as column_key 
             FROM information_schema.columns WHERE table_name = '{}' ORDER BY ordinal_position",
            table_name
        ),
        "mysql" => format!(
            "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY 
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

    let mut schema = Vec::new();

    for row in rows {
        if db_type == "sqlite" {
            // SQLite PRAGMA returns: cid, name, type, notnull, dflt_value, pk
            schema.push(ColumnSchema {
                name: row.try_get::<String, _>(1).unwrap_or_default(),
                data_type: row.try_get::<String, _>(2).unwrap_or_default(),
                is_nullable: if row.try_get::<i32, _>(3).unwrap_or(0) == 0 {
                    "YES".to_string()
                } else {
                    "NO".to_string()
                },
                column_default: row.try_get::<Option<String>, _>(4).ok().flatten(),
                column_key: if row.try_get::<i32, _>(5).unwrap_or(0) == 1 {
                    "PRI".to_string()
                } else {
                    "".to_string()
                },
            });
        } else {
            schema.push(ColumnSchema {
                name: row.try_get(0).unwrap_or_default(),
                data_type: row.try_get(1).unwrap_or_default(),
                is_nullable: row.try_get(2).unwrap_or_default(),
                column_default: row.try_get(3).ok(),
                column_key: row.try_get(4).unwrap_or_default(),
            });
        }
    }

    Ok(schema)
}

#[tauri::command]
pub async fn truncate_table(connection_string: String, table_name: String) -> Result<(), String> {
    let db_type = if connection_string.starts_with("postgres://") {
        "postgres"
    } else if connection_string.starts_with("mysql://") {
        "mysql"
    } else if connection_string.starts_with("sqlite://") {
        "sqlite"
    } else {
        return Err("Unsupported database type".to_string());
    };

    let mut conn = <AnyConnection as SqlxConnection>::connect(&connection_string)
        .await
        .map_err(|e| format!("Failed to connect: {}", e))?;

    // SQLite doesn't support TRUNCATE, use DELETE instead
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
    let mut conn = <AnyConnection as SqlxConnection>::connect(&connection_string)
        .await
        .map_err(|e| format!("Failed to connect: {}", e))?;

    let query = if connection_string.starts_with("mysql://") {
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
    let db_type = if connection_string.starts_with("postgres://") {
        "postgres"
    } else if connection_string.starts_with("mysql://") {
        "mysql"
    } else if connection_string.starts_with("sqlite://") {
        "sqlite"
    } else {
        return Err("Unsupported database type".to_string());
    };

    let mut conn = <AnyConnection as SqlxConnection>::connect(&connection_string)
        .await
        .map_err(|e| format!("Failed to connect: {}", e))?;

    // Different syntax for different databases
    let query = match db_type {
        "postgres" => format!(
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
        "sqlite" => format!(
            "CREATE TABLE \"{}\" AS SELECT * FROM \"{}\"{}",
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
