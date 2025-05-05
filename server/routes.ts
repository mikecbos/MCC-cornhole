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
  
  // Admin-specific endpoint to get all players including deleted ones
  app.get("/api/admin/players", async (req, res) => {
    const players = await storage.getAllPlayersAdmin();
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
        // If player exists but is deleted (isAvailable = false), reactivate them instead of creating new
        if (existingPlayer.isAvailable === false) {
          const reactivatedPlayer = await storage.updatePlayerAvailability(existingPlayer.id, true);
          return res.status(200).json({
            ...reactivatedPlayer,
            message: "Player has been reactivated."
          });
        } else {
          // Player exists and is not deleted, so return error
          return res.status(400).json({
            message: "A player with this name already exists."
          });
        }
      }
      
      const player = await storage.createPlayer(validatedData);
      res.status(201).json(player);
    } catch (error) {
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Invalid player data"
      });
    }
  });
  
  app.delete("/api/players/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid player ID" });
      }

      const player = await storage.getPlayer(id);
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }

      // Check if player is part of a team
      const team = await storage.getTeamByPlayer(id);
      if (team) {
        // Delete team first if player is part of a team
        await storage.deleteTeam(team.id);
      }

      // Delete the player
      // Using the existing database structure, we're "deleting" by marking the player as unavailable
      // In a production app, you would implement a proper delete operation
      const success = await storage.updatePlayerAvailability(id, false);
      
      if (success) {
        // After successful "deletion", regenerate the bracket if there's an active tournament
        const tournament = await storage.getActiveTournament();
        if (tournament) {
          await storage.generateBracket(tournament.id);
        }
        
        res.json({ success: true });
      } else {
        res.status(500).json({ message: "Failed to delete player" });
      }
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Server error" 
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

  app.put("/api/teams/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid team ID" });
      }

      const team = await storage.getTeam(id);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }

      // Validate the request data
      const validatedData = insertTeamSchema.partial().parse(req.body);
      
      // If player1Id is changing, ensure the new player is available
      if (validatedData.player1Id && validatedData.player1Id !== team.player1Id) {
        const player1Team = await storage.getTeamByPlayer(validatedData.player1Id);
        if (player1Team) {
          return res.status(400).json({
            message: "The new player is already part of a team."
          });
        }
        
        // Free the old player
        if (team.player1Id) {
          await storage.updatePlayerAvailability(team.player1Id, true);
        }
        
        // Mark the new player as unavailable
        await storage.updatePlayerAvailability(validatedData.player1Id, false);
      }
      
      // If player2Id is changing, ensure the new player is available
      if (validatedData.player2Id && validatedData.player2Id !== team.player2Id) {
        const player2Team = await storage.getTeamByPlayer(validatedData.player2Id);
        if (player2Team) {
          return res.status(400).json({
            message: "The new teammate is already part of a team."
          });
        }
        
        // Free the old player
        if (team.player2Id) {
          await storage.updatePlayerAvailability(team.player2Id, true);
        }
        
        // Mark the new player as unavailable
        await storage.updatePlayerAvailability(validatedData.player2Id, false);
      }
      
      // If player2Id is being cleared (removed), free the player
      if (validatedData.player2Id === null && team.player2Id) {
        await storage.updatePlayerAvailability(team.player2Id, true);
      }
      
      // Update waitingForTeammate flag based on player2Id
      if (validatedData.player2Id !== undefined) {
        validatedData.waitingForTeammate = validatedData.player2Id === null;
      }
      
      // Update the team
      const updatedTeam = await storage.updateTeam(id, validatedData);
      
      // Regenerate bracket if needed
      if (validatedData.player1Id || validatedData.player2Id) {
        const tournament = await storage.getActiveTournament();
        if (tournament) {
          await storage.generateBracket(tournament.id);
        }
      }
      
      res.json(updatedTeam);
    } catch (error) {
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Invalid team data" 
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
      
      // Set waitingForTeammate based on player2Id
      // If waitingForTeammate isn't set in the request, derive it from player2Id
      if (validatedData.waitingForTeammate === undefined) {
        validatedData.waitingForTeammate = validatedData.player2Id === null;
      }
      
      console.log("Creating team with data:", validatedData);
      
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
      console.error("Error creating team:", error);
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Invalid team data"
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
  
  app.get("/api/tournaments/all", async (req, res) => {
    try {
      const includeArchived = req.query.archived === "true";
      const tournaments = await storage.getAllTournaments(includeArchived);
      res.json(tournaments);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Server error" 
      });
    }
  });
  
  app.get("/api/tournaments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid tournament ID" });
      }
      
      const tournament = await storage.getTournament(id);
      if (!tournament) {
        return res.status(404).json({ message: "Tournament not found" });
      }
      
      res.json(tournament);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Server error" 
      });
    }
  });
  
  app.post("/api/tournaments", async (req, res) => {
    try {
      const validatedData = insertTournamentSchema.parse(req.body);
      const tournament = await storage.createTournament(validatedData);
      res.status(201).json(tournament);
    } catch (error) {
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Invalid tournament data" 
      });
    }
  });
  
  app.put("/api/tournaments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid tournament ID" });
      }
      
      const tournament = await storage.getTournament(id);
      if (!tournament) {
        return res.status(404).json({ message: "Tournament not found" });
      }
      
      const validatedData = insertTournamentSchema.partial().parse(req.body);
      const updatedTournament = await storage.updateTournament(id, validatedData);
      
      // If this tournament is now active, deactivate all other tournaments
      if (validatedData.isActive) {
        await storage.deactivateOtherTournaments(id);
      }
      
      res.json(updatedTournament);
    } catch (error) {
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Invalid tournament data" 
      });
    }
  });
  
  app.post("/api/tournaments/:id/archive", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid tournament ID" });
      }
      
      const tournament = await storage.getTournament(id);
      if (!tournament) {
        return res.status(404).json({ message: "Tournament not found" });
      }
      
      const updatedTournament = await storage.updateTournament(id, { 
        isArchived: true,
        isActive: false 
      });
      
      res.json(updatedTournament);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Server error" 
      });
    }
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
