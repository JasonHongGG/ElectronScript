use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use std::process::Command;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;

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
        .invoke_handler(tauri::generate_handler![
            check_process,
            kill_process,
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
