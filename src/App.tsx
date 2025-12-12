import { useState } from "react";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { MainInterface } from "./components/MainInterface";
import { Connection } from "./types";

function App() {
  const [activeConnection, setActiveConnection] = useState<Connection | null>(null);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', overflow: 'hidden' }}>
      {activeConnection ? (
        <MainInterface
          key={activeConnection.id}
          connection={activeConnection}
          onSwitchConnection={(conn) => setActiveConnection(conn)}
        />
      ) : (
        <WelcomeScreen onConnect={(conn) => setActiveConnection(conn)} />
      )}
    </div>
  );
}

export default App;
