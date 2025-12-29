use crate::db::AppState;
use crate::models::{SavedFunction, SavedQuery};
use sqlx::{Pool, Sqlite};
use tauri::State;

// Helper for saving items (query or function)
async fn insert_saved_item(
    db: &Pool<Sqlite>,
    table: &str,
    content_col: &str,
    name: &str,
    content: &str,
    connection_id: i64,
) -> Result<i64, String> {
    let sql = format!(
        "INSERT INTO {} (name, {}, connection_id) VALUES (?, ?, ?)",
        table, content_col
    );
    let result = sqlx::query(&sql)
        .bind(name)
        .bind(content)
        .bind(connection_id)
        .execute(db)
        .await
        .map_err(|e| format!("Failed to save to {}: {}", table, e))?;
    Ok(result.last_insert_rowid())
}

// Helper for deleting items
async fn delete_saved_item(db: &Pool<Sqlite>, table: &str, id: i64) -> Result<(), String> {
    let sql = format!("DELETE FROM {} WHERE id = ?", table);
    sqlx::query(&sql)
        .bind(id)
        .execute(db)
        .await
        .map_err(|e| format!("Failed to delete from {}: {}", table, e))?;
    Ok(())
}

// Helper for updating saved items
async fn update_saved_item(
    db: &Pool<Sqlite>,
    table: &str,
    content_col: &str,
    id: i64,
    name: &str,
    content: &str,
) -> Result<(), String> {
    let sql = format!(
        "UPDATE {} SET name = ?, {} = ? WHERE id = ?",
        table, content_col
    );
    sqlx::query(&sql)
        .bind(name)
        .bind(content)
        .bind(id)
        .execute(db)
        .await
        .map_err(|e| format!("Failed to update {}: {}", table, e))?;
    Ok(())
}

#[tauri::command]
pub async fn save_query(
    state: State<'_, AppState>,
    name: String,
    query: String,
    connection_id: i64,
) -> Result<i64, String> {
    insert_saved_item(
        &state.db,
        "saved_queries",
        "query",
        &name,
        &query,
        connection_id,
    )
    .await
}

#[tauri::command]
pub async fn list_queries(
    state: State<'_, AppState>,
    connection_id: i64,
) -> Result<Vec<SavedQuery>, String> {
    sqlx::query_as::<_, SavedQuery>(
        "SELECT id, name, query, connection_id, datetime(created_at) as created_at FROM saved_queries WHERE connection_id = ? ORDER BY created_at DESC",
    )
    .bind(connection_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| format!("Failed to list queries: {}", e))
}

#[tauri::command]
pub async fn delete_query(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    delete_saved_item(&state.db, "saved_queries", id).await
}

#[tauri::command]
pub async fn update_query(
    state: State<'_, AppState>,
    id: i64,
    name: String,
    query: String,
) -> Result<(), String> {
    update_saved_item(&state.db, "saved_queries", "query", id, &name, &query).await
}

#[tauri::command]
pub async fn save_function(
    state: State<'_, AppState>,
    name: String,
    function_body: String,
    connection_id: i64,
) -> Result<i64, String> {
    insert_saved_item(
        &state.db,
        "saved_functions",
        "function_body",
        &name,
        &function_body,
        connection_id,
    )
    .await
}

#[tauri::command]
pub async fn list_functions(
    state: State<'_, AppState>,
    connection_id: i64,
) -> Result<Vec<SavedFunction>, String> {
    sqlx::query_as::<_, SavedFunction>(
        "SELECT id, name, function_body, connection_id, datetime(created_at) as created_at FROM saved_functions WHERE connection_id = ? ORDER BY created_at DESC",
    )
    .bind(connection_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| format!("Failed to list functions: {}", e))
}

#[tauri::command]
pub async fn delete_function(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    delete_saved_item(&state.db, "saved_functions", id).await
}

#[tauri::command]
pub async fn update_function(
    state: State<'_, AppState>,
    id: i64,
    name: String,
    function_body: String,
) -> Result<(), String> {
    update_saved_item(
        &state.db,
        "saved_functions",
        "function_body",
        id,
        &name,
        &function_body,
    )
    .await
}
