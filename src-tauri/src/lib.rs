use base64::Engine as _;
use std::fs;
use std::io::Write as _;
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
fn save_file_bytes(path: String, base64: String) -> Result<(), String> {
  let bytes = base64::engine::general_purpose::STANDARD
    .decode(base64.as_bytes())
    .map_err(|e| e.to_string())?;
  std::fs::write(&path, bytes).map_err(|e| e.to_string())
}

#[tauri::command]
fn file_size(path: String) -> Result<u64, String> {
  let metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
  Ok(metadata.len())
}

const TEXTUTIL: &str = "/usr/bin/textutil";

#[tauri::command]
fn convert_with_textutil(path: String, to: String) -> Result<String, String> {
  if to != "txt" && to != "html" {
    return Err(format!("Unsupported textutil target: {to}"));
  }
  if !path.starts_with('/') {
    return Err("textutil needs an absolute file path.".to_string());
  }
  let output = Command::new(TEXTUTIL)
    .args(["-convert", to.as_str(), "-stdout"])
    .arg(&path)
    .output()
    .map_err(|e| format!("Could not run textutil: {e}"))?;
  if !output.status.success() {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    return Err(if stderr.is_empty() {
      "textutil could not read this file.".to_string()
    } else {
      stderr
    });
  }
  Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

#[tauri::command]
fn save_with_textutil(html: String, to: String, path: String) -> Result<(), String> {
  if !["doc", "docx", "rtf", "odt"].contains(&to.as_str()) {
    return Err(format!("Unsupported textutil target: {to}"));
  }
  if !path.starts_with('/') {
    return Err("textutil needs an absolute output path.".to_string());
  }
  let nanos = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.as_nanos())
    .unwrap_or(0);
  let tmp = std::env::temp_dir().join(format!("papertiger-{}-{}.html", std::process::id(), nanos));
  fs::write(&tmp, html.as_bytes()).map_err(|e| e.to_string())?;
  let result = Command::new(TEXTUTIL)
    .args(["-convert", to.as_str(), "-output"])
    .arg(&path)
    .arg(&tmp)
    .output();
  let _ = fs::remove_file(&tmp);
  let output = result.map_err(|e| format!("Could not run textutil: {e}"))?;
  if !output.status.success() {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    return Err(if stderr.is_empty() {
      "textutil could not write this file.".to_string()
    } else {
      stderr
    });
  }
  Ok(())
}

fn app_data_file_path(app: &tauri::AppHandle, name: &str) -> Result<std::path::PathBuf, String> {
  let valid = !name.is_empty()
    && name
      .chars()
      .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
  if !valid {
    return Err(format!("Invalid storage name: {name}"));
  }
  let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
  fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  Ok(dir.join(format!("{name}.json")))
}

#[tauri::command]
fn load_app_data(app: tauri::AppHandle, name: String) -> Result<Option<String>, String> {
  let path = app_data_file_path(&app, &name)?;
  match fs::read_to_string(&path) {
    Ok(contents) => Ok(Some(contents)),
    Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
    Err(e) => Err(e.to_string()),
  }
}

#[tauri::command]
fn save_app_data(app: tauri::AppHandle, name: String, contents: String) -> Result<(), String> {
  let path = app_data_file_path(&app, &name)?;
  let tmp_path = path.with_extension("json.tmp");
  {
    let mut file = fs::File::create(&tmp_path).map_err(|e| e.to_string())?;
    file.write_all(contents.as_bytes()).map_err(|e| e.to_string())?;
  }
  fs::rename(&tmp_path, &path).map_err(|e| e.to_string())?;
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
      hardware_info,
      read_file_base64,
      save_file_bytes,
      file_size,
      load_app_data,
      save_app_data,
      convert_with_textutil,
      save_with_textutil
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
