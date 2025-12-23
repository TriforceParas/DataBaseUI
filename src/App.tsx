import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { MainInterface } from "./components/MainInterface";
import { Connection } from "./types";

function App() {
  const [activeConnection, setActiveConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Apply theme immediately on load
    const savedTheme = localStorage.getItem('app-theme') || 'blue';
    document.documentElement.dataset.theme = savedTheme;

    const init = async () => {
      const params = new URLSearchParams(window.location.search);
      const connId = params.get('connection_id');

      if (connId) {
        try {
          const connections = await invoke<Connection[]>('list_connections');
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
      await invoke('open_connection_window', { connectionId: conn.id });
    } catch (e) {
      console.error("Failed to open connection window", e);
    }
  };

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
