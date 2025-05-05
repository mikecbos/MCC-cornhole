import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").default(false),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  isAdmin: true,
});

// Player schema for tournament participants
export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  isAvailable: boolean("is_available").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPlayerSchema = createInsertSchema(players).pick({
  firstName: true,
  lastName: true,
  isAvailable: true,
});

// Team schema for tournament teams
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  player1Id: integer("player1_id").notNull().references(() => players.id),
  player2Id: integer("player2_id").references(() => players.id),
  seedNumber: integer("seed_number"),
  createdAt: timestamp("created_at").defaultNow(),
  waitingForTeammate: boolean("waiting_for_teammate").default(false),
});

export const insertTeamSchema = createInsertSchema(teams).pick({
  name: true,
  player1Id: true, 
  player2Id: true,
  seedNumber: true,
  waitingForTeammate: true,
});

// Match schema for tournament brackets
export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull(),
  round: integer("round").notNull(),
  matchNumber: integer("match_number").notNull(),
  team1Id: integer("team1_id").references(() => teams.id),
  team2Id: integer("team2_id").references(() => teams.id),
  winnerId: integer("winner_id").references(() => teams.id),
  nextMatchId: integer("next_match_id").references(() => matches.id),
});

export const insertMatchSchema = createInsertSchema(matches).pick({
  tournamentId: true,
  round: true,
  matchNumber: true,
  team1Id: true,
  team2Id: true,
  winnerId: true,
  nextMatchId: true,
});

// Tournament schema
export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  maxTeams: integer("max_teams").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTournamentSchema = createInsertSchema(tournaments).pick({
  name: true,
  maxTeams: true,
  isActive: true,
});

// Team name suggestion request schema
export const teamNameSuggestionSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  teammateFirstName: z.string().optional(),
  teammateLastName: z.string().optional(),
});

// Export types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof players.$inferSelect;

export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teams.$inferSelect;

export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matches.$inferSelect;

export type InsertTournament = z.infer<typeof insertTournamentSchema>;
export type Tournament = typeof tournaments.$inferSelect;

export type TeamNameSuggestionRequest = z.infer<typeof teamNameSuggestionSchema>;
