mod commands;
mod db;
mod models;
mod utils;

use db::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            // Connection
            commands::connection::save_connection,
            commands::connection::list_connections,
            commands::connection::verify_connection,
            commands::connection::verify_connection_by_id,
            commands::connection::verify_connection_manual,
            commands::connection::delete_connection,
            commands::connection::update_connection,
            commands::connection::get_connection_string,
            // Credentials
            commands::credential::save_credential,
            commands::credential::list_credentials,
            commands::credential::delete_credential,
            commands::credential::update_credential,
            // DB Ops
            commands::db_ops::get_tables,
            commands::db_ops::execute_query,
            commands::db_ops::get_columns,
            commands::db_ops::get_table_schema,
            commands::db_ops::truncate_table,
            commands::db_ops::drop_table,
            commands::db_ops::duplicate_table,
            commands::db_ops::get_databases,
            commands::db_ops::export_schema,
            commands::db_ops::import_schema,
            commands::db_ops::create_database,
            commands::db_ops::duplicate_database,
            commands::db_ops::delete_database,
            commands::db_ops::get_table_data,
            // CRUD Operations
            commands::crud::update_record,
            commands::crud::delete_record,
            commands::crud::insert_record,
            commands::crud::apply_batch_changes,
            // Tags
            commands::tag::create_tag,
            commands::tag::update_tag,
            commands::tag::delete_tag,
            commands::tag::get_tags,
            commands::tag::assign_tag,
            commands::tag::remove_tag_from_table,
            commands::tag::get_table_tags,
            // Sidebar
            commands::sidebar::get_sidebar_view,
            // Saved Items
            commands::saved::save_query,
            commands::saved::list_queries,
            commands::saved::delete_query,
            commands::saved::update_query,
            commands::saved::save_function,
            commands::saved::list_functions,
            commands::saved::delete_function,
            commands::saved::update_function,
            // Window
            commands::window::open_connection_window,
            commands::window::open_loading_window,
            commands::window::close_loading_window,
            // Filters
            commands::filter::save_table_filters,
            commands::filter::get_table_filters,
            commands::filter::delete_table_filters,
            // Session
            commands::session::create_session,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialize updater plugin (desktop only)
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
            
            // Initialize process plugin for restart after update
            app.handle().plugin(tauri_plugin_process::init())?;

            // Initialize DB
            let handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                match db::init_db(&handle).await {
                    Ok(pool) => {
                        handle.manage(AppState { 
                            db: pool,
                            sessions: db::SessionManager::new()
                        });
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
