import { Match, Team, Player } from "@shared/schema";

export interface MatchDisplay {
  id: number;
  round: number;
  matchNumber: number;
  team1?: TeamDisplay;
  team2?: TeamDisplay;
  winnerId?: number;
  nextMatchId?: number;
}

export interface TeamDisplay {
  id: number;
  name: string;
  players: string[];
  seedNumber?: number;
}

// Function to convert raw match data to display format with team details
export const prepareMatchesForDisplay = (
  matches: Match[], 
  teams: Team[], 
  players: Player[]
): MatchDisplay[] => {
  return matches.map(match => {
    const team1 = match.team1Id ? teams.find(t => t.id === match.team1Id) : undefined;
    const team2 = match.team2Id ? teams.find(t => t.id === match.team2Id) : undefined;
    
    return {
      id: match.id,
      round: match.round,
      matchNumber: match.matchNumber,
      team1: team1 ? getTeamDisplay(team1, players) : undefined,
      team2: team2 ? getTeamDisplay(team2, players) : undefined,
      winnerId: match.winnerId,
      nextMatchId: match.nextMatchId
    };
  });
};

// Helper to create team display info
const getTeamDisplay = (team: Team, players: Player[]): TeamDisplay => {
  const player1 = players.find(p => p.id === team.player1Id);
  const player2 = players.find(p => p.id === team.player2Id);
  
  const playerNames: string[] = [];
  
  if (player1) {
    playerNames.push(`${player1.firstName} ${player1.lastName}`);
  }
  
  if (player2) {
    playerNames.push(`${player2.firstName} ${player2.lastName}`);
  }
  
  return {
    id: team.id,
    name: team.name,
    players: playerNames,
    seedNumber: team.seedNumber
  };
};

// Helper to generate empty rounds for a tournament bracket
export const generateEmptyBracket = (numberOfTeams: number) => {
  const rounds: number = Math.ceil(Math.log2(numberOfTeams));
  const bracket: MatchDisplay[] = [];
  
  for (let round = 1; round <= rounds; round++) {
    const matchesInRound = Math.pow(2, rounds - round);
    
    for (let matchNumber = 1; matchNumber <= matchesInRound; matchNumber++) {
      bracket.push({
        id: bracket.length + 1,
        round,
        matchNumber,
      });
    }
  }
  
  return bracket;
};
