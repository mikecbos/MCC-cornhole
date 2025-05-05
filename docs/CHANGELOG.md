# Cornhole Tournament Management System - Changelog

## Version 1.2.0 - Admin Player Registration & Team Creation Workflow Improvements

### Added

- **Admin Player Registration Feature**
  - Added "Add Player" button to the Players tab in admin interface
  - Created `AddPlayerForm` component with validation using zod
  - Implemented the `createPlayerMutation` API integration for admin player creation
  - Added UI feedback for successful player registration

- **Team Creation UX Improvements**
  - Moved team creation functionality from Players tab to Teams tab
  - Added conditional disabling of "Create Team" button when no players are available
  - Enhanced form validation for the team creation process

### Changed

- **Restructured Admin UI**
  - Improved tab organization for more intuitive workflow
  - Enhanced UI for team listing and player management
  - Added visual indicators for player status (available, on team, deleted)

- **Code Refactoring**
  - Improved TypeScript typing across components
  - Enhanced query invalidation to ensure UI consistency after mutations
  - Fixed form validation for the `player2Id` field to properly handle null values
  - Added explicit handling of `waitingForTeammate` flag when creating teams

### Fixed

- Fixed the issue where team creation was not possible when no players were available
- Improved error handling in form submissions
- Enhanced dialog description text for better user guidance
- Fixed type errors in admin component

## Version 1.1.0 - Database Migration & Enhanced Bracket Management

### Added

- **Database Integration**
  - Migrated from in-memory storage to PostgreSQL with Drizzle ORM
  - Implemented proper database schema with relationships
  - Added comprehensive query methods for all entity types

- **Enhanced Bracket Management**
  - Added ability to regenerate brackets
  - Improved bracket visualization
  - Added match result updates with automatic advancement

### Changed

- **Player Management**
  - Changed player deletion to mark as unavailable rather than removing
  - Added ability to reactivate deleted players
  - Improved player listing with status indicators

- **Team Management**
  - Enhanced team creation and editing functionality
  - Added support for teams waiting for teammates
  - Improved validation and error handling

## Version 1.0.0 - Initial Release

### Features

- Basic tournament management
- Player registration
- Team formation
- Single elimination bracket generation
- Admin interface for tournament management
- Public registration forms
- Match result recording
- Tournament history tracking