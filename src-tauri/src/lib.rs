use base64::Engine as _;
use std::process::Command;
use tauri::Manager;

#[derive(serde::Serialize)]
struct HardwareInfo {
  chip: String,
  apple_silicon: bool,
  ram_gb: f64,
  macos_version: String,
  cpu_cores: u32,
}

fn run_sysctl(key: &str) -> String {
  Command::new("sysctl")
    .arg("-n")
    .arg(key)
    .output()
    .ok()
    .filter(|o| o.status.success())
    .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
    .unwrap_or_default()
}

#[tauri::command]
fn hardware_info() -> Result<HardwareInfo, String> {
  let chip = run_sysctl("machdep.cpu.brand_string");
  let apple_silicon =
    run_sysctl("hw.optional.arm64") == "1" || std::env::consts::ARCH == "aarch64";

  let memsize_bytes: f64 = run_sysctl("hw.memsize").parse().unwrap_or(0.0);
  let ram_gb = ((memsize_bytes / 1024f64.powi(3)) * 10.0).round() / 10.0;

  let macos_version = Command::new("sw_vers")
    .arg("-productVersion")
    .output()
    .ok()
    .filter(|o| o.status.success())
    .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
    .unwrap_or_default();

  let cpu_cores: u32 = run_sysctl("hw.ncpu").parse().unwrap_or(0);

  Ok(HardwareInfo {
    chip,
    apple_silicon,
    ram_gb,
    macos_version,
    cpu_cores,
  })
}

#[tauri::command]
fn read_file_base64(path: String) -> Result<String, String> {
  let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
  Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
}

#[tauri::command]
fn file_size(path: String) -> Result<u64, String> {
  let metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
  Ok(metadata.len())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
      hardware_info,
      read_file_base64,
      file_size
    ])
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
