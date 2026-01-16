use sqlx::{migrate::MigrateDatabase, sqlite::SqlitePoolOptions, Pool, Sqlite, MySql, Postgres};
use std::fs;
use tauri::{AppHandle, Manager, Runtime};

use std::collections::HashMap;
use std::sync::RwLock;

#[derive(Clone, Debug)]
pub enum PoolWrapper {
    Mysql(Pool<MySql>),
    Postgres(Pool<Postgres>),
    Sqlite(Pool<Sqlite>),
}

impl PoolWrapper {
    pub async fn new(connection_string: &str) -> Result<Self, String> {
        if connection_string.starts_with("mysql") {
            let pool = sqlx::MySqlPool::connect(connection_string).await.map_err(|e| e.to_string())?;
            Ok(PoolWrapper::Mysql(pool))
        } else if connection_string.starts_with("postgres") {
            let pool = sqlx::PgPool::connect(connection_string).await.map_err(|e| e.to_string())?;
            Ok(PoolWrapper::Postgres(pool))
        } else {
            // Assume sqlite or try sqlite
            let pool = sqlx::SqlitePool::connect(connection_string).await.map_err(|e| e.to_string())?;
            Ok(PoolWrapper::Sqlite(pool))
        }
    }
}


#[derive(Clone, Debug)]
pub struct Session {
    #[allow(dead_code)]
    pub id: String,
    pub connection_id: i64,
    pub database_name: Option<String>,
    pub pool: PoolWrapper,
    #[allow(dead_code)]
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub struct SessionManager {
    sessions: RwLock<HashMap<String, Session>>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: RwLock::new(HashMap::new()),
        }
    }

    pub fn create_session(&self, connection_id: i64, database_name: Option<String>, pool: PoolWrapper) -> String {
        let id = format!("session:{}", uuid::Uuid::new_v4());
        let session = Session {
            id: id.clone(),
            connection_id,
            database_name,
            pool,
            created_at: chrono::Utc::now(),
        };
        self.sessions.write().unwrap().insert(id.clone(), session);
        id
    }

    pub fn get_session(&self, id: &str) -> Option<Session> {
        self.sessions.read().unwrap().get(id).cloned()
    }

    #[allow(dead_code)]
    pub fn remove_session(&self, id: &str) {
        self.sessions.write().unwrap().remove(id);
    }
}

pub async fn get_connection(state: &AppState, connection_string: &str) -> Result<PoolWrapper, String> {
    if connection_string.starts_with("session:") {
        if let Some(session) = state.sessions.get_session(connection_string) {
            return Ok(session.pool);
        }
        return Err("Session expired or invalid".to_string());
    }
    PoolWrapper::new(connection_string).await
}

pub struct AppState {
    pub db: Pool<Sqlite>,
    pub sessions: SessionManager,
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

    // Create credentials table first (since connections references it)
    create_table_schema(
        &pool,
        "credentials",
        "CREATE TABLE IF NOT EXISTS credentials (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            username TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );",
    )
    .await?;

    // Check if connections table has old schema (connection_string column)
    let connections_sql: String = sqlx::query_scalar(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='connections'"
    )
    .fetch_optional(&pool)
    .await
    .unwrap_or(None)
    .unwrap_or_default();

    let needs_migration = connections_sql.contains("connection_string");

    if needs_migration && !connections_sql.is_empty() {
        println!("Migrating connections to new schema...");
        
        // Rename old table
        let _ = sqlx::query("DROP TABLE IF EXISTS connections_old")
            .execute(&pool)
            .await;
        let _ = sqlx::query("ALTER TABLE connections RENAME TO connections_old")
            .execute(&pool)
            .await;
    }

    // Create new connections table
    create_table_schema(
        &pool,
        "connections",
        "CREATE TABLE IF NOT EXISTS connections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            db_type TEXT NOT NULL DEFAULT 'mysql',
            host TEXT NOT NULL DEFAULT 'localhost',
            port INTEGER NOT NULL DEFAULT 3306,
            database_name TEXT,
            credential_id TEXT,
            ssl_mode TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(credential_id) REFERENCES credentials(id) ON DELETE SET NULL
        );",
    )
    .await?;

    // Migrate old connections if needed
    if needs_migration {
        let old_conns: Vec<(i64, String, String, String)> = sqlx::query_as(
            "SELECT id, name, connection_string, datetime(created_at) as created_at FROM connections_old"
        )
        .fetch_all(&pool)
        .await
        .unwrap_or_default();

        for (id, name, conn_str, created_at) in old_conns {
            // Parse connection string to extract parts
            let (db_type, host, port, database_name) = parse_connection_string(&conn_str);
            
            let _ = sqlx::query(
                "INSERT INTO connections (id, name, db_type, host, port, database_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(id)
            .bind(&name)
            .bind(&db_type)
            .bind(&host)
            .bind(port)
            .bind(&database_name)
            .bind(&created_at)
            .execute(&pool)
            .await;
            
            println!("Migrated connection '{}' (credentials lost - please re-add)", name);
        }

        let _ = sqlx::query("DROP TABLE connections_old")
            .execute(&pool)
            .await;
        println!("Connection migration completed.");
    }

    // Cleanup any stale migration tables from previous runs
    let _ = sqlx::query("DROP TABLE IF EXISTS tags_old")
        .execute(&pool)
        .await;
    let _ = sqlx::query("DROP TABLE IF EXISTS table_tags_old")
        .execute(&pool)
        .await;


    create_table_schema(
        &pool,
        "tags",
        "CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            color TEXT NOT NULL,
            connection_id INTEGER,
            database_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(connection_id) REFERENCES connections(id) ON DELETE CASCADE
        );",
    )
    .await?;

    // Migration: Check if tags table has the connection_id column
    // We check the actual SQL definition of the table
    let tags_table_sql: String =
        sqlx::query_scalar("SELECT sql FROM sqlite_master WHERE type='table' AND name='tags'")
            .fetch_one(&pool)
            .await
            .unwrap_or_default();

    // Check if connection_id column exists OR if it points to the stale connections_old table
    if !tags_table_sql.contains("connection_id") || tags_table_sql.contains("connections_old") {
        println!("Migrating tags schema...");

        // 1. Rename existing table
        let _ = sqlx::query("DROP TABLE IF EXISTS tags_old")
            .execute(&pool)
            .await;
        let _ = sqlx::query("ALTER TABLE tags RENAME TO tags_old")
            .execute(&pool)
            .await;

        // 2. Create new table with correct schema
        create_table_schema(
            &pool,
            "tags",
            "CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                color TEXT NOT NULL,
                connection_id INTEGER,
                database_name TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(connection_id) REFERENCES connections(id) ON DELETE CASCADE
            );",
        )
        .await?;

        // 3. Copy data
        // Old table only had name and color, and likely created_at.
        // We copy what we can. Newly added columns connection_id and database_name will be NULL.
        let _ = sqlx::query(
            "INSERT INTO tags (id, name, color, created_at) 
             SELECT id, name, color, created_at FROM tags_old",
        )
        .execute(&pool)
        .await;

        // 4. Drop old table
        let _ = sqlx::query("DROP TABLE tags_old").execute(&pool).await;
        println!("Migration of tags completed.");
    }

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
    if !table_sql
        .replace(" ", "")
        .contains(&expected_unique.replace(" ", ""))
        || table_sql.contains("tags_old")
        || table_sql.contains("connections_old")
    {
        println!("Migrating table_tags schema...");

        // 1. Rename existing table
        let _ = sqlx::query("DROP TABLE IF EXISTS table_tags_old")
            .execute(&pool)
            .await;
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
        let _ = sqlx::query("DROP TABLE table_tags_old")
            .execute(&pool)
            .await;
        println!("Migration of table_tags completed.");
    }

    // Migration: Check if saved_queries has database_name column
    let sq_sql: String = sqlx::query_scalar("SELECT sql FROM sqlite_master WHERE type='table' AND name='saved_queries'")
        .fetch_optional(&pool)
        .await
        .unwrap_or_default()
        .unwrap_or_default();

    if !sq_sql.contains("database_name") {
        println!("Migrating saved_queries schema (adding database_name)...");
        let _ = sqlx::query("DROP TABLE IF EXISTS saved_queries_old").execute(&pool).await;
        let _ = sqlx::query("ALTER TABLE saved_queries RENAME TO saved_queries_old").execute(&pool).await;

        create_table_schema(
            &pool,
            "saved_queries",
            "CREATE TABLE IF NOT EXISTS saved_queries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                query TEXT NOT NULL,
                connection_id INTEGER NOT NULL,
                database_name TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(connection_id) REFERENCES connections(id) ON DELETE CASCADE
            );",
        ).await?;

        let _ = sqlx::query(
            "INSERT INTO saved_queries (id, name, query, connection_id, created_at)
             SELECT id, name, query, connection_id, created_at FROM saved_queries_old"
        ).execute(&pool).await;

        let _ = sqlx::query("DROP TABLE saved_queries_old").execute(&pool).await;
    } else if sq_sql.contains("connections_old") {
        println!("Migrating saved_queries schema (fixing stale foreign key)...");
        let _ = sqlx::query("DROP TABLE IF EXISTS saved_queries_old").execute(&pool).await;
        let _ = sqlx::query("ALTER TABLE saved_queries RENAME TO saved_queries_old").execute(&pool).await;

        create_table_schema(
            &pool,
            "saved_queries",
            "CREATE TABLE IF NOT EXISTS saved_queries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                query TEXT NOT NULL,
                connection_id INTEGER NOT NULL,
                database_name TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(connection_id) REFERENCES connections(id) ON DELETE CASCADE
            );",
        ).await?;

        let _ = sqlx::query(
            "INSERT INTO saved_queries (id, name, query, connection_id, database_name, created_at)
             SELECT id, name, query, connection_id, database_name, created_at FROM saved_queries_old"
        ).execute(&pool).await;

        let _ = sqlx::query("DROP TABLE saved_queries_old").execute(&pool).await;
    }

    create_table_schema(
        &pool,
        "saved_queries",
        "CREATE TABLE IF NOT EXISTS saved_queries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            query TEXT NOT NULL,
            connection_id INTEGER NOT NULL,
            database_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(connection_id) REFERENCES connections(id) ON DELETE CASCADE
        );",
    )
    .await?;

    // Migration: Check if saved_functions has database_name column
    let sf_sql: String = sqlx::query_scalar("SELECT sql FROM sqlite_master WHERE type='table' AND name='saved_functions'")
        .fetch_optional(&pool)
        .await
        .unwrap_or_default()
        .unwrap_or_default();

    if !sf_sql.contains("database_name") {
        println!("Migrating saved_functions schema (adding database_name)...");
        let _ = sqlx::query("DROP TABLE IF EXISTS saved_functions_old").execute(&pool).await;
        let _ = sqlx::query("ALTER TABLE saved_functions RENAME TO saved_functions_old").execute(&pool).await;

        create_table_schema(
            &pool,
            "saved_functions",
            "CREATE TABLE IF NOT EXISTS saved_functions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                function_body TEXT NOT NULL,
                connection_id INTEGER NOT NULL,
                database_name TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(connection_id) REFERENCES connections(id) ON DELETE CASCADE
            );",
        ).await?;

        let _ = sqlx::query(
            "INSERT INTO saved_functions (id, name, function_body, connection_id, created_at)
             SELECT id, name, function_body, connection_id, created_at FROM saved_functions_old"
        ).execute(&pool).await;

        let _ = sqlx::query("DROP TABLE saved_functions_old").execute(&pool).await;
    } else if sf_sql.contains("connections_old") {
        println!("Migrating saved_functions schema (fixing stale foreign key)...");
        let _ = sqlx::query("DROP TABLE IF EXISTS saved_functions_old").execute(&pool).await;
        let _ = sqlx::query("ALTER TABLE saved_functions RENAME TO saved_functions_old").execute(&pool).await;

        create_table_schema(
            &pool,
            "saved_functions",
            "CREATE TABLE IF NOT EXISTS saved_functions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                function_body TEXT NOT NULL,
                connection_id INTEGER NOT NULL,
                database_name TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(connection_id) REFERENCES connections(id) ON DELETE CASCADE
            );",
        ).await?;

        let _ = sqlx::query(
            "INSERT INTO saved_functions (id, name, function_body, connection_id, database_name, created_at)
             SELECT id, name, function_body, connection_id, database_name, created_at FROM saved_functions_old"
        ).execute(&pool).await;

        let _ = sqlx::query("DROP TABLE saved_functions_old").execute(&pool).await;
    }

    create_table_schema(
        &pool,
        "saved_functions",
        "CREATE TABLE IF NOT EXISTS saved_functions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            function_body TEXT NOT NULL,
            connection_id INTEGER NOT NULL,
            database_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(connection_id) REFERENCES connections(id) ON DELETE CASCADE
        );",
    )
    .await?;

    // Create table_filters table to store filter configurations per table
    create_table_schema(
        &pool,
        "table_filters",
        "CREATE TABLE IF NOT EXISTS table_filters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            connection_id INTEGER NOT NULL,
            database_name TEXT NOT NULL,
            table_name TEXT NOT NULL,
            filters_json TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(connection_id) REFERENCES connections(id) ON DELETE CASCADE,
            UNIQUE(connection_id, database_name, table_name)
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

/// Parse a legacy connection string to extract components
/// Returns (db_type, host, port, database_name)
fn parse_connection_string(conn_str: &str) -> (String, String, i32, Option<String>) {
    // Format: protocol://[user:pass@]host:port[/database]
    let mut db_type = "mysql".to_string();
    let mut host = "localhost".to_string();
    let mut port = 3306;
    let mut database_name = None;

    // Extract protocol
    if let Some(idx) = conn_str.find("://") {
        let protocol = &conn_str[..idx];
        db_type = match protocol {
            "mysql" => "mysql".to_string(),
            "postgres" | "postgresql" => "postgres".to_string(),
            "sqlite" => "sqlite".to_string(),
            _ => protocol.to_string(),
        };
        
        // Set default port based on db type
        port = match db_type.as_str() {
            "postgres" => 5432,
            "mysql" => 3306,
            _ => 3306,
        };

        let rest = &conn_str[idx + 3..];
        
        // For SQLite, the rest is the file path
        if db_type == "sqlite" {
            host = rest.to_string();
            return (db_type, host, 0, None);
        }
        
        // Remove credentials if present (user:pass@)
        let after_creds = if let Some(at_idx) = rest.rfind('@') {
            &rest[at_idx + 1..]
        } else {
            rest
        };
        
        // Split on / to get host:port and database
        let parts: Vec<&str> = after_creds.splitn(2, '/').collect();
        let host_port = parts[0];
        
        if parts.len() > 1 {
            // Remove query params from database name
            let db = parts[1].split('?').next().unwrap_or("");
            if !db.is_empty() {
                database_name = Some(db.to_string());
            }
        }
        
        // Split host:port
        if let Some(colon_idx) = host_port.rfind(':') {
            host = host_port[..colon_idx].to_string();
            if let Ok(p) = host_port[colon_idx + 1..].parse::<i32>() {
                port = p;
            }
        } else {
            host = host_port.to_string();
        }
    }

    (db_type, host, port, database_name)
}
