use crate::db::AppState;
use crate::models::Connection;
use sqlx::{AnyConnection, Connection as SqlxConnection};
use tauri::State;

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
        "SELECT id, name, connection_string, datetime(created_at) as created_at FROM connections ORDER BY created_at DESC",
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
