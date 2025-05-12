import os
import csv # Marked for Deletion
import random
import math
from datetime import datetime
from models import db, Match, Team

"""
def check_data_dir():
    # Ensure data directory and CSV files exist. <<< trip quotes
    if not os.path.exists("data"):
        os.makedirs("data")

    # Create participants.csv if it doesn't exist
    if not os.path.exists("data/participants.csv"):
        with open("data/participants.csv", "w", newline="") as file:
            writer = csv.writer(file)
            writer.writerow(["id", "first_name", "last_name", "team_id", "needs_teammate", "created_at"])
    
    # Check for existing participants file that needs to be updated
    else:
        # Read the first row to check the schema
        with open("data/participants.csv", "r", newline="") as file:
            reader = csv.reader(file)
            header = next(reader, None)
            if header and "needs_teammate" not in header:
                # Create a backup
                import shutil
                shutil.copy2("data/participants.csv", "data/participants.csv.bak")
                
                # Read all data
                file.seek(0)
                data = list(reader)
                
                # Update with new schema
                new_header = header + ["needs_teammate"]
                
                # Write data back with new schema
                with open("data/participants.csv", "w", newline="") as outfile:
                    writer = csv.writer(outfile)
                    writer.writerow(new_header)
                    for row in data[1:]:  # Skip header row
                        # Default value for needs_teammate is False
                        writer.writerow(row + ["False"])
                        
    # Create teams.csv if it doesn't exist
    if not os.path.exists("data/teams.csv"):
        with open("data/teams.csv", "w", newline="") as file:
            writer = csv.writer(file)
            writer.writerow(["id", "name", "created_at"])

    # Create tournaments.csv if it doesn't exist
    if not os.path.exists("data/tournaments.csv"):
        with open("data/tournaments.csv", "w", newline="") as file:
            writer = csv.writer(file)
            writer.writerow(["id", "name", "type", "status", "created_at"])

    # Create matches.csv if it doesn't exist
    if not os.path.exists("data/matches.csv"):
        with open("data/matches.csv", "w", newline="") as file:
            writer = csv.writer(file)
            writer.writerow([
                "id", "tournament_id", "round", "match_number", 
                "team1_id", "team2_id", "team1_score", "team2_score", 
                "winner_id", "status", "next_match_id", "next_match_position"
            ])

def write_participants_csv(data, fieldnames=None):
    # Write participants data to CSV with specified field order. <<< Triple quotes
    if not data:
        return
    
    # If fieldnames not provided, use the keys from the first row
    if not fieldnames:
        fieldnames = data[0].keys()
    
    path = "data/participants.csv"
    try:
        with open(path, "w", newline="", encoding="utf-8") as file:
            writer = csv.DictWriter(file, fieldnames=fieldnames, extrasaction='ignore')
            writer.writeheader()
            writer.writerows(data)
    except Exception as e:
        app.logger.error(f"Error writing participants CSV: {str(e)}")
        raise

def write_teams_csv(data, fieldnames=None):
    # Write teams data to CSV with specified field order. <<< Triple quotes
    if not data:
        return
    
    # If fieldnames not provided, use the keys from the first row
    if not fieldnames:
        fieldnames = data[0].keys()
    
    path = "data/teams.csv"
    try:
        with open(path, "w", newline="", encoding="utf-8") as file:
            writer = csv.DictWriter(file, fieldnames=fieldnames, extrasaction='ignore')
            writer.writeheader()
            writer.writerows(data)
    except Exception as e:
        app.logger.error(f"Error writing teams CSV: {str(e)}")
        raise

def read_csv(file_path):
    # Read CSV file and return list of dictionaries with resilient handling. <<< Triple quotes
    if not os.path.exists(file_path):
        return []

    try:
        # Try multiple encodings if necessary
        encodings = ['utf-8', 'utf-8-sig', 'latin-1']
        data = None
        
        for encoding in encodings:
            try:
                with open(file_path, "r", newline="", encoding=encoding) as file:
                    reader = csv.DictReader(file)
                    data = []
                    for row in reader:
                        # Clean up each field value
                        cleaned_row = {k: v.strip() if isinstance(v, str) else v for k, v in row.items()}
                        data.append(cleaned_row)
                break  # If successful, exit the loop
            except UnicodeDecodeError:
                continue
            except Exception as e:
                print(f"Error with encoding {encoding}: {e}")
                continue
                
        if data is None:
            print(f"Could not read file with any encoding: {file_path}")
            return []
            
        return data
    except Exception as e:
        print(f"Error reading CSV {file_path}: {e}")
        return []

def write_csv(file_path, data):
    # Write list of dictionaries to CSV file with consistent encoding. <<< Triple quotes
    if not data:
        return

    try:
        with open(file_path, "w", newline="", encoding="utf-8") as file:
            # Ensure all keys are included
            all_keys = set()
            for row in data:
                all_keys.update(row.keys())
                
            writer = csv.DictWriter(file, fieldnames=list(all_keys))
            writer.writeheader()
            writer.writerows(data)
    except Exception as e:
        print(f"Error writing CSV {file_path}: {e}")


def get_participants():
    # Get all participants from CSV. <<< Triple quotes
    return read_csv("data/participants.csv")


def get_teams():
    # Get all teams from CSV. <<< Triple quotes
    return read_csv("data/teams.csv")


def get_tournaments():
    # Get all tournaments from CSV. <<< Triple quotes
    return read_csv("data/tournaments.csv")


def get_matches():
    # Get all matches from CSV. <<< Triple quotes
    return read_csv("data/matches.csv")


def get_team_by_id(team_id):
    # Get team by ID.<<< Triple quotes
    teams = get_teams()
    for team in teams:
        if team["id"] == team_id:
            return team
    return None


def get_participant_by_id(participant_id):
    # Get participant by ID.<<< Triple quotes
    participants = get_participants()
    for participant in participants:
        if participant["id"] == participant_id:
            return participant
    return None


def get_tournament_by_id(tournament_id):
    # Get tournament by ID.<<< Triple quotes
    tournaments = get_tournaments()
    for tournament in tournaments:
        if tournament["id"] == tournament_id:
            return tournament
    return None


def get_match_by_id(match_id):
    # Get match by ID.<<< Triple quotes
    matches = get_matches()
    for match in matches:
        if match["id"] == match_id:
            return match
    return None
"""

def generate_tournament_bracket(tournament_db_obj, tournament_type, team_db_objects_or_ids):
    """
    Generate tournament bracket based on tournament type and prepare Match ORM objects.
    Args:
        tournament_db_obj (Tournament): The SQLAlchemy Tournament ORM object this bracket is for.
                                        (Assumed to have an ID already).
        tournament_type (str): Type of tournament (e.g., "single_elimination").
        team_db_objects_or_ids (list): A list of Team SQLAlchemy objects or their IDs.
    Returns:
        list: A list of new SQLAlchemy Match ORM objects (staged, not committed by this function).
    """
    new_match_orm_objects = []
    
    team_ids = []
    if not team_db_objects_or_ids:
        return [] # Cannot generate a bracket without teams
    
    if hasattr(team_db_objects_or_ids[0], 'id'): # Check if it's a list of ORM objects
        team_ids = [team.id for team in team_db_objects_or_ids]
    else: # Assume it's already a list of IDs
        team_ids = list(team_db_objects_or_ids) # Ensure it's a mutable list

    num_teams = len(team_ids)
    if num_teams < 2 and tournament_type != 'round_robin': # Round robin can technically have 1 "team" (no matches)
         # For single/double elim, less than 2 teams is problematic
        if tournament_type in ["single_elimination", "double_elimination"] and num_teams < 2:
            return []


    # --- SINGLE ELIMINATION BRACKET LOGIC ---
    if tournament_type == "single_elimination":
        if num_teams == 0: return []
        
        rounds_needed = math.ceil(math.log2(num_teams)) if num_teams > 0 else 0
        total_slots = 2 ** rounds_needed
        byes_needed = total_slots - num_teams

        current_round_teams_ids = list(team_ids) # Make a copy
        random.shuffle(current_round_teams_ids) # Shuffle for seeding
        current_round_teams_ids.extend([None] * byes_needed) # Add None for byes

        # Store matches by round to link them later
        matches_by_round = {i: [] for i in range(1, rounds_needed + 1)}
        
        # --- Generate all match objects first, then link ---
        all_new_matches_for_tournament = []

        # Round 1
        round_num = 1
        match_in_round_counter = 1
        round_1_matches = []
        for i in range(0, total_slots, 2):
            team1_id = current_round_teams_ids[i]
            team2_id = current_round_teams_ids[i+1]
            
            status = "pending"
            winner_id = None
            team1_score, team2_score = None, None

            if team1_id and not team2_id: # Team 1 gets a bye
                winner_id = team1_id
                status = "completed"
                # team1_score, team2_score = 1, 0 # Optional: score for bye
            elif not team1_id and team2_id: # Team 2 gets a bye
                winner_id = team2_id
                status = "completed"
                # team1_score, team2_score = 0, 1 # Optional: score for bye
            elif not team1_id and not team2_id: # Should not happen if total_slots > 0
                continue

            match_obj = Match(
                tournament_id=tournament_db_obj.id,
                round_number=round_num,
                match_in_round=match_in_round_counter,
                team1_id=team1_id,
                team2_id=team2_id,
                status=status,
                winner_id=winner_id,
                team1_score=team1_score,
                team2_score=team2_score
            )
            round_1_matches.append(match_obj)
            all_new_matches_for_tournament.append(match_obj)
            match_in_round_counter += 1
        matches_by_round[round_num] = round_1_matches
        
        # Subsequent Rounds (placeholders)
        for r_num in range(2, rounds_needed + 1):
            num_matches_in_this_round = len(matches_by_round[r_num - 1]) // 2
            match_in_round_counter = 1
            current_round_new_matches = []
            for _ in range(num_matches_in_this_round):
                match_obj = Match(
                    tournament_id=tournament_db_obj.id,
                    round_number=r_num,
                    match_in_round=match_in_round_counter,
                    status="pending" # Teams TBD
                )
                current_round_new_matches.append(match_obj)
                all_new_matches_for_tournament.append(match_obj)
                match_in_round_counter += 1
            matches_by_round[r_num] = current_round_new_matches

        # --- Add to session and flush to get IDs ---
        if all_new_matches_for_tournament:
            db.session.add_all(all_new_matches_for_tournament)
            db.session.flush() # THIS IS KEY: Populates match_obj.id for all new matches

        # --- Now link matches using their new IDs and advance bye winners ---
        for r_num in range(1, rounds_needed): # Iterate up to the second to last round
            matches_in_current_round = matches_by_round[r_num]
            matches_in_next_round = matches_by_round[r_num + 1]
            
            for i in range(len(matches_in_current_round)):
                current_match = matches_in_current_round[i]
                next_round_match_index = i // 2
                if next_round_match_index < len(matches_in_next_round):
                    next_match_for_progression = matches_in_next_round[next_round_match_index]
                    current_match.next_match_progression_id = next_match_for_progression.id
                    current_match.next_match_slot = "team1" if i % 2 == 0 else "team2"

                    # If current match was a bye, populate the next match
                    if current_match.status == "completed" and current_match.winner_id:
                        if current_match.next_match_slot == "team1":
                            next_match_for_progression.team1_id = current_match.winner_id
                        elif current_match.next_match_slot == "team2":
                            next_match_for_progression.team2_id = current_match.winner_id
        
        new_match_orm_objects = all_new_matches_for_tournament

    # --- DOUBLE ELIMINATION (Placeholder - Very Complex) ---
    elif tournament_type == "double_elimination":
        # This requires creating a winners' bracket and a losers' bracket,
        # and logic for dropping losers, and a grand final.
        # For now, we can delegate to single elimination as a placeholder.
        # Or return empty and flash a "not implemented" message in the route.
        # For this example, let's just return an empty list for double_elim.
        print("Warning: Double elimination bracket generation is not fully implemented.")
        return [] # Or implement simplified version

    # --- ROUND ROBIN BRACKET LOGIC ---
    elif tournament_type == "round_robin":
        if num_teams < 2: return []
        
        match_in_round_counter = 1 # Typically all RR matches are one "round" or phase
        round_num = 1 
        
        # To avoid duplicate pairings (Team A vs Team B is same as Team B vs Team A)
        # Iterate such that j always starts greater than i
        for i in range(num_teams):
            for j in range(i + 1, num_teams):
                team1_id_for_match = team_ids[i]
                team2_id_for_match = team_ids[j]
                
                new_match = Match(
                    tournament_id=tournament_db_obj.id,
                    round_number=round_num, 
                    match_in_round=match_in_round_counter,
                    team1_id=team1_id_for_match,
                    team2_id=team2_id_for_match,
                    status="pending"
                )
                new_match_orm_objects.append(new_match)
                match_in_round_counter += 1
    else:
        print(f"Warning: Unknown tournament type '{tournament_type}'")
        return []

    return new_match_orm_objects

def generate_single_elimination_bracket(tournament_id, team_ids):
    """Generate single elimination tournament bracket."""
    matches = []
    team_count = len(team_ids)
    
    # Determine the number of rounds needed
    rounds_needed = math.ceil(math.log2(team_count))
    total_slots = 2 ** rounds_needed
    
    # Randomly shuffle teams for seeding
    shuffled_teams = team_ids.copy()
    random.shuffle(shuffled_teams)
    
    # Add byes if needed
    byes_needed = total_slots - team_count
    for i in range(byes_needed):
        shuffled_teams.append("")
    
    # Create matches for first round
    first_round_matches = []
    for i in range(0, len(shuffled_teams), 2):
        match_id = f"{tournament_id}_{1}_{(i//2) + 1}"  # tournament_id_round_match_number
        match = {
            "id": match_id,
            "tournament_id": tournament_id,
            "round": "1",
            "match_number": str((i//2) + 1),
            "team1_id": shuffled_teams[i],
            "team2_id": shuffled_teams[i+1] if i+1 < len(shuffled_teams) else "",
            "team1_score": "",
            "team2_score": "",
            "winner_id": "",
            "status": "pending",
            "next_match_id": "",  # Will be filled in later
            "next_match_position": ""  # Will be filled in later
        }
        
        # If one team is empty (bye) and the other isn't, the non-empty team automatically advances
        if match["team1_id"] and not match["team2_id"]:
            match["winner_id"] = match["team1_id"]
            match["status"] = "completed"
            match["team1_score"] = "1"
            match["team2_score"] = "0"
        elif not match["team1_id"] and match["team2_id"]:
            match["winner_id"] = match["team2_id"]
            match["status"] = "completed"
            match["team1_score"] = "0"
            match["team2_score"] = "1"
        
        first_round_matches.append(match)
    
    matches.extend(first_round_matches)
    
    # Create matches for subsequent rounds
    for round_num in range(2, rounds_needed + 1):
        prev_round_matches = [m for m in matches if m["round"] == str(round_num - 1)]
        current_round_matches = []
        
        for i in range(0, len(prev_round_matches), 2):
            match_id = f"{tournament_id}_{round_num}_{(i//2) + 1}"
            match = {
                "id": match_id,
                "tournament_id": tournament_id,
                "round": str(round_num),
                "match_number": str((i//2) + 1),
                "team1_id": "",  # Will be filled when previous matches are completed
                "team2_id": "",  # Will be filled when previous matches are completed
                "team1_score": "",
                "team2_score": "",
                "winner_id": "",
                "status": "pending",
                "next_match_id": "",  # Will be filled in later
                "next_match_position": ""  # Will be filled in later
            }
            
            current_round_matches.append(match)
            
            # Update previous round matches with next match info
            if i < len(prev_round_matches):
                prev_round_matches[i]["next_match_id"] = match_id
                prev_round_matches[i]["next_match_position"] = "1"  # First team in next match
            
            if i+1 < len(prev_round_matches):
                prev_round_matches[i+1]["next_match_id"] = match_id
                prev_round_matches[i+1]["next_match_position"] = "2"  # Second team in next match
        
        matches.extend(current_round_matches)
    
    # Handle byes by advancing teams through empty matches automatically
    for match in matches:
        # If a previous match was a bye, set the winner in the next match
        if match["status"] == "completed" and match["next_match_id"]:
            next_match = next((m for m in matches if m["id"] == match["next_match_id"]), None)
            if next_match:
                if match["next_match_position"] == "1":
                    next_match["team1_id"] = match["winner_id"]
                else:
                    next_match["team2_id"] = match["winner_id"]
    
    return matches


def generate_double_elimination_bracket(tournament_id, team_ids):
    """
    Generate double elimination tournament bracket.
    This is a simplified version that creates a winners and losers bracket.
    """
    matches = []
    # For simplicity, use single elimination implementation for now
    # In a real implementation, you'd create both a winners and losers bracket
    return generate_single_elimination_bracket(tournament_id, team_ids)


def generate_round_robin_bracket(tournament_id, team_ids):
    """Generate round robin tournament bracket where every team plays against every other team."""
    matches = []
    team_count = len(team_ids)
    
    # If team count is odd, add a "bye" team
    if team_count % 2 != 0:
        team_ids.append("")
        team_count += 1
    
    # Number of rounds needed is team_count - 1
    rounds_needed = team_count - 1
    
    # Create a copy of team_ids for rotation
    teams = team_ids.copy()
    
    # First team is fixed, others rotate
    fixed_team = teams[0]
    rotating_teams = teams[1:]
    
    match_counter = 1
    
    for round_num in range(1, rounds_needed + 1):
        round_matches = []
        
        # Fixed team plays against the first rotating team
        if rotating_teams[0]:  # Skip if it's a bye
            match_id = f"{tournament_id}_{round_num}_{match_counter}"
            match = {
                "id": match_id,
                "tournament_id": tournament_id,
                "round": str(round_num),
                "match_number": str(match_counter),
                "team1_id": fixed_team,
                "team2_id": rotating_teams[0],
                "team1_score": "",
                "team2_score": "",
                "winner_id": "",
                "status": "pending",
                "next_match_id": "",
                "next_match_position": ""
            }
            round_matches.append(match)
            match_counter += 1
        
        # Pair remaining teams
        for i in range(1, len(rotating_teams) // 2 + 1):
            team1 = rotating_teams[i]
            team2 = rotating_teams[len(rotating_teams) - i]
            
            if team1 and team2:  # Skip if either is a bye
                match_id = f"{tournament_id}_{round_num}_{match_counter}"
                match = {
                    "id": match_id,
                    "tournament_id": tournament_id,
                    "round": str(round_num),
                    "match_number": str(match_counter),
                    "team1_id": team1,
                    "team2_id": team2,
                    "team1_score": "",
                    "team2_score": "",
                    "winner_id": "",
                    "status": "pending",
                    "next_match_id": "",
                    "next_match_position": ""
                }
                round_matches.append(match)
                match_counter += 1
        
        matches.extend(round_matches)
        
        # Rotate teams for next round: first team fixed, last team moves clockwise
        rotating_teams = [rotating_teams[-1]] + rotating_teams[:-1]
    
    return matches
