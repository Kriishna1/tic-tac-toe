import React, { useState, useEffect } from 'react';
import { nakamaService } from '../services/nakama.js';

function Leaderboard({ session, onBack }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    try {
      const data = await nakamaService.getLeaderboard();
      setLeaderboard(data.leaderboard);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
      setLoading(false);
    }
  };

  const getMedalEmoji = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return rank;
  };

  return (
    <div className="leaderboard">
      <div className="leaderboard-header">
        <button className="btn-back" onClick={onBack}>
          ← Back
        </button>
        <h2>Global Leaderboard</h2>
        <button className="btn-refresh" onClick={loadLeaderboard}>
          🔄
        </button>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="leaderboard-table">
          <div className="table-header">
            <div className="col-rank">Rank</div>
            <div className="col-player">Player</div>
            <div className="col-score">Score</div>
            <div className="col-wins">Wins</div>
            <div className="col-losses">Losses</div>
            <div className="col-streak">Streak</div>
          </div>
          <div className="table-body">
            {leaderboard.length === 0 ? (
              <div className="no-data">No players yet. Be the first!</div>
            ) : (
              leaderboard.map((entry) => (
                <div
                  key={entry.username}
                  className={`table-row ${entry.rank <= 3 ? 'top-player' : ''}`}
                >
                  <div className="col-rank">{getMedalEmoji(entry.rank)}</div>
                  <div className="col-player">{entry.username}</div>
                  <div className="col-score">{entry.score}</div>
                  <div className="col-wins">{entry.wins}</div>
                  <div className="col-losses">{entry.losses}</div>
                  <div className="col-streak">{entry.maxWinStreak}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Leaderboard;
