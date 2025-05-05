import {
  User, InsertUser, users,
  Player, InsertPlayer, players,
  Team, InsertTeam, teams,
  Match, InsertMatch, matches,
  Tournament, InsertTournament, tournaments
} from "@shared/schema";

// Interface for all storage operations
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Player operations
  getPlayer(id: number): Promise<Player | undefined>;
  getPlayerByName(firstName: string, lastName: string): Promise<Player | undefined>;
  getAllPlayers(): Promise<Player[]>;
  getAvailablePlayers(): Promise<Player[]>;
  createPlayer(player: InsertPlayer): Promise<Player>;
  updatePlayerAvailability(id: number, isAvailable: boolean): Promise<Player | undefined>;
  
  // Team operations
  getTeam(id: number): Promise<Team | undefined>;
  getAllTeams(): Promise<Team[]>;
  getTeamsByTournament(tournamentId: number): Promise<Team[]>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: number, team: Partial<InsertTeam>): Promise<Team | undefined>;
  getTeamsWaitingForTeammate(): Promise<Team[]>;
  getTeamByPlayer(playerId: number): Promise<Team | undefined>;
  
  // Match operations
  getMatch(id: number): Promise<Match | undefined>;
  getAllMatches(): Promise<Match[]>;
  getMatchesByTournament(tournamentId: number): Promise<Match[]>;
  getMatchesByRound(tournamentId: number, round: number): Promise<Match[]>;
  createMatch(match: InsertMatch): Promise<Match>;
  updateMatch(id: number, match: Partial<InsertMatch>): Promise<Match | undefined>;
  
  // Tournament operations
  getTournament(id: number): Promise<Tournament | undefined>;
  getActiveTournament(): Promise<Tournament | undefined>;
  getAllTournaments(): Promise<Tournament[]>;
  createTournament(tournament: InsertTournament): Promise<Tournament>;
  updateTournament(id: number, tournament: Partial<InsertTournament>): Promise<Tournament | undefined>;
  
  // Bracket operations
  generateBracket(tournamentId: number): Promise<Match[]>;
  updateBracket(tournamentId: number): Promise<Match[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private players: Map<number, Player>;
  private teams: Map<number, Team>;
  private matches: Map<number, Match>;
  private tournaments: Map<number, Tournament>;
  
  private userCurrentId: number;
  private playerCurrentId: number;
  private teamCurrentId: number;
  private matchCurrentId: number;
  private tournamentCurrentId: number;

  constructor() {
    this.users = new Map();
    this.players = new Map();
    this.teams = new Map();
    this.matches = new Map();
    this.tournaments = new Map();
    
    this.userCurrentId = 1;
    this.playerCurrentId = 1;
    this.teamCurrentId = 1;
    this.matchCurrentId = 1;
    this.tournamentCurrentId = 1;

    // Create a default tournament
    this.createTournament({
      name: "Summer Cornhole Championship",
      maxTeams: 16,
      isActive: true
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Player operations
  async getPlayer(id: number): Promise<Player | undefined> {
    return this.players.get(id);
  }

  async getPlayerByName(firstName: string, lastName: string): Promise<Player | undefined> {
    return Array.from(this.players.values()).find(
      (player) => 
        player.firstName.toLowerCase() === firstName.toLowerCase() && 
        player.lastName.toLowerCase() === lastName.toLowerCase()
    );
  }

  async getAllPlayers(): Promise<Player[]> {
    return Array.from(this.players.values());
  }

  async getAvailablePlayers(): Promise<Player[]> {
    return Array.from(this.players.values()).filter(player => player.isAvailable);
  }

  async createPlayer(insertPlayer: InsertPlayer): Promise<Player> {
    const id = this.playerCurrentId++;
    const now = new Date();
    const player: Player = { ...insertPlayer, id, createdAt: now };
    this.players.set(id, player);
    return player;
  }

  async updatePlayerAvailability(id: number, isAvailable: boolean): Promise<Player | undefined> {
    const player = await this.getPlayer(id);
    if (!player) return undefined;
    
    const updatedPlayer = { ...player, isAvailable };
    this.players.set(id, updatedPlayer);
    return updatedPlayer;
  }

  // Team operations
  async getTeam(id: number): Promise<Team | undefined> {
    return this.teams.get(id);
  }

  async getAllTeams(): Promise<Team[]> {
    return Array.from(this.teams.values());
  }

  async getTeamsByTournament(tournamentId: number): Promise<Team[]> {
    // For memory storage, we don't have a direct tournament relation for teams
    // In a real DB, we would have this relation
    // For now, return all teams
    return this.getAllTeams();
  }

  async createTeam(insertTeam: InsertTeam): Promise<Team> {
    const id = this.teamCurrentId++;
    const now = new Date();
    const team: Team = { ...insertTeam, id, createdAt: now };
    this.teams.set(id, team);
    return team;
  }

  async updateTeam(id: number, teamUpdates: Partial<InsertTeam>): Promise<Team | undefined> {
    const team = await this.getTeam(id);
    if (!team) return undefined;
    
    const updatedTeam = { ...team, ...teamUpdates };
    this.teams.set(id, updatedTeam);
    return updatedTeam;
  }

  async getTeamsWaitingForTeammate(): Promise<Team[]> {
    return Array.from(this.teams.values()).filter(team => team.waitingForTeammate);
  }

  async getTeamByPlayer(playerId: number): Promise<Team | undefined> {
    return Array.from(this.teams.values()).find(
      (team) => team.player1Id === playerId || team.player2Id === playerId
    );
  }

  // Match operations
  async getMatch(id: number): Promise<Match | undefined> {
    return this.matches.get(id);
  }

  async getAllMatches(): Promise<Match[]> {
    return Array.from(this.matches.values());
  }

  async getMatchesByTournament(tournamentId: number): Promise<Match[]> {
    return Array.from(this.matches.values()).filter(
      match => match.tournamentId === tournamentId
    );
  }

  async getMatchesByRound(tournamentId: number, round: number): Promise<Match[]> {
    return Array.from(this.matches.values()).filter(
      match => match.tournamentId === tournamentId && match.round === round
    );
  }

  async createMatch(insertMatch: InsertMatch): Promise<Match> {
    const id = this.matchCurrentId++;
    const match: Match = { ...insertMatch, id };
    this.matches.set(id, match);
    return match;
  }

  async updateMatch(id: number, matchUpdates: Partial<InsertMatch>): Promise<Match | undefined> {
    const match = await this.getMatch(id);
    if (!match) return undefined;
    
    const updatedMatch = { ...match, ...matchUpdates };
    this.matches.set(id, updatedMatch);
    return updatedMatch;
  }

  // Tournament operations
  async getTournament(id: number): Promise<Tournament | undefined> {
    return this.tournaments.get(id);
  }

  async getActiveTournament(): Promise<Tournament | undefined> {
    return Array.from(this.tournaments.values()).find(
      tournament => tournament.isActive
    );
  }

  async getAllTournaments(): Promise<Tournament[]> {
    return Array.from(this.tournaments.values());
  }

  async createTournament(insertTournament: InsertTournament): Promise<Tournament> {
    const id = this.tournamentCurrentId++;
    const now = new Date();
    const tournament: Tournament = { ...insertTournament, id, createdAt: now };
    this.tournaments.set(id, tournament);
    return tournament;
  }

  async updateTournament(id: number, tournamentUpdates: Partial<InsertTournament>): Promise<Tournament | undefined> {
    const tournament = await this.getTournament(id);
    if (!tournament) return undefined;
    
    const updatedTournament = { ...tournament, ...tournamentUpdates };
    this.tournaments.set(id, updatedTournament);
    return updatedTournament;
  }

  // Bracket operations
  async generateBracket(tournamentId: number): Promise<Match[]> {
    // Clear existing matches for this tournament
    const existingMatches = await this.getMatchesByTournament(tournamentId);
    for (const match of existingMatches) {
      this.matches.delete(match.id);
    }
    
    const tournament = await this.getTournament(tournamentId);
    if (!tournament) throw new Error("Tournament not found");
    
    const teams = await this.getTeamsByTournament(tournamentId);
    const teamsCount = teams.length;
    
    if (teamsCount < 2) {
      return [];
    }
    
    // Determine number of rounds and matches
    const roundsCount = Math.ceil(Math.log2(teamsCount));
    const matchesCount = Math.pow(2, roundsCount) - 1;
    
    // Create empty matches structure
    let matches: Match[] = [];
    
    // Generate rounds from final to first
    for (let round = roundsCount; round >= 1; round--) {
      const matchesInRound = Math.pow(2, round - 1);
      
      for (let matchNumber = 1; matchNumber <= matchesInRound; matchNumber++) {
        // Create empty match
        const matchData: InsertMatch = {
          tournamentId,
          round,
          matchNumber,
          team1Id: null,
          team2Id: null,
          winnerId: null,
          nextMatchId: null
        };
        
        const match = await this.createMatch(matchData);
        matches.push(match);
        
        // If not final round, connect to next match
        if (round < roundsCount) {
          const nextRoundMatchIndex = Math.floor((matchNumber - 1) / 2);
          const nextRoundMatches = matches.filter(m => m.round === round + 1);
          const nextMatch = nextRoundMatches[nextRoundMatchIndex];
          
          // Update this match with next match ID
          await this.updateMatch(match.id, { nextMatchId: nextMatch.id });
          
          // Update the next match with team slots
          if (matchNumber % 2 === 1) {
            // Odd-numbered matches connect to team1Id
            await this.updateMatch(nextMatch.id, { team1Id: null });
          } else {
            // Even-numbered matches connect to team2Id
            await this.updateMatch(nextMatch.id, { team2Id: null });
          }
        }
      }
    }
    
    // Assign teams to first round
    const firstRoundMatches = matches.filter(m => m.round === 1);
    
    // Sort teams by seed if available
    const sortedTeams = teams
      .filter(team => team.player2Id !== null) // Only include complete teams
      .sort((a, b) => {
        // If both have seed numbers, sort by them
        if (a.seedNumber !== null && b.seedNumber !== null) {
          return a.seedNumber - b.seedNumber;
        }
        // Teams with seed number come first
        if (a.seedNumber !== null) return -1;
        if (b.seedNumber !== null) return 1;
        // Sort by creation time for teams without seed
        return a.createdAt.getTime() - b.createdAt.getTime();
      });
    
    // Place teams in first round matches
    // This implements a tournament seeding where 1 plays against the lowest seed, etc.
    const assignedMatches = [];
    
    for (let i = 0; i < Math.min(sortedTeams.length, firstRoundMatches.length * 2); i++) {
      const team = sortedTeams[i];
      const matchIndex = i % firstRoundMatches.length;
      const match = firstRoundMatches[matchIndex];
      
      if (!assignedMatches.includes(match.id)) {
        // First team assigned to this match
        await this.updateMatch(match.id, { team1Id: team.id });
        assignedMatches.push(match.id);
      } else {
        // Second team assigned to this match
        await this.updateMatch(match.id, { team2Id: team.id });
      }
    }
    
    // Return all matches for this tournament
    return this.getMatchesByTournament(tournamentId);
  }

  async updateBracket(tournamentId: number): Promise<Match[]> {
    // Get all matches for this tournament
    const matches = await this.getMatchesByTournament(tournamentId);
    
    // Start from the first round and propagate winners
    const rounds = [...new Set(matches.map(m => m.round))].sort();
    
    for (const round of rounds) {
      const roundMatches = matches.filter(m => m.round === round);
      
      // Update matches where winner is set
      for (const match of roundMatches) {
        if (match.winnerId && match.nextMatchId) {
          const nextMatch = matches.find(m => m.id === match.nextMatchId);
          if (!nextMatch) continue;
          
          // Place winner in the next match
          const isFirstTeam = roundMatches.findIndex(m => m.id === match.id) % 2 === 0;
          
          if (isFirstTeam) {
            await this.updateMatch(nextMatch.id, { team1Id: match.winnerId });
          } else {
            await this.updateMatch(nextMatch.id, { team2Id: match.winnerId });
          }
        }
      }
    }
    
    return this.getMatchesByTournament(tournamentId);
  }
}

export const storage = new MemStorage();
