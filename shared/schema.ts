import { sqliteTable, text, integer, blob } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema for authentication
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: integer("is_admin", { mode: "boolean" }).default(false),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  isAdmin: true,
});

// Player schema for tournament participants
export const players = sqliteTable("players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  isAvailable: integer("is_available", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertPlayerSchema = createInsertSchema(players).pick({
  firstName: true,
  lastName: true,
  isAvailable: true,
});

// Team schema for tournament teams
export const teams = sqliteTable("teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  player1Id: integer("player1_id").notNull().references(() => players.id),
  player2Id: integer("player2_id").references(() => players.id),
  seedNumber: integer("seed_number"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  waitingForTeammate: integer("waiting_for_teammate", { mode: "boolean" }).default(false),
});

export const insertTeamSchema = createInsertSchema(teams).pick({
  name: true,
  player1Id: true, 
  player2Id: true,
  seedNumber: true,
  waitingForTeammate: true,
});

// Match schema for tournament brackets
export const matches = sqliteTable("matches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tournamentId: integer("tournament_id").notNull(),
  round: integer("round").notNull(),
  matchNumber: integer("match_number").notNull(),
  team1Id: integer("team1_id").references(() => teams.id),
  team2Id: integer("team2_id").references(() => teams.id),
  winnerId: integer("winner_id").references(() => teams.id),
  nextMatchId: integer("next_match_id").references(() => matches.id),
  
  // Score tracking
  team1Score: integer("team1_score"),
  team2Score: integer("team2_score"),
  
  // Match status and scheduling
  matchStatus: text("match_status").default("pending"), // pending, in_progress, completed
  scheduledTime: text("scheduled_time"),
  completedTime: text("completed_time"),
  
  // Note/comments about the match
  notes: text("notes"),
});

export const insertMatchSchema = createInsertSchema(matches).pick({
  tournamentId: true,
  round: true,
  matchNumber: true,
  team1Id: true,
  team2Id: true,
  winnerId: true,
  nextMatchId: true,
  team1Score: true,
  team2Score: true,
  matchStatus: true,
  scheduledTime: true,
  completedTime: true,
  notes: true,
});

// Tournament schema
export const tournaments = sqliteTable("tournaments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  maxTeams: integer("max_teams").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  isArchived: integer("is_archived", { mode: "boolean" }).default(false),
  season: text("season"),
  year: integer("year").default(new Date().getFullYear()),
  registrationOpen: integer("registration_open", { mode: "boolean" }).default(true),
  tournamentStatus: text("tournament_status").default("registration"), // registration, in_progress, completed
  startDate: text("start_date"),
  endDate: text("end_date"),
  bracketType: text("bracket_type").default("single"), // single or double elimination
  primaryColor: text("primary_color").default("#4f46e5"), // Custom theme color
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertTournamentSchema = createInsertSchema(tournaments).pick({
  name: true,
  description: true,
  maxTeams: true,
  isActive: true,
  isArchived: true,
  season: true,
  year: true,
  registrationOpen: true,
  tournamentStatus: true,
  startDate: true,
  endDate: true,
  bracketType: true,
  primaryColor: true,
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
