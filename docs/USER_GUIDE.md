# Cornhole Tournament Management System - User Guide

## Overview

The Cornhole Tournament Management System allows tournament organizers to efficiently manage cornhole tournaments, from player registration to bracket generation and tournament completion. This guide focuses on the key workflows and functionality of the system.

## Getting Started

### Accessing the System

1. **Public Access**: Anyone can view active tournaments and register as a player
2. **Admin Access**: Tournament organizers can log in to the admin interface with credentials
   - Default credentials: Username: `admin`, Password: `admin`

### Admin Dashboard Layout

The admin dashboard is divided into four primary tabs:

1. **Tournaments**: Manage tournament creation and settings
2. **Bracket Management**: View and update tournament brackets
3. **Teams**: Manage team registration and formation
4. **Players**: Manage individual player registration

## Key Workflows

### Tournament Creation and Management

1. Log in to the admin dashboard
2. Navigate to the "Tournaments" tab
3. Click "Create Tournament"
4. Fill in the tournament details:
   - Name
   - Description
   - Maximum number of teams
   - Season and year
   - Bracket type (Single or Double elimination)
5. Click "Create Tournament"
6. The new tournament will be set as active automatically
7. To archive a tournament, click the "Archive" button on the tournament card

### Player Management

The system allows two ways to register players:

#### Public Registration (for participants)

1. Visit the public registration page
2. Enter first and last name
3. Optionally select a teammate
4. Submit the registration form

#### Admin Registration (new feature)

1. Log in to the admin dashboard
2. Navigate to the "Players" tab
3. Click the "Add Player" button
4. Enter the player's first and last name
5. Click "Add Player"
6. The player will be added and marked as "Available"

#### Deleting Players

1. In the "Players" tab, find the player you want to delete
2. Click the delete button (trash icon)
3. Confirm the deletion
4. The player will be marked as "Deleted" but remains in the database
   - This preserves tournament history while preventing re-registration

### Team Management

#### Creating Teams as an Admin

1. Log in to the admin dashboard
2. First, ensure there are available players by checking the "Players" tab
   - If no players are available, add players using the "Add Player" button
3. Navigate to the "Teams" tab
4. Click the "Create Team" button
   - Note: This button is disabled if no players are available
5. Fill in the team details:
   - Team name
   - Select Player 1 (required)
   - Optionally select Player 2
   - If no Player 2 is selected, the team will be marked as "waiting for teammate"
6. Click "Create Team"
7. The team will appear in the teams list

#### Public Team Formation

1. Player A registers through the public form and selects "waiting for teammate"
2. Player B registers and selects Player A as their teammate
3. The system automatically creates a team with both players

### Bracket Management

1. Log in to the admin dashboard
2. Navigate to the "Bracket Management" tab
3. The current active tournament's bracket will be displayed
4. To regenerate the bracket, go to the "Tournaments" tab and click "Generate Bracket"
5. To update match results:
   - Click on a team in a match to mark them as the winner
   - The bracket will automatically advance the winner to the next round
   - The winning team will be highlighted in the bracket

## Recent Improvements

### Admin Player Registration

A key improvement to the system is the ability for admins to register players directly from the admin interface:

1. **Why this feature was added**: Previously, admins could only create teams from existing players registered through the public interface. This created a dependency where no teams could be formed until players had registered through the public form.

2. **How it works**: 
   - A new "Add Player" button was added to the Players tab
   - Clicking this button opens a simple form to enter player details
   - New players are automatically marked as "Available"
   - This makes them immediately available for team creation

3. **Benefits**:
   - Admins can pre-register players before the tournament
   - Helps with on-site registration where the admin can enter player information
   - Untangles the dependency between player registration and team creation
   - Allows for more flexible tournament management

### Team Creation Workflow

The team creation workflow has been improved:

1. **Team creation moved to Teams tab**: The button to create teams is now located in the Teams tab instead of the Players tab, providing a more intuitive workflow.

2. **Conditional button state**: The "Create Team" button is disabled when no players are available, preventing invalid team creation attempts.

3. **Clear player selection**: When creating a team, admins can easily see which players are available and select whether they want to create a complete team or a team waiting for a teammate.

4. **Streamlined process**:
   - Add players in the Players tab
   - Create teams in the Teams tab
   - Generate brackets in the Tournaments tab

This logical separation of concerns makes the system more intuitive to use.

## Best Practices

1. **Always add players before creating teams**: Ensure there are available players before attempting to create teams.

2. **Verify team creation**: After creating a team, verify that the players' status has changed from "Available" to "On Team".

3. **Check bracket after regeneration**: After regenerating a bracket, verify that all teams are properly placed in the bracket.

4. **Regular backups**: While the system preserves data by marking items as inactive rather than deleting them, it's still good practice to periodically export tournament data.

5. **Test before the tournament**: Always test the complete workflow before the actual tournament day to ensure everything is working properly.