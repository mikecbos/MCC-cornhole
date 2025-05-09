import os
import csv
import random
import math
from datetime import datetime


def check_data_dir():
    """Ensure data directory and CSV files exist."""
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


def read_csv(file_path):
    """Read CSV file and return list of dictionaries with resilient handling."""
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
    """Write list of dictionaries to CSV file with consistent encoding."""
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
    """Get all participants from CSV."""
    return read_csv("data/participants.csv")


def get_teams():
    """Get all teams from CSV."""
    return read_csv("data/teams.csv")


def get_tournaments():
    """Get all tournaments from CSV."""
    return read_csv("data/tournaments.csv")


def get_matches():
    """Get all matches from CSV."""
    return read_csv("data/matches.csv")


def get_team_by_id(team_id):
    """Get team by ID."""
    teams = get_teams()
    for team in teams:
        if team["id"] == team_id:
            return team
    return None


def get_participant_by_id(participant_id):
    """Get participant by ID."""
    participants = get_participants()
    for participant in participants:
        if participant["id"] == participant_id:
            return participant
    return None


def get_tournament_by_id(tournament_id):
    """Get tournament by ID."""
    tournaments = get_tournaments()
    for tournament in tournaments:
        if tournament["id"] == tournament_id:
            return tournament
    return None


def get_match_by_id(match_id):
    """Get match by ID."""
    matches = get_matches()
    for match in matches:
        if match["id"] == match_id:
            return match
    return None


def generate_tournament_bracket(tournament_id, tournament_type, team_ids):
    """Generate tournament bracket based on tournament type."""
    if tournament_type == "single_elimination":
        return generate_single_elimination_bracket(tournament_id, team_ids)
    elif tournament_type == "double_elimination":
        return generate_double_elimination_bracket(tournament_id, team_ids)
    elif tournament_type == "round_robin":
        return generate_round_robin_bracket(tournament_id, team_ids)
    else:
        return []


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
