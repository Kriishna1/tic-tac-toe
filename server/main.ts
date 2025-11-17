interface GameState {
    board: string[];
    currentPlayer: string;
    players: { [userId: string]: string };
    winner: string | null;
    gameOver: boolean;
    turnStartTime: number;
    timeLimit: number;
    mode: string;
}

interface LeaderboardEntry {
    userId: string;
    username: string;
    wins: number;
    losses: number;
    winStreak: number;
    maxWinStreak: number;
}

const TURN_TIME_LIMIT = 30000;
const COLLECTION_NAME = "gameStats";
const LEADERBOARD_ID = "global_leaderboard";

let rpcInitializeGame: nkruntime.RpcFunction = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    const request = JSON.parse(payload);
    const mode = request.mode || "classic";

    const state: GameState = {
        board: Array(9).fill(""),
        currentPlayer: "X",
        players: {},
        winner: null,
        gameOver: false,
        turnStartTime: Date.now(),
        timeLimit: mode === "timed" ? TURN_TIME_LIMIT : 0,
        mode: mode
    };

    return JSON.stringify({ state });
};

let rpcMakeMove: nkruntime.RpcFunction = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    const request = JSON.parse(payload);
    const { matchId, position, state } = request;

    if (!state || state.gameOver) {
        throw Error("Game is over");
    }

    if (position < 0 || position > 8) {
        throw Error("Invalid position");
    }

    if (state.board[position] !== "") {
        throw Error("Position already taken");
    }

    const userId = ctx.userId || "";
    if (state.players[userId] !== state.currentPlayer) {
        throw Error("Not your turn");
    }

    if (state.mode === "timed") {
        const elapsed = Date.now() - state.turnStartTime;
        if (elapsed > state.timeLimit) {
            throw Error("Time expired");
        }
    }

    state.board[position] = state.currentPlayer;

    const winner = checkWinner(state.board);
    if (winner) {
        state.winner = winner;
        state.gameOver = true;
    } else if (state.board.every((cell: string) => cell !== "")) {
        state.gameOver = true;
        state.winner = "draw";
    } else {
        state.currentPlayer = state.currentPlayer === "X" ? "O" : "X";
        state.turnStartTime = Date.now();
    }

    return JSON.stringify({ state });
};

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

let matchmakerMatched: nkruntime.MatchmakerMatchedFunction = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, matches: nkruntime.MatchmakerResult[]): string {
    if (matches.length < 2) {
        return "";
    }

    const mode = matches[0].properties?.mode || "classic";

    const matchId = nk.matchCreate("tictactoe", { mode });

    matches.forEach(match => {
        nk.notificationSend(match.presence.userId, "Match Found", { matchId, mode }, 1);
    });

    return matchId;
};

let matchInit: nkruntime.MatchInitFunction = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, params: {[key: string]: string}): {state: nkruntime.MatchState, tickRate: number, label: string} {
    const mode = params.mode || "classic";

    const state: GameState = {
        board: Array(9).fill(""),
        currentPlayer: "X",
        players: {},
        winner: null,
        gameOver: false,
        turnStartTime: Date.now(),
        timeLimit: mode === "timed" ? TURN_TIME_LIMIT : 0,
        mode: mode
    };

    return {
        state: state as nkruntime.MatchState,
        tickRate: 1,
        label: JSON.stringify({ mode })
    };
};

let matchJoinAttempt: nkruntime.MatchJoinAttemptFunction = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, presence: nkruntime.Presence, metadata: {[key: string]: any}): {state: nkruntime.MatchState, accept: boolean, rejectMessage?: string} | null {
    const gameState = state as any as GameState;
    const playerCount = Object.keys(gameState.players).length;

    if (playerCount >= 2) {
        return {
            state,
            accept: false,
            rejectMessage: "Match is full"
        };
    }

    const symbol = playerCount === 0 ? "X" : "O";
    gameState.players[presence.userId] = symbol;

    return {
        state: gameState as nkruntime.MatchState,
        accept: true
    };
};

let matchJoin: nkruntime.MatchJoinFunction = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, presences: nkruntime.Presence[]): {state: nkruntime.MatchState} | null {
    const gameState = state as any as GameState;

    presences.forEach(presence => {
        dispatcher.broadcastMessage(1, JSON.stringify({
            type: "player_joined",
            userId: presence.userId,
            symbol: gameState.players[presence.userId],
            state: gameState
        }));
    });

    if (Object.keys(gameState.players).length === 2) {
        dispatcher.broadcastMessage(2, JSON.stringify({
            type: "game_start",
            state: gameState
        }));
    }

    return { state: gameState as nkruntime.MatchState };
};

let matchLeave: nkruntime.MatchLeaveFunction = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, presences: nkruntime.Presence[]): {state: nkruntime.MatchState} | null {
    const gameState = state as any as GameState;

    presences.forEach(presence => {
        if (!gameState.gameOver) {
            gameState.gameOver = true;
            const remainingPlayer = Object.keys(gameState.players).find(id => id !== presence.userId);
            if (remainingPlayer) {
                gameState.winner = gameState.players[remainingPlayer];
            }

            dispatcher.broadcastMessage(3, JSON.stringify({
                type: "player_left",
                userId: presence.userId,
                state: gameState
            }));
        }
    });

    return { state: gameState as nkruntime.MatchState };
};

let matchLoop: nkruntime.MatchLoopFunction = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, messages: nkruntime.MatchMessage[]): {state: nkruntime.MatchState} | null {
    const gameState = state as any as GameState;

    if (gameState.mode === "timed" && !gameState.gameOver && Object.keys(gameState.players).length === 2) {
        const elapsed = Date.now() - gameState.turnStartTime;
        if (elapsed > gameState.timeLimit) {
            const currentPlayerId = Object.keys(gameState.players).find(id => gameState.players[id] === gameState.currentPlayer);
            const otherPlayerId = Object.keys(gameState.players).find(id => gameState.players[id] !== gameState.currentPlayer);

            if (otherPlayerId) {
                gameState.winner = gameState.players[otherPlayerId];
                gameState.gameOver = true;

                dispatcher.broadcastMessage(4, JSON.stringify({
                    type: "timeout",
                    userId: currentPlayerId,
                    state: gameState
                }));
            }
        }
    }

    messages.forEach(message => {
        const data = JSON.parse(nk.binaryToString(message.data));

        if (data.type === "move") {
            const userId = message.sender.userId;

            if (gameState.gameOver) {
                return;
            }

            if (gameState.players[userId] !== gameState.currentPlayer) {
                return;
            }

            const position = data.position;
            if (position < 0 || position > 8 || gameState.board[position] !== "") {
                return;
            }

            if (gameState.mode === "timed") {
                const elapsed = Date.now() - gameState.turnStartTime;
                if (elapsed > gameState.timeLimit) {
                    return;
                }
            }

            gameState.board[position] = gameState.currentPlayer;

            const winner = checkWinner(gameState.board);
            if (winner) {
                gameState.winner = winner;
                gameState.gameOver = true;
                updateLeaderboard(nk, logger, gameState);
            } else if (gameState.board.every((cell: string) => cell !== "")) {
                gameState.gameOver = true;
                gameState.winner = "draw";
                updateLeaderboard(nk, logger, gameState);
            } else {
                gameState.currentPlayer = gameState.currentPlayer === "X" ? "O" : "X";
                gameState.turnStartTime = Date.now();
            }

            dispatcher.broadcastMessage(5, JSON.stringify({
                type: "move_made",
                position,
                state: gameState
            }));
        }
    });

    return { state: gameState as nkruntime.MatchState };
};

let matchTerminate: nkruntime.MatchTerminateFunction = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, graceSeconds: number): {state: nkruntime.MatchState} | null {
    return { state };
};

let matchSignal: nkruntime.MatchSignalFunction = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, data: string): {state: nkruntime.MatchState, data?: string} | null {
    return { state };
};

function updateLeaderboard(nk: nkruntime.Nakama, logger: nkruntime.Logger, state: GameState): void {
    if (state.winner === "draw") {
        return;
    }

    const winnerUserId = Object.keys(state.players).find(id => state.players[id] === state.winner);
    const loserUserId = Object.keys(state.players).find(id => state.players[id] !== state.winner);

    if (!winnerUserId || !loserUserId) {
        return;
    }

    try {
        const winnerAccount = nk.accountGetId(winnerUserId);
        const loserAccount = nk.accountGetId(loserUserId);

        const winnerData = getPlayerStats(nk, winnerUserId);
        const loserData = getPlayerStats(nk, loserUserId);

        winnerData.wins += 1;
        winnerData.winStreak += 1;
        if (winnerData.winStreak > winnerData.maxWinStreak) {
            winnerData.maxWinStreak = winnerData.winStreak;
        }
        winnerData.username = winnerAccount.user?.username || "Player";

        loserData.losses += 1;
        loserData.winStreak = 0;
        loserData.username = loserAccount.user?.username || "Player";

        savePlayerStats(nk, winnerUserId, winnerData);
        savePlayerStats(nk, loserUserId, loserData);

        const winnerScore = calculateScore(winnerData);
        const loserScore = calculateScore(loserData);

        nk.leaderboardRecordWrite(LEADERBOARD_ID, winnerUserId, winnerAccount.user?.username || "Player", winnerScore, 0);
        nk.leaderboardRecordWrite(LEADERBOARD_ID, loserUserId, loserAccount.user?.username || "Player", loserScore, 0);
    } catch (error) {
        logger.error("Error updating leaderboard: " + error);
    }
}

function getPlayerStats(nk: nkruntime.Nakama, userId: string): LeaderboardEntry {
    try {
        const objects = nk.storageRead([{
            collection: COLLECTION_NAME,
            key: "stats",
            userId: userId
        }]);

        if (objects.length > 0 && objects[0].value) {
            const valueObj = objects[0].value as any;
            if (typeof valueObj === 'string') {
                return JSON.parse(valueObj);
            } else if (valueObj.userId) {
                return valueObj as LeaderboardEntry;
            }
        }
    } catch (error) {
    }

    return {
        userId,
        username: "Player",
        wins: 0,
        losses: 0,
        winStreak: 0,
        maxWinStreak: 0
    };
}

function savePlayerStats(nk: nkruntime.Nakama, userId: string, data: LeaderboardEntry): void {
    nk.storageWrite([{
        collection: COLLECTION_NAME,
        key: "stats",
        userId: userId,
        value: data as any,
        permissionRead: 2,
        permissionWrite: 1
    }]);
}

function calculateScore(data: LeaderboardEntry): number {
    return (data.wins * 3) + (data.maxWinStreak * 10) - (data.losses * 1);
}

let rpcGetLeaderboard: nkruntime.RpcFunction = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    try {
        const limit = 100;
        const records = nk.leaderboardRecordsList(LEADERBOARD_ID, [], limit);

        const leaderboard = records.records?.map((record, index) => {
            const stats = getPlayerStats(nk, record.ownerId);
            return {
                rank: index + 1,
                username: record.username,
                score: record.score,
                wins: stats.wins,
                losses: stats.losses,
                winStreak: stats.winStreak,
                maxWinStreak: stats.maxWinStreak
            };
        }) || [];

        return JSON.stringify({ leaderboard });
    } catch (error) {
        logger.error("Error fetching leaderboard: " + error);
        return JSON.stringify({ leaderboard: [] });
    }
};

let rpcGetPlayerStats: nkruntime.RpcFunction = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    const userId = ctx.userId || "";
    const stats = getPlayerStats(nk, userId);
    return JSON.stringify({ stats });
};

function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, initializer: nkruntime.Initializer) {
    initializer.registerRpc("initialize_game", rpcInitializeGame);
    initializer.registerRpc("make_move", rpcMakeMove);
    initializer.registerRpc("get_leaderboard", rpcGetLeaderboard);
    initializer.registerRpc("get_player_stats", rpcGetPlayerStats);

    initializer.registerMatchmakerMatched(matchmakerMatched);

    initializer.registerMatch("tictactoe", {
        matchInit,
        matchJoinAttempt,
        matchJoin,
        matchLeave,
        matchLoop,
        matchTerminate,
        matchSignal
    });

    try {
        nk.leaderboardCreate(LEADERBOARD_ID, false, nkruntime.SortOrder.DESCENDING, nkruntime.Operator.BEST, "", {});
    } catch (error) {
        logger.info("Leaderboard already exists");
    }

    logger.info("Tic-Tac-Toe module loaded");
}