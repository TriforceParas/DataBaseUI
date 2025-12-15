use crate::db::AppState;
use chrono::{DateTime, NaiveDateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::mysql::MySqlConnection;
use sqlx::postgres::PgConnection;
use sqlx::sqlite::SqliteConnection;
use sqlx::{AnyConnection, Column, Connection as SqlxConnection, FromRow, Row, TypeInfo};
use std::collections::HashMap;
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
    // Macro to handle row processing generically for concrete row types
    macro_rules! process_rows {
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
                            Err(e) => {
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
        process_rows!(rows)
    } else if connection_string.starts_with("postgres:") {
        let mut conn = PgConnection::connect(&connection_string)
            .await
            .map_err(|e| format!("Connection failed: {}", e))?;
        let rows = sqlx::query(&query)
            .fetch_all(&mut conn)
            .await
            .map_err(|e| format!("Query failed: {}", e))?;
        process_rows!(rows)
    } else if connection_string.starts_with("sqlite:") {
        let mut conn = SqliteConnection::connect(&connection_string)
            .await
            .map_err(|e| format!("Connection failed: {}", e))?;
        let rows = sqlx::query(&query)
            .fetch_all(&mut conn)
            .await
            .map_err(|e| format!("Query failed: {}", e))?;
        process_rows!(rows)
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
