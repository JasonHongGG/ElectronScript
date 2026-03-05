import React from 'react';
import { Minus, Square, X } from 'lucide-react';

const Titlebar = () => {
    const appWindow = window.__TAURI__?.window?.getCurrentWindow?.();

    return (
        <div className="integrated-window-controls custom-style">
            <div className="titlebar-btn minimize" onClick={() => appWindow?.minimize()} title="縮小">
                <Minus size={12} strokeWidth={2.5} />
            </div>
            <div className="titlebar-btn maximize" onClick={() => appWindow?.toggleMaximize()} title="最大化">
                <Square size={12} strokeWidth={2.5} />
            </div>
            <div className="titlebar-btn close" onClick={() => appWindow?.close()} title="關閉">
                <X size={12} strokeWidth={2.5} />
            </div>
        </div>
    );
};

export default Titlebar;
