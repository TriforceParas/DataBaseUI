import { useState, useEffect } from "react";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { MainInterface } from "./components/MainInterface";
import { FullscreenLoader } from "./components/common/FullscreenLoader";
import { Connection } from "./types/index";
import { applyTheme, getSavedTheme } from "./utils/themeUtils";
import * as api from "./api";

function App() {
  const [activeConnection, setActiveConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Apply theme immediately on load
    const savedTheme = getSavedTheme();
    applyTheme(savedTheme);

    const init = async () => {
      const params = new URLSearchParams(window.location.search);
      const connId = params.get('connection_id');

      if (connId) {
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

  const params = new URLSearchParams(window.location.search);
  const isLoadingMode = params.get('mode') === 'loading';

  if (isLoadingMode) {
    return <FullscreenLoader isVisible={true} message="Generating High-Quality Screenshot..." />;
  }

  if (loading) return null; // Or a loader

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', overflow: 'hidden' }}>
      {activeConnection ? (
        <MainInterface
          key={activeConnection.id}
          connection={activeConnection}
          onSwitchConnection={() => { }} // Remove implementation as we use new windows
        />
      ) : (
        <WelcomeScreen onConnect={handleOpenConnection} />
      )}
    </div>
  );
}

export default App;
