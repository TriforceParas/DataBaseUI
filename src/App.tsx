import { useState, useEffect } from "react";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { MainInterface } from "./components/MainInterface";
import { FullscreenLoader } from "./components/common/FullscreenLoader";
import { Connection } from "./types/index";
import { applyTheme, getSavedTheme } from "./utils/themeUtils";
import * as api from "./api";

import { ConnectionWindow } from "./components/windows/ConnectionWindow";
import { VaultWindow } from "./components/windows/VaultWindow";
import { ErrorWindow } from "./components/windows/ErrorWindow";

function App() {
  const [activeConnection, setActiveConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);

  // Apply theme globally (runs for all windows)
  useEffect(() => {
    const savedTheme = getSavedTheme();
    applyTheme(savedTheme);
  }, []);

  // Parse URL params
  const params = new URLSearchParams(window.location.search);
  const windowMode = params.get('window');

  // Routing for separate windows
  if (windowMode === 'connection') {
    return <ConnectionWindow />;
  }
  if (windowMode === 'vault') {
    return <VaultWindow />;
  }
  if (windowMode === 'error') {
    return <ErrorWindow />;
  }

  // Loading Screen Mode
  const isLoadingMode = params.get('mode') === 'loading';
  if (isLoadingMode) {
    return <FullscreenLoader isVisible={true} message="Generating High-Quality Screenshot..." />;
  }

  // Main Window Logic
  useEffect(() => {
    const init = async () => {
      // Check for connection_id to auto-open main interface (e.g. from reload)
      const connId = params.get('connection_id');
      if (connId && !windowMode) {
        try {
          const connections = await api.listConnections();
          const target = connections.find(c => c.id === Number(connId));
          if (target) {
            setActiveConnection(target);
          }
        } catch (e) {
          console.error("Failed to load connection", e);
        }
      }
      setLoading(false);
    };
    init();
  }, []);

  const handleOpenConnection = async (conn: Connection) => {
    try {
      await api.openConnectionWindow(conn.id);
    } catch (e) {
      console.error("Failed to open connection window", e);
    }
  };

  if (loading) return null;

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', overflow: 'hidden' }}>
      {activeConnection ? (
        <MainInterface
          key={activeConnection.id}
          connection={activeConnection}
          onSwitchConnection={() => {
            // In multi-window mode, switching might mean opening another window or resetting state
            // For now, we allow resetting to welcome screen (if single window) or just closing
          }}
        />
      ) : (
        <WelcomeScreen onConnect={handleOpenConnection} />
      )}
    </div>
  );
}

export default App;
