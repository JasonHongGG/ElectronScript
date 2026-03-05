import React, { useState } from 'react';
import { Terminal, Trash2, ChevronDown, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react';
import { useLogs } from '../hooks/useLogs';

const GlobalLogPanel = ({ isHome }) => {
    const { logs, clearLogs, marquee } = useLogs();
    const [collapsed, setCollapsed] = useState(true);

    // Auto-scroll effect could be implemented with a ref
    const logOutputRef = React.useRef(null);
    React.useEffect(() => {
        if (logOutputRef.current) {
            logOutputRef.current.scrollTop = logOutputRef.current.scrollHeight;
        }
    }, [logs]);

    const toggleCollapse = (e) => {
        if (e.target.closest('.log-panel-actions')) return;
        setCollapsed(!collapsed);
    };

    const renderIcon = (type) => {
        switch (type) {
            case 'error': return <XCircle size={14} color="var(--accent-red)" style={{ marginRight: 4 }} />;
            case 'success': return <CheckCircle size={14} color="var(--accent-green)" style={{ marginRight: 4 }} />;
            case 'warn': return <AlertTriangle size={14} color="var(--accent-orange)" style={{ marginRight: 4 }} />;
            default: return <Info size={14} color="var(--text-secondary)" style={{ marginRight: 4 }} />;
        }
    };

    return (
        <div
            id="global-log-panel"
            className={`global-log-panel ${isHome ? 'hidden-on-home' : ''} ${collapsed ? 'collapsed' : ''}`}
        >
            <div className="log-panel-header" id="log-panel-header" onClick={toggleCollapse}>
                <div className="log-panel-title">
                    <div className="log-status-dot glow-green"></div>
                    <Terminal className="log-icon" />
                    <span className="log-title-text">系統日誌</span>
                    <div className="log-marquee" id="log-marquee">{marquee}</div>
                </div>
                <div className="log-panel-actions">
                    <button id="clear-log" className="btn-icon-glass" title="清除紀錄" onClick={(e) => { e.stopPropagation(); clearLogs(); }}>
                        <Trash2 size={16} />
                    </button>
                    <button id="toggle-log" className="btn-icon-glass" title="收起/展開" onClick={(e) => { e.stopPropagation(); setCollapsed(!collapsed); }}>
                        <ChevronDown size={16} />
                    </button>
                </div>
            </div>
            <div id="log-output" className="log-output" ref={logOutputRef}>
                {logs.map(log => (
                    <div key={log.id} className={`log-entry ${log.type}`}>
                        <div className="log-time">{log.time}</div>
                        <div className="log-msg">
                            {renderIcon(log.type)}
                            {log.message}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GlobalLogPanel;
