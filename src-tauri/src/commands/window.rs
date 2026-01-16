use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
pub async fn open_connection_window<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    connection_id: i64,
    username: Option<String>,
    password: Option<String>,
) -> Result<(), String> {
    // Use timestamp to generate unique window labels, allowing multiple windows per connection
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let label = format!("connection-{}-{}", connection_id, timestamp);
    
    let mut url = format!("index.html?connection_id={}", connection_id);
    if let (Some(u), Some(p)) = (username, password) {
        url.push_str(&format!("&u={}&p={}", u, p));
    }

    WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(url.into()))
        .title("Connection")
        .inner_size(1200.0, 800.0)
        .min_inner_size(1000.0, 700.0)
        .decorations(false)
        .maximized(true)
        .build()
        .map_err(|e: tauri::Error| e.to_string())?;

    Ok(())
}


#[tauri::command]
pub async fn open_loading_window<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
) -> Result<(), String> {
    let label = "loading-window";
    let url = "index.html?mode=loading";

    if let Some(win) = app.get_webview_window(label) {
        let _ = win.set_focus();
        return Ok(());
    }

    let win = WebviewWindowBuilder::new(&app, label, WebviewUrl::App(url.into()))
        .title("Processing")
        .inner_size(400.0, 250.0)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .center()
        .resizable(false);

    win.build().map_err(|e: tauri::Error| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn close_loading_window<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("loading-window") {
        win.close().map_err(|e: tauri::Error| e.to_string())?;
    }
    Ok(())
}
