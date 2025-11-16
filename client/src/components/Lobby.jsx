import React, { useState, useEffect } from 'react';
import { nakamaService } from '../services/nakama.js';

function Lobby({ session, onMatchFound, onShowLeaderboard }) {
  const [searching, setSearching] = useState(false);
  const [mode, setMode] = useState('classic');
  const [ticket, setTicket] = useState(null);
  const [playerStats, setPlayerStats] = useState(null);

  useEffect(() => {
    loadPlayerStats();
  }, []);

  const loadPlayerStats = async () => {
    try {
      const data = await nakamaService.getPlayerStats();
      setPlayerStats(data.stats);
    } catch (error) {
      console.error('Failed to load player stats:', error);
    }
  };

  const startMatchmaking = async () => {
    setSearching(true);
    try {
      const socket = await nakamaService.createSocket();

      socket.onmatchmakermatched = async (matched) => {
        if (matched.ticket === ticket?.ticket) {
          const match = await nakamaService.joinMatch(matched.match_id);
          onMatchFound(match);
          setSearching(false);
        }
      };

      const newTicket = await nakamaService.findMatch(mode);
      setTicket(newTicket);
    } catch (error) {
      console.error('Matchmaking failed:', error);
      setSearching(false);
    }
  };

  const cancelMatchmaking = () => {
    setSearching(false);
    setTicket(null);
  };

  return (
    <div className="lobby">
      <div className="lobby-content">
        <div className="player-card">
          <h2>Player Stats</h2>
          {playerStats ? (
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Wins</span>
                <span className="stat-value">{playerStats.wins}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Losses</span>
                <span className="stat-value">{playerStats.losses}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Win Streak</span>
                <span className="stat-value">{playerStats.winStreak}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Best Streak</span>
                <span className="stat-value">{playerStats.maxWinStreak}</span>
              </div>
            </div>
          ) : (
            <p>Loading stats...</p>
          )}
        </div>

        <div className="mode-selector">
          <h3>Select Game Mode</h3>
          <div className="mode-buttons">
            <button
              className={`mode-btn ${mode === 'classic' ? 'active' : ''}`}
              onClick={() => setMode('classic')}
              disabled={searching}
            >
              <div className="mode-icon">♾️</div>
              <div className="mode-name">Classic</div>
              <div className="mode-desc">No time limit</div>
            </button>
            <button
              className={`mode-btn ${mode === 'timed' ? 'active' : ''}`}
              onClick={() => setMode('timed')}
              disabled={searching}
            >
              <div className="mode-icon">⏱️</div>
              <div className="mode-name">Timed</div>
              <div className="mode-desc">30 seconds per turn</div>
            </button>
          </div>
        </div>

        <div className="action-buttons">
          {!searching ? (
            <button className="btn-primary" onClick={startMatchmaking}>
              Find Match
            </button>
          ) : (
            <div className="searching">
              <div className="spinner"></div>
              <p>Searching for opponent...</p>
              <button className="btn-secondary" onClick={cancelMatchmaking}>
                Cancel
              </button>
            </div>
          )}

          <button className="btn-secondary" onClick={onShowLeaderboard}>
            View Leaderboard
          </button>
        </div>
      </div>
    </div>
  );
}

export default Lobby;
