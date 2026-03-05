use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use std::process::Command;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;

use sysinfo::System;

/// 取得系統上特定名稱的所有進程，包含其 PID 與啟動參數
#[tauri::command]
fn get_instances(exe_name: String) -> Result<Vec<Value>, String> {
    let mut sys = System::new_all();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    let mut instances = Vec::new();

    // 依據 exe 名稱尋找 (忽略大小寫後綴)
    let search_name = exe_name.to_lowercase();
    let search_name = search_name.strip_suffix(".exe").unwrap_or(&search_name);

    for (pid, process) in sys.processes() {
        let p_name = process.name().to_string_lossy().to_lowercase();
        let p_name = p_name.strip_suffix(".exe").unwrap_or(&p_name);

        if p_name == search_name {
            let cmd = process.cmd();

            // 跳過無法讀取命令列的進程（通常是權限不足，這些都是子進程）
            if cmd.is_empty() {
                continue;
            }

            // Electron 子進程 (renderer, gpu-process, utility 等) 的命令列都帶有 --type= 參數
            // 只有主進程（擁有實際視窗的進程）不帶 --type=，所以跳過所有帶 --type= 的子進程
            let is_child_process = cmd.iter().any(|arg| {
                let s = arg.to_string_lossy();
                s.starts_with("--type=")
            });
            if is_child_process {
                continue;
            }

            let mut has_debug_port = false;
            let mut workdir = String::new();
            let mut port = 0;

            for arg in cmd.iter() {
                let arg_str = arg.to_string_lossy();

                // 檢查是否有 debug port (例如: --remote-debugging-port=9222)
                if arg_str.starts_with("--remote-debugging-port=") {
                    has_debug_port = true;
                    if let Some(p) = arg_str.split('=').nth(1) {
                        port = p.parse().unwrap_or(0);
                    }
                }

                // 試圖找出 workdir (通常 VS Code 的工作目錄會是最後一個獨立的無橫線參數，或者是 --folder-uri)
                // 這裡採用簡單的啟發式：如果是絕對路徑且存在
                if !arg_str.starts_with("--") && std::path::Path::new(arg_str.as_ref()).is_dir() {
                    workdir = arg_str.to_string();
                } else if arg_str.starts_with("--folder-uri=") {
                    let uri = arg_str.strip_prefix("--folder-uri=").unwrap_or("");
                    let decode = uri
                        .replace("file:///", "")
                        .replace("%3A", ":")
                        .replace("%5C", "\\")
                        .replace("/", "\\");
                    workdir = decode;
                }
            }

            instances.push(serde_json::json!({
                "pid": pid.as_u32(),
                "name": process.name().to_string_lossy(),
                "has_debug_port": has_debug_port,
                "port": port,
                "workdir": workdir,
                "cmd": cmd.iter().map(|s| s.to_string_lossy().to_string()).collect::<Vec<String>>()
            }));
        }
    }

    Ok(instances)
}

/// 透過 PID 強制關閉單一進程
#[tauri::command]
fn kill_instance(pid: u32) -> Result<bool, String> {
    let mut sys = System::new_all();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    if let Some(process) = sys.process(sysinfo::Pid::from_u32(pid)) {
        Ok(process.kill())
    } else {
        Err(format!("找不到 PID: {}", pid))
    }
}

/// 啟動指定的 exe 並帶上 --remote-debugging-port 以及可選的工作目錄
#[tauri::command]
fn launch_app(exe_path: String, port: u16, workdir: Option<String>) -> Result<bool, String> {
    let mut cmd = Command::new(&exe_path);
    cmd.arg(format!("--remote-debugging-port={}", port));

    if let Some(dir) = workdir {
        if !dir.is_empty() {
            cmd.arg(&dir);
        }
    }

    cmd.spawn()
        .map_err(|e| format!("無法啟裁 {}: {}", exe_path, e))?;

    Ok(true)
}

/// 透過 HTTP 取得 CDP 頁面列表
#[tauri::command]
async fn get_cdp_targets(port: u16) -> Result<Vec<Value>, String> {
    let url = format!("http://127.0.0.1:{}/json", port);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .map_err(|e| format!("無法建立 HTTP Client: {}", e))?;

    let res = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("無法連線到 DevTools: {}", e))?;

    let targets = res
        .json::<Vec<Value>>()
        .await
        .map_err(|e| format!("解析 JSON 失敗: {}", e))?;

    Ok(targets)
}

/// 透過 CDP WebSocket 對單一頁面注入 JS 程式碼
#[tauri::command]
async fn cdp_evaluate(ws_url: String, expression: String) -> Result<String, String> {
    let (mut ws_stream, _) = connect_async(&ws_url)
        .await
        .map_err(|e| format!("WebSocket 連線失敗: {}", e))?;

    let msg = serde_json::json!({
        "id": 1,
        "method": "Runtime.evaluate",
        "params": {
            "expression": expression
        }
    });

    ws_stream
        .send(Message::text(msg.to_string()))
        .await
        .map_err(|e| format!("發送指令失敗: {}", e))?;

    // 等待回應
    if let Some(response) = ws_stream.next().await {
        let response = response.map_err(|e| format!("接收回應失敗: {}", e))?;
        ws_stream.close(None).await.ok();
        Ok(response.to_string())
    } else {
        Err("未收到回應".to_string())
    }
}

/// 一次注入腳本到指定 port 的所有頁面
#[tauri::command]
async fn inject_script(port: u16, code: String) -> Result<u32, String> {
    // 1. 取得所有頁面
    let targets = get_cdp_targets(port).await?;

    let mut injected_count: u32 = 0;

    for target in &targets {
        // 過濾: 只注入 type=page 且不是 devtools
        let t_type = target["type"].as_str().unwrap_or("");
        let t_url = target["url"].as_str().unwrap_or("");
        if t_type != "page" || t_url.starts_with("devtools://") {
            continue;
        }

        let ws_url = match target["webSocketDebuggerUrl"].as_str() {
            Some(url) => url.to_string(),
            None => continue,
        };

        // 2. 注入程式碼
        match cdp_evaluate(ws_url, code.clone()).await {
            Ok(_) => injected_count += 1,
            Err(e) => eprintln!("注入頁面失敗: {}", e),
        }
    }

    Ok(injected_count)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_instances,
            kill_instance,
            launch_app,
            get_cdp_targets,
            cdp_evaluate,
            inject_script,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
