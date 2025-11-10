// match_tictactoe.js
// Server-authoritative Tic-Tac-Toe match handler for Nakama
// Supports 2 players, move validation, win/draw detection, reconnection

const moduleName = "match_tictactoe";
const tickRate = 1; // ticks per second (minimal for turn-based game)
const maxPlayers = 2;

// OpCodes for client-server messages
const OpCode = {
  MOVE: 1,
  CHAT: 2,
  STATE_UPDATE: 10,
  ERROR: 99
};

// Game status constants
const GameStatus = {
  WAITING: 'waiting',
  PLAYING: 'playing',
  FINISHED: 'finished'
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if there's a winner on the board
 * @param {Array<Array<string>>} board - 3x3 grid with '', 'X', or 'O'
 * @returns {string|null} - 'X', 'O', or null if no winner
 */
function checkWin(board) {
  // Check rows
  for (let i = 0; i < 3; i++) {
    if (board[i][0] && board[i][0] === board[i][1] && board[i][1] === board[i][2]) {
      return board[i][0];
    }
  }
  
  // Check columns
  for (let i = 0; i < 3; i++) {
    if (board[0][i] && board[0][i] === board[1][i] && board[1][i] === board[2][i]) {
      return board[0][i];
    }
  }
  
  // Check diagonals
  if (board[0][0] && board[0][0] === board[1][1] && board[1][1] === board[2][2]) {
    return board[0][0];
  }
  if (board[0][2] && board[0][2] === board[1][1] && board[1][1] === board[2][0]) {
    return board[0][2];
  }
  
  return null;
}

/**
 * Check if board is full (draw condition if no winner)
 * @param {Array<Array<string>>} board
 * @returns {boolean}
 */
function checkDraw(board) {
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (!board[i][j]) return false;
    }
  }
  return true;
}

/**
 * Serialize state to JSON string for storage
 * @param {Object} state
 * @returns {string}
 */
function serializeState(state) {
  return JSON.stringify(state);
}

/**
 * Deserialize state from JSON string
 * @param {string} stateJson
 * @returns {Object}
 */
function deserializeState(stateJson) {
  try {
    return JSON.parse(stateJson);
  } catch (e) {
    return null;
  }
}

/**
 * Convert board to readable string (for logging/debugging)
 * @param {Array<Array<string>>} board
 * @returns {string}
 */
function boardToString(board) {
  return board.map(row => row.map(cell => cell || '_').join(' ')).join('\n');
}

/**
 * Create initial empty 3x3 board
 * @returns {Array<Array<string>>}
 */
function createEmptyBoard() {
  return [
    ['', '', ''],
    ['', '', ''],
    ['', '', '']
  ];
}

/**
 * Get player mark (X or O) based on seat index
 * @param {number} seatIndex - 0 or 1
 * @returns {string} - 'X' or 'O'
 */
function getMarkForSeat(seatIndex) {
  return seatIndex === 0 ? 'X' : 'O';
}

// ============================================================================
// MATCH LIFECYCLE HOOKS
// ============================================================================

/**
 * matchInit - Initialize match state when match is created
 * @param {Object} ctx - Match context
 * @param {Object} logger - Nakama logger
 * @param {Object} nk - Nakama runtime API
 * @param {Object} params - Creation parameters
 * @returns {Object} - { state, tickRate, label }
 */
var matchInit = function(ctx, logger, nk, params) {
  logger.info('[' + moduleName + '] matchInit called with params: ' + JSON.stringify(params));
  
  var state = {
    // 3x3 board: '' = empty, 'X' = player 1, 'O' = player 2
    board: createEmptyBoard(),
    
    // Players array: [{ userId, sessionId, username, seat }, ...]
    players: [],
    
    // Current turn: 0 (X) or 1 (O)
    currentTurn: 0,
    
    // Game status: 'waiting', 'playing', 'finished'
    status: GameStatus.WAITING,
    
    // Winner info: null or { winner: 'X'|'O', userId: '...' }
    result: null,
    
    // Track presences for reconnection support
    presences: {},
    
    // Move history for replay/debugging
    moveHistory: [],
    
    // Match creation timestamp
    createdAt: Date.now(),
    
    // Optional: custom params from match creation
    params: params || {}
  };
  
  var label = JSON.stringify({
    mode: (params && params.mode) || 'default',
    status: state.status,
    players: 0
  });
  
  return {
    state: state,
    tickRate: tickRate,
    label: label
  };
};

/**
 * matchJoinAttempt - Check if player can join the match
 * @param {Object} ctx - Match context
 * @param {Object} logger - Nakama logger
 * @param {Object} nk - Nakama runtime API
 * @param {Object} dispatcher - Match dispatcher
 * @param {number} tick - Current tick
 * @param {Object} state - Current match state
 * @param {Object} presence - Player presence attempting to join
 * @param {Object} metadata - Join metadata
 * @returns {Object} - { state, accept: boolean, rejectMessage?: string }
 */
var matchJoinAttempt = function(ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
  logger.info('[' + moduleName + '] matchJoinAttempt: ' + presence.userId);
  
  // Check if player is reconnecting (was already in the match)
  var existingPlayer = null;
  for (var i = 0; i < state.players.length; i++) {
    if (state.players[i].userId === presence.userId) {
      existingPlayer = state.players[i];
      break;
    }
  }
  
  if (existingPlayer) {
    logger.info('[' + moduleName + '] Player reconnecting: ' + presence.userId);
    return {
      state: state,
      accept: true
    };
  }
  
  // Check if match is full
  if (state.players.length >= maxPlayers) {
    logger.warn('[' + moduleName + '] Match full, rejecting: ' + presence.userId);
    return {
      state: state,
      accept: false,
      rejectMessage: 'Match is full'
    };
  }
  
  // Check if match already finished
  if (state.status === GameStatus.FINISHED) {
    return {
      state: state,
      accept: false,
      rejectMessage: 'Match has already finished'
    };
  }
  
  return {
    state: state,
    accept: true
  };
};

/**
 * matchJoin - Handle player joining the match
 * @param {Object} ctx - Match context
 * @param {Object} logger - Nakama logger
 * @param {Object} nk - Nakama runtime API
 * @param {Object} dispatcher - Match dispatcher
 * @param {number} tick - Current tick
 * @param {Object} state - Current match state
 * @param {Array<Object>} presences - Array of presences joining
 * @returns {Object} - { state }
 */
var matchJoin = function(ctx, logger, nk, dispatcher, tick, state, presences) {
  for (var i = 0; i < presences.length; i++) {
    var presence = presences[i];
    logger.info('[' + moduleName + '] Player joined: ' + presence.userId);
    
    // Check if player is reconnecting
    var existingPlayer = null;
    var existingIndex = -1;
    for (var j = 0; j < state.players.length; j++) {
      if (state.players[j].userId === presence.userId) {
        existingPlayer = state.players[j];
        existingIndex = j;
        break;
      }
    }
    
    if (existingPlayer) {
      // Reconnection: update session and presence
      logger.info('[' + moduleName + '] Player reconnected: ' + presence.userId + ', seat: ' + existingPlayer.seat);
      state.players[existingIndex].sessionId = presence.sessionId;
      state.presences[presence.userId] = presence;
      
      // Send current state to reconnecting player
      var reconnectData = JSON.stringify({
        type: 'reconnect',
        state: {
          board: state.board,
          currentTurn: state.currentTurn,
          status: state.status,
          result: state.result,
          players: state.players.map(function(p) {
            return { userId: p.userId, username: p.username, seat: p.seat, mark: getMarkForSeat(p.seat) };
          }),
          yourSeat: existingPlayer.seat,
          yourMark: getMarkForSeat(existingPlayer.seat)
        }
      });
      dispatcher.broadcastMessage(OpCode.STATE_UPDATE, reconnectData, [presence]);
    } else {
      // New player joining
      var seat = state.players.length; // 0 or 1
      var player = {
        userId: presence.userId,
        sessionId: presence.sessionId,
        username: presence.username,
        seat: seat
      };
      
      state.players.push(player);
      state.presences[presence.userId] = presence;
      
      logger.info('[' + moduleName + '] Assigned seat ' + seat + ' (' + getMarkForSeat(seat) + ') to ' + presence.username);
      
      // If we now have 2 players, start the game
      if (state.players.length === maxPlayers) {
        state.status = GameStatus.PLAYING;
        logger.info('[' + moduleName + '] Game starting! Both players joined.');
      }
    }
  }
  
  // Broadcast updated state to all players
  var stateUpdate = JSON.stringify({
    type: 'state_update',
    state: {
      board: state.board,
      currentTurn: state.currentTurn,
      status: state.status,
      players: state.players.map(function(p) {
        return { userId: p.userId, username: p.username, seat: p.seat, mark: getMarkForSeat(p.seat) };
      })
    }
  });
  
  var allPresences = [];
  for (var userId in state.presences) {
    allPresences.push(state.presences[userId]);
  }
  dispatcher.broadcastMessage(OpCode.STATE_UPDATE, stateUpdate, allPresences);
  
  // Update label
  var label = JSON.stringify({
    mode: (state.params && state.params.mode) || 'default',
    status: state.status,
    players: state.players.length
  });
  dispatcher.matchLabelUpdate(label);
  
  return { state: state };
};

/**
 * matchLeave - Handle player leaving/disconnecting
 * @param {Object} ctx - Match context
 * @param {Object} logger - Nakama logger
 * @param {Object} nk - Nakama runtime API
 * @param {Object} dispatcher - Match dispatcher
 * @param {number} tick - Current tick
 * @param {Object} state - Current match state
 * @param {Array<Object>} presences - Array of presences leaving
 * @returns {Object} - { state }
 */
var matchLeave = function(ctx, logger, nk, dispatcher, tick, state, presences) {
  for (var i = 0; i < presences.length; i++) {
    var presence = presences[i];
    logger.info('[' + moduleName + '] Player left: ' + presence.userId);
    
    // Remove from presences (but keep in players for reconnection support)
    delete state.presences[presence.userId];
    
    // If game is in progress and a player leaves, consider it a forfeit
    if (state.status === GameStatus.PLAYING) {
      var leavingPlayer = null;
      for (var j = 0; j < state.players.length; j++) {
        if (state.players[j].userId === presence.userId) {
          leavingPlayer = state.players[j];
          break;
        }
      }
      
      if (leavingPlayer) {
        // Opponent wins by forfeit
        var opponentSeat = leavingPlayer.seat === 0 ? 1 : 0;
        var opponent = state.players[opponentSeat];
        
        state.status = GameStatus.FINISHED;
        state.result = {
          winner: getMarkForSeat(opponentSeat),
          userId: opponent ? opponent.userId : null,
          reason: 'forfeit'
        };
        
        logger.info('[' + moduleName + '] Player ' + leavingPlayer.userId + ' forfeited. Winner: ' + state.result.winner);
        
        // Broadcast game over
        var gameOverData = JSON.stringify({
          type: 'game_over',
          result: state.result,
          board: state.board
        });
        
        var allPresences = [];
        for (var userId in state.presences) {
          allPresences.push(state.presences[userId]);
        }
        if (allPresences.length > 0) {
          dispatcher.broadcastMessage(OpCode.STATE_UPDATE, gameOverData, allPresences);
        }
      }
    }
  }
  
  return { state: state };
};

/**
 * matchLoop - Called on each tick (minimal implementation for turn-based game)
 * @param {Object} ctx - Match context
 * @param {Object} logger - Nakama logger
 * @param {Object} nk - Nakama runtime API
 * @param {Object} dispatcher - Match dispatcher
 * @param {number} tick - Current tick
 * @param {Object} state - Current match state
 * @param {Array<Object>} messages - Messages received this tick
 * @returns {Object} - { state }
 */
var matchLoop = function(ctx, logger, nk, dispatcher, tick, state, messages) {
  // For turn-based Tic-Tac-Toe, we don't need heavy tick processing
  // Could add timeout logic here (e.g., auto-forfeit if player doesn't move within time limit)
  
  // Example: log every 60 seconds in waiting state
  if (state.status === GameStatus.WAITING && tick % 60 === 0) {
    logger.debug('[' + moduleName + '] Match waiting for players... (tick ' + tick + ')');
  }
  
  return { state: state };
};

/**
 * matchTerminate - Cleanup when match ends
 * @param {Object} ctx - Match context
 * @param {Object} logger - Nakama logger
 * @param {Object} nk - Nakama runtime API
 * @param {Object} dispatcher - Match dispatcher
 * @param {number} tick - Current tick
 * @param {Object} state - Current match state
 * @param {number} graceSeconds - Grace period before termination
 * @returns {Object} - { state }
 */
var matchTerminate = function(ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
  logger.info('[' + moduleName + '] Match terminating. Final state: ' + state.status);
  
  // Save match results to leaderboard and storage
  if (state.result) {
    logger.info('[' + moduleName + '] Winner: ' + state.result.winner + ' (userId: ' + state.result.userId + ')');
    
    // Update leaderboard for both players
    if (state.players && state.players.length === 2) {
      var winner = state.result.userId;
      var isDraw = state.result.reason === 'draw';
      
      for (var i = 0; i < state.players.length; i++) {
        var player = state.players[i];
        var isWinner = player.userId === winner;
        
        // Score calculation: win = 3 points, draw = 1 point, loss = 0 points
        var score = isDraw ? 1 : (isWinner ? 3 : 0);
        var subscore = state.moveHistory.length; // number of moves (for tiebreaking)
        
        try {
          if (nk && typeof nk.leaderboardRecordWrite === 'function') {
            nk.leaderboardRecordWrite(
              'tictactoe_global',
              player.userId,
              null, // username
              score,
              subscore,
              { 
                result: isDraw ? 'draw' : (isWinner ? 'win' : 'loss'),
                match_id: ctx.matchId,
                finished_at: Date.now()
              }
            );
            logger.info('[' + moduleName + '] Leaderboard updated for ' + player.userId + ' (score: ' + score + ')');
          }
        } catch (e) {
          logger.warn('[' + moduleName + '] Failed to update leaderboard: ' + e);
        }
      }
    }
    
    // Save match result to storage
    try {
      if (nk && typeof nk.storageWrite === 'function') {
        nk.storageWrite([{
          collection: 'match_results',
          key: ctx.matchId,
          userId: state.result.userId || '00000000-0000-0000-0000-000000000000',
          value: { 
            result: state.result, 
            moves: state.moveHistory, 
            players: state.players,
            createdAt: state.createdAt, 
            finishedAt: Date.now() 
          },
          permissionRead: 2, // public read
          permissionWrite: 0 // no write
        }]);
        logger.info('[' + moduleName + '] Match result saved to storage');
      }
    } catch (e) {
      logger.warn('[' + moduleName + '] Failed to save match result: ' + e);
    }
  }
  
  return { state: state };
};

/**
 * matchReceive - Handle messages from clients
 * @param {Object} ctx - Match context
 * @param {Object} logger - Nakama logger
 * @param {Object} nk - Nakama runtime API
 * @param {Object} dispatcher - Match dispatcher
 * @param {number} tick - Current tick
 * @param {Object} state - Current match state
 * @param {Array<Object>} messages - Array of { sender, opCode, data }
 * @returns {Object} - { state }
 */
var matchReceive = function(ctx, logger, nk, dispatcher, tick, state, messages) {
  for (var i = 0; i < messages.length; i++) {
    var message = messages[i];
    var sender = message.sender;
    var opCode = message.opCode;
    var data = null;
    
    try {
      data = JSON.parse(nk.binaryToString(message.data));
    } catch (e) {
      logger.warn('[' + moduleName + '] Invalid JSON from ' + sender.userId + ': ' + e);
      continue;
    }
    
    // Handle different message types
    if (opCode === OpCode.MOVE) {
      handleMove(ctx, logger, nk, dispatcher, state, sender, data);
    } else if (opCode === OpCode.CHAT) {
      handleChat(ctx, logger, nk, dispatcher, state, sender, data);
    } else {
      logger.warn('[' + moduleName + '] Unknown opCode: ' + opCode);
    }
  }
  
  return { state: state };
};

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

/**
 * Handle move message from client
 * @param {Object} ctx - Match context
 * @param {Object} logger - Nakama logger
 * @param {Object} nk - Nakama runtime API
 * @param {Object} dispatcher - Match dispatcher
 * @param {Object} state - Current match state
 * @param {Object} sender - Player presence
 * @param {Object} data - Move data { x, y }
 */
function handleMove(ctx, logger, nk, dispatcher, state, sender, data) {
  // Validation 1: Game must be in PLAYING state
  if (state.status !== GameStatus.PLAYING) {
    sendError(dispatcher, sender, 'Game is not in progress');
    return;
  }
  
  // Find player making the move
  var player = null;
  for (var i = 0; i < state.players.length; i++) {
    if (state.players[i].userId === sender.userId) {
      player = state.players[i];
      break;
    }
  }
  
  if (!player) {
    sendError(dispatcher, sender, 'You are not in this game');
    return;
  }
  
  // Validation 2: Is it this player's turn?
  if (player.seat !== state.currentTurn) {
    sendError(dispatcher, sender, 'Not your turn');
    return;
  }
  
  // Validation 3: Valid coordinates
  var x = data.x;
  var y = data.y;
  if (typeof x !== 'number' || typeof y !== 'number' || x < 0 || x > 2 || y < 0 || y > 2) {
    sendError(dispatcher, sender, 'Invalid coordinates');
    return;
  }
  
  // Validation 4: Cell must be empty
  if (state.board[y][x] !== '') {
    sendError(dispatcher, sender, 'Cell already occupied');
    return;
  }
  
  // Apply the move
  var mark = getMarkForSeat(player.seat);
  state.board[y][x] = mark;
  
  // Record move in history
  state.moveHistory.push({
    userId: player.userId,
    seat: player.seat,
    mark: mark,
    x: x,
    y: y,
    tick: Date.now()
  });
  
  logger.info('[' + moduleName + '] Move: ' + player.username + ' (' + mark + ') -> (' + x + ', ' + y + ')');
  logger.debug('[' + moduleName + '] Board:\n' + boardToString(state.board));
  
  // Check for win
  var winner = checkWin(state.board);
  if (winner) {
    state.status = GameStatus.FINISHED;
    state.result = {
      winner: winner,
      userId: player.userId,
      reason: 'win'
    };
    
    logger.info('[' + moduleName + '] Game over! Winner: ' + winner + ' (' + player.username + ')');
    
    // Broadcast game over
    var gameOverData = JSON.stringify({
      type: 'game_over',
      move: { x: x, y: y, mark: mark, userId: player.userId },
      result: state.result,
      board: state.board
    });
    
    var allPresences = [];
    for (var userId in state.presences) {
      allPresences.push(state.presences[userId]);
    }
    dispatcher.broadcastMessage(OpCode.STATE_UPDATE, gameOverData, allPresences);
    
    return;
  }
  
  // Check for draw
  if (checkDraw(state.board)) {
    state.status = GameStatus.FINISHED;
    state.result = {
      winner: null,
      userId: null,
      reason: 'draw'
    };
    
    logger.info('[' + moduleName + '] Game over! Draw.');
    
    // Broadcast game over
    var drawData = JSON.stringify({
      type: 'game_over',
      move: { x: x, y: y, mark: mark, userId: player.userId },
      result: state.result,
      board: state.board
    });
    
    var allPresences = [];
    for (var userId in state.presences) {
      allPresences.push(state.presences[userId]);
    }
    dispatcher.broadcastMessage(OpCode.STATE_UPDATE, drawData, allPresences);
    
    return;
  }
  
  // Switch turn
  state.currentTurn = state.currentTurn === 0 ? 1 : 0;
  
  // Broadcast move to all players
  var moveData = JSON.stringify({
    type: 'move',
    move: { x: x, y: y, mark: mark, userId: player.userId },
    board: state.board,
    currentTurn: state.currentTurn,
    nextPlayer: state.players[state.currentTurn].userId
  });
  
  var allPresences = [];
  for (var userId in state.presences) {
    allPresences.push(state.presences[userId]);
  }
  dispatcher.broadcastMessage(OpCode.STATE_UPDATE, moveData, allPresences);
}

/**
 * Handle chat message from client
 * @param {Object} ctx - Match context
 * @param {Object} logger - Nakama logger
 * @param {Object} nk - Nakama runtime API
 * @param {Object} dispatcher - Match dispatcher
 * @param {Object} state - Current match state
 * @param {Object} sender - Player presence
 * @param {Object} data - Chat data { message }
 */
function handleChat(ctx, logger, nk, dispatcher, state, sender, data) {
  if (!data.message || typeof data.message !== 'string') {
    return;
  }
  
  logger.debug('[' + moduleName + '] Chat from ' + sender.username + ': ' + data.message);
  
  // Broadcast chat to all players
  var chatData = JSON.stringify({
    type: 'chat',
    userId: sender.userId,
    username: sender.username,
    message: data.message,
    timestamp: Date.now()
  });
  
  var allPresences = [];
  for (var userId in state.presences) {
    allPresences.push(state.presences[userId]);
  }
  dispatcher.broadcastMessage(OpCode.CHAT, chatData, allPresences);
}

/**
 * Send error message to a specific player
 * @param {Object} dispatcher - Match dispatcher
 * @param {Object} presence - Player presence
 * @param {string} message - Error message
 */
function sendError(dispatcher, presence, message) {
  var errorData = JSON.stringify({
    type: 'error',
    message: message
  });
  dispatcher.broadcastMessage(OpCode.ERROR, errorData, [presence]);
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  matchInit: matchInit,
  matchJoinAttempt: matchJoinAttempt,
  matchJoin: matchJoin,
  matchLeave: matchLeave,
  matchLoop: matchLoop,
  matchTerminate: matchTerminate,
  matchReceive: matchReceive
};
