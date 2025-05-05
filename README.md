# Cornhole Tournament Manager

A lightweight web application for managing cornhole tournaments. This application allows tournament organizers to register teams, create tournaments, and track match results.

## Features

- **User Registration**: Participants can register with their name and team information
- **Team Management**: Admin can create, edit, and delete teams, as well as reassign participants
- **Tournament Configuration**: Choose between single elimination, double elimination, and round robin formats
- **Bracket Generation**: Automatically generates tournament brackets based on registered teams
- **Score Tracking**: Record match scores and automatically advance winning teams
- **Responsive Design**: Works on both desktop and mobile devices

## Tech Stack

- **Backend**: Python Flask
- **Frontend**: HTML, CSS, JavaScript
- **Styling**: Bootstrap 5
- **Data Storage**: CSV files (lightweight, no database required)

## Installation & Setup

### Prerequisites

- Python 3.7 or higher
- pip (Python package installer)

### Local Development

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/cornhole-tournament-manager.git
   cd cornhole-tournament-manager
   ```

2. Create a virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```
   pip install Flask flask-wtf python-dotenv
   ```

4. Create environment variables:
   ```
   cp .env.example .env
   ```
   Then edit the `.env` file with your desired settings.

5. Run the application:
   ```
   python main.py
   ```

6. Visit `http://localhost:5000` in your browser to access the application.

### Deployment on Render

1. Push your code to GitHub.

2. Create a new Web Service on Render:
   - Connect your GitHub repository
   - Select "Python" as the runtime
   - Set the build command: `pip install Flask flask-wtf python-dotenv`
   - Set the start command: `python main.py`
   - Add the environment variables from your `.env` file

3. Deploy the service.

## Usage

### Admin Login

1. Navigate to `/admin/login` or click "Admin Login" in the navigation.
2. Enter the admin credentials defined in your `.env` file.

### Creating a Tournament

1. Log in as admin.
2. Go to "New Tournament" in the navigation.
3. Enter tournament details and select teams.
4. Create the tournament and view the generated bracket.

### Tracking Scores

1. Log in as admin.
2. Navigate to a tournament view.
3. Click "Update" on any match to enter scores.
4. Enter the scores and save - winners will automatically advance.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- Bootstrap for the responsive UI
- Chart.js for bracket visualization
- Font Awesome for icons
