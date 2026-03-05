import React from 'react';
import { ArrowLeft, Library, SquareTerminal, Syringe, Play } from 'lucide-react';
import { useTauri } from '../hooks/useTauri';
import { useLogs } from '../hooks/useLogs';
import { apps } from '../data/config';
import { snippets } from '../data/snippets';

const ScriptLibraryView = ({ appKey, onBack }) => {
    const { injectScript } = useTauri();
    const { log } = useLogs();

    const app = apps[appKey];
    const defs = snippets[appKey] || {};

    const handleRunScript = async (snippetKey, snippet) => {
        log(`正在注入腳本「${snippet.name}」到 ${app.name}...`, 'info');
        try {
            const count = await injectScript(app.port, snippet.code);
            log(`注入成功！(影響 ${count} 個分頁)`, 'success');
        } catch (e) {
            log(`注入失敗: ${e}`, 'error');
        }
    };

    return (
        <div id="view-scripts" className="view active">
            <div className="script-library-header">
                <div className="app-title-group" onClick={onBack} title="返回應用">
                    <div className="back-button">
                        <ArrowLeft size={20} />
                    </div>
                    <div>
                        <h2><Library size={28} style={{ marginRight: '8px' }} />{app.name} - 腳本庫</h2>
                        <p className="subtitle text-sm" style={{ marginTop: '4px', color: 'var(--text-muted)' }}>
                            選擇腳本並注入到指定的應用程式實例中
                        </p>
                    </div>
                </div>
            </div>

            <div className="cards-grid">
                {Object.entries(defs).map(([sKey, script]) => {
                    const isStop = sKey.toLowerCase().includes('stop');
                    const IconComp = isStop ? SquareTerminal : Syringe;

                    return (
                        <div key={sKey} className="script-card">
                            <div className="script-card-header">
                                <IconComp size={20} style={{ color: 'var(--accent-yellow)' }} /> {script.name.replace(/\[.*?\]\s*/, '')}
                            </div>
                            <div className="script-card-target">
                                目標：{app.name} (Port {app.port})
                            </div>
                            <div className="script-card-actions mt-auto">
                                <button className="btn btn-warning" onClick={() => handleRunScript(sKey, script)}>
                                    <Play size={14} /> 執行腳本
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ScriptLibraryView;
