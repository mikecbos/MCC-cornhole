/**
 * JavaScript functionality for admin pages
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize edit team modal
    initEditTeamModal();
    
    // Initialize delete team confirmation
    initDeleteTeamConfirmation();
    
    // Initialize delete participant confirmation
    initDeleteParticipantConfirmation();
    
    // Initialize reassign participant functionality
    initReassignParticipant();
    
    // Initialize tournament type selection
    initTournamentTypeSelection();
});

/**
 * Initialize edit team modal to populate with team data
 */
function initEditTeamModal() {
    const editTeamModal = document.getElementById('editTeamModal');
    if (!editTeamModal) return;
    
    editTeamModal.addEventListener('show.bs.modal', function(event) {
        const button = event.relatedTarget;
        const teamId = button.getAttribute('data-team-id');
        const teamName = button.getAttribute('data-team-name');
        
        const modalTitle = editTeamModal.querySelector('.modal-title');
        const teamIdInput = editTeamModal.querySelector('#edit_team_id');
        const teamNameInput = editTeamModal.querySelector('#edit_team_name');
        
        modalTitle.textContent = `Edit Team: ${teamName}`;
        teamIdInput.value = teamId;
        teamNameInput.value = teamName;
    });
}

/**
 * Initialize delete team confirmation
 */
function initDeleteTeamConfirmation() {
    const deleteTeamModal = document.getElementById('deleteTeamModal');
    if (!deleteTeamModal) return;
    
    deleteTeamModal.addEventListener('show.bs.modal', function(event) {
        const button = event.relatedTarget;
        const teamId = button.getAttribute('data-team-id');
        const teamName = button.getAttribute('data-team-name');
        
        const modalBody = deleteTeamModal.querySelector('.modal-body p');
        const teamIdInput = deleteTeamModal.querySelector('#delete_team_id');
        
        modalBody.textContent = `Are you sure you want to delete team "${teamName}"? This cannot be undone.`;
        teamIdInput.value = teamId;
    });
}

/**
 * Initialize delete participant confirmation
 */
function initDeleteParticipantConfirmation() {
    const deleteParticipantModal = document.getElementById('deleteParticipantModal');
    if (!deleteParticipantModal) return;
    
    deleteParticipantModal.addEventListener('show.bs.modal', function(event) {
        const button = event.relatedTarget;
        const participantId = button.getAttribute('data-participant-id');
        const participantName = button.getAttribute('data-participant-name');
        
        const modalBody = deleteParticipantModal.querySelector('.modal-body p');
        const participantIdInput = deleteParticipantModal.querySelector('#delete_participant_id');
        
        modalBody.textContent = `Are you sure you want to delete participant "${participantName}"? This cannot be undone.`;
        participantIdInput.value = participantId;
    });
}

/**
 * Initialize reassign participant functionality
 */
function initReassignParticipant() {
    const reassignModal = document.getElementById('reassignParticipantModal');
    if (!reassignModal) return;
    
    reassignModal.addEventListener('show.bs.modal', function(event) {
        const button = event.relatedTarget;
        const participantId = button.getAttribute('data-participant-id');
        const participantName = button.getAttribute('data-participant-name');
        const currentTeamId = button.getAttribute('data-team-id');
        
        const modalTitle = reassignModal.querySelector('.modal-title');
        const participantIdInput = reassignModal.querySelector('#reassign_participant_id');
        const teamSelect = reassignModal.querySelector('#new_team_id');
        
        modalTitle.textContent = `Reassign ${participantName}`;
        participantIdInput.value = participantId;
        
        // Select current team in dropdown
        if (teamSelect) {
            for (let i = 0; i < teamSelect.options.length; i++) {
                if (teamSelect.options[i].value === currentTeamId) {
                    teamSelect.selectedIndex = i;
                    break;
                }
            }
        }
    });
}

/**
 * Initialize tournament type selection behavior
 */
function initTournamentTypeSelection() {
    const tournamentTypeSelect = document.getElementById('tournament_type');
    if (!tournamentTypeSelect) return;
    
    const typeDescriptions = {
        'single_elimination': 'Teams are eliminated after a single loss. The last team standing wins.',
        'double_elimination': 'Teams are eliminated after two losses. Gives teams a second chance.',
        'round_robin': 'Every team plays against every other team. The team with the best record wins.'
    };
    
    const descriptionElement = document.getElementById('tournament_type_description');
    if (!descriptionElement) return;
    
    // Update description when type is changed
    tournamentTypeSelect.addEventListener('change', function() {
        const selectedType = this.value;
        descriptionElement.textContent = typeDescriptions[selectedType] || '';
    });
    
    // Initialize description based on initial selection
    const initialType = tournamentTypeSelect.value;
    descriptionElement.textContent = typeDescriptions[initialType] || '';
}
