import { apps } from './config.js';
import { snippets } from './snippets.js';

// ── Tauri invoke 包裝 ───────────────────────────────────────
const { invoke } = window.__TAURI__.core;

// ── Log 模組 ────────────────────────────────────────────────
const logOutput = document.getElementById('log-output');

function log(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const time = new Date().toLocaleTimeString('zh-TW', { hour12: false });
    entry.textContent = `[${time}] ${message}`;
    logOutput.appendChild(entry);
    logOutput.scrollTop = logOutput.scrollHeight;
}

document.getElementById('clear-log').addEventListener('click', () => {
    logOutput.innerHTML = '';
});

// ── CDP 注入器 (透過 Rust 後端，繞過所有瀏覽器限制) ──
async function cdpInject(port, snippet) {
    const count = await invoke('inject_script', {
        port: parseInt(port),
        code: snippet.code,
    });
    return count;
}

// ── 狀態管理 ────────────────────────────────────────────────
const appStates = {};

async function refreshStatus(appKey) {
    const app = apps[appKey];
    try {
        const running = await invoke('check_process', { processName: app.processName });
        appStates[appKey] = running;
        updateStatusUI(appKey, running);
    } catch (e) {
        appStates[appKey] = false;
        updateStatusUI(appKey, false);
    }
}

function updateStatusUI(appKey, running) {
    const dot = document.querySelector(`[data-app="${appKey}"] .status-dot`);
    const text = document.querySelector(`[data-app="${appKey}"] .status-text`);
    if (dot && text) {
        dot.className = `status-dot ${running ? 'running' : 'stopped'}`;
        text.textContent = running ? '運行中' : '未運行';
    }
}

// ── 按鈕事件 ────────────────────────────────────────────────

async function handleLaunch(appKey) {
    const app = apps[appKey];
    log(`正在啟動 ${app.name} (Port: ${app.port})...`, 'info');

    try {
        // 如果正在運行，先關閉
        if (appStates[appKey]) {
            log(`偵測到 ${app.name} 正在運行，先關閉...`, 'warn');
            await invoke('kill_process', { processName: app.processName });
            await sleep(2000);
        }

        await invoke('launch_app', { exePath: app.exePath, port: app.port });

        // 等待 port 就緒
        log(`等待 ${app.name} Debug Port 就緒...`, 'info');
        const ready = await waitForPort(app.port);

        if (ready) {
            log(`${app.name} 已就緒！(Port ${app.port})`, 'success');
        } else {
            log(`${app.name} 啟動逾時，請手動檢查`, 'warn');
        }
    } catch (e) {
        log(`啟動 ${app.name} 失敗: ${e}`, 'error');
    }

    await refreshStatus(appKey);
}

async function handleKill(appKey) {
    const app = apps[appKey];
    log(`正在關閉 ${app.name}...`, 'warn');

    try {
        await invoke('kill_process', { processName: app.processName });
        log(`${app.name} 已關閉`, 'success');
    } catch (e) {
        log(`關閉 ${app.name} 失敗: ${e}`, 'error');
    }

    await sleep(500);
    await refreshStatus(appKey);
}

async function handleInject(appKey, snippetKey) {
    const app = apps[appKey];
    const snippet = snippets[appKey]?.[snippetKey];
    if (!snippet) return;

    log(`正在注入「${snippet.name}」到 ${app.name}...`, 'info');

    try {
        const count = await cdpInject(app.port, snippet);
        log(`成功注入「${snippet.name}」(${count} 個頁面)`, 'success');
    } catch (e) {
        log(`注入失敗: ${e.message}`, 'error');
    }
}

// ── 工具函式 ────────────────────────────────────────────────

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function waitForPort(port, timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            await invoke('get_cdp_targets', { port: parseInt(port) });
            return true;
        } catch {
            // 還沒好
        }
        await sleep(500);
    }
    return false;
}

// ── 動態產生 UI ─────────────────────────────────────────────

function renderCards() {
    const container = document.getElementById('app-cards');

    for (const [appKey, app] of Object.entries(apps)) {
        const appSnippets = snippets[appKey] || {};

        const card = document.createElement('div');
        card.className = 'app-card';
        card.dataset.app = appKey;

        // 產生腳本按鈕
        const snippetButtons = Object.entries(appSnippets).map(([key, s]) => {
            const isStop = key.toLowerCase().includes('stop');
            const btnClass = isStop ? 'btn-stop' : 'btn-inject';
            const icon = isStop ? '⏹' : '💉';
            return `<button class="btn ${btnClass}" data-action="inject" data-app="${appKey}" data-snippet="${key}">${icon} ${s.name.replace(/\[.*?\]\s*/, '')}</button>`;
        }).join('');

        card.innerHTML = `
      <div class="card-header">
        <div class="app-info">
          <span class="app-name">${app.name}</span>
          <span class="port-badge">Port ${app.port}</span>
        </div>
        <div class="status-indicator">
          <span class="status-dot stopped"></span>
          <span class="status-text">檢查中...</span>
        </div>
      </div>
      <div class="card-actions">
        <button class="btn btn-launch" data-action="launch" data-app="${appKey}">🚀 啟動 / 重啟</button>
        <button class="btn btn-kill" data-action="kill" data-app="${appKey}">⏻ 關閉</button>
        ${snippetButtons}
      </div>
    `;

        container.appendChild(card);
    }

    // 綁定事件 (事件委派)
    container.addEventListener('click', async (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn || btn.disabled) return;

        const action = btn.dataset.action;
        const appKey = btn.dataset.app;

        btn.disabled = true;
        try {
            if (action === 'launch') await handleLaunch(appKey);
            else if (action === 'kill') await handleKill(appKey);
            else if (action === 'inject') await handleInject(appKey, btn.dataset.snippet);
        } finally {
            btn.disabled = false;
        }
    });
}

// ── 初始化 ──────────────────────────────────────────────────

async function init() {
    renderCards();
    log('工具已啟動，正在檢查各 App 狀態...', 'info');

    // 初始檢查所有 App 狀態
    for (const appKey of Object.keys(apps)) {
        await refreshStatus(appKey);
        const app = apps[appKey];
        const status = appStates[appKey] ? '運行中' : '未運行';
        log(`${app.name}: ${status}`, appStates[appKey] ? 'success' : 'warn');
    }
}

init();
