use sqlx::{migrate::MigrateDatabase, sqlite::SqlitePoolOptions, Pool, Sqlite};
use std::fs;
use tauri::{AppHandle, Manager, Runtime};

pub struct AppState {
    pub db: Pool<Sqlite>,
}

pub async fn init_db<R: Runtime>(app: &AppHandle<R>) -> Result<Pool<Sqlite>, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;

    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
    }

    let db_path = app_data_dir.join("app_data.db");
    let db_url = format!("sqlite://{}", db_path.to_string_lossy());

    if !Sqlite::database_exists(&db_url).await.unwrap_or(false) {
        Sqlite::create_database(&db_url)
            .await
            .map_err(|e| format!("Failed to create database: {}", e))?;
    }

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS connections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            connection_string TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to create connections table: {}", e))?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            color TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to create tags table: {}", e))?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS table_tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            table_name TEXT NOT NULL,
            connection_id INTEGER NOT NULL,
            tag_id INTEGER NOT NULL,
            FOREIGN KEY(connection_id) REFERENCES connections(id) ON DELETE CASCADE,
            FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE,
            UNIQUE(table_name, connection_id, tag_id)
        );",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to create table_tags table: {}", e))?;

    // Saved Queries table
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS saved_queries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            query TEXT NOT NULL,
            connection_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(connection_id) REFERENCES connections(id) ON DELETE CASCADE
        );",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to create saved_queries table: {}", e))?;

    // Saved Functions table
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS saved_functions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            function_body TEXT NOT NULL,
            connection_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(connection_id) REFERENCES connections(id) ON DELETE CASCADE
        );",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to create saved_functions table: {}", e))?;

    Ok(pool)
}
