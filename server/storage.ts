import {
  User, InsertUser, users,
  Player, InsertPlayer, players,
  Team, InsertTeam, teams,
  Match, InsertMatch, matches,
  Tournament, InsertTournament, tournaments
} from "@shared/schema";

import { db } from "./db";
import { eq, and, or, ne, desc, not } from "drizzle-orm";
import Database from 'better-sqlite3';
import path from 'path';
import memoryStore from 'memorystore';
import session from 'express-session';

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
  getAllPlayersAdmin(): Promise<Player[]>;  // For admin interface - includes deleted players
  getAvailablePlayers(): Promise<Player[]>;
  createPlayer(player: InsertPlayer): Promise<Player>;
  updatePlayerAvailability(id: number, isAvailable: boolean): Promise<Player | undefined>;
  
  // Team operations
  getTeam(id: number): Promise<Team | undefined>;
  getAllTeams(): Promise<Team[]>;
  getTeamsByTournament(tournamentId: number): Promise<Team[]>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: number, team: Partial<InsertTeam>): Promise<Team | undefined>;
  deleteTeam(id: number): Promise<boolean>;
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
  getAllTournaments(includeArchived?: boolean): Promise<Tournament[]>;
  getArchivedTournaments(): Promise<Tournament[]>;
  createTournament(tournament: InsertTournament): Promise<Tournament>;
  updateTournament(id: number, tournament: Partial<InsertTournament>): Promise<Tournament | undefined>;
  deactivateOtherTournaments(activeId: number): Promise<void>;
  
  // Bracket operations
  generateBracket(tournamentId: number): Promise<Match[]>;
  updateBracket(tournamentId: number): Promise<Match[]>;
  
  // Session store
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  
  constructor() {
    // Create an in-memory session store
    const MemoryStore = memoryStore(session);
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
  }
  
  //
  // User operations
  //
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  
  //
  // Player operations
  //
  async getPlayer(id: number): Promise<Player | undefined> {
    const [player] = await db.select().from(players).where(eq(players.id, id));
    return player;
  }
  
  async getPlayerByName(firstName: string, lastName: string): Promise<Player | undefined> {
    const [player] = await db.select().from(players).where(
      and(
        eq(players.firstName, firstName),
        eq(players.lastName, lastName)
      )
    );
    return player;
  }
  
  async getAllPlayers(): Promise<Player[]> {
    // Return all active players (not deleted)
    return db.select().from(players).where(not(eq(players.isAvailable, false)));
  }
  
  async getAllPlayersAdmin(): Promise<Player[]> {
    // For admin interface, return ALL players including those marked as deleted
    return db.select().from(players);
  }
  
  async getAvailablePlayers(): Promise<Player[]> {
    return db.select().from(players).where(eq(players.isAvailable, true));
  }
  
  async createPlayer(insertPlayer: InsertPlayer): Promise<Player> {
    const [player] = await db.insert(players).values(insertPlayer).returning();
    return player;
  }
  
  async updatePlayerAvailability(id: number, isAvailable: boolean): Promise<Player | undefined> {
    const [updatedPlayer] = await db
      .update(players)
      .set({ isAvailable })
      .where(eq(players.id, id))
      .returning();
    return updatedPlayer;
  }
  
  //
  // Team operations
  //
  async getTeam(id: number): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team;
  }
  
  async getAllTeams(): Promise<Team[]> {
    return db.select().from(teams);
  }
  
  async getTeamsByTournament(tournamentId: number): Promise<Team[]> {
    // In a real app, we would have a teams_tournaments table for this relationship
    // For now, we'll just return all teams since we only have one tournament
    return this.getAllTeams();
  }
  
  async createTeam(insertTeam: InsertTeam): Promise<Team> {
    const [team] = await db.insert(teams).values(insertTeam).returning();
    return team;
  }
  
  async updateTeam(id: number, teamUpdates: Partial<InsertTeam>): Promise<Team | undefined> {
    const [updatedTeam] = await db
      .update(teams)
      .set(teamUpdates)
      .where(eq(teams.id, id))
      .returning();
    return updatedTeam;
  }
  
  async deleteTeam(id: number): Promise<boolean> {
    try {
      // Get the team first to find associated players
      const team = await this.getTeam(id);
      if (!team) {
        return false;
      }
      
      // First update any match references to this team
      // Find all matches where this team is team1 or team2
      await db
        .update(matches)
        .set({ team1Id: null })
        .where(eq(matches.team1Id, id))
        .execute();
      
      await db
        .update(matches)
        .set({ team2Id: null })
        .where(eq(matches.team2Id, id))
        .execute();
      
      // Also clear winner references
      await db
        .update(matches)
        .set({ winnerId: null })
        .where(eq(matches.winnerId, id))
        .execute();
      
      // Mark the players as available again
      if (team.player1Id) {
        await this.updatePlayerAvailability(team.player1Id, true);
      }
      
      if (team.player2Id) {
        await this.updatePlayerAvailability(team.player2Id, true);
      }
      
      // Delete the team
      await db.delete(teams).where(eq(teams.id, id));
      
      return true;
    } catch (error) {
      console.error("Error deleting team:", error);
      return false;
    }
  }
  
  async getTeamsWaitingForTeammate(): Promise<Team[]> {
    return db.select().from(teams).where(eq(teams.waitingForTeammate, true));
  }
  
  async getTeamByPlayer(playerId: number): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(
      or(
        eq(teams.player1Id, playerId),
        eq(teams.player2Id, playerId)
      )
    );
    return team;
  }
  
  //
  // Match operations
  //
  async getMatch(id: number): Promise<Match | undefined> {
    const [match] = await db.select().from(matches).where(eq(matches.id, id));
    return match;
  }
  
  async getAllMatches(): Promise<Match[]> {
    return db.select().from(matches);
  }
  
  async getMatchesByTournament(tournamentId: number): Promise<Match[]> {
    return db
      .select()
      .from(matches)
      .where(eq(matches.tournamentId, tournamentId));
  }
  
  async getMatchesByRound(tournamentId: number, round: number): Promise<Match[]> {
    return db
      .select()
      .from(matches)
      .where(
        and(
          eq(matches.tournamentId, tournamentId),
          eq(matches.round, round)
        )
      );
  }
  
  async createMatch(insertMatch: InsertMatch): Promise<Match> {
    const [match] = await db.insert(matches).values(insertMatch).returning();
    return match;
  }
  
  async updateMatch(id: number, matchUpdates: Partial<InsertMatch>): Promise<Match | undefined> {
    const [updatedMatch] = await db
      .update(matches)
      .set(matchUpdates)
      .where(eq(matches.id, id))
      .returning();
    return updatedMatch;
  }
  
  //
  // Tournament operations
  //
  async getTournament(id: number): Promise<Tournament | undefined> {
    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, id));
    return tournament;
  }
  
  async getActiveTournament(): Promise<Tournament | undefined> {
    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.isActive, true));
    return tournament;
  }
  
  async getAllTournaments(includeArchived: boolean = false): Promise<Tournament[]> {
    if (includeArchived) {
      return await db.select().from(tournaments).orderBy(desc(tournaments.year), desc(tournaments.createdAt));
    } else {
      return await db.select().from(tournaments).where(eq(tournaments.isArchived, false)).orderBy(desc(tournaments.year), desc(tournaments.createdAt));
    }
  }
  
  async getArchivedTournaments(): Promise<Tournament[]> {
    return await db.select().from(tournaments).where(eq(tournaments.isArchived, true)).orderBy(desc(tournaments.year), desc(tournaments.createdAt));
  }
  
  async createTournament(insertTournament: InsertTournament): Promise<Tournament> {
    // If this tournament is active, deactivate all other tournaments
    if (insertTournament.isActive) {
      await db.update(tournaments).set({ isActive: false }).where(ne(tournaments.id, 0));
    }
    
    const [tournament] = await db
      .insert(tournaments)
      .values(insertTournament)
      .returning();
    return tournament;
  }
  
  async updateTournament(id: number, tournamentUpdates: Partial<InsertTournament>): Promise<Tournament | undefined> {
    const [updatedTournament] = await db
      .update(tournaments)
      .set(tournamentUpdates)
      .where(eq(tournaments.id, id))
      .returning();
    return updatedTournament;
  }
  
  async deactivateOtherTournaments(activeId: number): Promise<void> {
    await db
      .update(tournaments)
      .set({ isActive: false })
      .where(ne(tournaments.id, activeId));
  }
  
  //
  // Bracket operations
  //
  async generateBracket(tournamentId: number): Promise<Match[]> {
    // Clear existing matches for this tournament
    await db
      .delete(matches)
      .where(eq(matches.tournamentId, tournamentId));
    
    // Get tournament and teams
    const tournament = await this.getTournament(tournamentId);
    if (!tournament) {
      throw new Error("Tournament not found");
    }
    
    const teams = await this.getTeamsByTournament(tournamentId);
    
    // Sort teams by creation date (first come, first served seeding)
    teams.sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      // Parse dates as ISO strings for SQLite (stored as TEXT)
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);
      return dateA.getTime() - dateB.getTime();
    });
    
    // Calculate the number of rounds needed
    const numberOfTeams = teams.length;
    const numberOfRounds = Math.ceil(Math.log2(Math.max(numberOfTeams, 2)));
    
    // Create all matches (empty bracket)
    const createdMatches: Match[] = [];
    
    for (let round = numberOfRounds; round >= 1; round--) {
      const matchesInRound = Math.pow(2, round - 1);
      
      for (let matchNumber = 1; matchNumber <= matchesInRound; matchNumber++) {
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
        createdMatches.push(match);
      }
    }
    
    // Set nextMatchId for all matches except the final
    for (const match of createdMatches) {
      if (match.round < numberOfRounds) {
        const nextRound = match.round + 1;
        const nextMatchNumber = Math.ceil(match.matchNumber / 2);
        
        // Find the next match
        const nextMatch = createdMatches.find(m => 
          m.round === nextRound && m.matchNumber === nextMatchNumber
        );
        
        if (nextMatch) {
          await this.updateMatch(match.id, { nextMatchId: nextMatch.id });
        }
      }
    }
    
    // Get updated matches with nextMatchId set
    const updatedMatches = await this.getMatchesByTournament(tournamentId);
    
    // Assign teams to first-round matches
    const firstRoundMatches = updatedMatches.filter(match => match.round === 1);
    const assignedMatchIds = new Set<number>();
    
    // Assign teams to matches
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      
      if (i % 2 === 0) {
        // Even index: Assign to team1Id
        const matchIndex = Math.floor(i / 2);
        if (matchIndex < firstRoundMatches.length) {
          const match = firstRoundMatches[matchIndex];
          await this.updateMatch(match.id, { team1Id: team.id });
          assignedMatchIds.add(match.id);
        }
      } else {
        // Odd index: Assign to team2Id
        const matchIndex = Math.floor((i - 1) / 2);
        if (matchIndex < firstRoundMatches.length) {
          const match = firstRoundMatches[matchIndex];
          await this.updateMatch(match.id, { team2Id: team.id });
          assignedMatchIds.add(match.id);
        }
      }
    }
    
    // Handle byes (if odd number of teams) - team1 gets a bye
    for (const match of firstRoundMatches) {
      if (!assignedMatchIds.has(match.id)) {
        if (match.team1Id && !match.team2Id) {
          // Team 1 gets a bye - automatically advances
          await this.updateMatch(match.id, { winnerId: match.team1Id });
          
          // If there's a next match, update it
          if (match.nextMatchId) {
            const nextMatch = await this.getMatch(match.nextMatchId);
            if (nextMatch) {
              if (!nextMatch.team1Id) {
                await this.updateMatch(nextMatch.id, { team1Id: match.team1Id });
              } else if (!nextMatch.team2Id) {
                await this.updateMatch(nextMatch.id, { team2Id: match.team1Id });
              }
            }
          }
        }
      }
    }
    
    // Return all matches for this tournament
    return this.getMatchesByTournament(tournamentId);
  }
  
  async updateBracket(tournamentId: number): Promise<Match[]> {
    const matches = await this.getMatchesByTournament(tournamentId);
    
    // Process matches with winners, starting from round 1
    for (let round = 1; round <= 10; round++) {
      const roundMatches = matches.filter(match => match.round === round);
      
      for (const match of roundMatches) {
        if (match.winnerId && match.nextMatchId) {
          const nextMatch = matches.find(m => m.id === match.nextMatchId);
          
          if (nextMatch) {
            // Place winner in the next match
            if (!nextMatch.team1Id) {
              await this.updateMatch(nextMatch.id, { team1Id: match.winnerId });
            } else if (!nextMatch.team2Id) {
              await this.updateMatch(nextMatch.id, { team2Id: match.winnerId });
            } else if (nextMatch.team1Id === match.winnerId || nextMatch.team2Id === match.winnerId) {
              // Winner is already in the next match (this can happen if we update a previous match)
              // Do nothing
            } else {
              // This shouldn't happen, but log it if it does
              console.error("Both spots in next match are already filled");
            }
          }
        }
      }
    }
    
    return matches;
  }
}

// Initialize with admin user
async function initializeDatabase() {
  // Check if admin user exists
  const storage = new DatabaseStorage();
  const adminUser = await storage.getUserByUsername("admin");
  
  if (!adminUser) {
    // Create default admin user
    await storage.createUser({
      username: "admin",
      password: "admin",
      isAdmin: true
    });
  }
}

// Create a database storage instance
export const storage = new DatabaseStorage();

// Initialize the database with admin user
initializeDatabase().catch(err => {
  console.error("Error initializing database:", err);
});