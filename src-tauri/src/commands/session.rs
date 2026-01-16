use crate::db::{AppState, PoolWrapper};
use tauri::{State, command};

#[command]
pub async fn create_session(
    state: State<'_, AppState>,
    connection_id: i64,
    database_name: Option<String>,
) -> Result<String, String> {
    // Reuse existing logic to get credentials and build connection URL
    
    // 1. Fetch connection details
    let conn: crate::models::Connection = sqlx::query_as::<_, crate::models::Connection>(
        "SELECT id, name, db_type, host, port, database_name, credential_id, ssl_mode, datetime(created_at) as created_at FROM connections WHERE id = ?"
    )
    .bind(connection_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| format!("Connection not found: {}", e))?;

    // 2. Fetch credentials if needed
    let (username, password) = if let Some(cred_id) = &conn.credential_id {
        let cred: crate::models::Credential = sqlx::query_as::<_, crate::models::Credential>(
            "SELECT id, name, username, datetime(created_at) as created_at FROM credentials WHERE id = ?"
        )
        .bind(cred_id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| format!("Credential not found: {}", e))?;
        
        let entry = keyring::Entry::new("sql-ui-app", &cred.id).map_err(|e| e.to_string())?;
        let password = entry.get_password().map_err(|e| e.to_string())?;
        (Some(cred.username), Some(password))
    } else {
        (None, None)
    };

    // 3. Build connection string
    let url = crate::commands::credential::build_connection_string(
        &conn.db_type,
        &conn.host,
        conn.port,
        database_name.as_deref().or(conn.database_name.as_deref()),

        username.as_deref(),
        password.as_deref(),
        conn.ssl_mode.as_deref(),
    );

    // 4. Create Pool
    let pool = PoolWrapper::new(&url).await?;

    // 5. Store in SessionManager
    let session_id = state.sessions.create_session(connection_id, database_name.clone().or(conn.database_name), pool);

    Ok(session_id)
}
