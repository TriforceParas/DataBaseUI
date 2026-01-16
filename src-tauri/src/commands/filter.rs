use crate::db::AppState;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterCondition {
    pub id: String,
    pub enabled: bool,
    pub column: String,
    pub operator: String,
    pub value: String,
}



/// Save filters for a specific table
#[tauri::command]
pub async fn save_table_filters(
    state: State<'_, AppState>,
    connection_id: i64,
    database_name: String,
    table_name: String,
    filters: Vec<FilterCondition>,
) -> Result<(), String> {
    let filters_json = serde_json::to_string(&filters)
        .map_err(|e| format!("Failed to serialize filters: {}", e))?;

    sqlx::query(
        "INSERT INTO table_filters (connection_id, database_name, table_name, filters_json, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(connection_id, database_name, table_name) 
         DO UPDATE SET filters_json = excluded.filters_json, updated_at = CURRENT_TIMESTAMP"
    )
    .bind(connection_id)
    .bind(&database_name)
    .bind(&table_name)
    .bind(&filters_json)
    .execute(&state.db)
    .await
    .map_err(|e| format!("Failed to save filters: {}", e))?;

    Ok(())
}

/// Get filters for a specific table
#[tauri::command]
pub async fn get_table_filters(
    state: State<'_, AppState>,
    connection_id: i64,
    database_name: String,
    table_name: String,
) -> Result<Vec<FilterCondition>, String> {
    let row = sqlx::query(
        "SELECT filters_json FROM table_filters 
         WHERE connection_id = ? AND database_name = ? AND table_name = ?"
    )
    .bind(connection_id)
    .bind(&database_name)
    .bind(&table_name)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| format!("Failed to get filters: {}", e))?;

    match row {
        Some(row) => {
            let filters_json: String = row.get("filters_json");
            let filters: Vec<FilterCondition> = serde_json::from_str(&filters_json)
                .map_err(|e| format!("Failed to parse filters: {}", e))?;
            Ok(filters)
        }
        None => Ok(vec![]),
    }
}

/// Delete filters for a specific table
#[tauri::command]
pub async fn delete_table_filters(
    state: State<'_, AppState>,
    connection_id: i64,
    database_name: String,
    table_name: String,
) -> Result<(), String> {
    sqlx::query(
        "DELETE FROM table_filters 
         WHERE connection_id = ? AND database_name = ? AND table_name = ?"
    )
    .bind(connection_id)
    .bind(&database_name)
    .bind(&table_name)
    .execute(&state.db)
    .await
    .map_err(|e| format!("Failed to delete filters: {}", e))?;

    Ok(())
}
