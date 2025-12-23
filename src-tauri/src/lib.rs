mod commands;
mod db;

use db::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::save_connection,
            commands::list_connections,
            commands::verify_connection,
            commands::delete_connection,
            commands::update_connection,
            commands::get_tables,
            commands::create_tag,
            commands::update_tag,
            commands::delete_tag,
            commands::get_tags,
            commands::assign_tag,
            commands::remove_tag_from_table,
            commands::get_table_tags,
            commands::execute_query,
            commands::get_columns,
            commands::open_connection_window,
            commands::get_table_schema,
            commands::truncate_table,
            commands::drop_table,
            commands::duplicate_table,
            // Saved Queries
            commands::save_query,
            commands::list_queries,
            commands::delete_query,
            commands::update_query,
            // Saved Functions
            commands::save_function,
            commands::list_functions,
            commands::delete_function,
            commands::update_function
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialize DB
            let handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                match db::init_db(&handle).await {
                    Ok(pool) => {
                        handle.manage(AppState { db: pool });
                    }
                    Err(e) => {
                        log::error!("Failed to initialize database: {}", e);
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
