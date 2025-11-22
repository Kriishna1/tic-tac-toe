import { describe, it, expect } from '@jest/globals';

interface MatchmakerTicket {
  ticket: string;
  mode: string;
}

interface Player {
  userId: string;
  ticket: MatchmakerTicket;
}

function matchPlayers(players: Player[]): Player[][] {
  const matches: Player[][] = [];
  const modeGroups: { [mode: string]: Player[] } = {};

  players.forEach(player => {
    const mode = player.ticket.mode;
    if (!modeGroups[mode]) {
      modeGroups[mode] = [];
    }
    modeGroups[mode].push(player);
  });

  Object.values(modeGroups).forEach(group => {
    for (let i = 0; i < group.length - 1; i += 2) {
      matches.push([group[i], group[i + 1]]);
    }
  });

  return matches;
}

describe('Matchmaking System', () => {
  it('should match two players in same mode', () => {
    const players: Player[] = [
      {
        userId: "player1",
        ticket: { ticket: "ticket1", mode: "classic" }
      },
      {
        userId: "player2",
        ticket: { ticket: "ticket2", mode: "classic" }
      }
    ];

    const matches = matchPlayers(players);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toHaveLength(2);
  });

  it('should not match players in different modes', () => {
    const players: Player[] = [
      {
        userId: "player1",
        ticket: { ticket: "ticket1", mode: "classic" }
      },
      {
        userId: "player2",
        ticket: { ticket: "ticket2", mode: "timed" }
      }
    ];

    const matches = matchPlayers(players);
    expect(matches).toHaveLength(0);
  });

  it('should match multiple pairs in same mode', () => {
    const players: Player[] = [
      {
        userId: "player1",
        ticket: { ticket: "ticket1", mode: "classic" }
      },
      {
        userId: "player2",
        ticket: { ticket: "ticket2", mode: "classic" }
      },
      {
        userId: "player3",
        ticket: { ticket: "ticket3", mode: "classic" }
      },
      {
        userId: "player4",
        ticket: { ticket: "ticket4", mode: "classic" }
      }
    ];

    const matches = matchPlayers(players);
    expect(matches).toHaveLength(2);
  });

  it('should handle odd number of players', () => {
    const players: Player[] = [
      {
        userId: "player1",
        ticket: { ticket: "ticket1", mode: "classic" }
      },
      {
        userId: "player2",
        ticket: { ticket: "ticket2", mode: "classic" }
      },
      {
        userId: "player3",
        ticket: { ticket: "ticket3", mode: "classic" }
      }
    ];

    const matches = matchPlayers(players);
    expect(matches).toHaveLength(1);
  });

  it('should match players across different modes', () => {
    const players: Player[] = [
      {
        userId: "player1",
        ticket: { ticket: "ticket1", mode: "classic" }
      },
      {
        userId: "player2",
        ticket: { ticket: "ticket2", mode: "classic" }
      },
      {
        userId: "player3",
        ticket: { ticket: "ticket3", mode: "timed" }
      },
      {
        userId: "player4",
        ticket: { ticket: "ticket4", mode: "timed" }
      }
    ];

    const matches = matchPlayers(players);
    expect(matches).toHaveLength(2);
  });
});
