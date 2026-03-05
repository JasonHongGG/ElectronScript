import React, { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Cpu, Plus, RefreshCw, Power, Library, X, Folder, Code } from 'lucide-react';
import { useTauri } from '../hooks/useTauri';
import { useLogs } from '../hooks/useLogs';
import { apps } from '../data/config';

const AppManagementView = ({ appKey, onBack, onGoScripts }) => {
    const { getInstances, launchApp, getCdpTargets, killInstance } = useTauri();
    const { log } = useLogs();

    const app = apps[appKey];
    const [instances, setInstances] = useState([]);
    const [isOpening, setIsOpening] = useState(false);
    const [isRestarting, setIsRestarting] = useState(false);
    const [isClosingAll, setIsClosingAll] = useState(false);

    const fetchInstances = useCallback(async () => {
        try {
            const insts = await getInstances(app.processName);
            // 按 PID 排序，確保順序穩定
            insts.sort((a, b) => a.pid - b.pid);

            setInstances(prev => {
                // 用序列化的 PID+port+workdir 簽名來比對，避免不必要的 re-render
                const serialize = (list) => list.map(i => `${i.pid}:${i.port}:${i.workdir}`).join('|');
                if (serialize(prev) === serialize(insts)) return prev;
                return insts;
            });
        } catch (err) {
            log(`無法取得 ${app.name} 狀態: ${err}`, 'error');
        }
    }, [getInstances, app, log]);

    useEffect(() => {
        let mounted = true;
        fetchInstances();
        const interval = setInterval(() => {
            if (mounted) fetchInstances();
        }, 3000);
        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [fetchInstances]);

    const handleAppOpen = async () => {
        setIsOpening(true);
        try {
            let insts = await getInstances(app.processName);
            let requireRestartAll = false;

            if (insts.length > 0) {
                const hasReady = insts.some(i => i.has_debug_port && i.port === app.port);
                if (!hasReady) {
                    log(`偵測到 ${app.name} 運行中但未掛載 Debug Port，將準備關閉重啟...`, 'warn');
                    requireRestartAll = true;
                }
            }

            const openDialog = window.__TAURI__?.dialog?.open;
            const selectedDir = openDialog ? await openDialog({
                directory: true,
                multiple: false,
                title: `選擇要開啟的 ${app.name} 專案目錄 (可取消)`
            }) : null;

            if (requireRestartAll) {
                log(`正在關閉所有舊的 ${app.name} 實例...`, 'info');
                for (const inst of insts) {
                    await killInstance(inst.pid);
                }
                await new Promise(r => setTimeout(r, 1000));
            }

            log(`正在啟動 ${app.name} (Port: ${app.port})...`, 'info');
            await launchApp(app.exePath, app.port, selectedDir || null);

            log(`等待 ${app.name} Debug Port 就緒...`, 'info');
            let ready = false;
            for (let i = 0; i < 20; i++) {
                try {
                    await getCdpTargets(app.port);
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
        await fetchInstances();
        setIsOpening(false);
    };

    const handleAppRestart = async () => {
        setIsRestarting(true);
        try {
            log(`正在重新啟動所有 ${app.name} 實例以掛載 Port...`, 'warn');
            const insts = await getInstances(app.processName);
            const workdirs = insts.map(i => i.workdir).filter(w => w !== "");

            for (const inst of insts) {
                await killInstance(inst.pid);
            }
            await new Promise(r => setTimeout(r, 1500));

            let launchedCount = 0;
            if (workdirs.length > 0) {
                for (const dir of workdirs) {
                    await launchApp(app.exePath, app.port, dir);
                    launchedCount++;
                    await new Promise(r => setTimeout(r, 500));
                }
            } else {
                await launchApp(app.exePath, app.port, null);
                launchedCount++;
            }
            log(`成功發送 ${launchedCount} 個啟動請求`, 'success');
        } catch (e) {
            log(`重啟失敗: ${e}`, 'error');
        }
        await fetchInstances();
        setIsRestarting(false);
    };

    const handleAppCloseAll = async () => {
        setIsClosingAll(true);
        try {
            const insts = await getInstances(app.processName);
            log(`正在強制關閉 ${insts.length} 個實例...`, 'warn');
            for (const inst of insts) {
                await killInstance(inst.pid);
            }
            log(`已全數關閉`, 'success');
        } catch (e) {
            log(`關閉失敗: ${e}`, 'error');
        }
        await new Promise(r => setTimeout(r, 1000));
        await fetchInstances();
        setIsClosingAll(false);
    };

    const handleKillSingle = async (pid) => {
        try {
            await killInstance(pid);
            log(`已終止進程 PID: ${pid}`, 'info');
            await fetchInstances();
        } catch (e) {
            log(`終止失敗: ${e}`, 'error');
        }
    };

    const noInstances = instances.length === 0;

    return (
        <div id="view-app" className="view active">
            <div className="app-management-header">
                <div className="app-title-group" onClick={onBack} title="返回主頁">
                    <div className="back-button">
                        <ArrowLeft size={20} />
                    </div>
                    <h2>
                        {appKey === 'vscode' ? <Code size={28} /> : <Cpu size={28} />} {app.name}
                    </h2>
                </div>
                <div className="app-view-actions">
                    <button className="btn btn-primary" onClick={handleAppOpen} disabled={isOpening}>
                        <Plus size={16} /> 智慧開啟
                    </button>
                    <button className="btn btn-warning" onClick={handleAppRestart} disabled={noInstances || isRestarting}>
                        <RefreshCw size={16} /> 重啟掛載
                    </button>
                    <button className="btn btn-danger" onClick={handleAppCloseAll} disabled={noInstances || isClosingAll}>
                        <Power size={16} /> 全部關閉
                    </button>
                    <button className="btn btn-warning" onClick={onGoScripts}>
                        <Library size={16} /> 腳本庫
                    </button>
                </div>
            </div>

            <div className="section-title">運行中的標籤頁 (Instances)</div>
            <div className="instances-list">
                {noInstances ? (
                    <div className="text-sm text-muted" style={{ color: 'var(--text-muted)', padding: '10px' }}>
                        目前沒有任何運行中的視窗。
                    </div>
                ) : (
                    instances.map(inst => {
                        const isReady = inst.has_debug_port && inst.port === app.port;
                        const statusClass = isReady ? 'ready' : 'pending';
                        const statusText = isReady ? `Debug Port: ${inst.port}` : '未掛載 Debug Port';

                        return (
                            <div key={inst.pid} className="instance-item">
                                <div className="inst-info">
                                    <div className="inst-pid-row">
                                        <span className="inst-pid"><Cpu size={14} /> PID: {inst.pid}</span>
                                        <span className={`inst-status ${statusClass}`}>{statusText}</span>
                                    </div>
                                    {inst.workdir && (
                                        <div className="inst-workdir">
                                            <Folder size={12} /> {inst.workdir}
                                        </div>
                                    )}
                                </div>
                                <div className="inst-actions">
                                    <button className="btn-icon-danger" onClick={() => handleKillSingle(inst.pid)} title="強制關閉此視窗">
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default AppManagementView;
