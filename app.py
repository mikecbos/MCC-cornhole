import os
import logging
import csv
import secrets
import hashlib
import hmac
import base64
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


# Add this context processor to make tournaments available in all templates
@app.context_processor
def inject_tournaments():
    """Make tournaments available in all templates for navigation."""
    tournaments = []
    try:
        # Only try to get tournaments if the data directory is set up
        if os.path.exists("data/tournaments.csv"):
            tournaments = get_tournaments()
            # Sort by creation date (most recent first)
            tournaments.sort(key=lambda t: t.get("created_at", ""), reverse=True)
    except:
        # If there's an error, just return an empty list
        pass
    
    return {'tournaments': tournaments}



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
    """Home page shows the latest tournament bracket."""
    # Get all tournaments
    tournaments = get_tournaments()
    
    # Sort by creation date (most recent first)
    tournaments.sort(key=lambda t: t.get("created_at", ""), reverse=True)
    
    # Get the most recent active or completed tournament
    active_tournament = None
    for tournament in tournaments:
        if tournament.get("status") in ["active", "completed"]:
            active_tournament = tournament
            break
    
    # If no active/completed tournament is found, get the most recent pending one
    if not active_tournament and tournaments:
        active_tournament = tournaments[0]
    
    # If a tournament is found, redirect to its public view
    if active_tournament:
        return redirect(url_for("public_tournament_view", tournament_id=active_tournament["id"]))
    
    # If no tournaments exist, show welcome page
    return render_template("welcome.html")

@app.route("/register", methods=["GET", "POST"])
def register():
    """Registration page for participants."""
    if request.method == "POST":
        first_name = request.form.get("first_name")
        last_name = request.form.get("last_name")
        team_name = request.form.get("team_name")
        teammate_option = request.form.get("teammate_option", "none")  # new field
        
        # Validate primary participant
        if not first_name or not last_name or not team_name:
            flash("Name and team name are required", "danger")
            return redirect(url_for("register"))
        
        # Load existing participants and teams
        participants = get_participants()
        teams = get_teams()
        
        # Check if the primary participant already exists
        for participant in participants:
            if participant["first_name"].lower() == first_name.lower() and participant["last_name"].lower() == last_name.lower():
                flash(f"{first_name} {last_name} is already registered. If this is you, please use a different name or contact the administrator.", "danger")
                return redirect(url_for("register"))
        
        # Check or create team
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
        
        # Add the primary participant
        participant_id = str(len(participants) + 1)
        participant = {
            "id": participant_id,
            "first_name": first_name,
            "last_name": last_name,
            "team_id": team_id,
            "needs_teammate": teammate_option != "none",  # Flag if needs teammate assignment
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        participants.append(participant)
        
        # Handle teammate based on option selected
        if teammate_option == "specific":
            # User selected a specific teammate
            teammate_id = request.form.get("selected_teammate")
            if teammate_id:
                # Update the selected teammate's team_id
                for p in participants:
                    if p["id"] == teammate_id:
                        if p["team_id"] and p["team_id"] != team_id:
                            flash(f"Selected teammate is already in another team.", "danger")
                            return redirect(url_for("register"))
                        p["team_id"] = team_id
                        p["needs_teammate"] = False
                        flash(f"You have been teamed up with {p['first_name']} {p['last_name']}.", "success")
        
        elif teammate_option == "provide":
            # User is providing teammate details
            teammate_first_name = request.form.get("teammate_first_name")
            teammate_last_name = request.form.get("teammate_last_name")
            
            if not teammate_first_name or not teammate_last_name:
                flash("Teammate details are incomplete", "danger")
                return redirect(url_for("register"))
                
            # Check if the teammate already exists
            for p in participants:
                if p["first_name"].lower() == teammate_first_name.lower() and p["last_name"].lower() == teammate_last_name.lower():
                    flash(f"{teammate_first_name} {teammate_last_name} is already registered.", "danger")
                    return redirect(url_for("register"))
            
            # Add the teammate
            teammate_id = str(len(participants) + 1)
            teammate = {
                "id": teammate_id,
                "first_name": teammate_first_name,
                "last_name": teammate_last_name,
                "team_id": team_id,
                "needs_teammate": False,
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            participants.append(teammate)
            flash(f"You and {teammate_first_name} have been added to team '{team_name}'.", "success")
        
        elif teammate_option == "random":
            flash(f"You've been registered. An admin will assign you a teammate soon.", "success")
            participant["needs_teammate"] = True
        
        else:  # none - no teammate for now
            flash(f"You've been registered without a teammate. You can add one later.", "success")
            participant["needs_teammate"] = True
        
        # Save updated participants list
        write_csv("data/participants.csv", participants)
        return redirect(url_for("index"))
    
    # For GET request, prepare data for the form
    available_teammates = []
    participants = get_participants()
    for participant in participants:
        if participant.get("needs_teammate", True) and not participant.get("team_id"):
            available_teammates.append(participant)
    
    return render_template("register.html", available_teammates=available_teammates)

@app.route("/update-team-name", methods=["GET", "POST"])
def update_team_name():
    """Handle team name updates from registration emails."""
    # Get request parameters
    participant_id = request.args.get("id")
    token = request.args.get("token")
    
    if not participant_id or not token:
        flash("Invalid or missing parameters", "danger")
        return redirect(url_for("index"))
    
    # Get participant data
    participants = get_participants()
    participant = None
    
    for p in participants:
        if p["id"] == participant_id:
            participant = p
            break
    
    if not participant:
        flash("Participant not found", "danger")
        return redirect(url_for("index"))
    
    # Verify token (very basic security)
    # In a production app, you would use a more robust authentication method
    secret_key = os.environ.get("SECRET_KEY", "mcc2025cornhole")  # Should match Apps Script
    
    # For GET requests, display the form
    if request.method == "GET":
        # Only proceed if the token is valid
        try:
            # Get participant info from email service
            # You would need to implement more robust token verification in production
            return render_template(
                "update_team_name.html",
                participant=participant
            )
        except:
            flash("Invalid token", "danger")
            return redirect(url_for("index"))
    
    # For POST requests, update the team name
    elif request.method == "POST":
        new_team_name = request.form.get("team_name")
        confirm_token = request.form.get("token")
        
        if not new_team_name:
            flash("Team name is required", "danger")
            return redirect(url_for("update_team_name", id=participant_id, token=token))
        
        if token != confirm_token:
            flash("Invalid token", "danger")
            return redirect(url_for("index"))
        
        # Find or create the team
        teams = get_teams()
        team_id = None
        
        # Check if team with this name already exists
        for team in teams:
            if team["name"].lower() == new_team_name.lower():
                team_id = team["id"]
                break
        
        # Create new team if it doesn't exist
        if team_id is None:
            team_id = str(len(teams) + 1)
            team = {
                "id": team_id,
                "name": new_team_name,
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            teams.append(team)
            write_csv("data/teams.csv", teams)
        
        # Update participant's team
        for p in participants:
            if p["id"] == participant_id:
                p["team_id"] = team_id
                break
        
        write_csv("data/participants.csv", participants)
        
        flash(f"Team name updated successfully to '{new_team_name}'", "success")
        return render_template("update_success.html")

# Simple success page after the team name update
@app.route("/update-success")
def update_success():
    """Display success message after team name update."""
    return render_template("update_success.html")

# Add a route for all tournaments view
@app.route("/tournaments")
def all_tournaments():
    """Show all available tournaments."""
    tournaments = get_tournaments()
    
    # Sort by creation date (most recent first)
    tournaments.sort(key=lambda t: t.get("created_at", ""), reverse=True)
    
    return render_template(
        "all_tournaments.html",
        tournaments=tournaments
    )

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
            team_id = str(len(teams) + 1) if teams else "1"
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
            team_participants = [p for p in participants if p["team_id"] == team_id]
            if team_participants:
                # First remove all participants from the team
                for participant in participants:
                    if participant["team_id"] == team_id:
                        participant["team_id"] = ""
                        participant["needs_teammate"] = True
                
                write_csv("data/participants.csv", participants)
            
            # Now remove the team
            teams = [team for team in teams if team["id"] != team_id]
            write_csv("data/teams.csv", teams)
            flash("Team and all its members have been removed successfully", "success")
            
        elif action == "reassign_participant":
            participant_id = request.form.get("participant_id")
            new_team_id = request.form.get("new_team_id")
            
            if not participant_id or not new_team_id:
                flash("Participant ID and new team ID are required", "danger")
                return redirect(url_for("team_management"))
            
            # Check if participant already in the team
            participant = next((p for p in participants if p["id"] == participant_id), None)
            if participant and participant["team_id"] == new_team_id:
                flash("Participant is already in this team", "warning")
                return redirect(url_for("team_management"))
            
            # Update participant's team
            old_team_id = None
            for p in participants:
                if p["id"] == participant_id:
                    old_team_id = p["team_id"]
                    p["team_id"] = new_team_id
                    p["needs_teammate"] = False
                    
                    # Get team names for flash message
                    old_team_name = next((t["name"] for t in teams if t["id"] == old_team_id), "No team")
                    new_team_name = next((t["name"] for t in teams if t["id"] == new_team_id), "Unknown")
                    
                    flash(f"{p['first_name']} {p['last_name']} moved from '{old_team_name}' to '{new_team_name}'", "success")
                    break
            
            write_csv("data/participants.csv", participants)
            
        elif action == "delete_participant":
            participant_id = request.form.get("participant_id")
            
            if not participant_id:
                flash("Participant ID is required", "danger")
                return redirect(url_for("team_management"))
            
            # Find participant to get their name for the confirmation message
            participant_to_delete = next((p for p in participants if p["id"] == participant_id), None)
            if participant_to_delete:
                participant_name = f"{participant_to_delete['first_name']} {participant_to_delete['last_name']}"
            else:
                participant_name = "Participant"
                
            # Remove participant
            participants = [p for p in participants if p["id"] != participant_id]
            write_csv("data/participants.csv", participants)
            flash(f"{participant_name} deleted successfully", "success")
        
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
    
    # Get participants without a team
    unassigned_participants = [p for p in participants if not p["team_id"] or p["team_id"] == ""]
    
    return render_template(
        "team_management.html",
        teams=teams,
        participants=participants,
        teams_with_participants=teams_with_participants,
        unassigned_participants=unassigned_participants,
        team_dict=team_dict
    )

@app.route("/admin/team-names", methods=["GET", "POST"])
@admin_required
def team_name_management():
    """Team name management page for handling TBD team names."""
    participants = get_participants()
    teams = get_teams()
    
    # Filter participants with TBD team names
    tbd_participants = []
    for participant in participants:
        # Find the team for this participant
        team = None
        if participant["team_id"]:
            team = next((t for t in teams if t["id"] == participant["team_id"]), None)
        
        # If the participant has no team or team name is TBD, add to the list
        if not team or (team and team["name"] == "TBD"):
            tbd_participants.append(participant)
    
    if request.method == "POST":
        action = request.form.get("action")
        
        if action == "set_team_name":
            participant_id = request.form.get("participant_id")
            assign_existing = request.form.get("assign_existing_team") == "on"
            
            if not participant_id:
                flash("Participant ID is required", "danger")
                return redirect(url_for("team_name_management"))
            
            # Find the participant
            participant = next((p for p in participants if p["id"] == participant_id), None)
            if not participant:
                flash("Participant not found", "danger")
                return redirect(url_for("team_name_management"))
            
            # Handle assigning to existing team or creating new team
            if assign_existing:
                team_id = request.form.get("existing_team_id")
                if not team_id:
                    flash("Existing team ID is required when using 'Assign to existing team'", "danger")
                    return redirect(url_for("team_name_management"))
                
                # Update participant's team
                participant["team_id"] = team_id
                
                # Get team name for confirmation message
                team_name = next((t["name"] for t in teams if t["id"] == team_id), "Unknown")
                flash(f"Participant assigned to existing team '{team_name}'", "success")
            else:
                team_name = request.form.get("team_name")
                if not team_name:
                    flash("Team name is required", "danger")
                    return redirect(url_for("team_name_management"))
                
                # Check if a team with this name already exists
                existing_team = next((t for t in teams if t["name"].lower() == team_name.lower()), None)
                
                if existing_team:
                    # Use existing team
                    participant["team_id"] = existing_team["id"]
                    flash(f"Participant assigned to existing team '{team_name}'", "success")
                else:
                    # Create new team
                    team_id = str(len(teams) + 1)
                    team = {
                        "id": team_id,
                        "name": team_name,
                        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    }
                    teams.append(team)
                    write_csv("data/teams.csv", teams)
                    
                    # Update participant's team
                    participant["team_id"] = team_id
                    flash(f"New team '{team_name}' created and participant assigned", "success")
            
            # Save participant changes
            write_csv("data/participants.csv", participants)
            
        elif action == "resend_email":
            participant_id = request.form.get("participant_id")
            participant_email = request.form.get("participant_email")
            
            if not participant_id:
                flash("Participant ID is required", "danger")
                return redirect(url_for("team_name_management"))
            
            if not participant_email:
                flash("Email address is required", "danger")
                return redirect(url_for("team_name_management"))
            
            # Find the participant
            participant = next((p for p in participants if p["id"] == participant_id), None)
            if not participant:
                flash("Participant not found", "danger")
                return redirect(url_for("team_name_management"))
            
            # Update email if changed
            if participant.get("email", "") != participant_email:
                participant["email"] = participant_email
                write_csv("data/participants.csv", participants)
            
            # Generate token for update link
            # In a real application, this would be more secure
            secret_key = os.environ.get("SECRET_KEY", "mcc2025cornhole")
            token_base = participant_id + participant_email + secret_key
            token = hashlib.sha256(token_base.encode()).hexdigest()
            
            # Create the update link
            update_link = f"{request.host_url.rstrip('/')}/update-team-name?id={participant_id}&token={token}"
            
            # In a real application, you would send an email here
            # For this example, we'll just display the link
            flash(f"Email would be sent to {participant_email} with link: {update_link}", "info")
            flash("Note: In a production environment, this would send an actual email", "warning")
        
        return redirect(url_for("team_name_management"))
    
    return render_template(
        "team_name_management.html",
        tbd_participants=tbd_participants,
        teams=teams
    )

@app.route("/admin/tournament/new", methods=["GET", "POST"])
@admin_required
def tournament_config():
    """Tournament configuration page."""
    teams = get_teams()
    tournaments = get_tournaments()
    participants = get_participants()
    
    # Filter to show only teams with at least one member
    valid_teams = []
    for team in teams:
        team_members = [p for p in participants if p["team_id"] == team["id"]]
        if team_members:
            # Add member count to team object for display
            team_copy = team.copy()
            team_copy["member_count"] = len(team_members)
            valid_teams.append(team_copy)
    
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
    """Tournament bracket view page for admins."""
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

@app.route("/tournament/<tournament_id>")
def public_tournament_view(tournament_id):
    """Public tournament bracket view page that works as a landing page."""
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
        "public_tournament_view.html",
        tournament=tournament,
        rounds=sorted_rounds,
        team_dict=team_dict
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
