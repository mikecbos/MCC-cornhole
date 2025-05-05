/**
 * Main JavaScript file for the Cornhole Tournament App
 */

document.addEventListener('DOMContentLoaded', function() {
    // Enable Bootstrap tooltips
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
    
    // Enable Bootstrap popovers
    const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
    const popoverList = [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl));
    
    // Automatically dismiss alerts after 5 seconds
    setTimeout(function() {
        const alerts = document.querySelectorAll('.alert:not(.alert-permanent)');
        alerts.forEach(function(alert) {
            const bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        });
    }, 5000);
    
    // Form validation
    const forms = document.querySelectorAll('.needs-validation');
    Array.from(forms).forEach(function(form) {
        form.addEventListener('submit', function(event) {
            if (!form.checkValidity()) {
                event.preventDefault();
                event.stopPropagation();
            }
            form.classList.add('was-validated');
        }, false);
    });
    
    // Add behavior for "select all" checkboxes
    const selectAllCheckboxes = document.querySelectorAll('[data-select-all]');
    selectAllCheckboxes.forEach(function(checkbox) {
        const targetName = checkbox.dataset.selectAll;
        const targetCheckboxes = document.querySelectorAll(`input[name="${targetName}"]`);
        
        checkbox.addEventListener('change', function() {
            targetCheckboxes.forEach(function(targetCheckbox) {
                targetCheckbox.checked = checkbox.checked;
            });
        });
        
        // Update "select all" checkbox when individual checkboxes are changed
        targetCheckboxes.forEach(function(targetCheckbox) {
            targetCheckbox.addEventListener('change', function() {
                const allChecked = Array.from(targetCheckboxes).every(checkbox => checkbox.checked);
                const someChecked = Array.from(targetCheckboxes).some(checkbox => checkbox.checked);
                
                checkbox.checked = allChecked;
                checkbox.indeterminate = someChecked && !allChecked;
            });
        });
    });
    
    // Team search functionality
    const teamSearchInput = document.getElementById('teamSearch');
    if (teamSearchInput) {
        teamSearchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const teamCards = document.querySelectorAll('.team-card');
            
            teamCards.forEach(function(card) {
                const teamName = card.querySelector('.team-name').textContent.toLowerCase();
                if (teamName.includes(searchTerm)) {
                    card.classList.remove('d-none');
                } else {
                    card.classList.add('d-none');
                }
            });
        });
    }
    
    // Participant search functionality
    const participantSearchInput = document.getElementById('participantSearch');
    if (participantSearchInput) {
        participantSearchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const participantRows = document.querySelectorAll('.participant-row');
            
            participantRows.forEach(function(row) {
                const participantName = row.querySelector('.participant-name').textContent.toLowerCase();
                if (participantName.includes(searchTerm)) {
                    row.classList.remove('d-none');
                } else {
                    row.classList.add('d-none');
                }
            });
        });
    }
});
