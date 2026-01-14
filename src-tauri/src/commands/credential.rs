use crate::db::AppState;
use crate::models::Credential;
use keyring::Entry;
use tauri::State;
use uuid::Uuid;

const SERVICE_NAME: &str = "com.dbplus.sqlclient";

/// Store a credential in the OS keyring
#[tauri::command]
pub async fn save_credential(
    state: State<'_, AppState>,
    name: String,
    username: String,
    password: String,
) -> Result<String, String> {
    // Generate a unique ID for this credential
    let id = Uuid::new_v4().to_string();
    
    // Store password in OS keyring
    let entry = Entry::new(SERVICE_NAME, &id)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    
    entry
        .set_password(&password)
        .map_err(|e| format!("Failed to store password in keyring: {}", e))?;
    
    // Store credential metadata in SQLite (not the password!)
    sqlx::query(
        "INSERT INTO credentials (id, name, username) VALUES (?, ?, ?)"
    )
    .bind(&id)
    .bind(&name)
    .bind(&username)
    .execute(&state.db)
    .await
    .map_err(|e| format!("Failed to save credential: {}", e))?;
    
    Ok(id)
}

/// List all credentials (without passwords)
#[tauri::command]
pub async fn list_credentials(state: State<'_, AppState>) -> Result<Vec<Credential>, String> {
    sqlx::query_as::<_, Credential>(
        "SELECT id, name, username, datetime(created_at) as created_at FROM credentials ORDER BY created_at DESC"
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| format!("Failed to list credentials: {}", e))
}

/// Delete a credential from both keyring and database
#[tauri::command]
pub async fn delete_credential(state: State<'_, AppState>, id: String) -> Result<(), String> {
    // Delete from keyring
    let entry = Entry::new(SERVICE_NAME, &id)
        .map_err(|e| format!("Failed to access keyring: {}", e))?;
    
    // Ignore error if password doesn't exist in keyring
    let _ = entry.delete_credential();
    
    // Delete from database
    sqlx::query("DELETE FROM credentials WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|e| format!("Failed to delete credential: {}", e))?;
    
    Ok(())
}

/// Update a credential (name, username, and optionally password)
#[tauri::command]
pub async fn update_credential(
    state: State<'_, AppState>,
    id: String,
    name: String,
    username: String,
    password: Option<String>,
) -> Result<(), String> {
    // If password provided, update in keyring
    if let Some(pwd) = password {
        let entry = Entry::new(SERVICE_NAME, &id)
            .map_err(|e| format!("Failed to access keyring: {}", e))?;
        
        entry
            .set_password(&pwd)
            .map_err(|e| format!("Failed to update password: {}", e))?;
    }
    
    // Update metadata in database
    sqlx::query("UPDATE credentials SET name = ?, username = ? WHERE id = ?")
        .bind(&name)
        .bind(&username)
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|e| format!("Failed to update credential: {}", e))?;
    
    Ok(())
}

/// Get password from keyring (internal use only, not exposed to frontend directly)
pub fn get_password_from_keyring(credential_id: &str) -> Result<String, String> {
    let entry = Entry::new(SERVICE_NAME, credential_id)
        .map_err(|e| format!("Failed to access keyring: {}", e))?;
    
    entry
        .get_password()
        .map_err(|e| format!("Failed to retrieve password: {}", e))
}

/// Build a connection string from connection metadata and credentials
pub fn build_connection_string(
    db_type: &str,
    host: &str,
    port: i32,
    database_name: Option<&str>,
    username: Option<&str>,
    password: Option<&str>,
    ssl_mode: Option<&str>,
) -> String {
    let mut url = match db_type {
        "mysql" => format!("mysql://"),
        "postgres" => format!("postgres://"),
        "sqlite" => return format!("sqlite://{}", host), // For SQLite, host is the file path
        _ => format!("{}://", db_type),
    };
    
    // Add credentials if present
    if let (Some(user), Some(pass)) = (username, password) {
        url.push_str(&format!("{}:{}@", user, pass));
    } else if let Some(user) = username {
        url.push_str(&format!("{}@", user));
    }
    
    // Add host and port
    url.push_str(&format!("{}:{}", host, port));
    
    // Add database name if present
    if let Some(db) = database_name {
        url.push_str(&format!("/{}", db));
    }
    
    // Add SSL mode if present
    if let Some(ssl) = ssl_mode {
        url.push_str(&format!("?sslmode={}", ssl));
    }
    
    url
}
