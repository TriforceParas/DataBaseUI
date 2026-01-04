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

    create_table_schema(
        &pool,
        "connections",
        "CREATE TABLE IF NOT EXISTS connections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            connection_string TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );",
    )
    .await?;

    create_table_schema(
        &pool,
        "tags",
        "CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            color TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );",
    )
    .await?;

    create_table_schema(
        &pool,
        "table_tags",
        "CREATE TABLE IF NOT EXISTS table_tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            table_name TEXT NOT NULL,
            connection_id INTEGER NOT NULL,
            database_name TEXT NOT NULL,
            tag_id INTEGER NOT NULL,
            FOREIGN KEY(connection_id) REFERENCES connections(id) ON DELETE CASCADE,
            FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE,
            UNIQUE(table_name, connection_id, database_name, tag_id)
        );",
    )
    .await?;

    // Migration: Check if table_tags has the correct UNIQUE constraint
    // We check the actual SQL definition of the table
    let table_sql: String = sqlx::query_scalar(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='table_tags'",
    )
    .fetch_one(&pool)
    .await
    .unwrap_or_default();

    // The target unique constraint string we expect
    let expected_unique = "UNIQUE(table_name, connection_id, database_name, tag_id)";
    
    // Also check if database_name column exists (for the data copy part)
    // If table exists but doesn't have our unique constraint OR doesn't have the column (though unsafe to rely just on column if constraint is wrong)
    // Simplest robust check: if SQL doesn't contain our expected unique string, Re-create.
    
    // Normalizing string for check (simple contains)
    if !table_sql.replace(" ", "").contains(&expected_unique.replace(" ", "")) {
        println!("Migrating table_tags schema...");
        
        // 1. Rename existing table
        let _ = sqlx::query("DROP TABLE IF EXISTS table_tags_old").execute(&pool).await;
        let _ = sqlx::query("ALTER TABLE table_tags RENAME TO table_tags_old")
            .execute(&pool)
            .await;
            
        // 2. Create new table with correct schema
        create_table_schema(
            &pool,
            "table_tags",
            "CREATE TABLE IF NOT EXISTS table_tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                table_name TEXT NOT NULL,
                connection_id INTEGER NOT NULL,
                database_name TEXT NOT NULL,
                tag_id INTEGER NOT NULL,
                FOREIGN KEY(connection_id) REFERENCES connections(id) ON DELETE CASCADE,
                FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE,
                UNIQUE(table_name, connection_id, database_name, tag_id)
            );",
        )
        .await?;

        // 3. Copy data
        // Check if old table has database_name column to decide how to copy
        let has_db_col_old: i32 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM pragma_table_info('table_tags_old') WHERE name='database_name'",
        )
        .fetch_one(&pool)
        .await
        .unwrap_or(0);

        if has_db_col_old > 0 {
             // Old table has column, copy it directly
             let _ = sqlx::query(
                "INSERT INTO table_tags (id, table_name, connection_id, tag_id, database_name) 
                 SELECT id, table_name, connection_id, tag_id, database_name FROM table_tags_old",
            )
            .execute(&pool)
            .await;
        } else {
             // Old table does NOT have column, default to empty string
             let _ = sqlx::query(
                "INSERT INTO table_tags (id, table_name, connection_id, tag_id, database_name) 
                 SELECT id, table_name, connection_id, tag_id, '' FROM table_tags_old",
            )
            .execute(&pool)
            .await;
        }

        // 4. Drop old table
        let _ = sqlx::query("DROP TABLE table_tags_old").execute(&pool).await;
        println!("Migration of table_tags completed.");
    }

    // Saved Queries table
    create_table_schema(
        &pool,
        "saved_queries",
        "CREATE TABLE IF NOT EXISTS saved_queries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            query TEXT NOT NULL,
            connection_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(connection_id) REFERENCES connections(id) ON DELETE CASCADE
        );",
    )
    .await?;

    // Saved Functions table
    create_table_schema(
        &pool,
        "saved_functions",
        "CREATE TABLE IF NOT EXISTS saved_functions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            function_body TEXT NOT NULL,
            connection_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(connection_id) REFERENCES connections(id) ON DELETE CASCADE
        );",
    )
    .await?;

    Ok(pool)
}

async fn create_table_schema(
    pool: &Pool<Sqlite>,
    table_name: &str,
    schema_sql: &str,
) -> Result<(), String> {
    sqlx::query(schema_sql)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to create {} table: {}", table_name, e))?;
    Ok(())
}
