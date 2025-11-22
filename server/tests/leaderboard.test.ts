import { describe, it, expect } from '@jest/globals';

interface LeaderboardEntry {
  userId: string;
  username: string;
  wins: number;
  losses: number;
  winStreak: number;
  maxWinStreak: number;
}

function calculateScore(data: LeaderboardEntry): number {
  return (data.wins * 3) + (data.maxWinStreak * 10) - (data.losses * 1);
}

function updatePlayerStats(
  stats: LeaderboardEntry,
  won: boolean
): LeaderboardEntry {
  const newStats = { ...stats };

  if (won) {
    newStats.wins += 1;
    newStats.winStreak += 1;
    if (newStats.winStreak > newStats.maxWinStreak) {
      newStats.maxWinStreak = newStats.winStreak;
    }
  } else {
    newStats.losses += 1;
    newStats.winStreak = 0;
  }

  return newStats;
}

describe('Leaderboard System', () => {
  it('should calculate score correctly', () => {
    const player: LeaderboardEntry = {
      userId: "player1",
      username: "TestPlayer",
      wins: 10,
      losses: 5,
      winStreak: 3,
      maxWinStreak: 5
    };

    const score = calculateScore(player);
    expect(score).toBe(75);
  });

  it('should update stats on win', () => {
    const player: LeaderboardEntry = {
      userId: "player1",
      username: "TestPlayer",
      wins: 5,
      losses: 2,
      winStreak: 2,
      maxWinStreak: 3
    };

    const updated = updatePlayerStats(player, true);
    expect(updated.wins).toBe(6);
    expect(updated.winStreak).toBe(3);
    expect(updated.maxWinStreak).toBe(3);
  });

  it('should update max win streak', () => {
    const player: LeaderboardEntry = {
      userId: "player1",
      username: "TestPlayer",
      wins: 5,
      losses: 2,
      winStreak: 3,
      maxWinStreak: 3
    };

    const updated = updatePlayerStats(player, true);
    expect(updated.winStreak).toBe(4);
    expect(updated.maxWinStreak).toBe(4);
  });

  it('should reset win streak on loss', () => {
    const player: LeaderboardEntry = {
      userId: "player1",
      username: "TestPlayer",
      wins: 5,
      losses: 2,
      winStreak: 3,
      maxWinStreak: 5
    };

    const updated = updatePlayerStats(player, false);
    expect(updated.losses).toBe(3);
    expect(updated.winStreak).toBe(0);
    expect(updated.maxWinStreak).toBe(5);
  });

  it('should sort leaderboard by score', () => {
    const players: LeaderboardEntry[] = [
      {
        userId: "p1",
        username: "Player1",
        wins: 5,
        losses: 2,
        winStreak: 1,
        maxWinStreak: 3
      },
      {
        userId: "p2",
        username: "Player2",
        wins: 10,
        losses: 1,
        winStreak: 5,
        maxWinStreak: 5
      },
      {
        userId: "p3",
        username: "Player3",
        wins: 3,
        losses: 5,
        winStreak: 0,
        maxWinStreak: 2
      }
    ];

    const sorted = players
      .map(p => ({ ...p, score: calculateScore(p) }))
      .sort((a, b) => b.score - a.score);

    expect(sorted[0].userId).toBe("p2");
    expect(sorted[1].userId).toBe("p1");
    expect(sorted[2].userId).toBe("p3");
  });
});
