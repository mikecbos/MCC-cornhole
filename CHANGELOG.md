# Changelog
All notable changes to the Cornhole Tournament Manager will be documented in this file.

## [1.1.0] - YYYY-MM-DD  <- Update with the actual date when you "release" or stabilize this version
### Added
- **Persistent Data Storage:** Migrated application data from CSV files to a PostgreSQL database (hosted on Neon).
    - Implemented SQLAlchemy ORM for database interaction.
    - Set up Flask-Migrate for database schema management and migrations.
- **Tournament History:** Tournaments, teams, participants, and match results are now saved persistently.

### Changed
- **Data Management:** Replaced all CSV read/write operations with database queries using SQLAlchemy.
- **Application Setup:** Integrated Flask-Migrate for initializing and updating the database schema.

### Deprecated
- CSV file-based data storage (`data/` directory for participants, teams, tournaments, matches).
- Utility functions related to reading/writing CSV files (`utils.py` will be significantly refactored or parts removed).

### TODO / Future Considerations for v1.2.0 
- Basic tournament navigation (e.g., Next/Previous on a tournament listing page).
- Dropdown menu for quick access to any tournament (currently available via "All Tournaments" link).
- Tournament filtering by status.
- Dedicated tournaments listing page with search functionality.
- Keyboard navigation.

## [1.0.0] - [Original completion date]
### Initial Release
- Team registration system
- Tournament creation and management
- Bracket generation and visualization
- Match scoring and updating
- Administrative dashboard