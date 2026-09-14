use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Apply window vibrancy on macOS
      #[cfg(target_os = "macos")]
      {
        if let Some(window) = app.get_webview_window("main") {
          use window_vibrancy::NSVisualEffectMaterial;
          let _ = window_vibrancy::apply_vibrancy(
            &window,
            NSVisualEffectMaterial::Sidebar,
            None,
            None,
          );
        }
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
