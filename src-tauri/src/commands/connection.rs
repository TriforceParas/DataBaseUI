use crate::commands::credential::{build_connection_string, get_password_from_keyring};
use crate::db::AppState;
use crate::models::{Connection, Credential};
use sqlx::{AnyConnection, Connection as SqlxConnection};
use tauri::State;

#[tauri::command]
pub async fn verify_connection(
    state: State<'_, AppState>,
    connection_string: String,
    credential_id: Option<String>
) -> Result<(), String> {
    let mut final_conn_string = connection_string;

    // If credential_id is provided, fetch credentials and inject into connection string
    if let Some(cred_id) = credential_id {
        // Parse ID (handling potential string wrapping)
        let cred: Credential = sqlx::query_as::<_, Credential>(
            "SELECT id, name, username, datetime(created_at) as created_at FROM credentials WHERE id = ?"
        )
        .bind(&cred_id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| format!("Credential not found: {}", e))?;
        
        let password = get_password_from_keyring(&cred.id)?;
        
        if let Some(protocol_end) = final_conn_string.find("://") {
             let split_idx = protocol_end + 3;
             let (protocol_part, rest) = final_conn_string.split_at(split_idx);
             
             if rest.contains('@') {
                 if let Some(at_idx) = rest.find('@') {
                     let (user_part, host_part) = rest.split_at(at_idx);
                     // host_part starts with '@'
                     final_conn_string = format!("{}{}:{}{}", protocol_part, user_part, password, host_part);
                 }
             } else {
                // No username in string? Just prepend username:password@
                final_conn_string = format!("{}{}:{}@{}", protocol_part, cred.username, password, rest);
             }
        }
    }

    <AnyConnection as SqlxConnection>::connect(&final_conn_string)
        .await
        .map_err(|e| format!("Failed to connect: {}", e))
        .map(|_| ())
}

/// Verify connection using stored connection metadata and credentials
#[tauri::command]
pub async fn verify_connection_by_id(
    state: State<'_, AppState>,
    connection_id: i64,
) -> Result<(), String> {
    let connection_string = get_connection_string_internal(&state, connection_id, None).await?;
    verify_connection(state, connection_string, None).await
}

/// Verify connection using stored metadata but manual credentials
#[tauri::command]
pub async fn verify_connection_manual(
    state: State<'_, AppState>,
    connection_id: i64,
    username: String,
    password: String,
) -> Result<(), String> {
    // Fetch connection metadata
    let conn: Connection = sqlx::query_as::<_, Connection>(
        "SELECT id, name, db_type, host, port, database_name, credential_id, ssl_mode, datetime(created_at) as created_at FROM connections WHERE id = ?"
    )
    .bind(connection_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| format!("Connection not found: {}", e))?;

    let connection_string = build_connection_string(
        &conn.db_type,
        &conn.host,
        conn.port,
        conn.database_name.as_deref(),
        Some(&username),
        Some(&password),
        conn.ssl_mode.as_deref(),
    );

    <AnyConnection as SqlxConnection>::connect(&connection_string)
        .await
        .map_err(|e| format!("Failed to connect: {}", e))
        .map(|_| ())
}

/// Build connection string from connection ID by fetching metadata and credentials
async fn get_connection_string_internal(state: &AppState, connection_id: i64, database_name: Option<String>) -> Result<String, String> {
    // Fetch connection metadata
    let conn: Connection = sqlx::query_as::<_, Connection>(
        "SELECT id, name, db_type, host, port, database_name, credential_id, ssl_mode, datetime(created_at) as created_at FROM connections WHERE id = ?"
    )
    .bind(connection_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| format!("Connection not found: {}", e))?;
    
    // If credential_id is set, fetch credentials
    let (username, password) = if let Some(cred_id) = &conn.credential_id {
        // Fetch credential from DB
        let cred: Credential = sqlx::query_as::<_, Credential>(
            "SELECT id, name, username, datetime(created_at) as created_at FROM credentials WHERE id = ?"
        )
        .bind(cred_id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| format!("Credential not found: {}", e))?;
        
        // Get password from keyring
        let password = get_password_from_keyring(&cred.id)?;
        (Some(cred.username), Some(password))
    } else {
        (None, None)
    };
    
    Ok(build_connection_string(
        &conn.db_type,
        &conn.host,
        conn.port,
        database_name.or(conn.database_name).as_deref(),
        username.as_deref(),
        password.as_deref(),
        conn.ssl_mode.as_deref(),
    ))
}

/// Tauri command: Get connection string by connection ID
#[tauri::command]
pub async fn get_connection_string(
    state: State<'_, AppState>,
    connection_id: i64,
    database_name: Option<String>,
    username: Option<String>,
    password: Option<String>,
) -> Result<String, String> {
    if let (Some(u), Some(p)) = (username, password) {
        // Build with manual creds
        let conn: Connection = sqlx::query_as::<_, Connection>(
            "SELECT id, name, db_type, host, port, database_name, credential_id, ssl_mode, datetime(created_at) as created_at FROM connections WHERE id = ?"
        )
        .bind(connection_id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| format!("Connection not found: {}", e))?;

        return Ok(build_connection_string(
            &conn.db_type,
            &conn.host,
            conn.port,
            database_name.or(conn.database_name).as_deref(),
            Some(&u),
            Some(&p),
            conn.ssl_mode.as_deref(),
        ));
    }
    get_connection_string_internal(&state, connection_id, database_name).await
}

#[tauri::command]
pub async fn save_connection(
    state: State<'_, AppState>,
    name: String,
    db_type: String,
    host: String,
    port: i32,
    database_name: Option<String>,
    credential_id: Option<String>,
    ssl_mode: Option<String>,
) -> Result<i64, String> {
    let result = sqlx::query(
        "INSERT INTO connections (name, db_type, host, port, database_name, credential_id, ssl_mode) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&name)
    .bind(&db_type)
    .bind(&host)
    .bind(port)
    .bind(&database_name)
    .bind(&credential_id)
    .bind(&ssl_mode)
    .execute(&state.db)
    .await
    .map_err(|e| format!("Failed to save connection: {}", e))?;

    Ok(result.last_insert_rowid())
}

#[tauri::command]
pub async fn list_connections(state: State<'_, AppState>) -> Result<Vec<Connection>, String> {
    sqlx::query_as::<_, Connection>(
        "SELECT id, name, db_type, host, port, database_name, credential_id, ssl_mode, datetime(created_at) as created_at FROM connections ORDER BY created_at DESC",
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
    db_type: String,
    host: String,
    port: i32,
    database_name: Option<String>,
    credential_id: Option<String>,
    ssl_mode: Option<String>,
) -> Result<(), String> {
    sqlx::query(
        "UPDATE connections SET name = ?, db_type = ?, host = ?, port = ?, database_name = ?, credential_id = ?, ssl_mode = ? WHERE id = ?"
    )
    .bind(&name)
    .bind(&db_type)
    .bind(&host)
    .bind(port)
    .bind(&database_name)
    .bind(&credential_id)
    .bind(&ssl_mode)
    .bind(id)
    .execute(&state.db)
    .await
    .map_err(|e| format!("Failed to update connection: {}", e))?;
    Ok(())
}
