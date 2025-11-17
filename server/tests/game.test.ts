import { describe, it, expect, beforeEach } from '@jest/globals';

interface GameState {
  board: string[];
  currentPlayer: string;
  players: { [userId: string]: string };
  winner: string | null;
  gameOver: boolean;
}

function checkWinner(board: string[]): string | null {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  return null;
}

function makeMove(state: GameState, userId: string, position: number): GameState {
  if (state.gameOver) {
    throw new Error("Game is over");
  }

  if (position < 0 || position > 8) {
    throw new Error("Invalid position");
  }

  if (state.board[position] !== "") {
    throw new Error("Position already taken");
  }

  if (state.players[userId] !== state.currentPlayer) {
    throw new Error("Not your turn");
  }

  const newState = {
    ...state,
    board: [...state.board]
  };

  newState.board[position] = state.currentPlayer;

  const winner = checkWinner(newState.board);
  if (winner) {
    newState.winner = winner;
    newState.gameOver = true;
  } else if (newState.board.every(cell => cell !== "")) {
    newState.gameOver = true;
    newState.winner = "draw";
  } else {
    newState.currentPlayer = state.currentPlayer === "X" ? "O" : "X";
  }

  return newState;
}

describe('Tic-Tac-Toe Game Logic', () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = {
      board: Array(9).fill(""),
      currentPlayer: "X",
      players: {
        "player1": "X",
        "player2": "O"
      },
      winner: null,
      gameOver: false
    };
  });

  it('should initialize game with empty board', () => {
    expect(gameState.board).toEqual(Array(9).fill(""));
    expect(gameState.currentPlayer).toBe("X");
    expect(gameState.gameOver).toBe(false);
  });

  it('should allow valid move', () => {
    const newState = makeMove(gameState, "player1", 0);
    expect(newState.board[0]).toBe("X");
    expect(newState.currentPlayer).toBe("O");
  });

  it('should reject move on occupied position', () => {
    gameState.board[0] = "X";
    expect(() => makeMove(gameState, "player2", 0)).toThrow("Position already taken");
  });

  it('should reject move out of turn', () => {
    expect(() => makeMove(gameState, "player2", 0)).toThrow("Not your turn");
  });

  it('should detect horizontal win', () => {
    gameState.board = ["X", "X", "", "", "", "", "", "", ""];
    const newState = makeMove(gameState, "player1", 2);
    expect(newState.winner).toBe("X");
    expect(newState.gameOver).toBe(true);
  });

  it('should detect vertical win', () => {
    gameState.board = ["X", "", "", "X", "", "", "", "", ""];
    const newState = makeMove(gameState, "player1", 6);
    expect(newState.winner).toBe("X");
    expect(newState.gameOver).toBe(true);
  });

  it('should detect diagonal win', () => {
    gameState.board = ["X", "", "", "", "X", "", "", "", ""];
    const newState = makeMove(gameState, "player1", 8);
    expect(newState.winner).toBe("X");
    expect(newState.gameOver).toBe(true);
  });

  it('should detect draw', () => {
    gameState.board = ["X", "O", "X", "X", "O", "O", "O", "X", ""];
    const newState = makeMove(gameState, "player1", 8);
    expect(newState.winner).toBe("draw");
    expect(newState.gameOver).toBe(true);
  });

  it('should reject moves after game over', () => {
    gameState.gameOver = true;
    expect(() => makeMove(gameState, "player1", 0)).toThrow("Game is over");
  });

  it('should alternate players', () => {
    let state = makeMove(gameState, "player1", 0);
    expect(state.currentPlayer).toBe("O");
    state = makeMove(state, "player2", 1);
    expect(state.currentPlayer).toBe("X");
  });
});
