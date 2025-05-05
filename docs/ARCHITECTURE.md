# Cornhole Tournament Management System - Architecture Documentation

## Overview

The Cornhole Tournament Management System is a lightweight web application designed to facilitate tournament organization, player registration, team formation, and bracket generation/management for cornhole tournaments. The system runs efficiently on Replit's free tier, focusing on essential functionality while maintaining a clean, intuitive user interface.

## Technology Stack

- **Frontend**: React with TypeScript
- **UI Framework**: Tailwind CSS with shadcn/ui components
- **State Management**: TanStack Query for server state, React hooks for local state
- **Routing**: Wouter for client-side routing
- **Backend**: Node.js with Express
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Session-based authentication with PostgreSQL session store

## System Architecture

### 1. Data Model

The core entities in the system are:

- **Users**: Admin accounts for tournament management
- **Players**: Individual participants who register for tournaments
- **Teams**: Pairs of players (or a single player waiting for a teammate)
- **Tournaments**: Configurable events with settings for team limits, bracket type, etc.
- **Matches**: Individual games within the bracket structure

### 2. Component Structure

The application is divided into the following major components:

- **Public Interface**: 
  - Registration forms for players
  - Team formation and viewing
  - Tournament bracket visualization
  
- **Admin Interface**:
  - Tournament management (creation, editing, archiving)
  - Player management (viewing, adding, deleting)
  - Team management (creating teams, editing)
  - Bracket management (generation, updating)

### 3. Key Workflows

#### Player Registration Flow

1. Players register by providing their name through the public registration form
2. System checks if the player already exists
   - If deleted, player is reactivated
   - If new, player is created as "available"
3. Player can register as an individual or specify a teammate
4. If registering with a teammate, both players form a team
5. If registering as an individual, player is marked as "waiting for teammate"

#### Team Formation Flow

Two paths for team formation:

1. **Player-Initiated**:
   - Player A registers and selects "waiting for teammate"
   - Player B registers and selects Player A as teammate
   - System automatically forms a team

2. **Admin-Initiated**:
   - Admin navigates to Players tab and adds players as needed
   - Admin navigates to Teams tab
   - Admin creates teams by selecting available players
   - Admin can create a team with a single player who is waiting for a teammate

#### Bracket Generation Flow

1. Admin navigates to Tournament Management tab
2. Admin selects "Generate Bracket" for the active tournament
3. System creates a bracket based on registered teams
4. Teams are seeded according to the configured method (random, balanced, sequential)
5. Bracket is displayed with match structure
6. Admin can update match results, which automatically advances winners

## Admin Dashboard Structure

The admin dashboard is organized into four main tabs:

### 1. Tournaments Tab
- View all tournaments (active, completed, archived)
- Create new tournaments with configurable settings
- Edit existing tournaments
- Archive tournaments that are completed

### 2. Bracket Management Tab
- View the active tournament's bracket
- Update match results
- Regenerate bracket if needed

### 3. Teams Tab
- View all registered teams for the active tournament
- Create new teams from available players
- Delete teams if necessary
- View team details (members, status)

### 4. Players Tab
- View all players (registered, on teams, deleted)
- Add new players directly from the admin interface
- Delete players (marks as unavailable rather than removing)
- Filter and sort players by various criteria

## Admin Workflow for Creating Teams

When no players are available, the "Create Team" button in the Teams tab is disabled. The workflow to create teams is:

1. Navigate to the Players tab
2. Click "Add Player" to register new players
3. Complete the player registration form with first and last name
4. Repeat for additional players as needed
5. Navigate to the Teams tab
6. Now that players are available, the "Create Team" button is enabled
7. Click "Create Team" and select players from the available pool
8. Specify if the team has one or two players
9. Single-player teams are marked as "waiting for teammate"

This workflow ensures that there are always available players before teams can be created, preventing errors and maintaining data integrity.

## Security and Access Control

- Login system uses username/password authentication
- Admin accounts have full system access
- Public users can only view tournaments and register
- Session data is stored securely in the database
- CSRF protection implemented for all forms

## API Structure

The backend API follows RESTful principles with the following endpoints:

- `/api/players` - Player registration and management
- `/api/teams` - Team creation and retrieval
- `/api/tournaments` - Tournament CRUD operations
- `/api/brackets` - Bracket generation and match updates

Each endpoint implements proper validation and error handling, with consistent response formats across the API.