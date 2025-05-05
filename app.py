from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from flask_wtf import FlaskForm
from flask_wtf.csrf import CSRFProtect
from wtforms import StringField, IntegerField, SelectField, BooleanField, SubmitField
from wtforms.validators import DataRequired, NumberRange, Optional
import os
import random
import math
from datetime import datetime

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev_key_for_dev_only')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///tournament.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize extensions
db = SQLAlchemy(app)
csrf = CSRFProtect(app)

# Define database models
class Tournament(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    max_teams = db.Column(db.Integer, default=16)
    is_active = db.Column(db.Boolean, default=True)
    is_archived = db.Column(db.Boolean, default=False)
    season = db.Column(db.String(50), nullable=True)
    year = db.Column(db.Integer, default=datetime.now().year)
    registration_open = db.Column(db.Boolean, default=True)
    status = db.Column(db.String(20), default='registration')  # registration, in_progress, completed
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    teams = db.relationship('Team', backref='tournament', lazy=True)
    matches = db.relationship('Match', backref='tournament', lazy=True)

class Player(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    is_available = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Team(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    tournament_id = db.Column(db.Integer, db.ForeignKey('tournament.id'), nullable=False)
    player1_id = db.Column(db.Integer, db.ForeignKey('player.id'), nullable=False)
    player2_id = db.Column(db.Integer, db.ForeignKey('player.id'), nullable=True)
    seed_number = db.Column(db.Integer, nullable=True)
    waiting_for_teammate = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    player1 = db.relationship('Player', foreign_keys=[player1_id], backref='teams_as_player1')
    player2 = db.relationship('Player', foreign_keys=[player2_id], backref='teams_as_player2')

class Match(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    tournament_id = db.Column(db.Integer, db.ForeignKey('tournament.id'), nullable=False)
    round = db.Column(db.Integer, nullable=False)
    match_number = db.Column(db.Integer, nullable=False)
    team1_id = db.Column(db.Integer, db.ForeignKey('team.id'), nullable=True)
    team2_id = db.Column(db.Integer, db.ForeignKey('team.id'), nullable=True)
    winner_id = db.Column(db.Integer, db.ForeignKey('team.id'), nullable=True)
    next_match_id = db.Column(db.Integer, db.ForeignKey('match.id'), nullable=True)
    team1_score = db.Column(db.Integer, nullable=True)
    team2_score = db.Column(db.Integer, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    team1 = db.relationship('Team', foreign_keys=[team1_id], backref='matches_as_team1')
    team2 = db.relationship('Team', foreign_keys=[team2_id], backref='matches_as_team2')
    winner = db.relationship('Team', foreign_keys=[winner_id], backref='matches_won')
    next_match = db.relationship('Match', remote_side=[id], backref='previous_matches')

# Forms
class TournamentForm(FlaskForm):
    name = StringField('Tournament Name', validators=[DataRequired()])
    description = StringField('Description')
    max_teams = IntegerField('Maximum Teams', validators=[NumberRange(min=2, max=64)], default=16)
    season = StringField('Season')
    year = IntegerField('Year', default=datetime.now().year)
    is_active = BooleanField('Make Active', default=True)
    submit = SubmitField('Create Tournament')

class PlayerForm(FlaskForm):
    first_name = StringField('First Name', validators=[DataRequired()])
    last_name = StringField('Last Name', validators=[DataRequired()])
    submit = SubmitField('Register')

class TeamForm(FlaskForm):
    name = StringField('Team Name', validators=[DataRequired()])
    player2_id = SelectField('Teammate', coerce=int, validators=[Optional()])
    submit = SubmitField('Register Team')

class AdminLoginForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired()])
    password = StringField('Password', validators=[DataRequired()])
    submit = SubmitField('Login')

# Helper functions
def generate_bracket(tournament_id):
    """Generate a tournament bracket based on registered teams"""
    tournament = Tournament.query.get(tournament_id)
    if not tournament:
        return False
    
    # Delete existing matches for this tournament
    Match.query.filter_by(tournament_id=tournament_id).delete()
    db.session.commit()
    
    # Get teams for this tournament
    teams = Team.query.filter_by(tournament_id=tournament_id, waiting_for_teammate=False).all()
    
    # Need at least 2 teams to create a bracket
    if len(teams) < 2:
        return False
    
    # Randomize team order for seeding
    random.shuffle(teams)
    
    # Assign seed numbers
    for i, team in enumerate(teams):
        team.seed_number = i + 1
    
    # Calculate bracket size (power of 2)
    bracket_size = 2
    while bracket_size < len(teams):
        bracket_size *= 2
    
    # Create matches for the bracket
    rounds = int(math.log2(bracket_size))
    
    # Create matches from the final round to the first round
    for r in range(1, rounds + 1):
        num_matches_in_round = 2 ** (r - 1)
        for m in range(1, num_matches_in_round + 1):
            match = Match(
                tournament_id=tournament_id,
                round=r,
                match_number=m
            )
            db.session.add(match)
    
    db.session.commit()
    
    # Set up relationship between matches
    for r in range(2, rounds + 1):
        matches_in_current_round = Match.query.filter_by(tournament_id=tournament_id, round=r).order_by(Match.match_number).all()
        matches_in_next_round = Match.query.filter_by(tournament_id=tournament_id, round=r-1).order_by(Match.match_number).all()
        
        for i, match in enumerate(matches_in_current_round):
            next_match_index = i // 2
            match.next_match_id = matches_in_next_round[next_match_index].id
    
    # Place teams in first round matches
    first_round_matches = Match.query.filter_by(tournament_id=tournament_id, round=rounds).order_by(Match.match_number).all()
    
    for i, team in enumerate(teams):
        if i < len(first_round_matches) * 2:
            match_index = i // 2
            if i % 2 == 0:
                first_round_matches[match_index].team1_id = team.id
            else:
                first_round_matches[match_index].team2_id = team.id
    
    db.session.commit()
    return True

def update_bracket(tournament_id):
    """Update bracket after a match result is recorded"""
    matches = Match.query.filter_by(tournament_id=tournament_id).all()
    
    for match in matches:
        if match.winner_id and match.next_match_id:
            next_match = Match.query.get(match.next_match_id)
            if next_match:
                # Determine if this match feeds into team1 or team2 of the next match
                prev_matches = Match.query.filter_by(next_match_id=next_match.id).order_by(Match.match_number).all()
                if len(prev_matches) > 0 and match.id == prev_matches[0].id:
                    next_match.team1_id = match.winner_id
                else:
                    next_match.team2_id = match.winner_id
    
    db.session.commit()
    return True

def is_admin():
    """Check if current user has admin privileges"""
    return session.get('is_admin', False)

# Routes
@app.route('/')
def index():
    # Get active tournament
    tournament = Tournament.query.filter_by(is_active=True).first()
    if not tournament:
        tournament = Tournament(
            name="Cornhole Tournament",
            max_teams=16,
            is_active=True
        )
        db.session.add(tournament)
        db.session.commit()
    
    teams = Team.query.filter_by(tournament_id=tournament.id, waiting_for_teammate=False).all()
    
    # Get bracket matches
    matches = Match.query.filter_by(tournament_id=tournament.id).order_by(Match.round, Match.match_number).all()
    
    return render_template('index.html', tournament=tournament, teams=teams, matches=matches)

@app.route('/register', methods=['GET', 'POST'])
def register():
    tournament = Tournament.query.filter_by(is_active=True).first()
    if not tournament or not tournament.registration_open:
        flash('Registration is currently closed.')
        return redirect(url_for('index'))
    
    # Player form
    player_form = PlayerForm()
    
    # Team form - will be populated after player is created
    team_form = TeamForm()
    
    # Get all available players for teammate selection
    available_players = Player.query.filter_by(is_available=True).all()
    team_form.player2_id.choices = [(0, 'Random Teammate')] + [(p.id, f"{p.first_name} {p.last_name}") for p in available_players]
    
    if player_form.validate_on_submit():
        # Create new player
        player = Player(
            first_name=player_form.first_name.data,
            last_name=player_form.last_name.data
        )
        db.session.add(player)
        db.session.commit()
        
        # Store player id in session for team registration
        session['player_id'] = player.id
        
        return redirect(url_for('register_team'))
    
    return render_template('register.html', player_form=player_form, tournament=tournament)

@app.route('/register/team', methods=['GET', 'POST'])
def register_team():
    player_id = session.get('player_id')
    if not player_id:
        flash('Please register as a player first.')
        return redirect(url_for('register'))
    
    player = Player.query.get(player_id)
    if not player:
        flash('Player not found.')
        return redirect(url_for('register'))
    
    tournament = Tournament.query.filter_by(is_active=True).first()
    if not tournament or not tournament.registration_open:
        flash('Registration is currently closed.')
        return redirect(url_for('index'))
    
    # Team form
    team_form = TeamForm()
    
    # Get all available players for teammate selection
    available_players = Player.query.filter_by(is_available=True).all()
    team_form.player2_id.choices = [(0, 'Random Teammate')] + [(p.id, f"{p.first_name} {p.last_name}") for p in available_players]
    
    if team_form.validate_on_submit():
        # Create team
        team = Team(
            name=team_form.name.data,
            tournament_id=tournament.id,
            player1_id=player_id
        )
        
        # Handle teammate selection
        player2_id = team_form.player2_id.data
        if player2_id > 0:  # Specific teammate selected
            player2 = Player.query.get(player2_id)
            if player2 and player2.is_available:
                team.player2_id = player2_id
                team.waiting_for_teammate = False
                
                # Mark both players as unavailable
                player.is_available = False
                player2.is_available = False
            else:
                flash('Selected teammate is no longer available.')
                return redirect(url_for('register_team'))
        else:  # Random teammate requested
            team.waiting_for_teammate = True
            player.is_available = False
            
            # Try to match with another team waiting for teammate
            waiting_team = Team.query.filter_by(tournament_id=tournament.id, waiting_for_teammate=True).first()
            if waiting_team and waiting_team.player1_id != player_id:
                # Match the teams
                waiting_team.player2_id = player_id
                waiting_team.waiting_for_teammate = False
                
                # Don't create a new team, we joined existing one
                db.session.add(player)
                db.session.commit()
                
                flash(f'You have been matched with a team: {waiting_team.name}')
                # Clear the player session
                session.pop('player_id', None)
                
                # Regenerate bracket
                generate_bracket(tournament.id)
                
                return redirect(url_for('index'))
        
        # Add the new team
        db.session.add(team)
        db.session.add(player)
        db.session.commit()
        
        # Regenerate bracket
        generate_bracket(tournament.id)
        
        # Clear the player session
        session.pop('player_id', None)
        
        flash('Team registered successfully!')
        return redirect(url_for('index'))
    
    return render_template('register_team.html', team_form=team_form, player=player, tournament=tournament)

@app.route('/admin', methods=['GET', 'POST'])
def admin_login():
    if is_admin():
        return redirect(url_for('admin_dashboard'))
    
    form = AdminLoginForm()
    
    if form.validate_on_submit():
        # Simple admin authentication (in a real app, use proper authentication)
        if form.username.data == 'admin' and form.password.data == 'admin':
            session['is_admin'] = True
            flash('Admin login successful!')
            return redirect(url_for('admin_dashboard'))
        else:
            flash('Invalid credentials!')
    
    return render_template('admin_login.html', form=form)

@app.route('/admin/dashboard')
def admin_dashboard():
    if not is_admin():
        flash('Admin login required!')
        return redirect(url_for('admin_login'))
    
    tournaments = Tournament.query.all()
    active_tournament = Tournament.query.filter_by(is_active=True).first()
    
    return render_template('admin_dashboard.html', 
                           tournaments=tournaments, 
                           active_tournament=active_tournament)

@app.route('/admin/tournaments/new', methods=['GET', 'POST'])
def new_tournament():
    if not is_admin():
        flash('Admin login required!')
        return redirect(url_for('admin_login'))
    
    form = TournamentForm()
    
    if form.validate_on_submit():
        # If making this tournament active, deactivate all others
        if form.is_active.data:
            Tournament.query.update({Tournament.is_active: False})
        
        tournament = Tournament(
            name=form.name.data,
            description=form.description.data,
            max_teams=form.max_teams.data,
            season=form.season.data,
            year=form.year.data,
            is_active=form.is_active.data
        )
        db.session.add(tournament)
        db.session.commit()
        
        flash('Tournament created successfully!')
        return redirect(url_for('admin_dashboard'))
    
    return render_template('tournament_form.html', form=form, is_new=True)

@app.route('/admin/tournaments/<int:tournament_id>/edit', methods=['GET', 'POST'])
def edit_tournament(tournament_id):
    if not is_admin():
        flash('Admin login required!')
        return redirect(url_for('admin_login'))
    
    tournament = Tournament.query.get_or_404(tournament_id)
    form = TournamentForm(obj=tournament)
    
    if form.validate_on_submit():
        # If making this tournament active, deactivate all others
        if form.is_active.data and not tournament.is_active:
            Tournament.query.update({Tournament.is_active: False})
        
        tournament.name = form.name.data
        tournament.description = form.description.data
        tournament.max_teams = form.max_teams.data
        tournament.season = form.season.data
        tournament.year = form.year.data
        tournament.is_active = form.is_active.data
        
        db.session.commit()
        
        flash('Tournament updated successfully!')
        return redirect(url_for('admin_dashboard'))
    
    return render_template('tournament_form.html', form=form, tournament=tournament, is_new=False)

@app.route('/admin/tournaments/<int:tournament_id>/archive', methods=['POST'])
def archive_tournament(tournament_id):
    if not is_admin():
        return jsonify({'success': False, 'message': 'Admin login required!'})
    
    tournament = Tournament.query.get_or_404(tournament_id)
    tournament.is_archived = True
    tournament.is_active = False
    db.session.commit()
    
    return jsonify({'success': True})

@app.route('/admin/tournaments/<int:tournament_id>/status', methods=['POST'])
def update_tournament_status(tournament_id):
    if not is_admin():
        return jsonify({'success': False, 'message': 'Admin login required!'})
    
    tournament = Tournament.query.get_or_404(tournament_id)
    
    status = request.form.get('status')
    registration = request.form.get('registration') == 'true'
    
    if status in ['registration', 'in_progress', 'completed']:
        tournament.status = status
    
    tournament.registration_open = registration
    db.session.commit()
    
    return jsonify({'success': True})

@app.route('/admin/matches/<int:match_id>/winner', methods=['POST'])
def update_match_winner(match_id):
    if not is_admin():
        return jsonify({'success': False, 'message': 'Admin login required!'})
    
    match = Match.query.get_or_404(match_id)
    winner_id = request.form.get('winner_id', type=int)
    
    if winner_id not in [match.team1_id, match.team2_id]:
        return jsonify({'success': False, 'message': 'Invalid winner'})
    
    match.winner_id = winner_id
    db.session.commit()
    
    # Update the bracket
    update_bracket(match.tournament_id)
    
    return jsonify({'success': True})

@app.route('/admin/brackets/<int:tournament_id>/generate', methods=['POST'])
def admin_generate_bracket(tournament_id):
    if not is_admin():
        return jsonify({'success': False, 'message': 'Admin login required!'})
    
    success = generate_bracket(tournament_id)
    
    if success:
        return jsonify({'success': True})
    else:
        return jsonify({'success': False, 'message': 'Failed to generate bracket. Need at least 2 teams.'})

@app.route('/history')
def tournament_history():
    tournaments = Tournament.query.filter_by(is_archived=True).order_by(Tournament.year.desc(), Tournament.id.desc()).all()
    return render_template('tournament_history.html', tournaments=tournaments)

@app.route('/tournaments/<int:tournament_id>')
def tournament_details(tournament_id):
    tournament = Tournament.query.get_or_404(tournament_id)
    teams = Team.query.filter_by(tournament_id=tournament_id, waiting_for_teammate=False).all()
    matches = Match.query.filter_by(tournament_id=tournament_id).order_by(Match.round, Match.match_number).all()
    
    # Find winner
    final_match = Match.query.filter_by(tournament_id=tournament_id, round=1, match_number=1).first()
    winner = None
    if final_match and final_match.winner_id:
        winner = Team.query.get(final_match.winner_id)
    
    return render_template('tournament_details.html', 
                           tournament=tournament, 
                           teams=teams, 
                           matches=matches, 
                           winner=winner)

@app.route('/admin/logout')
def admin_logout():
    session.pop('is_admin', None)
    flash('You have been logged out.')
    return redirect(url_for('index'))

@app.route('/api/teams')
def api_teams():
    tournament_id = request.args.get('tournament_id', type=int)
    
    if tournament_id:
        teams = Team.query.filter_by(tournament_id=tournament_id, waiting_for_teammate=False).all()
    else:
        teams = Team.query.filter_by(waiting_for_teammate=False).all()
    
    teams_data = []
    for team in teams:
        player1 = Player.query.get(team.player1_id)
        player2 = None
        if team.player2_id:
            player2 = Player.query.get(team.player2_id)
        
        teams_data.append({
            'id': team.id,
            'name': team.name,
            'tournament_id': team.tournament_id,
            'players': [
                f"{player1.first_name} {player1.last_name}",
                f"{player2.first_name} {player2.last_name}" if player2 else None
            ],
            'seed_number': team.seed_number
        })
    
    return jsonify(teams_data)

@app.route('/api/brackets/<int:tournament_id>')
def api_brackets(tournament_id):
    matches = Match.query.filter_by(tournament_id=tournament_id).order_by(Match.round, Match.match_number).all()
    
    matches_data = []
    for match in matches:
        team1 = None
        if match.team1_id:
            t1 = Team.query.get(match.team1_id)
            player1 = Player.query.get(t1.player1_id)
            player2 = Player.query.get(t1.player2_id) if t1.player2_id else None
            
            team1 = {
                'id': t1.id,
                'name': t1.name,
                'players': [
                    f"{player1.first_name} {player1.last_name}",
                    f"{player2.first_name} {player2.last_name}" if player2 else None
                ],
                'seed_number': t1.seed_number
            }
        
        team2 = None
        if match.team2_id:
            t2 = Team.query.get(match.team2_id)
            player1 = Player.query.get(t2.player1_id)
            player2 = Player.query.get(t2.player2_id) if t2.player2_id else None
            
            team2 = {
                'id': t2.id,
                'name': t2.name,
                'players': [
                    f"{player1.first_name} {player1.last_name}",
                    f"{player2.first_name} {player2.last_name}" if player2 else None
                ],
                'seed_number': t2.seed_number
            }
        
        matches_data.append({
            'id': match.id,
            'round': match.round,
            'match_number': match.match_number,
            'team1': team1,
            'team2': team2,
            'winner_id': match.winner_id,
            'next_match_id': match.next_match_id,
            'team1_score': match.team1_score,
            'team2_score': match.team2_score,
        })
    
    return jsonify(matches_data)

# Initialize database
with app.app_context():
    db.create_all()
    
    # Create default tournament if none exists
    if not Tournament.query.first():
        default_tournament = Tournament(
            name="Summer Cornhole Championship",
            max_teams=16,
            is_active=True,
            year=datetime.now().year
        )
        db.session.add(default_tournament)
        db.session.commit()

# Run the application
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)