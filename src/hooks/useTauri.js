import { useCallback } from 'react';

// Fallback for non-Tauri browser environments during development
const { invoke } = window.__TAURI__?.core || { invoke: async () => { console.warn('Tauri invoke not found'); return null; } };

export const useTauri = () => {
    const getInstances = useCallback(async (exeName) => {
        return await invoke('get_instances', { exeName });
    }, []);

    const injectScript = useCallback(async (port, code) => {
        return await invoke('inject_script', { port: parseInt(port), code });
    }, []);

    const killInstance = useCallback(async (pid) => {
        return await invoke('kill_instance', { pid });
    }, []);

    const launchApp = useCallback(async (exePath, port, workdir) => {
        return await invoke('launch_app', { exePath, port: parseInt(port), workdir });
    }, []);

    const getCdpTargets = useCallback(async (port) => {
        return await invoke('get_cdp_targets', { port: parseInt(port) });
    }, []);

    return { getInstances, injectScript, killInstance, launchApp, getCdpTargets, invoke };
};
