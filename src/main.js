import { apps } from './config.js';
import { snippets } from './snippets.js';

// ── Tauri API ────────────────────────────────────────────────
const { invoke } = window.__TAURI__.core;
const { getCurrentWindow } = window.__TAURI__.window;
const { open } = window.__TAURI__.dialog;
const appWindow = getCurrentWindow();

// ── Titlebar Controls ────────────────────────────────────────
document.getElementById('titlebar-minimize').addEventListener('click', () => appWindow.minimize());
document.getElementById('titlebar-maximize').addEventListener('click', () => appWindow.toggleMaximize());
document.getElementById('titlebar-close').addEventListener('click', () => appWindow.close());

// ── UI Elements ──────────────────────────────────────────────
const viewHome = document.getElementById('view-home');
const viewApp = document.getElementById('view-app');
const viewScripts = document.getElementById('view-scripts');
const navHeader = document.getElementById('nav-header');
const navTitle = document.getElementById('current-view-title');

const homeAppsGrid = document.getElementById('home-apps-grid');
const appInstancesList = document.getElementById('app-instances-list');
const scriptsGrid = document.getElementById('scripts-grid');
const logOutput = document.getElementById('log-output');

// Buttons
const btnBack = document.getElementById('btn-back');
const btnToScripts = document.getElementById('btn-to-scripts');
const btnAppOpen = document.getElementById('btn-app-open');
const btnAppRestart = document.getElementById('btn-app-restart');
const btnAppCloseAll = document.getElementById('btn-app-closeall');

// Global State
let currentAppKey = null;
let currentView = 'home';
let currentInstances = [];
let refreshInterval = null;

// ── Log System ───────────────────────────────────────────────
function log(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false });
    entry.innerHTML = `<div class="log-time">[${timeStr}]</div><div class="log-msg">${message}</div>`;
    logOutput.appendChild(entry);
    logOutput.scrollTo({ top: logOutput.scrollHeight, behavior: 'smooth' });
    if (window.lucide) lucide.createIcons({ root: entry });
}

document.getElementById('clear-log').addEventListener('click', () => {
    logOutput.innerHTML = '';
});

// ── Helper API ───────────────────────────────────────────────
async function fetchInstances(appKey) {
    const app = apps[appKey];
    try {
        currentInstances = await invoke('get_instances', { exeName: app.processName });
        return currentInstances;
    } catch (e) {
        log(`無法取得 ${app.name} 狀態: ${e}`, 'error');
        return [];
    }
}

async function injectScript(port, code) {
    return await invoke('inject_script', { port: parseInt(port), code });
}

// ── Routing & Views ──────────────────────────────────────────
function switchView(viewId) {
    [viewHome, viewApp, viewScripts].forEach(v => {
        v.classList.remove('active');
        v.classList.add('hidden');
    });

    currentView = viewId;

    if (viewId === 'home') {
        viewHome.classList.remove('hidden');
        viewHome.classList.add('active');
        navHeader.classList.add('hidden');
        currentAppKey = null;
        stopAutoRefresh();
    } else {
        document.getElementById(`view-${viewId}`).classList.remove('hidden');
        document.getElementById(`view-${viewId}`).classList.add('active');
        navHeader.classList.remove('hidden');

        // Contextual buttons in nav header
        if (viewId === 'scripts') {
            btnToScripts.classList.add('hidden');
        } else {
            btnToScripts.classList.remove('hidden');
        }
    }
}

function handleBackAction() {
    if (currentView === 'scripts') {
        goAppView(currentAppKey);
    } else if (currentView === 'app') {
        goHome();
    }
}

function goHome() {
    switchView('home');
    renderHome();
}

async function goAppView(appKey) {
    currentAppKey = appKey;
    const app = apps[appKey];
    navTitle.textContent = app.name;
    document.getElementById('app-view-name').innerHTML = `<i data-lucide="${appKey === 'vscode' ? 'code' : 'cpu'}"></i> ${app.name}`;

    switchView('app');
    if (window.lucide) lucide.createIcons();

    await refreshAppView();
    startAutoRefresh();
}

function goScriptsView() {
    navTitle.textContent = `${apps[currentAppKey].name} - 腳本庫`;
    switchView('scripts');
    renderScriptsGrid();
}

// ── Renderers ────────────────────────────────────────────────
function renderHome() {
    homeAppsGrid.innerHTML = '';
    for (const [key, app] of Object.entries(apps)) {
        const card = document.createElement('div');
        card.className = 'app-entry-card';
        card.innerHTML = `
            <div class="app-entry-header">
                <div class="app-logo"><i data-lucide="${key === 'vscode' ? 'code' : 'cpu'}"></i></div>
                <div class="app-entry-info">
                    <h3>${app.name}</h3>
                    <div class="app-entry-stats" id="stats-${key}">檢查狀態中...</div>
                </div>
            </div>
        `;
        card.addEventListener('click', () => goAppView(key));
        homeAppsGrid.appendChild(card);

        // Async update stats
        fetchInstances(key).then(instances => {
            const stats = document.getElementById(`stats-${key}`);
            if (stats) stats.textContent = instances.length > 0 ? `運行中 (${instances.length} 個實例)` : '未運行';
        });
    }
    if (window.lucide) lucide.createIcons();
}

async function refreshAppView() {
    if (!currentAppKey) return;
    const app = apps[currentAppKey];
    const instances = await fetchInstances(currentAppKey);

    // Update Action Buttons State
    if (instances.length === 0) {
        btnAppRestart.disabled = true;
        btnAppCloseAll.disabled = true;
    } else {
        btnAppRestart.disabled = false;
        btnAppCloseAll.disabled = false;
    }

    // Render Instances
    appInstancesList.innerHTML = '';

    if (instances.length === 0) {
        appInstancesList.innerHTML = `<div class="text-sm text-muted" style="color: var(--text-muted); padding: 10px;">目前沒有任何運行中的視窗。</div>`;
        return;
    }

    instances.forEach(inst => {
        const isReady = inst.has_debug_port && inst.port === app.port;
        const statusClass = isReady ? 'ready' : 'pending';
        const statusText = isReady ? `Debug Port: ${inst.port}` : '未掛載 Debug Port';
        const workdirDisplay = inst.workdir ? `<div class="inst-workdir"><i data-lucide="folder"></i> ${inst.workdir}</div>` : '';

        const item = document.createElement('div');
        item.className = 'instance-item';
        item.innerHTML = `
            <div class="inst-info">
                <div class="inst-pid-row">
                    <span class="inst-pid"><i data-lucide="cpu"></i> PID: ${inst.pid}</span>
                    <span class="inst-status ${statusClass}">${statusText}</span>
                </div>
                ${workdirDisplay}
            </div>
            <div class="inst-actions">
                <button class="btn-icon-danger btn-kill-single" data-pid="${inst.pid}" title="強制關閉此視窗">
                    <i data-lucide="x"></i>
                </button>
            </div>
        `;
        appInstancesList.appendChild(item);
    });

    // Bind kill events
    document.querySelectorAll('.btn-kill-single').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const pid = parseInt(e.currentTarget.dataset.pid);
            await handleKillSingle(pid);
        });
    });

    if (window.lucide) lucide.createIcons();
}

function renderScriptsGrid() {
    scriptsGrid.innerHTML = '';
    const defs = snippets[currentAppKey] || {};

    for (const [sKey, script] of Object.entries(defs)) {
        const isStop = sKey.toLowerCase().includes('stop');
        const iconName = isStop ? 'square-terminal' : 'syringe';
        const btnClass = isStop ? 'btn-stop' : 'btn-inject';

        const card = document.createElement('div');
        card.className = 'script-card';
        card.innerHTML = `
            <div class="script-card-header">
                <i data-lucide="${iconName}"></i> ${script.name.replace(/\[.*?\]\s*/, '')}
            </div>
            <div class="script-card-target">
                目標：${apps[currentAppKey].name} (Port ${apps[currentAppKey].port})
            </div>
            <div class="script-card-actions">
                <button class="btn ${btnClass} btn-run-script" data-script="${sKey}">
                    <i data-lucide="play"></i> 執行腳本
                </button>
            </div>
        `;
        scriptsGrid.appendChild(card);
    }

    document.querySelectorAll('.btn-run-script').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const sKey = e.currentTarget.dataset.script;
            await handleRunScript(sKey);
        });
    });

    if (window.lucide) lucide.createIcons();
}

// ── Auto Refresh ─────────────────────────────────────────────
function startAutoRefresh() {
    stopAutoRefresh();
    refreshInterval = setInterval(refreshAppView, 3000);
}

function stopAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = null;
}

// ── Action Handlers ──────────────────────────────────────────

async function handleAppOpen() {
    const app = apps[currentAppKey];
    stopAutoRefresh();
    btnAppOpen.disabled = true;

    try {
        // 先尋找是否已經有實例
        let instances = await fetchInstances(currentAppKey);
        let requireRestartAll = false;

        if (instances.length > 0) {
            // 檢查是否沒有任何一個是 ready 的
            const hasReady = instances.some(i => i.has_debug_port && i.port === app.port);
            if (!hasReady) {
                log(`偵測到 ${app.name} 運行中但未掛載 Debug Port，將準備關閉重啟...`, 'warn');
                requireRestartAll = true;
            }
        }

        // 開啟資料夾選擇對話框 (Workdir)
        const selectedDir = await open({
            directory: true,
            multiple: false,
            title: `選擇要開啟的 ${app.name} 專案目錄 (可取消)`
        });

        if (requireRestartAll) {
            log(`正在關閉所有舊的 ${app.name} 實例...`, 'info');
            for (const inst of instances) {
                await invoke('kill_instance', { pid: inst.pid });
            }
            await new Promise(r => setTimeout(r, 1000));
        }

        log(`正在啟動 ${app.name} (Port: ${app.port})...`, 'info');
        await invoke('launch_app', {
            exePath: app.exePath,
            port: parseInt(app.port),
            workdir: selectedDir || null
        });

        log(`等待 ${app.name} Debug Port 就緒...`, 'info');
        let ready = false;
        for (let i = 0; i < 20; i++) {
            try {
                await invoke('get_cdp_targets', { port: parseInt(app.port) });
                ready = true;
                break;
            } catch (e) { }
            await new Promise(r => setTimeout(r, 500));
        }

        if (ready) log(`${app.name} 已就緒！`, 'success');
        else log(`${app.name} 啟動逾時，請檢查`, 'warn');

    } catch (e) {
        log(`開啟失敗: ${e}`, 'error');
    }

    btnAppOpen.disabled = false;
    await refreshAppView();
    startAutoRefresh();
}

async function handleAppRestart() {
    const app = apps[currentAppKey];
    stopAutoRefresh();
    btnAppRestart.disabled = true;

    try {
        log(`正在重新啟動所有 ${app.name} 實例以掛載 Port...`, 'warn');
        const instances = await fetchInstances(currentAppKey);

        // 記錄 workdir 以便重啟
        const workdirs = instances.map(i => i.workdir).filter(w => w !== "");

        for (const inst of instances) {
            await invoke('kill_instance', { pid: inst.pid });
        }
        await new Promise(r => setTimeout(r, 1500));

        let launchedCount = 0;
        if (workdirs.length > 0) {
            for (const dir of workdirs) {
                await invoke('launch_app', { exePath: app.exePath, port: parseInt(app.port), workdir: dir });
                launchedCount++;
                await new Promise(r => setTimeout(r, 500));
            }
        } else {
            await invoke('launch_app', { exePath: app.exePath, port: parseInt(app.port), workdir: null });
            launchedCount++;
        }

        log(`成功發送 ${launchedCount} 個啟動請求`, 'success');

    } catch (e) {
        log(`重啟失敗: ${e}`, 'error');
    }

    btnAppRestart.disabled = false;
    await refreshAppView();
    startAutoRefresh();
}

async function handleAppCloseAll() {
    stopAutoRefresh();
    btnAppCloseAll.disabled = true;
    try {
        const instances = await fetchInstances(currentAppKey);
        log(`正在強制關閉 ${instances.length} 個實例...`, 'warn');
        for (const inst of instances) {
            await invoke('kill_instance', { pid: inst.pid });
        }
        log(`已全數關閉`, 'success');
    } catch (e) {
        log(`關閉失敗: ${e}`, 'error');
    }
    btnAppCloseAll.disabled = false;
    await new Promise(r => setTimeout(r, 1000));
    await refreshAppView();
    startAutoRefresh();
}

async function handleKillSingle(pid) {
    try {
        await invoke('kill_instance', { pid });
        log(`已終止進程 PID: ${pid}`, 'info');
        await refreshAppView();
    } catch (e) {
        log(`終止失敗: ${e}`, 'error');
    }
}

async function handleRunScript(snippetKey) {
    const app = apps[currentAppKey];
    const snippet = snippets[currentAppKey]?.[snippetKey];
    if (!snippet) return;

    log(`正在注入腳本「${snippet.name}」到 ${app.name}...`, 'info');
    try {
        const count = await injectScript(app.port, snippet.code);
        log(`注入成功！(影響 ${count} 個分頁)`, 'success');
    } catch (e) {
        log(`注入失敗: ${e}`, 'error');
    }
}

// ── Event Listeners ──────────────────────────────────────────
btnBack.addEventListener('click', handleBackAction);
btnToScripts.addEventListener('click', goScriptsView);
btnAppOpen.addEventListener('click', handleAppOpen);
btnAppRestart.addEventListener('click', handleAppRestart);
btnAppCloseAll.addEventListener('click', handleAppCloseAll);

// ── Init ─────────────────────────────────────────────────────
goHome();
