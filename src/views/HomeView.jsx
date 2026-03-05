import React, { useEffect, useState } from 'react';
import { Code, Cpu, ArrowRight } from 'lucide-react';
import { useTauri } from '../hooks/useTauri';
import { apps } from '../data/config';

const HomeView = ({ onSelectApp }) => {
    const { getInstances } = useTauri();
    const [vscodeStats, setVscodeStats] = useState({ instances: 0, text: '檢查狀態中...', running: false });
    const [antiStats, setAntiStats] = useState({ instances: 0, text: '檢查狀態中...', running: false });

    useEffect(() => {
        let mounted = true;

        const fetchStats = async () => {
            try {
                const vsInstances = await getInstances(apps.vscode.processName);
                if (mounted) {
                    setVscodeStats({
                        instances: vsInstances.length,
                        text: vsInstances.length > 0 ? `運行中 (${vsInstances.length} 個實例)` : '未運行',
                        running: vsInstances.length > 0
                    });
                }

                const antiInstances = await getInstances(apps.antigravity.processName);
                if (mounted) {
                    setAntiStats({
                        instances: antiInstances.length,
                        text: antiInstances.length > 0 ? `運行中 (${antiInstances.length} 個實例)` : '未運行',
                        running: antiInstances.length > 0
                    });
                }
            } catch (err) {
                console.error('Failed to fetch home stats', err);
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 3000);
        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [getInstances]);

    return (
        <div id="view-home" className="view active home-premium-layout">
            <div className="premium-cards-container">

                {/* VS Code Card */}
                <div className="premium-card vscode-card" onClick={() => onSelectApp('vscode')}>
                    <div className="card-bg-glow"></div>
                    <div className="card-content">
                        <div className="card-icon-container">
                            <Code size={40} />
                        </div>
                        <div className="card-text-container">
                            <h2 className="card-title">VS Code</h2>
                            <p className="card-desc">Visual Studio Code Injection</p>
                        </div>
                    </div>
                    <div className="card-footer">
                        <div className="status-indicator">
                            <div className={`status-dot ${vscodeStats.running ? 'running' : ''}`}></div>
                            <span className="status-text" style={{ color: vscodeStats.running ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                                {vscodeStats.text}
                            </span>
                        </div>
                        <ArrowRight className="card-arrow" size={20} />
                    </div>
                </div>

                {/* Antigravity Card */}
                <div className="premium-card antigravity-card" onClick={() => onSelectApp('antigravity')}>
                    <div className="card-bg-glow"></div>
                    <div className="card-content">
                        <div className="card-icon-container">
                            <Cpu size={40} />
                        </div>
                        <div className="card-text-container">
                            <h2 className="card-title">Antigravity</h2>
                            <p className="card-desc">Native Sub-agent Backend</p>
                        </div>
                    </div>
                    <div className="card-footer">
                        <div className="status-indicator">
                            <div className={`status-dot ${antiStats.running ? 'running' : ''}`}></div>
                            <span className="status-text" style={{ color: antiStats.running ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                                {antiStats.text}
                            </span>
                        </div>
                        <ArrowRight className="card-arrow" size={20} />
                    </div>
                </div>

            </div>
        </div>
    );
};

export default HomeView;
