import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';
import Lobby from './components/Lobby.jsx';
import GameRoom from './components/GameRoom.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import { nakamaService } from './services/nakama.js';

function App() {
  const [view, setView] = useState('lobby');
  const [session, setSession] = useState(null);
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeNakama();
  }, []);

  const initializeNakama = async () => {
    try {
      const newSession = await nakamaService.authenticate();
      setSession(newSession);
      setLoading(false);
    } catch (error) {
      console.error('Authentication failed:', error);
      setLoading(false);
    }
  };

  const handleMatchFound = (matchData) => {
    setMatch(matchData);
    setView('game');
  };

  const handleBackToLobby = () => {
    setMatch(null);
    setView('lobby');
  };

  const handleShowLeaderboard = () => {
    setView('leaderboard');
  };

  if (loading) {
    return (
      <ThemeProvider>
        <div className="app">
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Connecting to server...</p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div className="app">
        <header className="app-header">
          <h1>Multiplayer Tic-Tac-Toe</h1>
          <ThemeToggle />
        </header>

        <main className="app-main">
          {view === 'lobby' && (
            <Lobby
              session={session}
              onMatchFound={handleMatchFound}
              onShowLeaderboard={handleShowLeaderboard}
            />
          )}

          {view === 'game' && match && (
            <GameRoom
              session={session}
              match={match}
              onBackToLobby={handleBackToLobby}
            />
          )}

          {view === 'leaderboard' && (
            <Leaderboard
              session={session}
              onBack={() => setView('lobby')}
            />
          )}
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;
