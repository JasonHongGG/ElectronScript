import React, { useState } from 'react';
import Titlebar from './components/Titlebar';
import GlobalLogPanel from './components/GlobalLogPanel';
import HomeView from './views/HomeView';
import AppManagementView from './views/AppManagementView';
import ScriptLibraryView from './views/ScriptLibraryView';
import { LogProvider } from './hooks/useLogs';
import { Zap } from 'lucide-react';

function App() {
    const [currentView, setCurrentView] = useState('home');
    const [currentAppKey, setCurrentAppKey] = useState(null);

    const goHome = () => {
        setCurrentView('home');
        setCurrentAppKey(null);
    };

    const goAppView = (appKey) => {
        setCurrentAppKey(appKey);
        setCurrentView('app');
    };

    const goScriptsView = () => {
        setCurrentView('scripts');
    };

    return (
        <LogProvider>
            <div className="app-content-wrapper">
                <div data-tauri-drag-region className="drag-region-overlay"></div>
                <Titlebar />

                <div className="integrated-logo">
                    <Zap size={16} strokeWidth={2.5} style={{ color: 'var(--accent-yellow)' }} />
                    <span>Electron Injector</span>
                </div>

                <div className="app-content">

                    {currentView === 'home' && (
                        <HomeView onSelectApp={goAppView} />
                    )}

                    {currentView === 'app' && currentAppKey && (
                        <AppManagementView
                            appKey={currentAppKey}
                            onBack={goHome}
                            onGoScripts={goScriptsView}
                        />
                    )}

                    {currentView === 'scripts' && currentAppKey && (
                        <ScriptLibraryView
                            appKey={currentAppKey}
                            onBack={() => goAppView(currentAppKey)}
                        />
                    )}
                </div>

                <GlobalLogPanel isHome={currentView === 'home'} />
            </div>
        </LogProvider>
    );
}

export default App;
