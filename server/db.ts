import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from "@shared/schema";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from 'path';
import fs from 'fs';

// Ensure the data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create and configure the SQLite database
const dbPath = path.join(dataDir, 'cornhole_tournament.db');
const sqlite = new Database(dbPath);

// Create drizzle instance
export const db = drizzle(sqlite, { schema });

// Initialize the database with tables if they don't exist
try {
  // Create tables based on schema
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0
    );
    
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      is_available INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      player1_id INTEGER NOT NULL,
      player2_id INTEGER,
      seed_number INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      waiting_for_teammate INTEGER DEFAULT 0,
      FOREIGN KEY (player1_id) REFERENCES players(id),
      FOREIGN KEY (player2_id) REFERENCES players(id)
    );
    
    CREATE TABLE IF NOT EXISTS tournaments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      max_teams INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1,
      is_archived INTEGER DEFAULT 0,
      season TEXT,
      year INTEGER DEFAULT (strftime('%Y', 'now')),
      registration_open INTEGER DEFAULT 1,
      tournament_status TEXT DEFAULT 'registration',
      start_date TEXT,
      end_date TEXT,
      bracket_type TEXT DEFAULT 'single',
      primary_color TEXT DEFAULT '#4f46e5',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      round INTEGER NOT NULL,
      match_number INTEGER NOT NULL,
      team1_id INTEGER,
      team2_id INTEGER,
      winner_id INTEGER,
      next_match_id INTEGER,
      team1_score INTEGER,
      team2_score INTEGER,
      match_status TEXT DEFAULT 'pending',
      scheduled_time TEXT,
      completed_time TEXT,
      notes TEXT,
      FOREIGN KEY (team1_id) REFERENCES teams(id),
      FOREIGN KEY (team2_id) REFERENCES teams(id),
      FOREIGN KEY (winner_id) REFERENCES teams(id),
      FOREIGN KEY (next_match_id) REFERENCES matches(id)
    );
  `);
  
  // Create initial admin user if none exists
  const userCount = sqlite.prepare('SELECT COUNT(*) as count FROM users').get() as any;
  if (userCount.count === 0) {
    sqlite.prepare(
      'INSERT INTO users (username, password, is_admin) VALUES (?, ?, ?)'
    ).run('admin', 'admin', 1);
  }
  
  // Create initial tournament if none exists
  const tournamentCount = sqlite.prepare('SELECT COUNT(*) as count FROM tournaments').get() as any;
  if (tournamentCount.count === 0) {
    sqlite.prepare(
      'INSERT INTO tournaments (name, description, max_teams, bracket_type) VALUES (?, ?, ?, ?)'
    ).run('Summer Cornhole Championship', 'Annual summer cornhole tournament', 16, 'single');
  }
  
  console.log('Database initialized successfully');
} catch (error) {
  console.error('Error initializing database:', error);
  throw error;
}