import React, { createContext, useContext, useState, useCallback } from 'react';

const LogContext = createContext(null);

export const LogProvider = ({ children }) => {
    const [logs, setLogs] = useState([]);
    const [marquee, setMarquee] = useState('Waiting for logs...');

    const log = useCallback((message, type = 'info') => {
        const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false });
        const newLog = {
            id: Date.now() + Math.random(),
            time: timeStr,
            message,
            type
        };

        setLogs(prev => [...prev, newLog]);
        setMarquee(message);
    }, []);

    const clearLogs = useCallback(() => {
        setLogs([]);
        setMarquee('Waiting for logs...');
    }, []);

    return (
        <LogContext.Provider value={{ logs, log, clearLogs, marquee }}>
            {children}
        </LogContext.Provider>
    );
};

export const useLogs = () => {
    const context = useContext(LogContext);
    if (!context) {
        throw new Error('useLogs must be used within a LogProvider');
    }
    return context;
};
