import os
import logging
import csv
import secrets
from datetime import datetime
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash
from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify
from flask_wtf import CSRFProtect
from flask_wtf.csrf import CSRFError
from dotenv import load_dotenv

from utils import (
    check_data_dir, read_csv, write_csv, get_participants, get_teams, 
    get_tournaments, get_matches, generate_tournament_bracket, 
    get_team_by_id, get_participant_by_id, get_tournament_by_id, get_match_by_id
)

# Set up logging
logging.basicConfig(level=logging.DEBUG)

# Ensure .env file is loaded
load_dotenv(verbose=True)  # Added verbose=True to see debug output

# Create Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", secrets.token_hex(16))

# Initialize CSRF protection
csrf = CSRFProtect(app)

# Ensure data directory and CSV files exist
check_data_dir()

# Add context processor to make variables available to all templates
@app.context_processor
def inject_now():
    return {'now': datetime.now()}

# Admin credentials (in a real app, these would be stored securely)
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")

# Make sure these variables are defined and not None
if not ADMIN_USERNAME or not ADMIN_PASSWORD:
    raise ValueError("Admin credentials not found in environment variables. Check your .env file.")

# Decorator for admin authentication
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "admin_logged_in" not in session or not session["admin_logged_in"]:
            flash("You need to login as admin to access this page.", "danger")
            return redirect(url_for("admin_login"))
        return f(*args, **kwargs)
    return decorated_function

# Routes
@app.route("/")
def index():
    """Home page route."""
    return render_template("index.html")

@app.route("/register", methods=["GET", "POST"])
def register():
    """Registration page for participants."""
    if request.method == "POST":
        first_name = request.form.get("first_name")
        last_name = request.form.get("last_name")
        teammate_first_name = request.form.get("teammate_first_name")
        teammate_last_name = request.form.get("teammate_last_name")
        team_name = request.form.get("team_name")
        
        if not first_name or not last_name or not teammate_first_name or not teammate_last_name or not team_name:
            flash("All fields are required", "danger")
            return redirect(url_for("register"))
        
        # Load existing participants and teams
        participants = get_participants()
        teams = get_teams()
        
        # Check if participants already exist
        for participant in participants:
            # Check if the player is already registered
            if participant["first_name"].lower() == first_name.lower() and participant["last_name"].lower() == last_name.lower():
                flash(f"{first_name} {last_name} is already registered. If this is you, please use a different name or contact the administrator.", "danger")
                return redirect(url_for("register"))
            
            # Check if the teammate is already registered
            if participant["first_name"].lower() == teammate_first_name.lower() and participant["last_name"].lower() == teammate_last_name.lower():
                flash(f"{teammate_first_name} {teammate_last_name} is already registered. Please use a different teammate or contact the administrator.", "danger")
                return redirect(url_for("register"))
        
        # Check if team exists or create new one
        team_id = None
        for team in teams:
            if team["name"].lower() == team_name.lower():
                team_id = team["id"]
                break
        
        if team_id is None:
            # Create new team
            team_id = str(len(teams) + 1)
            team = {
                "id": team_id,
                "name": team_name,
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            teams.append(team)
            write_csv("data/teams.csv", teams)
        
        # Add the first participant (player)
        participant_id = str(len(participants) + 1)
        participant = {
            "id": participant_id,
            "first_name": first_name,
            "last_name": last_name,
            "team_id": team_id,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        participants.append(participant)
        
        # Add the second participant (teammate)
        teammate_id = str(len(participants) + 1)
        teammate = {
            "id": teammate_id,
            "first_name": teammate_first_name,
            "last_name": teammate_last_name,
            "team_id": team_id,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        participants.append(teammate)
        
        # Save updated participants list
        write_csv("data/participants.csv", participants)
        
        flash(f"Thank you for registering, {first_name}! You and {teammate_first_name} have been added to team '{team_name}'.", "success")
        return redirect(url_for("index"))
    
    return render_template("register.html")

@app.route("/admin/login", methods=["GET", "POST"])
def admin_login():
    """Admin login page."""
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        
        # Add debugging info
        app.logger.info(f"Login attempt - Username: {username}")
        app.logger.info(f"Expected admin username: {ADMIN_USERNAME}")
        app.logger.info(f"Password match: {password == ADMIN_PASSWORD}")
        
        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            session["admin_logged_in"] = True
            flash("You have been logged in as admin.", "success")
            return redirect(url_for("admin_dashboard"))
        else:
            flash("Invalid credentials. Please try again.", "danger")
            
    return render_template("admin_login.html")

@app.route("/admin/logout")
def admin_logout():
    """Admin logout route."""
    session.pop("admin_logged_in", None)
    flash("You have been logged out.", "success")
    return redirect(url_for("index"))

@app.route("/admin/dashboard")
@admin_required
def admin_dashboard():
    """Admin dashboard showing tournament and registration overview."""
    participants = get_participants()
    teams = get_teams()
    tournaments = get_tournaments()
    
    return render_template(
        "admin_dashboard.html",
        participants=participants,
        teams=teams,
        tournaments=tournaments,
        participants_count=len(participants),
        teams_count=len(teams),
        tournaments_count=len(tournaments)
    )

@app.route("/admin/teams", methods=["GET", "POST"])
@admin_required
def team_management():
    """Team management page."""
    teams = get_teams()
    participants = get_participants()
    
    if request.method == "POST":
        action = request.form.get("action")
        
        if action == "create_team":
            team_name = request.form.get("team_name")
            if not team_name:
                flash("Team name is required", "danger")
                return redirect(url_for("team_management"))
            
            # Check if team already exists
            for team in teams:
                if team["name"].lower() == team_name.lower():
                    flash(f"Team '{team_name}' already exists", "danger")
                    return redirect(url_for("team_management"))
            
            # Create new team
            team_id = str(len(teams) + 1)
            team = {
                "id": team_id,
                "name": team_name,
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            teams.append(team)
            write_csv("data/teams.csv", teams)
            flash(f"Team '{team_name}' created successfully", "success")
            
        elif action == "edit_team":
            team_id = request.form.get("team_id")
            team_name = request.form.get("team_name")
            
            if not team_id or not team_name:
                flash("Team ID and name are required", "danger")
                return redirect(url_for("team_management"))
            
            # Update team name
            for team in teams:
                if team["id"] == team_id:
                    team["name"] = team_name
                    break
            
            write_csv("data/teams.csv", teams)
            flash(f"Team updated successfully", "success")
            
        elif action == "delete_team":
            team_id = request.form.get("team_id")
            
            if not team_id:
                flash("Team ID is required", "danger")
                return redirect(url_for("team_management"))
            
            # Check if there are participants in the team
            for participant in participants:
                if participant["team_id"] == team_id:
                    flash("Cannot delete team with participants. Please reassign participants first.", "danger")
                    return redirect(url_for("team_management"))
            
            # Remove team
            teams = [team for team in teams if team["id"] != team_id]
            write_csv("data/teams.csv", teams)
            flash("Team deleted successfully", "success")
            
        elif action == "reassign_participant":
            participant_id = request.form.get("participant_id")
            new_team_id = request.form.get("new_team_id")
            
            if not participant_id or not new_team_id:
                flash("Participant ID and new team ID are required", "danger")
                return redirect(url_for("team_management"))
            
            # Update participant's team
            for participant in participants:
                if participant["id"] == participant_id:
                    old_team_id = participant["team_id"]
                    participant["team_id"] = new_team_id
                    
                    # Get team names for flash message
                    old_team_name = next((t["name"] for t in teams if t["id"] == old_team_id), "Unknown")
                    new_team_name = next((t["name"] for t in teams if t["id"] == new_team_id), "Unknown")
                    
                    flash(f"{participant['first_name']} {participant['last_name']} moved from '{old_team_name}' to '{new_team_name}'", "success")
                    break
            
            write_csv("data/participants.csv", participants)
            
        elif action == "delete_participant":
            participant_id = request.form.get("participant_id")
            
            if not participant_id:
                flash("Participant ID is required", "danger")
                return redirect(url_for("team_management"))
            
            # Remove participant
            participants = [p for p in participants if p["id"] != participant_id]
            write_csv("data/participants.csv", participants)
            flash("Participant deleted successfully", "success")
        
        return redirect(url_for("team_management"))
    
    # Create a lookup dict of team names by ID for easier display
    team_dict = {team["id"]: team["name"] for team in teams}
    
    # Group participants by team
    teams_with_participants = []
    for team in teams:
        team_participants = [p for p in participants if p["team_id"] == team["id"]]
        teams_with_participants.append({
            "team": team,
            "participants": team_participants
        })
    
    return render_template(
        "team_management.html",
        teams=teams,
        participants=participants,
        teams_with_participants=teams_with_participants,
        team_dict=team_dict
    )

@app.route("/admin/tournament/new", methods=["GET", "POST"])
@admin_required
def tournament_config():
    """Tournament configuration page."""
    teams = get_teams()
    tournaments = get_tournaments()
    
    if request.method == "POST":
        tournament_name = request.form.get("tournament_name")
        tournament_type = request.form.get("tournament_type")
        selected_teams = request.form.getlist("selected_teams")
        
        if not tournament_name or not tournament_type or not selected_teams:
            flash("Tournament name, type, and at least one team are required", "danger")
            return redirect(url_for("tournament_config"))
        
        # Create new tournament
        tournament_id = str(len(tournaments) + 1)
        tournament = {
            "id": tournament_id,
            "name": tournament_name,
            "type": tournament_type,
            "status": "pending",  # pending, active, completed
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        tournaments.append(tournament)
        write_csv("data/tournaments.csv", tournaments)
        
        # Generate tournament bracket
        matches = get_matches()
        new_matches = generate_tournament_bracket(tournament_id, tournament_type, selected_teams)
        matches.extend(new_matches)
        write_csv("data/matches.csv", matches)
        
        flash(f"Tournament '{tournament_name}' created successfully", "success")
        return redirect(url_for("tournament_view", tournament_id=tournament_id))
    
    return render_template(
        "tournament_config.html",
        teams=teams
    )

@app.route("/admin/tournament/<tournament_id>")
@admin_required
def tournament_view(tournament_id):
    """Tournament bracket view page."""
    tournament = get_tournament_by_id(tournament_id)
    if not tournament:
        flash("Tournament not found", "danger")
        return redirect(url_for("admin_dashboard"))
    
    matches = get_matches()
    tournament_matches = [m for m in matches if m["tournament_id"] == tournament_id]
    
    # Group matches by round
    rounds = {}
    for match in tournament_matches:
        round_num = match["round"]
        if round_num not in rounds:
            rounds[round_num] = []
        rounds[round_num].append(match)
    
    # Sort rounds by round number
    sorted_rounds = {k: rounds[k] for k in sorted(rounds.keys())}
    
    teams = get_teams()
    team_dict = {team["id"]: team["name"] for team in teams}
    
    return render_template(
        "tournament_view.html",
        tournament=tournament,
        rounds=sorted_rounds,
        team_dict=team_dict
    )

@app.route("/admin/match/<match_id>", methods=["GET", "POST"])
@admin_required
def match_view(match_id):
    """Match details and score update page."""
    match = get_match_by_id(match_id)
    if not match:
        flash("Match not found", "danger")
        return redirect(url_for("admin_dashboard"))
    
    teams = get_teams()
    team_dict = {team["id"]: team["name"] for team in teams}
    
    team1 = get_team_by_id(match["team1_id"]) if match["team1_id"] else None
    team2 = get_team_by_id(match["team2_id"]) if match["team2_id"] else None
    
    if request.method == "POST":
        team1_score = request.form.get("team1_score")
        team2_score = request.form.get("team2_score")
        
        if not team1_score or not team2_score:
            flash("Both scores are required", "danger")
            return redirect(url_for("match_view", match_id=match_id))
        
        try:
            team1_score = int(team1_score)
            team2_score = int(team2_score)
        except ValueError:
            flash("Scores must be numbers", "danger")
            return redirect(url_for("match_view", match_id=match_id))
        
        # Update match with scores
        matches = get_matches()
        for m in matches:
            if m["id"] == match_id:
                m["team1_score"] = str(team1_score)
                m["team2_score"] = str(team2_score)
                m["status"] = "completed"
                
                # Determine winner
                if team1_score > team2_score:
                    m["winner_id"] = m["team1_id"]
                elif team2_score > team1_score:
                    m["winner_id"] = m["team2_id"]
                else:
                    m["winner_id"] = ""  # Tie
                
                # Update next match if applicable
                if m["next_match_id"]:
                    next_match = next((nm for nm in matches if nm["id"] == m["next_match_id"]), None)
                    if next_match:
                        # Determine if this is the first or second team in next match
                        if m["next_match_position"] == "1":
                            next_match["team1_id"] = m["winner_id"]
                        else:
                            next_match["team2_id"] = m["winner_id"]
                
                flash(f"Match scores updated successfully", "success")
                break
        
        write_csv("data/matches.csv", matches)
        
        # Check if this is the final match and update tournament status if needed
        tournament = get_tournament_by_id(match["tournament_id"])
        if tournament:
            tournament_matches = [m for m in matches if m["tournament_id"] == match["tournament_id"]]
            all_completed = all(m["status"] == "completed" for m in tournament_matches)
            
            if all_completed:
                tournaments = get_tournaments()
                for t in tournaments:
                    if t["id"] == match["tournament_id"]:
                        t["status"] = "completed"
                        break
                write_csv("data/tournaments.csv", tournaments)
                flash(f"Tournament '{tournament['name']}' has been completed!", "success")
        
        return redirect(url_for("tournament_view", tournament_id=match["tournament_id"]))
    
    return render_template(
        "match_view.html",
        match=match,
        team1=team1,
        team2=team2,
        team_dict=team_dict
    )

@app.route("/view/tournament/<tournament_id>")
def public_tournament_view(tournament_id):
    """Public tournament bracket view page."""
    tournament = get_tournament_by_id(tournament_id)
    if not tournament:
        flash("Tournament not found", "danger")
        return redirect(url_for("index"))
    
    matches = get_matches()
    tournament_matches = [m for m in matches if m["tournament_id"] == tournament_id]
    
    # Group matches by round
    rounds = {}
    for match in tournament_matches:
        round_num = match["round"]
        if round_num not in rounds:
            rounds[round_num] = []
        rounds[round_num].append(match)
    
    # Sort rounds by round number
    sorted_rounds = {k: rounds[k] for k in sorted(rounds.keys())}
    
    teams = get_teams()
    team_dict = {team["id"]: team["name"] for team in teams}
    
    return render_template(
        "tournament_view.html",
        tournament=tournament,
        rounds=sorted_rounds,
        team_dict=team_dict,
        public_view=True
    )

# For debugging purposes, you can add this to check what values are being loaded
print(f"Admin username from env: {os.environ.get('ADMIN_USERNAME')}")  # This will print during startup
print(f"Admin password from env: (length: {len(os.environ.get('ADMIN_PASSWORD', ''))})")  # Print password length for security

@app.errorhandler(CSRFError)
@app.errorhandler(CSRFError)
def handle_csrf_error(e):
    """Handle CSRF errors."""
    return render_template('index.html', error=e.description), 400

@app.errorhandler(404)
def page_not_found(e):
    """Handle 404 errors."""
    return render_template('index.html', error="Page not found"), 404

@app.errorhandler(500)
def server_error(e):
    """Handle 500 errors."""
    return render_template('index.html', error="Internal server error"), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
