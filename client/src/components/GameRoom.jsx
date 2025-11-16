import React, { useState, useEffect, useCallback } from 'react';
import Board3D from './Board3D.jsx';
import Timer from './Timer.jsx';
import { nakamaService } from '../services/nakama.js';

function GameRoom({ session, match, onBackToLobby }) {
  const [gameState, setGameState] = useState({
    board: Array(9).fill(''),
    currentPlayer: 'X',
    players: {},
    winner: null,
    gameOver: false,
    turnStartTime: Date.now(),
    timeLimit: 0,
    mode: 'classic'
  });
  const [mySymbol, setMySymbol] = useState(null);
  const [opponentName, setOpponentName] = useState('Waiting...');

  useEffect(() => {
    const socket = nakamaService.socket;
    if (!socket) return;

    socket.onmatchdata = (data) => {
      const message = JSON.parse(new TextDecoder().decode(data.data));

      if (message.type === 'player_joined') {
        setGameState(message.state);
        if (message.userId === session.user_id) {
          setMySymbol(message.symbol);
        }
      } else if (message.type === 'game_start') {
        setGameState(message.state);
      } else if (message.type === 'move_made') {
        setGameState(message.state);
      } else if (message.type === 'player_left') {
        setGameState(message.state);
        alert('Opponent left the game');
      } else if (message.type === 'timeout') {
        setGameState(message.state);
      }
    };

    socket.onmatchpresence = (presence) => {
      if (presence.joins) {
        presence.joins.forEach(join => {
          if (join.user_id !== session.user_id) {
            setOpponentName(join.username || 'Opponent');
          }
        });
      }
    };

    return () => {
      socket.onmatchdata = null;
      socket.onmatchpresence = null;
    };
  }, [session, match]);

  const handleCellClick = useCallback(async (position) => {
    if (gameState.gameOver) return;
    if (gameState.players[session.user_id] !== gameState.currentPlayer) return;
    if (gameState.board[position] !== '') return;

    try {
      await nakamaService.sendMatchState(match.match_id, 1, {
        type: 'move',
        position
      });
    } catch (error) {
      console.error('Failed to send move:', error);
    }
  }, [gameState, session, match]);

  const handleTimeout = useCallback(() => {
    if (!gameState.gameOver && gameState.players[session.user_id] === gameState.currentPlayer) {
      alert('Time expired! You lose.');
    }
  }, [gameState, session]);

  const handleLeaveMatch = async () => {
    try {
      await nakamaService.leaveMatch(match.match_id);
      onBackToLobby();
    } catch (error) {
      console.error('Failed to leave match:', error);
      onBackToLobby();
    }
  };

  const isMyTurn = gameState.players[session.user_id] === gameState.currentPlayer;
  const playerCount = Object.keys(gameState.players).length;

  return (
    <div className="game-room">
      <div className="game-header">
        <button className="btn-leave" onClick={handleLeaveMatch}>
          Leave Game
        </button>
        <div className="game-mode-badge">
          {gameState.mode === 'timed' ? '⏱️ Timed Mode' : '♾️ Classic Mode'}
        </div>
      </div>

      <div className="game-container">
        <div className="game-sidebar">
          <div className="player-info">
            <div className={`player-card ${isMyTurn && !gameState.gameOver ? 'active' : ''}`}>
              <div className="player-symbol">{mySymbol || '?'}</div>
              <div className="player-name">You</div>
              {isMyTurn && !gameState.gameOver && <div className="turn-indicator">Your Turn</div>}
            </div>

            <div className="vs-divider">VS</div>

            <div className={`player-card ${!isMyTurn && !gameState.gameOver ? 'active' : ''}`}>
              <div className="player-symbol">{mySymbol === 'X' ? 'O' : 'X'}</div>
              <div className="player-name">{opponentName}</div>
              {!isMyTurn && !gameState.gameOver && <div className="turn-indicator">Their Turn</div>}
            </div>
          </div>

          {gameState.mode === 'timed' && !gameState.gameOver && playerCount === 2 && (
            <Timer
              startTime={gameState.turnStartTime}
              timeLimit={gameState.timeLimit}
              onTimeout={handleTimeout}
            />
          )}

          {gameState.gameOver && (
            <div className="game-result">
              {gameState.winner === 'draw' ? (
                <div className="result-draw">
                  <div className="result-icon">🤝</div>
                  <div className="result-text">It's a Draw!</div>
                </div>
              ) : gameState.winner === mySymbol ? (
                <div className="result-win">
                  <div className="result-icon">🎉</div>
                  <div className="result-text">You Win!</div>
                </div>
              ) : (
                <div className="result-lose">
                  <div className="result-icon">😔</div>
                  <div className="result-text">You Lose!</div>
                </div>
              )}
              <button className="btn-primary" onClick={onBackToLobby}>
                Back to Lobby
              </button>
            </div>
          )}

          {playerCount < 2 && (
            <div className="waiting-opponent">
              <div className="spinner"></div>
              <p>Waiting for opponent...</p>
            </div>
          )}
        </div>

        <div className="game-board-container">
          <Board3D
            board={gameState.board}
            onCellClick={handleCellClick}
            disabled={!isMyTurn || gameState.gameOver || playerCount < 2}
            currentPlayer={gameState.currentPlayer}
          />
        </div>
      </div>
    </div>
  );
}

export default GameRoom;
