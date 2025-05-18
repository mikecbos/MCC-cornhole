from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from sqlalchemy.sql import expression

# Initialize SQLAlchemy object.
# This 'db' instance will be used to define models and later
# associated with the Flask app instance in app.py via db.init_app(app).
db = SQLAlchemy()

class Team(db.Model):
    __tablename__ = 'team'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    
    # New fields for better data management
    external_id = db.Column(db.String(50), nullable=True)  # Original Planning Center ID
    source = db.Column(db.String(50), nullable=True, default="planning_center")  # Data source
    notes = db.Column(db.Text, nullable=True)  # For admin annotations
    
    participants = db.relationship('Participant', 
                                 backref=db.backref('team_assigned', uselist=False),
                                 foreign_keys='Participant.team_id',
                                 lazy=True)
    
    def __repr__(self):
        return f"<Team {self.id}: {self.name}>"

class Participant(db.Model):
    __tablename__ = 'participant'

    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(80), nullable=False)
    last_name = db.Column(db.String(80), nullable=False)
    needs_teammate = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    
    # New fields for better data management
    external_id = db.Column(db.String(50), nullable=True)  # Original Planning Center ID
    source = db.Column(db.String(50), nullable=True, default="planning_center")  # Data source
    notes = db.Column(db.Text, nullable=True)  # For admin annotations
    display_name = db.Column(db.String(160), nullable=True)  # For admin customization of display
    
    team_id = db.Column(db.Integer, db.ForeignKey('team.id'), nullable=True)
    
    def __repr__(self):
        return f"<Participant {self.id}: {self.first_name} {self.last_name}>"

class Tournament(db.Model):
    __tablename__ = 'tournament'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    type = db.Column(db.String(50), nullable=False)  # e.g., 'single_elimination', 'round_robin'
    status = db.Column(db.String(20), nullable=False, default='pending')  # 'pending', 'active', 'completed'
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    
    # --- designate as Default Tournament ---
    is_default = db.Column(db.Boolean, nullable=False, default=False, server_default=expression.false(), index=True)
    
    # --- Auto-navigation settings ---
    auto_navigate = db.Column(db.Boolean, nullable=False, default=False, server_default=expression.false())
    auto_navigate_delay = db.Column(db.Integer, nullable=False, default=10, server_default='10')  # 10 Seconds instead of 30
    
    # --- Relationships ---
    matches = db.relationship('Match', backref='tournament_info', lazy='dynamic', cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Tournament {self.id}: {self.name} ({self.status})>"

class Match(db.Model):
    __tablename__ = 'match'

    id = db.Column(db.Integer, primary_key=True) # Using Integer for simplicity, can be string if needed.
    round_number = db.Column(db.Integer, nullable=True) # Renamed from 'round' to avoid SQL keyword conflict
    match_in_round = db.Column(db.Integer, nullable=True) # Your 'match_number' from CSV
    team1_score = db.Column(db.Integer, nullable=True)
    team2_score = db.Column(db.Integer, nullable=True)
    status = db.Column(db.String(20), nullable=False, default='pending') # 'pending', 'active', 'completed'
    # For single elimination progression:
    next_match_progression_id = db.Column(db.Integer, db.ForeignKey('match.id'), nullable=True) # Winner progresses to this match
    next_match_slot = db.Column(db.String(10), nullable=True) # e.g., 'team1' or 'team2' in the next_match_progression_id

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    # --- Foreign Keys ---
    tournament_id = db.Column(db.Integer, db.ForeignKey('tournament.id'), nullable=False)

    team1_id = db.Column(db.Integer, db.ForeignKey('team.id'), nullable=True) # Nullable if team not yet decided
    team2_id = db.Column(db.Integer, db.ForeignKey('team.id'), nullable=True) # Nullable if team not yet decided
    winner_id = db.Column(db.Integer, db.ForeignKey('team.id'), nullable=True)# Nullable until match is played

    # --- Relationships ---
    # The 'tournament_info' backref is created by the relationship in the Tournament model.

    # Define relationships to Team for team1, team2, and winner.
    # We need to specify foreign_keys because there are multiple FKs to the Team table.
    team1 = db.relationship('Team', foreign_keys=[team1_id], backref=db.backref('matches_as_team1', lazy='dynamic'))
    team2 = db.relationship('Team', foreign_keys=[team2_id], backref=db.backref('matches_as_team2', lazy='dynamic'))
    winner = db.relationship('Team', foreign_keys=[winner_id], backref=db.backref('matches_won', lazy='dynamic'))

    # For the self-referential next_match_progression relationship
    # This allows navigating from a match to the match its winner progresses to.
    progresses_to_match = db.relationship('Match', remote_side=[id], foreign_keys=[next_match_progression_id],
                                          backref=db.backref('feeder_matches', lazy='dynamic'))


    def __repr__(self):
        return f"<Match {self.id} (T:{self.tournament_id} R:{self.round_number}.{self.match_in_round}) {self.team1_id} vs {self.team2_id}>"

