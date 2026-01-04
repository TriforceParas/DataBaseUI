use crate::db::AppState;
use crate::models::{TableTag, Tag};
use tauri::State;

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
pub async fn update_tag(
    state: State<'_, AppState>,
    id: i64,
    name: String,
    color: String,
) -> Result<(), String> {
    sqlx::query("UPDATE tags SET name = ?, color = ? WHERE id = ?")
        .bind(name)
        .bind(color)
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| format!("Failed to update tag: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_tag(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    // First, remove all table_tags associations
    sqlx::query("DELETE FROM table_tags WHERE tag_id = ?")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| format!("Failed to remove tag associations: {}", e))?;

    // Then delete the tag itself
    sqlx::query("DELETE FROM tags WHERE id = ?")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| format!("Failed to delete tag: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn get_tags(
    state: State<'_, AppState>,
    connection_id: Option<i64>,
    database_name: Option<String>,
) -> Result<Vec<Tag>, String> {
    // Show only tags that match both connection_id AND database_name
    let query_str = "SELECT id, name, color, connection_id, database_name FROM tags 
        WHERE (connection_id = ? OR (connection_id IS NULL AND ? IS NULL))
        AND (database_name = ? OR (database_name IS NULL AND ? IS NULL))
        ORDER BY name ASC";

    sqlx::query_as::<_, Tag>(query_str)
        .bind(connection_id)
        .bind(connection_id)
        .bind(&database_name)
        .bind(&database_name)
        .fetch_all(&state.db)
        .await
        .map_err(|e| format!("Failed to fetch tags: {}", e))
}

#[tauri::command]
pub async fn assign_tag(
    state: State<'_, AppState>,
    connection_id: i64,
    table_name: String,
    database_name: String,
    tag_id: i64,
) -> Result<(), String> {
    // Check if tag exists
    let _ = sqlx::query("SELECT id FROM tags WHERE id = ?")
        .bind(tag_id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| "Tag not found".to_string())?;

    sqlx::query(
        "INSERT INTO table_tags (connection_id, table_name, database_name, tag_id) VALUES (?, ?, ?, ?)
         ON CONFLICT(table_name, connection_id, database_name, tag_id) DO NOTHING",
    )
    .bind(connection_id)
    .bind(table_name)
    .bind(database_name)
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
    database_name: String,
    tag_id: i64,
) -> Result<(), String> {
    sqlx::query(
        "DELETE FROM table_tags WHERE connection_id = ? AND table_name = ? AND database_name = ? AND tag_id = ?",
    )
    .bind(connection_id)
    .bind(table_name)
    .bind(database_name)
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
    database_name: String,
) -> Result<Vec<TableTag>, String> {
    sqlx::query_as::<_, TableTag>(
        "SELECT tag_id, table_name, connection_id, database_name FROM table_tags WHERE connection_id = ? AND database_name = ?",
    )
    .bind(connection_id)
    .bind(database_name)
    .fetch_all(&state.db)
    .await
    .map_err(|e| format!("Failed to fetch table tags: {}", e))
}
