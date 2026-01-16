use crate::db::{AppState, PoolWrapper};
use serde::{Serialize, Deserialize};
use tauri::State;
use sqlx::Row;
use crate::models::{Tag, TableTag};

#[derive(Serialize, Deserialize, Debug)]
pub struct TagGroupView {
    pub tag: Tag,
    pub tables: Vec<String>
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SidebarView {
    pub groups: Vec<TagGroupView>,
    pub untagged: Vec<String>,
    pub databases: Vec<String> // For connection dropdown
}

#[tauri::command]
pub async fn get_sidebar_view(
    state: State<'_, AppState>,
    connection_string: Option<String>,
    connection_id: Option<i64>,
    database_name: Option<String>,
    search_query: Option<String>
) -> Result<SidebarView, String> {
    // 1. Resolve Session or Legacy Connection
    let (pool, target_conn_id, effective_db_name) = if let Some(conn_str) = &connection_string {
        if conn_str.starts_with("session:") {
            // Session Path
            let session_id = conn_str; // passed as full string e.g. "session:uuid"
            let session = state.sessions.get_session(session_id).ok_or("Session not found")?;
            (session.pool, session.connection_id, session.database_name)
        } else {
            // Raw Connection String Path (unlikely for sidebar but possible if passed directly)
            // If raw string, we don't have a connection_id usually... 
            // The sidebar strictly relies on connection_id for tagging.
            // If connection_id is passed alongside the string, we use it.
            let p = crate::db::get_connection(&state, conn_str).await.map_err(|e| e.to_string())?;
            (p, connection_id.unwrap_or(0), database_name.clone())
        }
    } else {
        // Legacy Path: connection_id required
        let conn_id = connection_id.ok_or("Connection ID required when no connection string provided")?;
        
        let row = sqlx::query("SELECT id, name, db_type, host, port, credential_id, database_name FROM connections WHERE id = ?")
            .bind(conn_id)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| e.to_string())?
            .ok_or("Connection not found")?;

        let db_type: String = row.try_get("db_type").unwrap_or_default();
        let host: String = row.try_get("host").unwrap_or_default();
        let port: i32 = row.try_get("port").unwrap_or(3306);
        let default_db: String = row.try_get("database_name").unwrap_or_default();
        let credential_id: Option<String> = row.try_get("credential_id").unwrap_or_default();

        let target_conn_string = if db_type == "sqlite" {
            format!("sqlite:{}", host)
        } else {
            // MySQL or Postgres
            let mut username = String::new();
            let mut password = String::new();

            if let Some(cred_id) = credential_id {
                 let cred_row = sqlx::query("SELECT username FROM credentials WHERE id = ?")
                     .bind(&cred_id)
                     .fetch_optional(&state.db)
                     .await
                     .map_err(|e| e.to_string())?;
                 
                 if let Some(cr) = cred_row {
                     username = cr.try_get("username").unwrap_or_default();
                     password = crate::commands::credential::get_password_from_keyring(&cred_id).unwrap_or_default();
                 }
            }

            let db_to_use = database_name.clone().unwrap_or(default_db);
            let pass_part = if !password.is_empty() { format!(":{}", password) } else { String::new() };
            
            if db_type == "postgres" {
                 if db_to_use.is_empty() {
                      format!("postgres://{}{}{}@{}:{}", username, pass_part, "", host, port)
                 } else {
                      format!("postgres://{}{}{}@{}:{}/{}", username, pass_part, "", host, port, db_to_use)
                 }
            } else {
                 if db_to_use.is_empty() {
                      format!("mysql://{}{}{}@{}:{}", username, pass_part, "", host, port)
                 } else {
                      format!("mysql://{}{}{}@{}:{}/{}", username, pass_part, "", host, port, db_to_use)
                 }
            }
        };
        
        // Use get_connection (it wraps PoolWrapper::new)
        let p = crate::db::get_connection(&state, &target_conn_string).await.map_err(|e| e.to_string())?;
        (p, conn_id, database_name.clone())
    };

    // 2. Fetch Host for Scoping (needed for SQLite fallback and Tags logic)
    // Even if we have pool, we need 'host' to match legacy behavior for SQLite db_scope
    // Fetch from connections table using target_conn_id
    let host: String = if target_conn_id > 0 {
         sqlx::query_scalar("SELECT host FROM connections WHERE id = ?")
            .bind(target_conn_id)
            .fetch_one(&state.db)
            .await
            .unwrap_or_else(|_| "localhost".to_string())
    } else {
         "localhost".to_string()
    };

    // 3. Fetch Tables
    let mut all_tables: Vec<String> = match &pool {
        PoolWrapper::Sqlite(p) => {
             sqlx::query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
                 .fetch_all(p).await.map_err(|e: sqlx::Error| e.to_string())?
                 .iter().map(|r: &sqlx::sqlite::SqliteRow| r.get::<String, _>(0)).collect()
        },
        PoolWrapper::Mysql(p) => {
             let q = if let Some(db) = &effective_db_name {
                 format!("SHOW TABLES FROM `{}`", db)
             } else {
                 "SHOW TABLES".to_string()
             };
             
             match sqlx::query(&q).fetch_all(p).await {
                 Ok(rows) => rows.iter().map(|r: &sqlx::mysql::MySqlRow| r.get::<String, _>(0)).collect(),
                 Err(e) => {
                     let err_msg = e.to_string();
                     if err_msg.contains("1046") || err_msg.contains("No database selected") {
                         vec![]
                     } else {
                         println!("[Sidebar] Failed to fetch MySQL tables (Query: {}): {}", q, e);
                         vec![]
                     }
                 }
             }
        },
        PoolWrapper::Postgres(p) => {
             // Fetch Tables for Postgres
             let q = "SELECT table_name::TEXT FROM information_schema.tables WHERE table_schema = 'public'";
             match sqlx::query(q).fetch_all(p).await {
                  Ok(rows) => rows.iter().map(|r: &sqlx::postgres::PgRow| r.get::<String, _>(0)).collect(),
                  Err(e) => {
                      println!("[Sidebar] Failed to fetch Postgres tables: {}", e);
                      vec![]
                  }
             }
        }
    };

    // 4. Filter Tables
    if let Some(q) = &search_query {
        if !q.is_empty() {
            let q_lower = q.to_lowercase();
            all_tables.retain(|t: &String| t.to_lowercase().contains(&q_lower));
        }
    }

    // 5. Fetch Databases
    let databases = match &pool {
        PoolWrapper::Mysql(p) => {
             match sqlx::query("SHOW DATABASES").fetch_all(p).await {
                 Ok(rows) => {
                     let db_list: Vec<String> = rows.iter()
                     .map(|r: &sqlx::mysql::MySqlRow| r.get::<String, _>(0))
                     .filter(|d: &String| !["information_schema", "mysql", "performance_schema", "sys"].contains(&d.as_str()))
                     .collect();
                     println!("[Sidebar] Found {} MySQL databases", db_list.len());
                     db_list
                 },
                 Err(e) => {
                     println!("[Sidebar] Failed to fetch MySQL databases: {}", e);
                     vec![]
                 }
             }
        },
        PoolWrapper::Postgres(p) => {
             match sqlx::query("SELECT datname::TEXT FROM pg_database WHERE datistemplate = false").fetch_all(p).await {
                 Ok(rows) => {
                     let db_list: Vec<String> = rows.iter().map(|r: &sqlx::postgres::PgRow| r.get::<String, _>(0)).collect();
                     println!("[Sidebar] Found {} Postgres databases", db_list.len());
                     db_list
                 },
                 Err(e) => {
                     println!("[Sidebar] Failed to fetch Postgres databases: {}", e);
                     vec![]
                 }
             }
        },
        PoolWrapper::Sqlite(_) => {
            // For SQLite, the "database" is the file name itself (host)
            vec![host.clone()]
        }
    };

    // 6. Fetch Tags & TableTags
    let db_scope = effective_db_name.clone().unwrap_or(host.clone()); 
    
    let tags: Vec<Tag> = sqlx::query_as("SELECT id, name, color, connection_id, database_name FROM tags WHERE connection_id = ? AND database_name = ? ORDER BY name")
        .bind(target_conn_id)
        .bind(&db_scope)
        .fetch_all(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    let table_tags: Vec<TableTag> = sqlx::query_as("SELECT tag_id, table_name, connection_id, database_name FROM table_tags WHERE connection_id = ? AND database_name = ?")
        .bind(target_conn_id)
        .bind(&db_scope)
        .fetch_all(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    // 7. Build View
    let mut groups: Vec<TagGroupView> = Vec::new();
    let mut assigned_tables = std::collections::HashSet::new();

    for tag in tags {
        let mut tables_in_tag: Vec<String> = table_tags.iter()
            .filter(|tt| tt.tag_id == tag.id)
            .map(|tt| tt.table_name.clone())
            .collect();
        
        tables_in_tag.retain(|t| all_tables.contains(t));
        tables_in_tag.sort();

        for t in &tables_in_tag {
            assigned_tables.insert(t.clone());
        }

        groups.push(TagGroupView {
            tag,
            tables: tables_in_tag
        });
    }

    let mut untagged: Vec<String> = all_tables.into_iter()
        .filter(|t| !assigned_tables.contains(t))
        .collect();
    
    untagged.sort();

    Ok(SidebarView {
        groups,
        untagged,
        databases
    })
}
