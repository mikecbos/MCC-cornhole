import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertPlayerSchema,
  insertTeamSchema,
  insertMatchSchema,
  insertTournamentSchema,
  teamNameSuggestionSchema
} from "@shared/schema";
import { generateTeamNames } from "./openai";

export async function registerRoutes(app: Express): Promise<Server> {
  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Player routes
  app.get("/api/players", async (req, res) => {
    const players = await storage.getAllPlayers();
    res.json(players);
  });

  app.get("/api/players/available", async (req, res) => {
    const players = await storage.getAvailablePlayers();
    res.json(players);
  });

  app.post("/api/players", async (req, res) => {
    try {
      const validatedData = insertPlayerSchema.parse(req.body);
      
      // Check if player already exists
      const existingPlayer = await storage.getPlayerByName(
        validatedData.firstName,
        validatedData.lastName
      );
      
      if (existingPlayer) {
        return res.status(400).json({
          message: "A player with this name already exists."
        });
      }
      
      const player = await storage.createPlayer(validatedData);
      res.status(201).json(player);
    } catch (error) {
      res.status(400).json({ 
        message: error.message || "Invalid player data"
      });
    }
  });

  // Team routes
  app.get("/api/teams", async (req, res) => {
    const teams = await storage.getAllTeams();
    res.json(teams);
  });

  app.delete("/api/teams/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid team ID" });
      }

      const team = await storage.getTeam(id);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }

      // Check for admin/authentication in a real app
      const success = await storage.deleteTeam(id);
      
      if (success) {
        // Regenerate bracket
        const tournament = await storage.getActiveTournament();
        if (tournament) {
          await storage.generateBracket(tournament.id);
        }
        
        res.json({ success: true });
      } else {
        res.status(500).json({ message: "Failed to delete team" });
      }
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Server error" 
      });
    }
  });

  app.post("/api/teams", async (req, res) => {
    try {
      const validatedData = insertTeamSchema.parse(req.body);
      
      // Check if player1 is already in a team
      const player1Team = await storage.getTeamByPlayer(validatedData.player1Id);
      if (player1Team) {
        return res.status(400).json({
          message: "The registerer is already part of a team."
        });
      }
      
      // Check if player2 is already in a team (if specified)
      if (validatedData.player2Id) {
        const player2Team = await storage.getTeamByPlayer(validatedData.player2Id);
        if (player2Team) {
          return res.status(400).json({
            message: "The teammate is already part of a team."
          });
        }
      }
      
      // Mark player1 as unavailable
      const player1 = await storage.getPlayer(validatedData.player1Id);
      if (player1) {
        await storage.updatePlayerAvailability(player1.id, false);
      }
      
      // If player2 is specified, mark them as unavailable as well
      if (validatedData.player2Id) {
        const player2 = await storage.getPlayer(validatedData.player2Id);
        if (player2) {
          await storage.updatePlayerAvailability(player2.id, false);
        }
      }
      
      // Create the team
      const team = await storage.createTeam(validatedData);
      
      // If no active tournament, create one
      let tournament = await storage.getActiveTournament();
      if (!tournament) {
        tournament = await storage.createTournament({
          name: "Summer Cornhole Championship",
          maxTeams: 16,
          isActive: true
        });
      }
      
      // Regenerate bracket with new team
      await storage.generateBracket(tournament.id);
      
      res.status(201).json(team);
    } catch (error) {
      res.status(400).json({ 
        message: error.message || "Invalid team data"
      });
    }
  });

  app.get("/api/teams/waiting", async (req, res) => {
    const teams = await storage.getTeamsWaitingForTeammate();
    res.json(teams);
  });

  // Tournament routes
  app.get("/api/tournaments", async (req, res) => {
    const tournaments = await storage.getAllTournaments();
    res.json(tournaments);
  });

  app.get("/api/tournaments/active", async (req, res) => {
    const tournament = await storage.getActiveTournament();
    if (!tournament) {
      return res.status(404).json({ message: "No active tournament found" });
    }
    res.json(tournament);
  });

  // Bracket routes
  app.get("/api/brackets/:tournamentId", async (req, res) => {
    try {
      const tournamentId = parseInt(req.params.tournamentId);
      if (isNaN(tournamentId)) {
        return res.status(400).json({ message: "Invalid tournament ID" });
      }
      
      const tournament = await storage.getTournament(tournamentId);
      if (!tournament) {
        return res.status(404).json({ message: "Tournament not found" });
      }
      
      const matches = await storage.getMatchesByTournament(tournamentId);
      res.json(matches);
    } catch (error) {
      res.status(500).json({ message: error.message || "Server error" });
    }
  });

  app.post("/api/brackets/:tournamentId/generate", async (req, res) => {
    try {
      const tournamentId = parseInt(req.params.tournamentId);
      if (isNaN(tournamentId)) {
        return res.status(400).json({ message: "Invalid tournament ID" });
      }
      
      const tournament = await storage.getTournament(tournamentId);
      if (!tournament) {
        return res.status(404).json({ message: "Tournament not found" });
      }
      
      const matches = await storage.generateBracket(tournamentId);
      res.json(matches);
    } catch (error) {
      res.status(500).json({ message: error.message || "Server error" });
    }
  });

  app.put("/api/matches/:matchId", async (req, res) => {
    try {
      const matchId = parseInt(req.params.matchId);
      if (isNaN(matchId)) {
        return res.status(400).json({ message: "Invalid match ID" });
      }
      
      const match = await storage.getMatch(matchId);
      if (!match) {
        return res.status(404).json({ message: "Match not found" });
      }
      
      const validatedData = insertMatchSchema.partial().parse(req.body);
      const updatedMatch = await storage.updateMatch(matchId, validatedData);
      
      // If winner is updated, update bracket
      if (validatedData.winnerId) {
        await storage.updateBracket(match.tournamentId);
      }
      
      res.json(updatedMatch);
    } catch (error) {
      res.status(400).json({ message: error.message || "Invalid match data" });
    }
  });

  // Team name suggestions
  app.post("/api/team-name-suggestions", async (req, res) => {
    try {
      const validatedData = teamNameSuggestionSchema.parse(req.body);
      
      // Generate team names using OpenAI
      const names = await generateTeamNames(
        validatedData.firstName,
        validatedData.lastName,
        validatedData.teammateFirstName,
        validatedData.teammateLastName
      );
      
      res.json({ suggestions: names });
    } catch (error) {
      res.status(400).json({ 
        message: error.message || "Error generating team name suggestions",
        suggestions: [] 
      });
    }
  });

  // Admin routes - in a real app, add authentication middleware
  app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body;
    
    // For demo purposes, using simple admin/admin credentials
    if (username === "admin" && password === "admin") {
      res.json({ success: true, isAdmin: true });
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
