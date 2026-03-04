use std::process::Command;

/// 檢查指定的進程是否正在運行
#[tauri::command]
fn check_process(process_name: String) -> Result<bool, String> {
    let output = Command::new("tasklist")
        .args(["/FI", &format!("IMAGENAME eq {}", process_name), "/NH"])
        .output()
        .map_err(|e| format!("無法執行 tasklist: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.contains(&process_name))
}

/// 強制關閉指定的進程
#[tauri::command]
fn kill_process(process_name: String) -> Result<bool, String> {
    let output = Command::new("taskkill")
        .args(["/IM", &process_name, "/F"])
        .output()
        .map_err(|e| format!("無法執行 taskkill: {}", e))?;

    Ok(output.status.success())
}

/// 啟動指定的 exe 並帶上 --remote-debugging-port
#[tauri::command]
fn launch_app(exe_path: String, port: u16) -> Result<bool, String> {
    Command::new(&exe_path)
        .arg(format!("--remote-debugging-port={}", port))
        .spawn()
        .map_err(|e| format!("無法啟動 {}: {}", exe_path, e))?;

    Ok(true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            check_process,
            kill_process,
            launch_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
