/**
 * JavaScript for rendering and interacting with tournament brackets
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize tournament bracket visualization
    initBracketVisualization();
    
    // Handle score update forms
    initScoreUpdateForms();
});

/**
 * Initialize bracket visualization with connections between matches
 */
function initBracketVisualization() {
    const bracketContainer = document.querySelector('.tournament-bracket');
    if (!bracketContainer) return;
    
    // Draw connecting lines between matches using SVG
    setTimeout(function() {
        drawBracketConnections();
        
        // Redraw connections on window resize
        window.addEventListener('resize', function() {
            // Remove existing SVG lines
            const existingSvgs = document.querySelectorAll('.bracket-connector');
            existingSvgs.forEach(svg => svg.remove());
            
            // Redraw connections
            drawBracketConnections();
        });
    }, 100);
}

/**
 * Draw SVG connections between tournament matches
 */
function drawBracketConnections() {
    const rounds = document.querySelectorAll('.tournament-round');
    if (rounds.length <= 1) return;
    
    for (let i = 1; i < rounds.length; i++) {
        const currentRound = rounds[i];
        const previousRound = rounds[i-1];
        
        const currentMatches = currentRound.querySelectorAll('.match-card');
        const previousMatches = previousRound.querySelectorAll('.match-card');
        
        currentMatches.forEach(function(currentMatch) {
            // Get the two previous matches that feed into this one
            const matchId = currentMatch.dataset.matchId;
            const feederMatches = Array.from(previousMatches).filter(match => 
                match.dataset.nextMatchId === matchId
            );
            
            feederMatches.forEach(function(feederMatch) {
                connectMatchCards(feederMatch, currentMatch, feederMatch.dataset.nextMatchPosition);
            });
        });
    }
}

/**
 * Connect two match cards with an SVG line
 */
function connectMatchCards(fromCard, toCard, position) {
    const fromRect = fromCard.getBoundingClientRect();
    const toRect = toCard.getBoundingClientRect();
    
    // Create SVG element
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('bracket-connector');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '1';
    
    // Adjust for scroll position
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // Calculate start and end points
    const startX = fromRect.right + scrollLeft;
    const startY = fromRect.top + (fromRect.height / 2) + scrollTop;
    
    let endX = toRect.left + scrollLeft;
    let endY;
    
    // Position 1 = top of card, Position 2 = bottom of card
    if (position === '1') {
        endY = toRect.top + (toRect.height * 0.25) + scrollTop;
    } else {
        endY = toRect.top + (toRect.height * 0.75) + scrollTop;
    }
    
    // Calculate control points for curve
    const midX = startX + (endX - startX) / 2;
    
    // Create path
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`);
    path.setAttribute('stroke', 'var(--bs-info)');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    
    svg.appendChild(path);
    document.body.appendChild(svg);
}

/**
 * Initialize score update forms
 */
function initScoreUpdateForms() {
    const scoreInputs = document.querySelectorAll('.score-input');
    scoreInputs.forEach(function(input) {
        input.addEventListener('input', function() {
            // Validate score is a number and not negative
            let value = parseInt(this.value);
            if (isNaN(value) || value < 0) {
                this.value = '';
            }
            
            // Check if both scores are filled in to enable update button
            const form = this.closest('form');
            if (form) {
                const inputs = form.querySelectorAll('.score-input');
                const allFilled = Array.from(inputs).every(input => input.value.trim() !== '');
                const updateButton = form.querySelector('.score-update-btn');
                
                if (updateButton) {
                    updateButton.disabled = !allFilled;
                }
            }
        });
    });
}
