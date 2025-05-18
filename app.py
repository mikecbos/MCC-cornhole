import os
import logging
import csv
import secrets
import hashlib # Keep if used by /update-team-name or /admin/team-names
import io # For CSV processing
# import hmac # Not currently used
# import base64 # Not currently used
from datetime import datetime
from functools import wraps
# from werkzeug.security import generate_password_hash, check_password_hash # For future user auth
from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify, Response
from flask_wtf import CSRFProtect
from flask_wtf.csrf import CSRFError # Keep for error handler
from dotenv import load_dotenv
import click # For Flask CLI commands `flask run`


# --- Application-Specific Imports ---
from utils import generate_tournament_bracket # Assuming this is the ORM-refactored version
from models import db, Team, Participant, Tournament, Match
from flask_migrate import Migrate

# --- Constants / Configuration Parameters ---
APP_POLICY_MAX_TEAM_NAME_LENGTH = 30  # Policy for operational team name length
DB_SCHEMA_MAX_TEAM_NAME_LENGTH = 100   # Actual DB schema limit for Team.name

# Set up logging
logging.basicConfig(level=logging.INFO) # Changed to INFO for less noise, DEBUG for more detail

# Ensure .env file is loaded
load_dotenv(verbose=True)

# Create Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", secrets.token_hex(16))
DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    raise ValueError("No DATABASE_URL set for Flask application. Please set .env or environment variable.")
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# --- Add Engine Options Here ---
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True  # Enable pre-ping to check connections before use
    # Optional: Add pool_recycle if you know the idle timeout of your DB
    # e.g., if timeout is 5 minutes (300s), set recycle lower
    # 'pool_recycle': 280
}

# Initialize extensions
csrf = CSRFProtect(app)
db.init_app(app)
migrate = Migrate(app, db)

# Admin credentials
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")
if not ADMIN_USERNAME or not ADMIN_PASSWORD:
    raise ValueError("Admin credentials not found in environment variables. Check your .env file.")

# --- Context Processors ---
@app.context_processor
def inject_now():
    return {'now': datetime.now()}

@app.context_processor
def inject_tournaments():
    tournaments_data = []
    try:
        tournaments_data = Tournament.query.order_by(Tournament.created_at.desc()).all()
    except Exception as e:
        logging.error(f"Error fetching tournaments for context processor: {e}", exc_info=True)
    return {'tournaments': tournaments_data}

@app.context_processor
def inject_default_tournament_id():
    default_tournament_id = None
    try:
        # Find the one tournament marked as default
        default_tournament = Tournament.query.filter_by(is_default=True).first()
        if default_tournament:
            default_tournament_id = default_tournament.id
    except Exception as e:
        # Log error but don't crash layout rendering
        logging.error(f"Error fetching default tournament ID for context processor: {e}", exc_info=False)
    return {'default_tournament_id': default_tournament_id}


# --- Decorators ---
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "admin_logged_in" not in session or not session["admin_logged_in"]:
            flash("You need to login as admin to access this page.", "danger")
            return redirect(url_for("admin_login"))
        return f(*args, **kwargs)
    return decorated_function

# --- Public Routes ---
@app.route("/")
def index():
    active_tournament_obj = None
    try:
        active_tournament_obj = Tournament.query.filter(
            Tournament.status.in_(['active', 'completed'])
        ).order_by(Tournament.created_at.desc()).first()
        if not active_tournament_obj:
            active_tournament_obj = Tournament.query.filter_by(
                status='pending'
            ).order_by(Tournament.created_at.desc()).first()
        if not active_tournament_obj:
            active_tournament_obj = Tournament.query.order_by(Tournament.created_at.desc()).first()
    except Exception as e:
        logging.error(f"Error fetching tournament for index page: {e}", exc_info=True)
        flash("Could not load tournament information.", "warning")
    if active_tournament_obj:
        return redirect(url_for("public_tournament_view", tournament_id=active_tournament_obj.id))
    return render_template("welcome.html")

@app.route("/register", methods=["GET"])
def register():
    """Displays registration information."""
    return render_template("registration_info.html")

@app.route("/update-team-name", methods=["GET", "POST"])
def update_team_name():
    """Handle team name updates from registration emails."""
    # ### NEEDS ORM REFACTOR ###
    # This route currently uses CSV logic (get_participants, get_teams, write_csv)
    # It needs to be updated to use Participant.query, Team.query, db.session.add/commit
    # For now, it will likely error or behave unexpectedly.
    participant_id_str = request.args.get("id")
    token = request.args.get("token")
    
    if not participant_id_str or not token:
        flash("Invalid or missing parameters", "danger")
        return redirect(url_for("index"))

    try:
        participant_id = int(participant_id_str)
        participant_obj = Participant.query.get(participant_id)
    except ValueError:
        flash("Invalid participant ID format.", "danger")
        return redirect(url_for("index"))
        
    if not participant_obj:
        flash("Participant not found", "danger")
        return redirect(url_for("index"))
    
    # Basic token verification (replace with robust method in production)
    # This token logic needs secure generation and verification if this feature is kept.
    # For now, placeholder.
    # secret_key_token = os.environ.get("SECRET_KEY", "mcc2025cornhole") 
    # expected_token_base = str(participant_obj.id) + participant_obj.email + secret_key_token # Assuming participant has an email field
    # expected_token = hashlib.sha256(expected_token_base.encode()).hexdigest()
    # if token != expected_token:
    #     flash("Invalid or expired token.", "danger")
    #     return redirect(url_for("index"))

    if request.method == "POST":
        new_team_name_raw = request.form.get("team_name", "").strip()
        # confirm_token = request.form.get("token") # Re-verify token on POST

        # if token != confirm_token: # Simplified check
        #     flash("Invalid token on submission.", "danger")
        #     return redirect(url_for("index"))

        if not new_team_name_raw:
            flash("Team name is required", "danger")
            return render_template("update_team_name.html", participant=participant_obj, token=token) # Re-render form

        # Apply policy for team name length
        team_name_to_use = new_team_name_raw
        if len(new_team_name_raw) > APP_POLICY_MAX_TEAM_NAME_LENGTH:
            team_name_to_use = new_team_name_raw[:APP_POLICY_MAX_TEAM_NAME_LENGTH]
            flash(f"Team name '{new_team_name_raw}' was truncated to '{team_name_to_use}' as per policy.", "info")
        
        try:
            team_obj = Team.query.filter(db.func.lower(Team.name) == team_name_to_use.lower()).first()
            if not team_obj:
                team_obj = Team(name=team_name_to_use)
                db.session.add(team_obj)
                # No need to flush here if we are only assigning team_obj to participant
            
            participant_obj.team_assigned = team_obj # Assign ORM object
            # participant_obj.needs_teammate = False # If assigning team means they have one
            db.session.commit()
            flash(f"Team name for {participant_obj.first_name} {participant_obj.last_name} updated successfully to '{team_obj.name}'", "success")
            return render_template("update_success.html")
        except Exception as e:
            db.session.rollback()
            flash(f"Error updating team name: {str(e)}", "danger")
            logging.error(f"Update team name error: {e}", exc_info=True)
            
    # For GET request or if POST fails and re-renders
    return render_template("update_team_name.html", participant=participant_obj, token=token)


@app.route("/update-success")
def update_success():
    return render_template("update_success.html")

@app.route("/tournaments")
def tournaments_list():
    try:
        all_tournaments_data = Tournament.query.order_by(Tournament.created_at.desc()).all()
    except Exception as e:
        logging.error(f"Error fetching tournaments list: {e}", exc_info=True)
        flash("Could not load the list of tournaments.", "danger")
        all_tournaments_data = []
    return render_template("all_tournaments.html", tournaments=all_tournaments_data)

@app.route("/tournament/<int:tournament_id>")
def public_tournament_view(tournament_id):
    try:
        tournament_obj = Tournament.query.get_or_404(tournament_id)
        # Eager load related team data for efficiency in the template loop
        tournament_matches_list = Match.query.options(
                db.joinedload(Match.team1),
                db.joinedload(Match.team2),
                db.joinedload(Match.winner)
            ).filter_by(tournament_id=tournament_obj.id)\
             .order_by(Match.round_number, Match.match_in_round)\
             .all()

        rounds_dict = {}
        team_ids_in_matches = set()
        for match_obj in tournament_matches_list:
            round_num = match_obj.round_number
            if round_num not in rounds_dict: rounds_dict[round_num] = []
            rounds_dict[round_num].append(match_obj)
            # Collect team IDs involved
            if match_obj.team1_id: team_ids_in_matches.add(match_obj.team1_id)
            if match_obj.team2_id: team_ids_in_matches.add(match_obj.team2_id)
            if match_obj.winner_id: team_ids_in_matches.add(match_obj.winner_id) # Include winner for final display

        # Fetch teams involved AND their participants (eager load)
        teams_involved = []
        if team_ids_in_matches:
            teams_involved = Team.query.options(
                db.joinedload(Team.participants) # Eager load participants
            ).filter(Team.id.in_(list(team_ids_in_matches))).all()

        # Create a dictionary mapping team ID to a formatted display string
        team_display_dict = {}
        for team in teams_involved:
            # Format participant names (e.g., "John D., Jane S.") - sorted for consistency
            participant_names = ", ".join(sorted([
                f"{p.first_name} {p.last_name[:1]}."
                for p in team.participants if p.first_name and p.last_name
            ]))
            # Handle cases where a team might exist but have no participants listed
            if participant_names:
                team_display_dict[team.id] = f"{team.name} ({participant_names})"
            else:
                 # Fallback if no participants found for an involved team
                 team_display_dict[team.id] = team.name
    
        # Get the list of visible tournaments for navigation
        all_tournaments = Tournament.query.filter(
            Tournament.status.in_(['active', 'completed', 'pending'])
        ).order_by(Tournament.created_at.desc()).all()
        all_tournament_ids = [t.id for t in all_tournaments]
        
        # Find adjacent tournaments
        try:
            current_index = all_tournament_ids.index(tournament_id)
            next_tournament_id = all_tournament_ids[current_index + 1] if current_index < len(all_tournament_ids) - 1 else None
            prev_tournament_id = all_tournament_ids[current_index - 1] if current_index > 0 else None
            
            # Get names for better UX
            next_tournament_name = Tournament.query.get(next_tournament_id).name if next_tournament_id else None
            prev_tournament_name = Tournament.query.get(prev_tournament_id).name if prev_tournament_id else None
        except (ValueError, IndexError):
            next_tournament_id = prev_tournament_id = None
            next_tournament_name = prev_tournament_name = None
    
    
    except Exception as e:
        logging.error(f"Error fetching public tournament view for ID {tournament_id}: {e}", exc_info=True)
        flash("Error loading tournament details.", "danger")
        return redirect(url_for("index"))

    return render_template(
        "public_tournament_view.html",
        tournament=tournament_obj,
        rounds=rounds_dict,
        team_dict=team_display_dict,
        public_view=True,
        next_tournament_id=next_tournament_id,
        prev_tournament_id=prev_tournament_id,
        next_tournament_name=next_tournament_name,
        prev_tournament_name=prev_tournament_name
    )

# --- Admin Routes ---
@app.route("/admin/login", methods=["GET", "POST"])
def admin_login():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            session["admin_logged_in"] = True
            flash("You have been logged in as admin.", "success")
            return redirect(url_for("admin_dashboard"))
        else:
            flash("Invalid credentials. Please try again.", "danger")
    return render_template("admin_login.html")

@app.route("/admin/logout")
def admin_logout():
    session.pop("admin_logged_in", None)
    flash("You have been logged out.", "success")
    return redirect(url_for("index"))

@app.route("/admin/dashboard")
@admin_required
def admin_dashboard():
    try:
        participants_count = Participant.query.count()
        teams_count = Team.query.count()
        tournaments_count = Tournament.query.count()
        participants = Participant.query.order_by(Participant.created_at.desc()).limit(5).all()
        teams = Team.query.order_by(Team.created_at.desc()).limit(5).all()
        tournaments = Tournament.query.order_by(Tournament.created_at.desc()).limit(5).all()
    except Exception as e:
        flash(f"Error loading dashboard data: {str(e)}", "danger")
        logging.error(f"Admin dashboard error: {e}", exc_info=True)
        participants_count, teams_count, tournaments_count = 0, 0, 0
        participants, teams, tournaments = [], [], []
    return render_template("admin_dashboard.html", participants=participants, teams=teams, tournaments=tournaments,
                           participants_count=participants_count, teams_count=teams_count, tournaments_count=tournaments_count)

@app.route("/admin/teams", methods=["GET", "POST"])
@admin_required
def team_management():
    teams_list = Team.query.order_by(Team.name).all()
    participants_list = Participant.query.order_by(Participant.last_name, Participant.first_name).all()
    
    if request.method == "POST":
        action = request.form.get("action")
        try:
            if action == "create_team":
                team_name_raw = request.form.get("team_name", "").strip()
                if not team_name_raw:
                    flash("Team name is required", "danger")
                    return redirect(url_for("team_management"))
                
                team_name_to_create = team_name_raw
                if len(team_name_raw) > APP_POLICY_MAX_TEAM_NAME_LENGTH:
                    team_name_to_create = team_name_raw[:APP_POLICY_MAX_TEAM_NAME_LENGTH]
                    flash(f"Team name '{team_name_raw}' truncated to '{team_name_to_create}' due to policy limit.", "info")

                if len(team_name_to_create) > DB_SCHEMA_MAX_TEAM_NAME_LENGTH: # Should not happen if policy is stricter
                     team_name_to_create = team_name_to_create[:DB_SCHEMA_MAX_TEAM_NAME_LENGTH]
                     flash(f"Team name further truncated to fit database.", "warning")

                existing_team = Team.query.filter(db.func.lower(Team.name) == team_name_to_create.lower()).first()
                if existing_team:
                    flash(f"Team '{team_name_to_create}' already exists.", "danger")
                else:
                    new_team = Team(name=team_name_to_create)
                    db.session.add(new_team)
                    db.session.commit()
                    flash(f"Team '{new_team.name}' created successfully.", "success")
            
            elif action == "edit_team":
                team_id = request.form.get("team_id")
                new_team_name_raw = request.form.get("team_name", "").strip()
                if not team_id or not new_team_name_raw:
                    flash("Team ID and new name are required.", "danger")
                    return redirect(url_for("team_management"))

                team_to_edit = Team.query.get(team_id)
                if not team_to_edit:
                    flash("Team not found.", "danger")
                else:
                    new_team_name_processed = new_team_name_raw
                    if len(new_team_name_raw) > APP_POLICY_MAX_TEAM_NAME_LENGTH:
                        new_team_name_processed = new_team_name_raw[:APP_POLICY_MAX_TEAM_NAME_LENGTH]
                        flash(f"New team name '{new_team_name_raw}' truncated to '{new_team_name_processed}' due to policy.", "info")
                    
                    if len(new_team_name_processed) > DB_SCHEMA_MAX_TEAM_NAME_LENGTH: # Should not happen
                        new_team_name_processed = new_team_name_processed[:DB_SCHEMA_MAX_TEAM_NAME_LENGTH]
                        flash(f"New team name further truncated for DB.", "warning")

                    if Team.query.filter(db.func.lower(Team.name) == new_team_name_processed.lower(), Team.id != int(team_id)).first():
                        flash(f"Another team with the name '{new_team_name_processed}' already exists.", "danger")
                    else:
                        team_to_edit.name = new_team_name_processed
                        db.session.commit()
                        flash(f"Team updated successfully to '{team_to_edit.name}'.", "success")
            
            elif action == "delete_team":
                team_id = request.form.get("team_id")
                if not team_id:
                    flash("Team ID is required.", "danger")
                else:
                    team_to_delete = Team.query.get(team_id)
                    if not team_to_delete:
                        flash("Team not found.", "danger")
                    else:
                        active_matches_count = Match.query.filter(
                            ((Match.team1_id == team_id) | (Match.team2_id == team_id)),
                            Match.status != 'completed'
                        ).count()
                        if active_matches_count > 0:
                            flash(f"Cannot delete team '{team_to_delete.name}' as it is part of {active_matches_count} active or pending matches.", "warning")
                        else:
                            for p in team_to_delete.participants: # Unassign participants first
                                p.team_id = None
                                p.needs_teammate = True
                            # No need to commit here yet, can be part of the larger transaction

                            # Nullify FKs in Match table for this team
                            # Using the corrected db.case() syntax
                            Match.query.filter(
                                (Match.team1_id == team_id) | 
                                (Match.team2_id == team_id) | 
                                (Match.winner_id == team_id)
                            ).update({
                                'team1_id': db.case((Match.team1_id == team_id, None), else_=Match.team1_id),
                                'team2_id': db.case((Match.team2_id == team_id, None), else_=Match.team2_id),
                                'winner_id': db.case((Match.winner_id == team_id, None), else_=Match.winner_id)
                            }, synchronize_session='fetch') # 'fetch' is generally safer

                            db.session.delete(team_to_delete)
                            db.session.commit() # Commit all changes
                            flash(f"Team '{team_to_delete.name}' and its participant assignments removed successfully.", "success")
            
            elif action == "reassign_participant":
                participant_id = request.form.get("participant_id")
                new_team_id_str = request.form.get("new_team_id")
                if not participant_id: 
                    flash("Participant ID is required.", "danger")
                else:
                    p_to_reassign = Participant.query.get(participant_id)
                    if not p_to_reassign: 
                        flash("Participant not found.", "danger")
                    else:
                        old_team_name = p_to_reassign.team_assigned.name if p_to_reassign.team_assigned else "No team"
                        if new_team_id_str and new_team_id_str != "unassign":
                            new_team = Team.query.get(int(new_team_id_str))
                            if not new_team: 
                                flash("New team not found.", "danger")
                            else:
                                p_to_reassign.team_assigned = new_team
                                p_to_reassign.needs_teammate = False
                                db.session.commit()
                                flash(f"{p_to_reassign.first_name} moved from '{old_team_name}' to '{new_team.name}'.", "success")
                        else:
                            p_to_reassign.team_assigned = None
                            p_to_reassign.needs_teammate = True
                            db.session.commit()
                            flash(f"{p_to_reassign.first_name} unassigned from '{old_team_name}'.", "success")
            
            elif action == "delete_participant":
                participant_id = request.form.get("participant_id")
                if not participant_id: 
                    flash("Participant ID is required.", "danger")
                else:
                    p_to_delete = Participant.query.get(participant_id)
                    if not p_to_delete: 
                        flash("Participant not found.", "danger")
                    else:
                        name = f"{p_to_delete.first_name} {p_to_delete.last_name}"
                        db.session.delete(p_to_delete)
                        db.session.commit()
                        flash(f"Participant '{name}' deleted.", "success")
            
            # New action for multiple team deletion
            elif action == "delete_multiple_teams":
                selected_team_ids = request.form.getlist("selected_teams")
                if not selected_team_ids:
                    flash("No teams selected for deletion.", "warning")
                else:
                    deleted_count = 0
                    skipped_count = 0
                    for team_id in selected_team_ids:
                        try:
                            team_to_delete = Team.query.get(int(team_id))
                            if not team_to_delete:
                                continue
                                
                            # Check if team is in active matches
                            active_matches_count = Match.query.filter(
                                ((Match.team1_id == team_id) | (Match.team2_id == team_id)),
                                Match.status != 'completed'
                            ).count()
                            
                            if active_matches_count > 0:
                                skipped_count += 1
                                continue  # Skip this team
                                
                            # Unassign participants
                            for p in team_to_delete.participants:
                                p.team_id = None
                                p.needs_teammate = True
                                
                            # Update matches
                            Match.query.filter(
                                (Match.team1_id == team_id) | 
                                (Match.team2_id == team_id) | 
                                (Match.winner_id == team_id)
                            ).update({
                                'team1_id': db.case((Match.team1_id == team_id, None), else_=Match.team1_id),
                                'team2_id': db.case((Match.team2_id == team_id, None), else_=Match.team2_id),
                                'winner_id': db.case((Match.winner_id == team_id, None), else_=Match.winner_id)
                            }, synchronize_session='fetch')
                            
                            db.session.delete(team_to_delete)
                            deleted_count += 1
                            
                        except Exception as e:
                            logging.error(f"Error deleting team {team_id}: {e}", exc_info=True)
                            
                    if deleted_count > 0:
                        db.session.commit()
                        success_msg = f"Successfully deleted {deleted_count} teams."
                        if skipped_count > 0:
                            success_msg += f" {skipped_count} teams were skipped because they are part of active matches."
                        flash(success_msg, "success")
                    else:
                        if skipped_count > 0:
                            flash(f"No teams were deleted. {skipped_count} teams were skipped because they are part of active matches.", "warning")
                        else:
                            flash("No teams were deleted.", "warning")
            
            return redirect(url_for("team_management")) # Common redirect after POST action

        except Exception as e:
            db.session.rollback()
            flash(f"An error occurred: {str(e)}", "danger")
            logging.error(f"Team management error: {e}", exc_info=True)
            return redirect(url_for("team_management"))

    teams_with_their_participants = []
    for team_obj in teams_list:
        participants_sorted = sorted(team_obj.participants, key=lambda p: (p.last_name or "", p.first_name or ""))
        teams_with_their_participants.append({"team": team_obj, "participants": participants_sorted})
    unassigned_participants_list = Participant.query.filter_by(team_id=None).order_by(Participant.last_name, Participant.first_name).all()
    return render_template("team_management.html", teams=teams_list, all_participants=participants_list,
                           teams_with_participants=teams_with_their_participants, unassigned_participants=unassigned_participants_list)

@app.route("/admin/tournaments", methods=["GET", "POST"])
@admin_required
def admin_tournaments_management():
    """Displays a list of all tournaments for management and handles tournament name edits."""
    if request.method == "POST":
        action = request.form.get("action")
        try:
            if action == "edit_tournament_name":
                tournament_id_str = request.form.get("tournament_id")
                new_name = request.form.get("new_tournament_name", "").strip()

                if not tournament_id_str:
                    flash("Tournament ID is missing.", "danger")
                elif not new_name:
                    flash("New tournament name cannot be empty.", "danger")
                else:
                    tournament_id = int(tournament_id_str)
                    tournament_to_edit = Tournament.query.get(tournament_id)
                    if not tournament_to_edit:
                        flash("Tournament not found.", "danger")
                    else:
                        # Check for name conflict (case-insensitive, excluding self)
                        existing_tournament = Tournament.query.filter(
                            Tournament.id != tournament_id,
                            db.func.lower(Tournament.name) == new_name.lower()
                        ).first()
                        if existing_tournament:
                            flash(f"Another tournament named '{new_name}' already exists.", "danger")
                        else:
                            old_name = tournament_to_edit.name
                            tournament_to_edit.name = new_name
                            db.session.commit()
                            flash(f"Tournament name changed from '{old_name}' to '{new_name}'.", "success")
            else:
                flash("Invalid action specified for tournament management.", "danger")

        except Exception as e:
            db.session.rollback()
            flash(f"An error occurred processing your request: {str(e)}", "danger")
            logging.error(f"Admin tournament management POST error: {e}", exc_info=True)
        
        return redirect(url_for("admin_tournaments_management"))

    # For GET request
    try:
        all_tournaments = Tournament.query.order_by(Tournament.created_at.desc()).all()
    except Exception as e:
        flash(f"Error loading tournament list: {str(e)}", "danger")
        logging.error(f"Admin tournament management list error: {e}", exc_info=True)
        all_tournaments = []

    return render_template("tournament_management.html", tournaments=all_tournaments)

@app.route("/admin/tournament/delete/<int:tournament_id>", methods=["POST"])
@admin_required
def delete_tournament(tournament_id):
    """Deletes a tournament and its associated matches."""
    try:
        tournament_to_delete = Tournament.query.get_or_404(tournament_id)
        tournament_name = tournament_to_delete.name
        was_default = tournament_to_delete.is_default

        # Cascade delete should handle matches due to model relationship setting
        db.session.delete(tournament_to_delete)
        db.session.commit()
        flash(f"Tournament '{tournament_name}' and its matches deleted successfully.", "success")

        # Optional: If the deleted tournament was the default, maybe warn the admin
        if was_default:
            flash("The deleted tournament was the default. Please set a new default tournament for the main site link.", "warning")

    except Exception as e:
        db.session.rollback()
        flash(f"Error deleting tournament: {str(e)}", "danger")
        logging.error(f"Error deleting tournament {tournament_id}: {e}", exc_info=True)

    return redirect(url_for("admin_tournaments_management"))


@app.route("/admin/tournament/set_default/<int:tournament_id>", methods=["POST"])
@admin_required
def set_default_tournament(tournament_id):
    """Sets the specified tournament as the default, unsetting others."""
    try:
        tournament_to_set = Tournament.query.get_or_404(tournament_id)

        # Unset all other tournaments first (more efficient than looping)
        Tournament.query.filter(Tournament.id != tournament_id, Tournament.is_default == True).update({Tournament.is_default: False})

        # Set the chosen one
        tournament_to_set.is_default = True
        db.session.commit()
        flash(f"Tournament '{tournament_to_set.name}' is now set as the default for the main site link.", "success")

    except Exception as e:
        db.session.rollback()
        flash(f"Error setting default tournament: {str(e)}", "danger")
        logging.error(f"Error setting tournament {tournament_id} as default: {e}", exc_info=True)

    return redirect(url_for("admin_tournaments_management"))

@app.route("/admin/duplicates")
@admin_required
def manage_duplicates():
    # Find potential duplicates based on name
    duplicates = db.session.query(
        Participant.first_name, 
        Participant.last_name,
        db.func.count(Participant.id).label('count')
    ).group_by(
        db.func.lower(Participant.first_name),
        db.func.lower(Participant.last_name)
    ).having(
        db.func.count(Participant.id) > 1
    ).all()
    
    # Get details for each duplicate
    duplicate_details = []
    for first_name, last_name, count in duplicates:
        participants = Participant.query.filter(
            db.func.lower(Participant.first_name) == first_name.lower(),
            db.func.lower(Participant.last_name) == last_name.lower()
        ).all()
        
        duplicate_details.append({
            'first_name': first_name,
            'last_name': last_name,
            'count': count,
            'participants': participants
        })
    
    return render_template(
        "manage_duplicates.html", 
        duplicates=duplicate_details
    )


@app.route("/admin/team-names", methods=["GET", "POST"])
@admin_required
def team_name_management():
    """Team name management page for handling TBD team names."""
    # ### NEEDS ORM REFACTOR ###
    # This route relies on get_participants, get_teams, write_csv
    # It should query Participant and Team objects, and update them directly.
    
    # Placeholder logic, to be replaced:
    tbd_participants_orm = Participant.query.join(Team, Participant.team_id == Team.id, isouter=True)\
                                .filter((Participant.team_id == None) | (Team.name == "TBD") | (Team.name == ""))\
                                .order_by(Participant.last_name, Participant.first_name)\
                                .all()
    all_teams_orm = Team.query.order_by(Team.name).all()

    if request.method == "POST":
        action = request.form.get("action")
        participant_id_str = request.form.get("participant_id")

        if not participant_id_str:
            flash("Participant ID is required.", "danger")
            return redirect(url_for("team_name_management"))
        
        try:
            participant_id = int(participant_id_str)
            participant_obj = Participant.query.get(participant_id)
            if not participant_obj:
                flash("Participant not found.", "danger")
                return redirect(url_for("team_name_management"))

            if action == "set_team_name":
                assign_existing = request.form.get("assign_existing_team") == "on"
                team_name_to_set_raw = request.form.get("team_name", "").strip()
                existing_team_id_str = request.form.get("existing_team_id")

                team_name_to_set_processed = team_name_to_set_raw
                if len(team_name_to_set_raw) > APP_POLICY_MAX_TEAM_NAME_LENGTH:
                    team_name_to_set_processed = team_name_to_set_raw[:APP_POLICY_MAX_TEAM_NAME_LENGTH]
                    flash(f"Team name '{team_name_to_set_raw}' truncated to '{team_name_to_set_processed}'.", "info")
                
                if len(team_name_to_set_processed) > DB_SCHEMA_MAX_TEAM_NAME_LENGTH: # Should not be hit
                    team_name_to_set_processed = team_name_to_set_processed[:DB_SCHEMA_MAX_TEAM_NAME_LENGTH]

                target_team_obj = None
                if assign_existing:
                    if not existing_team_id_str:
                        flash("Existing team ID is required for assignment.", "danger")
                        return redirect(url_for("team_name_management"))
                    target_team_obj = Team.query.get(int(existing_team_id_str))
                    if not target_team_obj:
                        flash("Selected existing team not found.", "danger")
                        return redirect(url_for("team_name_management"))
                else: # Create new or find by new name
                    if not team_name_to_set_processed:
                        flash("New team name is required.", "danger")
                        return redirect(url_for("team_name_management"))
                    target_team_obj = Team.query.filter(db.func.lower(Team.name) == team_name_to_set_processed.lower()).first()
                    if not target_team_obj:
                        target_team_obj = Team(name=team_name_to_set_processed)
                        db.session.add(target_team_obj)
                
                participant_obj.team_assigned = target_team_obj
                # participant_obj.needs_teammate = False # If assigning team implies they have one
                db.session.commit()
                flash(f"Participant {participant_obj.first_name} assigned to team '{target_team_obj.name}'.", "success")

            elif action == "resend_email": # This feature might be re-evaluated
                # participant_email = request.form.get("participant_email", "").strip()
                # if not participant_email:
                #     flash("Participant email is required for resend.", "danger")
                # else:
                #     # Update participant_obj.email if it exists on model and changed
                #     # ... db.session.commit() ...
                #     # Generate token (securely) and update_link
                #     # Send email (placeholder)
                flash("Email sending feature for team name update is currently conceptual.", "info")
            
            return redirect(url_for("team_name_management"))

        except Exception as e:
            db.session.rollback()
            flash(f"Error in team name management: {str(e)}", "danger")
            logging.error(f"Team name management error: {e}", exc_info=True)
            return redirect(url_for("team_name_management"))
            
    return render_template("team_name_management.html", tbd_participants=tbd_participants_orm, teams=all_teams_orm)

@app.route("/admin/participants", methods=["GET", "POST"])
@admin_required
def participant_management():
    """Route for managing participants."""
    if request.method == "POST":
        action = request.form.get("action")
        try:
            if action == "delete_participant":
                participant_id = request.form.get("participant_id")
                if not participant_id:
                    flash("Participant ID is required.", "danger")
                else:
                    p_to_delete = Participant.query.get(participant_id)
                    if not p_to_delete:
                        flash("Participant not found.", "danger")
                    else:
                        name = f"{p_to_delete.first_name} {p_to_delete.last_name}"
                        db.session.delete(p_to_delete)
                        db.session.commit()
                        flash(f"Participant '{name}' deleted.", "success")
            
            elif action == "edit_participant":
                participant_id_str = request.form.get("participant_id")
                new_first_name = request.form.get("first_name", "").strip()
                new_last_name = request.form.get("last_name", "").strip()

                if not participant_id_str:
                    flash("Participant ID is missing for edit.", "danger")
                elif not new_first_name or not new_last_name:
                    flash("First name and last name are required for edit.", "danger")
                else:
                    try:
                        participant_id = int(participant_id_str)
                        participant_to_edit = Participant.query.get(participant_id)
                        if not participant_to_edit:
                            flash("Participant not found for editing.", "danger")
                        else:
                            old_name = f"{participant_to_edit.first_name} {participant_to_edit.last_name}"
                            participant_to_edit.first_name = new_first_name
                            participant_to_edit.last_name = new_last_name
                            # Optional: if you have a display_name field that's derived, update it too
                            # participant_to_edit.display_name = f"{new_first_name} {new_last_name}"
                            db.session.commit()
                            flash(f"Participant '{old_name}' updated to '{new_first_name} {new_last_name}'.", "success")
                    except ValueError:
                        flash("Invalid Participant ID format for edit.", "danger")

            elif action == "reassign_participant":
                participant_id = request.form.get("participant_id")
                new_team_id_str = request.form.get("new_team_id")
                if not participant_id:
                    flash("Participant ID is required for reassign.", "danger")
                else:
                    p_to_reassign = Participant.query.get(participant_id)
                    if not p_to_reassign:
                        flash("Participant not found for reassign.", "danger")
                    else:
                        old_team_name = p_to_reassign.team_assigned.name if p_to_reassign.team_assigned else "No team"
                        if new_team_id_str and new_team_id_str != "unassign":
                            try:
                                new_team = Team.query.get(int(new_team_id_str))
                                if not new_team:
                                    flash("New team not found for reassign.", "danger")
                                else:
                                    p_to_reassign.team_assigned = new_team
                                    p_to_reassign.needs_teammate = False # Assuming assigning to a team means they have one
                                    db.session.commit()
                                    flash(f"{p_to_reassign.first_name} {p_to_reassign.last_name} moved from '{old_team_name}' to '{new_team.name}'.", "success")
                            except ValueError:
                                flash("Invalid new team ID format for reassign.", "danger")
                        else: # Unassign
                            p_to_reassign.team_assigned = None
                            p_to_reassign.needs_teammate = True
                            db.session.commit()
                            flash(f"{p_to_reassign.first_name} {p_to_reassign.last_name} unassigned from '{old_team_name}'.", "success")
                            
            elif action == "delete_multiple_participants":
                selected_participant_ids = request.form.getlist("selected_participants")
                if not selected_participant_ids:
                    flash("No participants selected for deletion.", "warning")
                else:
                    deleted_count = 0
                    for p_id_str in selected_participant_ids:
                        try:
                            p_id = int(p_id_str)
                            p_to_delete = Participant.query.get(p_id)
                            if p_to_delete:
                                db.session.delete(p_to_delete)
                                deleted_count += 1
                        except ValueError:
                             logging.warning(f"Invalid participant ID '{p_id_str}' in bulk delete list.")
                        except Exception as e:
                            logging.error(f"Error deleting participant {p_id_str} in bulk: {e}", exc_info=True)
                    
                    if deleted_count > 0:
                        db.session.commit()
                        flash(f"Successfully deleted {deleted_count} participants.", "success")
                    else:
                        flash("No participants were deleted (or IDs were invalid).", "warning")
            
            return redirect(url_for("participant_management"))
            
        except Exception as e:
            db.session.rollback()
            flash(f"An error occurred: {str(e)}", "danger")
            logging.error(f"Participant management error: {e}", exc_info=True)
            return redirect(url_for("participant_management"))
    
    # For GET request
    all_participants = Participant.query.order_by(Participant.last_name, Participant.first_name).all()
    teams = Team.query.order_by(Team.name).all()
    
    return render_template("participant_management.html", 
                           all_participants=all_participants,
                           teams=teams)

@app.route("/admin/tournament/new", methods=["GET", "POST"])
@admin_required
def tournament_config():
    teams_for_display = [] # Initialize list for template data
    try:
        # 1. Get all teams that *could* potentially participate
        #    (e.g., those with at least one participant - adjust if criteria differ)
        candidate_teams_query = db.session.query(
                Team, db.func.count(Participant.id).label('member_count')
            ).outerjoin(Participant, Team.id == Participant.team_id)\
             .group_by(Team.id)\
             .order_by(Team.name)\
             .all()

        # Filter candidates based on minimum members (e.g., > 0)
        candidate_teams_list = [(team, count) for team, count in candidate_teams_query if count > 0]

        # 2. Find teams currently involved in non-completed tournaments
        #    We need distinct team IDs involved as either team1 or team2
        #    in matches belonging to tournaments that are NOT 'completed'.
        active_tournament_team_ids_query = db.session.query(Match.team1_id).distinct()\
            .join(Tournament, Match.tournament_id == Tournament.id)\
            .filter(Tournament.status != 'completed', Match.team1_id != None)\
            .union(\
                db.session.query(Match.team2_id).distinct()\
                .join(Tournament, Match.tournament_id == Tournament.id)\
                .filter(Tournament.status != 'completed', Match.team2_id != None)\
            ).all() # Gets a list of tuples like [(1,), (3,), (5,)]

        # Convert to a set for faster lookups
        busy_team_ids = {team_id[0] for team_id in active_tournament_team_ids_query}

        # 3. Prepare data for the template, marking availability
        for team, count in candidate_teams_list:
            is_available = team.id not in busy_team_ids
            teams_for_display.append({
                'team': team,
                'member_count': count,
                'is_available': is_available
            })

    except Exception as e:
        flash(f"Error loading data for new tournament form: {str(e)}", "danger")
        logging.error(f"New tournament form GET error: {e}", exc_info=True)
        teams_for_display = [] # Ensure it's iterable on error

    # --- POST Request Logic (remains largely the same) ---
    if request.method == "POST":
        tournament_name = request.form.get("tournament_name", "").strip()
        tournament_type = request.form.get("tournament_type")
        selected_team_ids_str = request.form.getlist("selected_teams")

        # --- Validation (keep existing checks) ---
        if not tournament_name:
            flash("Tournament name is required.", "danger")
            # Pass the prepared data back to the template on error
            return render_template("tournament_config.html", teams_data=teams_for_display)
        if not tournament_type:
             flash("Tournament type is required.", "danger")
             return render_template("tournament_config.html", teams_data=teams_for_display)
        if not selected_team_ids_str:
            flash("At least two teams must be selected.", "danger")
            return render_template("tournament_config.html", teams_data=teams_for_display)
        try:
            selected_team_ids = [int(tid) for tid in selected_team_ids_str]
        except ValueError:
            flash("Invalid team ID submitted.", "danger")
            return render_template("tournament_config.html", teams_data=teams_for_display)
        if len(selected_team_ids) < 2:
            flash("Please select at least two teams for the tournament.", "danger")
            return render_template("tournament_config.html", teams_data=teams_for_display)

        # --- Check if any selected teams are busy (server-side validation) ---
        # Refetch busy IDs in case state changed between GET and POST (less likely but safer)
        try:
            active_tournament_team_ids_query_post = db.session.query(Match.team1_id).distinct().join(Tournament, Match.tournament_id == Tournament.id).filter(Tournament.status != 'completed', Match.team1_id != None).union(db.session.query(Match.team2_id).distinct().join(Tournament, Match.tournament_id == Tournament.id).filter(Tournament.status != 'completed', Match.team2_id != None)).all()
            busy_team_ids_post = {team_id[0] for team_id in active_tournament_team_ids_query_post}
            selected_busy_teams = []
            for team_id in selected_team_ids:
                 if team_id in busy_team_ids_post:
                     # Find team name for better message
                     busy_team_name = Team.query.get(team_id).name if Team.query.get(team_id) else f"ID {team_id}"
                     selected_busy_teams.append(busy_team_name)

            if selected_busy_teams:
                flash(f"Cannot create tournament. The following selected teams are busy in other active tournaments: {', '.join(selected_busy_teams)}", "danger")
                return render_template("tournament_config.html", teams_data=teams_for_display)
        except Exception as e:
             # Log this error, but potentially proceed cautiously or block if needed
             logging.error(f"Error checking busy teams during POST: {e}", exc_info=True)
             flash("Warning: Could not verify team availability during submission. Proceeding with caution.", "warning")


        # --- Proceed with Tournament Creation (keep existing logic) ---
        try:
            new_tournament_obj = Tournament(
                name=tournament_name,
                type=tournament_type,
                status="active" # Update from default to active
            )
            db.session.add(new_tournament_obj)
            db.session.flush()

            teams_to_participate = Team.query.filter(Team.id.in_(selected_team_ids)).all()
            if len(teams_to_participate) != len(selected_team_ids):
                 flash("Some selected teams were not found (deleted?). Please refresh.", "warning")
                 db.session.rollback()
                 return render_template("tournament_config.html", teams_data=teams_for_display)

            new_match_orm_objects = generate_tournament_bracket(
                tournament_db_obj=new_tournament_obj,
                tournament_type=tournament_type, # Pass the type from the form
                team_db_objects_or_ids=teams_to_participate # Pass the list of Team objects
            )

            if new_match_orm_objects:
                 # ... (Add matches, commit, redirect as before) ...
                 db.session.add_all(new_match_orm_objects)
                 db.session.commit()
                 flash(f"Tournament '{new_tournament_obj.name}' created... Set status to 'Active' when ready.", "success")
                 return redirect(url_for("tournament_view", tournament_id=new_tournament_obj.id))
            else:
                 # ... (Handle bracket generation failure as before) ...
                 if tournament_type == "double_elimination":
                      # ... (handle double elim info message) ...
                      db.session.commit()
                      flash(f"Tournament '{new_tournament_obj.name}' created (Status: {new_tournament_obj.status}). Double elimination bracket needs manual setup...", "info")
                      return redirect(url_for("tournament_view", tournament_id=new_tournament_obj.id))
                 else:
                     flash("Could not generate tournament bracket...", "warning")
                     db.session.rollback()
                     return render_template("tournament_config.html", teams_data=teams_for_display)

        except Exception as e:
            # ... (Rollback and flash error as before) ...
            db.session.rollback()
            flash(f"An error occurred creating the tournament: {str(e)}", "danger")
            logging.error(f"Tournament creation POST error: {e}", exc_info=True)
            return render_template("tournament_config.html", teams_data=teams_for_display)

    # --- GET Request ---
    return render_template("tournament_config.html", teams_data=teams_for_display)

@app.route("/admin/tournament/set_status/<int:tournament_id>", methods=["POST"])
@admin_required
def set_tournament_status(tournament_id):
    """Updates the status of a specific tournament."""
    new_status = request.form.get('new_status')
    # Define allowed statuses for safety
    allowed_statuses = ['pending', 'active', 'paused', 'completed']

    if not new_status or new_status not in allowed_statuses:
        flash("Invalid target status provided.", "danger")
        return redirect(url_for("admin_tournaments_management"))

    try:
        tournament_to_update = Tournament.query.get_or_404(tournament_id)

        # Optional: Add logic here to prevent certain transitions if needed
        # (e.g., cannot set a 'completed' tournament back to 'pending')
        # if tournament_to_update.status == 'completed' and new_status != 'completed':
        #    flash(f"Cannot change status of already completed tournament '{tournament_to_update.name}'.", "warning")
        #    return redirect(url_for("admin_tournaments_management"))

        tournament_to_update.status = new_status
        db.session.commit()
        flash(f"Status for tournament '{tournament_to_update.name}' updated to '{new_status.title()}'.", "success")

    except Exception as e:
        db.session.rollback()
        flash(f"Error updating tournament status: {str(e)}", "danger")
        logging.error(f"Error setting status for tournament {tournament_id} to {new_status}: {e}", exc_info=True)

    return redirect(url_for("admin_tournaments_management"))

@app.route("/admin/tournament/<int:tournament_id>") # Added <int:..>
@admin_required
def tournament_view(tournament_id):
    """Tournament bracket view page for admins."""
    try:
        tournament_obj = Tournament.query.get_or_404(tournament_id)
        tournament_matches_list = Match.query.options(
                db.joinedload(Match.team1),
                db.joinedload(Match.team2),
                db.joinedload(Match.winner)
            ).filter_by(tournament_id=tournament_obj.id)\
             .order_by(Match.round_number, Match.match_in_round)\
             .all()

        rounds_dict = {}
        team_ids_in_matches = set()
        for match_obj in tournament_matches_list:
            round_num = match_obj.round_number
            if round_num not in rounds_dict: rounds_dict[round_num] = []
            rounds_dict[round_num].append(match_obj)
            if match_obj.team1_id: team_ids_in_matches.add(match_obj.team1_id)
            if match_obj.team2_id: team_ids_in_matches.add(match_obj.team2_id)
            if match_obj.winner_id: team_ids_in_matches.add(match_obj.winner_id)

        teams_involved = []
        if team_ids_in_matches:
            teams_involved = Team.query.options(
                db.joinedload(Team.participants)
            ).filter(Team.id.in_(list(team_ids_in_matches))).all()

        team_display_dict = {}
        for team in teams_involved:
             # --- CHANGE HERE: Use full last name ---
            participant_names = ", ".join(sorted([
                f"{p.first_name} {p.last_name}" # Use full last name
                for p in team.participants if p.first_name and p.last_name
            ]))
            # Handle cases where a team might exist but have no participants listed
            if participant_names:
                team_display_dict[team.id] = f"{team.name} ({participant_names})"
            else:
                # Fallback if no participants found for an involved team
                team_display_dict[team.id] = team.name

    except Exception as e:
        logging.error(f"Error fetching admin tournament view for ID {tournament_id}: {e}", exc_info=True)
        flash("Error loading tournament details for admin view.", "danger")
        return redirect(url_for("admin_dashboard"))

    return render_template(
        "tournament_view.html",
        tournament=tournament_obj,
        rounds=rounds_dict,
        team_dict=team_display_dict, # Pass the new dictionary
        public_view=False # Flag for admin template logic
    )


@app.route("/admin/tournament/toggle-auto-navigate/<int:tournament_id>", methods=["POST"])
@admin_required
def toggle_auto_navigate(tournament_id):
    """Toggles auto-navigation for a tournament and sets delay if provided."""
    try:
        tournament = Tournament.query.get_or_404(tournament_id)
        
        # Toggle the auto_navigate field
        tournament.auto_navigate = not tournament.auto_navigate
        
        # Update auto_navigate_delay if provided
        delay = request.form.get('delay')
        if delay and delay.isdigit():
            delay_value = int(delay)
            # Set reasonable bounds for the delay
            if 5 <= delay_value <= 300:  # Between 5 seconds and 5 minutes
                tournament.auto_navigate_delay = delay_value
        
        db.session.commit()
        
        flash(f"Auto-navigation {'enabled' if tournament.auto_navigate else 'disabled'} for tournament '{tournament.name}'.", "success")
        
    except Exception as e:
        db.session.rollback()
        flash(f"Error toggling auto-navigation: {str(e)}", "danger")
        logging.error(f"Toggle auto-navigate error for tournament {tournament_id}: {e}", exc_info=True)
    
    return redirect(url_for("tournament_view", tournament_id=tournament_id))


@app.route("/admin/match/<int:match_id>", methods=["GET", "POST"]) # Added <int:..>
@admin_required
def match_view(match_id):
    try:
        # Eager load required related objects
        match_obj = Match.query.options(
            db.joinedload(Match.team1),
            db.joinedload(Match.team2),
            db.joinedload(Match.winner),
            db.joinedload(Match.tournament_info) # Ensure tournament info is loaded
        ).get_or_404(match_id)

        # --- Robustness Check: Ensure tournament relationship loaded ---
        if not match_obj.tournament_info:
             flash("Error: Could not load associated tournament data for this match.", "danger")
             logging.error(f"Match {match_id} is missing tournament_info relationship.")
             # Redirect intelligently, maybe back to tournament list or dashboard
             return redirect(url_for("admin_tournaments_management"))
        # --- End Robustness Check ---

        # Use the eagerly loaded team objects if they exist
        team1 = match_obj.team1
        team2 = match_obj.team2

    except Exception as e:
        logging.error(f"Error fetching match details for ID {match_id}: {e}", exc_info=True)
        flash("Error loading match details.", "danger")
        # Redirect to admin dashboard or tournament list if tournament context is lost
        if hasattr(match_obj, 'tournament_id') and match_obj.tournament_id:
            return redirect(url_for('tournament_view', tournament_id=match_obj.tournament_id))
        else:
            return redirect(url_for("admin_dashboard"))

    if request.method == "POST":
        try:
            # --- Tournament Status Check (Primary Gatekeeper) ---
            # This check was already present and is the correct place to enforce it.
            if match_obj.tournament_info.status != 'active':
                flash(f"Scores cannot be entered because the tournament '{match_obj.tournament_info.name}' status is '{match_obj.tournament_info.status.title()}'. It must be set to 'Active'.", "warning")
                return redirect(url_for("match_view", match_id=match_id))
            # --- End Tournament Status Check ---

            # Check if teams are assigned before allowing score input
            if not team1 or not team2: # Check if team objects exist
                flash("Cannot enter scores until both teams are assigned to the match.", "warning")
                return redirect(url_for("match_view", match_id=match_id))

            team1_score_str = request.form.get("team1_score")
            team2_score_str = request.form.get("team2_score")

            # Validate scores
            try:
                team1_score = int(team1_score_str)
                team2_score = int(team2_score_str)
                if team1_score < 0 or team2_score < 0:
                    raise ValueError("Scores cannot be negative.")
                # Add more specific score rules if needed (e.g., must reach 21, win by 2)
                # if abs(team1_score - team2_score) < 2 and max(team1_score, team2_score) >= 21:
                #     flash("Winning score requires a 2-point lead if score is 21 or higher.", "warning")
                #     return redirect(url_for("match_view", match_id=match_id))
                if team1_score == team2_score:
                    flash("Scores cannot be tied. Please determine a winner.", "warning")
                    return redirect(url_for("match_view", match_id=match_id))

            except (ValueError, TypeError):
                 flash("Scores must be valid non-negative numbers.", "danger")
                 return redirect(url_for("match_view", match_id=match_id))

            # Update match scores, winner, and status
            match_obj.team1_score = team1_score
            match_obj.team2_score = team2_score
            match_obj.status = "completed"

            # Determine winner
            if team1_score > team2_score:
                match_obj.winner_id = match_obj.team1_id
            elif team2_score > team1_score:
                match_obj.winner_id = match_obj.team2_id
            else: # Should be caught by validation above, but as a fallback
                match_obj.winner_id = None
                match_obj.status = "pending" # Revert status if somehow tied
                flash("Internal Error: Tie score detected after validation.", "danger")
                return redirect(url_for("match_view", match_id=match_id))


            # --- Handle Progression ---
            next_match_to_update = None
            if match_obj.winner_id and match_obj.next_match_progression_id:
                # Find the match the winner should progress to
                next_match_to_update = Match.query.get(match_obj.next_match_progression_id)
                if next_match_to_update:
                    if match_obj.next_match_slot == "team1":
                        next_match_to_update.team1_id = match_obj.winner_id
                    elif match_obj.next_match_slot == "team2":
                        next_match_to_update.team2_id = match_obj.winner_id
                    else:
                        logging.warning(f"Match {match_obj.id} has next_match_id {next_match_to_update.id} but invalid next_match_slot '{match_obj.next_match_slot}'")
                    # Check if the next match is now ready (both teams set)
                    if next_match_to_update.team1_id and next_match_to_update.team2_id and next_match_to_update.status == 'pending':
                         # Optionally set next match status to 'ready' or keep 'pending'
                         pass # Or: next_match_to_update.status = 'ready'
                else:
                     logging.warning(f"Match {match_obj.id} completed, but next_match_id {match_obj.next_match_progression_id} not found.")

            db.session.commit() # Commit score update and potential progression
            flash(f"Match scores updated successfully. Winner: {match_obj.winner.name if match_obj.winner else 'N/A'}", "success")

            # --- Check if Tournament is Complete ---
            # Fetch the tournament again to check its status post-match update
            tournament_obj = match_obj.tournament_info # Use the already loaded object
            if tournament_obj and tournament_obj.status == 'active': # Only check if still active
                # Check if all matches in this tournament are now completed
                incomplete_matches_count = Match.query.filter(
                    Match.tournament_id == tournament_obj.id,
                    Match.status != 'completed'
                ).count()

                if incomplete_matches_count == 0:
                    tournament_obj.status = 'completed'
                    db.session.commit() # Commit tournament status update
                    flash(f"All matches are complete! Tournament '{tournament_obj.name}' status updated to Completed.", "info")


            # Redirect back to the tournament view after update
            return redirect(url_for("tournament_view", tournament_id=match_obj.tournament_id))

        except Exception as e:
            db.session.rollback()
            flash(f"An error occurred updating match scores: {str(e)}", "danger")
            logging.error(f"Match score update error for match {match_id}: {e}", exc_info=True)
            return redirect(url_for("match_view", match_id=match_id))

    # GET request
    # Pass team objects directly to the template
    return render_template("match_view.html", match=match_obj, team1=team1, team2=team2)


@app.route("/admin/csv-upload", methods=["GET", "POST"])
@admin_required
def admin_csv_upload():
    if request.method == "POST":
        action_taken = False
        processed_participants_in_batch = {} # Store results for feedback

        # --- Process Teams CSV First (if provided) ---
        teams_file = request.files.get('teams_csv')
        if teams_file and teams_file.filename != '':
            action_taken = True
            try:
                stream = io.StringIO(teams_file.stream.read().decode("UTF-8-SIG"), newline=None)
                csv_reader = csv.DictReader(stream)
                headers = csv_reader.fieldnames
                if not headers or "name" not in headers:
                     flash("Teams CSV is missing headers or the required 'name' header.", "danger")
                     # Avoid processing participants if teams failed critically
                     return redirect(url_for('admin_csv_upload'))

                headers_lower = [h.lower() for h in headers]
                has_external_id_col = 'id' in headers_lower

                teams_created_count = 0
                teams_updated_count = 0
                teams_policy_truncated = 0
                teams_skipped = 0
                processed_team_names = set() # Track names processed in this batch

                for row_num, row in enumerate(csv_reader, 1):
                    original_team_name = row.get("name", "").strip()
                    external_id_val = row.get("id", "").strip() if has_external_id_col else None

                    if not original_team_name:
                        flash(f"Skipping row {row_num} in Teams CSV: 'name' is missing.", "warning")
                        teams_skipped += 1
                        continue

                    # --- Basic Team Name De-duplication within the File ---
                    # If we encounter the same team name multiple times in the CSV,
                    # we will use the first one encountered and map subsequent
                    # references (by name or ID) to that same team object.
                    team_name_lower = original_team_name.lower()

                    # --- Length Handling ---
                    team_name_for_processing = original_team_name
                    if len(original_team_name) > APP_POLICY_MAX_TEAM_NAME_LENGTH:
                        team_name_for_processing = original_team_name[:APP_POLICY_MAX_TEAM_NAME_LENGTH]
                        flash(f"Team name '{original_team_name}' (Teams CSV row {row_num}) policy-truncated to '{team_name_for_processing}'.", "info")
                        teams_policy_truncated +=1
                    if len(team_name_for_processing) > DB_SCHEMA_MAX_TEAM_NAME_LENGTH:
                        team_name_for_processing = team_name_for_processing[:DB_SCHEMA_MAX_TEAM_NAME_LENGTH]

                    # --- Find or Create Team ---
                    # Prioritize finding existing DB team, then handle within-batch uniqueness
                    team_obj = Team.query.filter(db.func.lower(Team.name) == team_name_for_processing.lower()).first()

                    if team_obj:
                        # Update existing team if needed (e.g., external_id)
                        if has_external_id_col and external_id_val and not team_obj.external_id:
                             team_obj.external_id = external_id_val
                             # Potentially add other fields to update
                        teams_updated_count += 1
                    elif team_name_lower not in processed_team_names:
                        # Create new team only if it's the first time seeing this name in the batch
                        team_obj = Team(
                            name=team_name_for_processing,
                            external_id=external_id_val if external_id_val else None,
                            source="csv_upload"
                        )
                        db.session.add(team_obj)
                        processed_team_names.add(team_name_lower) # Mark as processed in this batch
                        teams_created_count += 1
                    else:
                        # Team name already processed in this batch, but didn't exist in DB initially.
                        # We need to retrieve the object we just added+flushed earlier in the loop.
                        # This requires a flush inside the loop or a different approach.
                        # Simpler: Rely on the DB constraint or the filter query above to handle this.
                        # If the filter query finds it (because it was added earlier in batch and flushed),
                        # it will enter the `if team_obj:` block.
                        # Let's commit teams at the end to avoid complex within-batch logic for now.
                         pass # Will be handled by subsequent lookups or DB unique constraint


                db.session.commit() # Commit all team changes
                msg = f"Teams CSV processed: {teams_created_count} created, {teams_updated_count} existing teams found/updated."
                if teams_policy_truncated > 0: msg += f" {teams_policy_truncated} names policy-truncated."
                if teams_skipped > 0: msg += f" {teams_skipped} rows skipped."
                flash(msg, "success")

            except Exception as e:
                db.session.rollback()
                flash(f"Error processing Teams CSV: {str(e)}", "danger")
                logging.error(f"Teams CSV upload error: {e}", exc_info=True)
                # Prevent participant processing if teams failed
                return redirect(url_for('admin_csv_upload'))


        # --- Process Participants CSV ---
        participants_file = request.files.get('participants_csv')
        if participants_file and participants_file.filename != '':
            action_taken = True
            try:
                # --- Pre-fetch teams for efficient lookup ---
                team_lookup_map = {}
                all_db_teams = Team.query.all() # Fetch teams *after* potentially adding new ones from teams.csv
                for t in all_db_teams:
                    if t.external_id:
                        team_lookup_map[f"extid_{t.external_id}"] = t
                    team_lookup_map[t.name.lower()] = t

                stream = io.StringIO(participants_file.stream.read().decode("UTF-8-SIG"), newline=None)
                csv_reader = csv.DictReader(stream)
                headers = csv_reader.fieldnames
                required_headers = ["first_name", "last_name"]
                if not headers or not all(h in headers for h in required_headers):
                    missing = [h for h in required_headers if h not in headers] if headers else required_headers
                    flash(f"Participants CSV is missing required headers: {', '.join(missing)}.", "danger")
                    return redirect(url_for('admin_csv_upload')) # Stop if headers invalid

                # --- Participant Processing Logic ---
                participants_created_count = 0
                participants_team_assigned_count = 0
                participants_team_not_found_count = 0
                participants_skipped = 0
                potential_duplicates_logged = 0 # Duplicates already in DB
                names_suffixed_in_batch = 0     # Duplicates within the uploaded file

                # Tracker for duplicate names *within this specific upload*
                processed_names_in_batch = {}

                # Map CSV headers to lowercase for flexible access
                headers_map = {h.lower(): h for h in headers}
                def get_val(row, key_lower, default=''):
                     # Handles potential extra spaces in header names too
                     actual_header = headers_map.get(key_lower.strip())
                     return row.get(actual_header, default) if actual_header else default


                for row_num, row in enumerate(csv_reader, 1):
                    first_name = get_val(row, "first_name").strip()
                    last_name = get_val(row, "last_name").strip()
                    # Use 'id' from participant CSV as external_id for participant
                    external_id = get_val(row, "id").strip()
                    # Use 'team_id' or 'team_name' from participant CSV to link to Team
                    team_id_from_csv = get_val(row, "team_id").strip()
                    team_name_from_csv = get_val(row, "team_name").strip()
                    needs_teammate_str = get_val(row, "needs_teammate", "false").strip().lower()

                    if not first_name or not last_name:
                        flash(f"Skipping row {row_num} in Participants CSV: first or last name missing.", "warning")
                        participants_skipped += 1
                        continue

                    # --- Check for duplicates already existing in DB (for logging) ---
                    existing_db_count = Participant.query.filter(
                        db.func.lower(Participant.first_name) == first_name.lower(),
                        db.func.lower(Participant.last_name) == last_name.lower()
                    ).count()
                    if existing_db_count > 0:
                        potential_duplicates_logged += 1
                        logging.info(f"Potential DB duplicate exists for {first_name} {last_name} (row {row_num}). Uploading anyway.")

                    # --- Handle Duplicate Names within this Batch (Suffixing Logic) ---
                    name_key = (first_name.lower(), last_name.lower())
                    count_in_batch = processed_names_in_batch.get(name_key, 0) + 1
                    processed_names_in_batch[name_key] = count_in_batch

                    original_last_name = last_name # Store original for reference
                    processed_last_name = last_name # Start with the original

                    if count_in_batch > 1:
                        processed_last_name = f"{last_name} ({count_in_batch})"
                        names_suffixed_in_batch += 1
                        logging.info(f"Duplicate name in uploaded batch: '{first_name} {original_last_name}' (row {row_num}) handled as '{processed_last_name}' (Occurrence {count_in_batch})")
                    # --- End of Suffixing Logic ---

                    # --- Determine Team Association using the map ---
                    team_obj_for_participant = None
                    # Priority 1: Match team_id_from_csv against Team.external_id (using map)
                    if team_id_from_csv:
                        team_obj_for_participant = team_lookup_map.get(f"extid_{team_id_from_csv}")

                    # Priority 2: Match team_name_from_csv against Team.name (using map, case-insensitive)
                    if not team_obj_for_participant and team_name_from_csv:
                        team_obj_for_participant = team_lookup_map.get(team_name_from_csv.lower())

                    # Priority 3: Match team_id_from_csv against Team.id (Database Primary Key) - fallback DB query
                    if not team_obj_for_participant and team_id_from_csv:
                        try:
                            team_pk_id = int(team_id_from_csv)
                            team_obj_for_participant = Team.query.get(team_pk_id) # Hit DB as fallback
                        except ValueError:
                            pass # team_id_from_csv wasn't an integer PK

                    # --- Create Participant ---
                    needs_teammate_bool = needs_teammate_str == "true"

                    new_participant = Participant(
                        first_name=first_name,
                        last_name=processed_last_name, # Use the potentially suffixed last name
                        external_id=external_id if external_id else None,
                        needs_teammate=needs_teammate_bool,
                        source="csv_upload" # Mark source
                    )

                    # Assign team if found
                    if team_obj_for_participant:
                        new_participant.team_assigned = team_obj_for_participant
                        participants_team_assigned_count += 1
                    else:
                        # Log if team couldn't be matched based on provided CSV data
                        if team_id_from_csv or team_name_from_csv:
                             logging.warning(f"Could not find team for {first_name} {processed_last_name} (row {row_num}) using TeamID:'{team_id_from_csv}' or TeamName:'{team_name_from_csv}'. Participant added without team.")
                             participants_team_not_found_count += 1

                    db.session.add(new_participant)
                    participants_created_count += 1

                db.session.commit() # Commit all new participants

                # --- Prepare Success Message ---
                msg = (f"Participants CSV processed: {participants_created_count} created. "
                       f"{participants_team_assigned_count} assigned to teams. ")
                if participants_team_not_found_count > 0:
                     msg += f"{participants_team_not_found_count} had team info in CSV but team not found in DB. "
                if potential_duplicates_logged > 0:
                     msg += f" {potential_duplicates_logged} entries had potential matches already in DB (logged). "
                if participants_skipped > 0: msg += f" {participants_skipped} rows skipped."
                # Report how many names were suffixed
                if names_suffixed_in_batch > 0:
                    msg += f" {names_suffixed_in_batch} participants had names suffixed (e.g., '(2)') due to duplicates within the uploaded file."

                flash(msg, "success")
                processed_participants_in_batch = {'created': participants_created_count, 'skipped': participants_skipped, 'suffixed': names_suffixed_in_batch}


            except Exception as e:
                db.session.rollback()
                flash(f"Error processing Participants CSV: {str(e)}", "danger")
                logging.error(f"Participants CSV upload error: {e}", exc_info=True)

        if not action_taken:
             flash("No files selected for upload.", "info")

        # Pass results to template for potential display, or just redirect
        # return render_template("csv_upload.html", results=processed_participants_in_batch)
        return redirect(url_for('admin_csv_upload'))

    # GET request
    return render_template("csv_upload.html")
    
@app.route("/admin/csv-download/<file_type>")
@admin_required
def csv_download(file_type):
    # ### NEEDS ORM REFACTOR ###
    # This should query data from DB and stream a CSV response.
    # For now, it uses old CSV logic which will fail or serve stale/empty files.
    if file_type == "participants":
        data = Participant.query.all()
        fieldnames = ["id", "first_name", "last_name", "team_id", "needs_teammate", "created_at"]
        # Potentially add team_name by joining/accessing participant.team_assigned.name
    elif file_type == "teams":
        data = Team.query.all()
        fieldnames = ["id", "name", "created_at"]
    elif file_type == "tournaments":
        data = Tournament.query.all()
        fieldnames = ["id", "name", "type", "status", "created_at"]
    elif file_type == "matches":
        data = Match.query.all()
        fieldnames = ["id", "tournament_id", "round_number", "match_in_round", 
                      "team1_id", "team2_id", "team1_score", "team2_score", 
                      "winner_id", "status", "next_match_progression_id", "next_match_slot", "created_at"]
    else:
        flash("Invalid file type for download.", "danger")
        return redirect(url_for('admin_csv_upload'))

    if not data:
        flash(f"No data found for {file_type} to download.", "info")
        # Optionally, create an empty CSV with headers as before
        # For now, let's just redirect.
        return redirect(url_for('admin_csv_upload'))

    output = io.StringIO()
    # For DictWriter, convert ORM objects to dicts or access attributes
    # Example for participants:
    if file_type == "participants":
        dict_data = []
        for p_obj in data:
            dict_data.append({
                "id": p_obj.id,
                "first_name": p_obj.first_name,
                "last_name": p_obj.last_name,
                "team_id": p_obj.team_id,
                "team_name": p_obj.team_assigned.name if p_obj.team_assigned else "", # Example of adding related data
                "needs_teammate": p_obj.needs_teammate,
                "created_at": p_obj.created_at.strftime("%Y-%m-%d %H:%M:%S") if p_obj.created_at else ""
            })
        # Adjust fieldnames if you add team_name
        if dict_data: fieldnames.insert(4, "team_name") # Example
        data_to_write = dict_data
    elif file_type == "teams":
        data_to_write = [{"id": t.id, "name": t.name, "created_at": t.created_at.strftime("%Y-%m-%d %H:%M:%S") if t.created_at else ""} for t in data]
    elif file_type == "tournaments":
        data_to_write = [{"id": t.id, "name": t.name, "type": t.type, "status": t.status, "created_at": t.created_at.strftime("%Y-%m-%d %H:%M:%S") if t.created_at else ""} for t in data]
    elif file_type == "matches":
        data_to_write = []
        for m_obj in data:
            data_to_write.append({
                "id": m_obj.id, "tournament_id": m_obj.tournament_id, "round_number": m_obj.round_number,
                "match_in_round": m_obj.match_in_round, "team1_id": m_obj.team1_id, "team2_id": m_obj.team2_id,
                "team1_score": m_obj.team1_score, "team2_score": m_obj.team2_score, "winner_id": m_obj.winner_id,
                "status": m_obj.status, "next_match_progression_id": m_obj.next_match_progression_id,
                "next_match_slot": m_obj.next_match_slot, 
                "created_at": m_obj.created_at.strftime("%Y-%m-%d %H:%M:%S") if m_obj.created_at else ""
            })
    else: # Should not be reached due to earlier check
        data_to_write = []


    if not data_to_write and data: # If conversion failed or data was complex
        flash(f"Could not prepare {file_type} data for CSV export.", "warning")
        return redirect(url_for('admin_csv_upload'))
    elif not data_to_write and not data: # No data and nothing to write
         pass # Flash message already handled


    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
    writer.writeheader()
    writer.writerows(data_to_write)
    
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-disposition": f"attachment; filename={file_type}.csv"}
    )

# --- Error Handlers ---
@app.errorhandler(CSRFError)
def handle_csrf_error(e):
    return render_template('index.html', error=e.description), 400

@app.errorhandler(404)
def page_not_found(e):
    return render_template('index.html', error="Page not found"), 404

@app.errorhandler(500)
def server_error(e):
    return render_template('index.html', error="Internal server error"), 500

# --- Custom CLI Commands ---
@app.cli.command("seed-test-bracket")
@click.option('--tournament-id', default=1, type=int, help='ID of the tournament to seed matches into.')
def seed_test_bracket_command(tournament_id):
    click.echo(f"Attempting to seed bracket for tournament ID: {tournament_id}")
    with app.app_context():
        try:
            tournament = Tournament.query.get(tournament_id)
            if not tournament:
                click.secho(f"Error: Tournament with ID {tournament_id} not found. Aborting.", fg="red")
                return
            click.echo(f"Using tournament: {tournament.name} (ID: {tournament.id})")
            team_names_to_ensure = ["Team Alpha Seed", "Team Bravo Seed", "Team Charlie Seed", "Team Delta Seed"]
            teams = {}
            for name in team_names_to_ensure:
                team_obj = Team.query.filter_by(name=name).first()
                if not team_obj:
                    click.echo(f"Creating team: {name}")
                    team_obj = Team(name=name)
                    db.session.add(team_obj)
                teams[name] = team_obj
            db.session.commit()
            team_a = teams["Team Alpha Seed"]; team_b = teams["Team Bravo Seed"]
            team_c = teams["Team Charlie Seed"]; team_d = teams["Team Delta Seed"]
            click.echo(f"Using Team IDs: A={team_a.id}, B={team_b.id}, C={team_c.id}, D={team_d.id}")

            if tournament and team_a and team_b and team_c and team_d:
                click.echo("Proceeding with match creation...")
                # Clear existing matches for this tournament to avoid duplicates if re-seeding
                Match.query.filter_by(tournament_id=tournament.id).delete()
                db.session.commit() # Commit deletion before adding new
                click.echo("Cleared existing matches for this tournament.")

                match1_r1 = Match(tournament_id=tournament.id, round_number=1, match_in_round=1, team1_id=team_a.id, team2_id=team_b.id, status="pending")
                match2_r1 = Match(tournament_id=tournament.id, round_number=1, match_in_round=2, team1_id=team_c.id, team2_id=team_d.id, status="pending")
                match1_r2_final = Match(tournament_id=tournament.id, round_number=2, match_in_round=1, team1_id=None, team2_id=None, status="pending")
                db.session.add_all([match1_r1, match2_r1, match1_r2_final])
                db.session.commit()
                click.echo(f"R1M1 ID:{match1_r1.id}, R1M2 ID:{match2_r1.id}, Final ID:{match1_r2_final.id}")
                match1_r1.next_match_progression_id = match1_r2_final.id; match1_r1.next_match_slot = "team1"
                match2_r1.next_match_progression_id = match1_r2_final.id; match2_r1.next_match_slot = "team2"
                match1_r1.team1_score = 21; match1_r1.team2_score = 10; match1_r1.winner_id = team_a.id; match1_r1.status = "completed"
                if match1_r1.next_match_slot == "team1": match1_r2_final.team1_id = match1_r1.winner_id
                elif match1_r1.next_match_slot == "team2": match1_r2_final.team2_id = match1_r1.winner_id
                match2_r1.team1_score = 15; match2_r1.team2_score = 21; match2_r1.winner_id = team_d.id; match2_r1.status = "completed"
                if match2_r1.next_match_slot == "team1": match1_r2_final.team1_id = match2_r1.winner_id
                elif match2_r1.next_match_slot == "team2": match1_r2_final.team2_id = match2_r1.winner_id
                if match1_r2_final.team1_id and match1_r2_final.team2_id:
                    match1_r2_final.team1_score = 21; match1_r2_final.team2_score = 18
                    match1_r2_final.winner_id = team_a.id; match1_r2_final.status = "completed"
                    tournament.status = "completed"
                    click.echo("Tournament completed with final match results.")
                else: click.echo("Final match teams not fully set.")
                db.session.commit()
                click.echo("Match progression, scores, and winners updated.")
            else: click.echo("Error: Prerequisite tournament/teams not ready for match creation.")
            click.secho("Test bracket seeding complete!", fg="green")
        except Exception as e:
            db.session.rollback()
            click.secho(f"Error during seeding: {str(e)}", fg="red")
            import traceback
            traceback.print_exc()

# if __name__ == "__main__": # Not needed if using `flask run` or gunicorn
#     app.run(host="0.0.0.0", port=5000, debug=True)