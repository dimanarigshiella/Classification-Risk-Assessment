/**
 * @deprecated - This file is deprecated and kept only for reference.
 * All functionality has been consolidated into main.js.
 * Please use main.js for all future updates and references.
 * Last updated: May 2025
 */

document.addEventListener('DOMContentLoaded', function() {
    // Form validation
    const questionnaireForm = document.querySelector('form');
    if (questionnaireForm) {
        questionnaireForm.addEventListener('submit', function(event) {
            const unansweredQuestions = validateForm();
            if (unansweredQuestions.length > 0) {
                event.preventDefault();
                highlightUnansweredQuestions(unansweredQuestions);
            }
        });
    }

    // Real-time score calculation
    setupRealTimeScoring();
    
    // Progress tracking
    updateProgressBar();
    
    // Add tooltips to question labels
    setupTooltips();
    
    // Smooth scrolling for navigation
    setupSmoothScrolling();
    
    // Highlight current risk level in the table
    highlightRiskLevel();

    // Example: If there's form validation for the client name field
    const clientNameField = document.querySelector('input[name="client_name"]');  // Changed from petitioner_name
    if (clientNameField) {
        // Validation logic
    }
    
    // Example: If there's special handling for the length of sentence dropdown
    const sentenceField = document.querySelector('select[name="length_of_sentence"]');  // Changed from sentence_length
    if (sentenceField) {
        // Special handling
    }
});

/**
 * Validates the form to ensure all questions are answered
 * @returns {Array} Array of unanswered question numbers
 */
function validateForm() {
    const questions = document.querySelectorAll('.question');
    const unansweredQuestions = [];
    
    if (!questions || questions.length === 0) {
        return unansweredQuestions; // Return empty array if no questions found
    }
    
    questions.forEach((questionDiv) => {
        if (!questionDiv) return; // Skip if element is null
        
        const radioButtons = questionDiv.querySelectorAll('input[type="radio"]');
        const answered = Array.from(radioButtons).some(radio => radio && radio.checked);
        
        questionDiv.classList.remove('unanswered', 'shake', 'highlight-question');
        
        if (!answered) {
            unansweredQuestions.push(questionDiv);
        }
    });
    
    return unansweredQuestions;
}

function highlightUnansweredQuestions(questions) {
    if (questions.length > 0) {
        const firstUnanswered = questions[0];
        
        // Add highlighting to all unanswered questions
        questions.forEach(question => {
            question.classList.add('unanswered');
        });

        // Add special highlight to first unanswered question
        firstUnanswered.classList.add('highlight-question');

        // Scroll the first unanswered question into center view
        firstUnanswered.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center'
        });

        // Add shake animation
        firstUnanswered.classList.add('shake');
        
        setTimeout(() => {
            firstUnanswered.classList.remove('shake');
        }, 820);
    }
}

/**
 * Sets up real-time score calculation
 */
function setupRealTimeScoring() {
    const radioButtons = document.querySelectorAll('input[type="radio"]');
    const scoreDisplay = document.createElement('div');
    scoreDisplay.className = 'current-score';
    scoreDisplay.innerHTML = '<strong>Current Segment Score:</strong> <span id="segment-score">0</span>';
    
    const form = document.querySelector('form');
    if (form) {
        const navigation = document.querySelector('.navigation');
        if (navigation) {
            form.insertBefore(scoreDisplay, navigation);
        }
        
        radioButtons.forEach(radio => {
            radio.addEventListener('change', updateCurrentScore);
        });
    }
}

/**
 * Updates the current segment score display
 */
function updateCurrentScore() {
    try {
        const radioButtons = document.querySelectorAll('input[type="radio"]:checked');
        let totalScore = 0;
        
        radioButtons.forEach(radio => {
            const value = parseInt(radio.value);
            if (!isNaN(value)) {
                totalScore += value;
            }
        });
        
        const scoreElement = document.getElementById('segment-score');
        if (scoreElement) {
            scoreElement.textContent = totalScore;
            
            scoreElement.className = '';
            if (totalScore > 8) {
                scoreElement.classList.add('high-score');
            } else if (totalScore > 4) {
                scoreElement.classList.add('medium-score');
            } else {
                scoreElement.classList.add('low-score');
            }
        }
    } catch (error) {
        console.error('Error updating score:', error);
    }
}

/**
 * Updates the progress bar based on current segment
 */
function updateProgressBar() {
    const progressBar = document.querySelector('.progress');
    if (progressBar) {
        // The width is already set in the template, but we can add a transition effect
        progressBar.style.transition = 'width 0.5s ease-in-out';
    }
}

/**
 * Sets up tooltips for questions
 */
function setupTooltips() {
    const questions = document.querySelectorAll('.question h3');
    
    const tooltipTexts = {};
    
    questions.forEach(question => {
        const questionText = question.textContent.split('.')[1].trim();
        
        if (tooltipTexts[questionText]) {
            // Create tooltip span
            const tooltipIcon = document.createElement('span');
            tooltipIcon.className = 'tooltip';
            tooltipIcon.innerHTML = ' <i class="info-icon">ⓘ</i>';
            
            const tooltipText = document.createElement('span');
            tooltipText.className = 'tooltip-text';
            tooltipText.textContent = tooltipTexts[questionText];
            
            tooltipIcon.appendChild(tooltipText);
            question.appendChild(tooltipIcon);
        }
    });
}

/**
 * Sets up smooth scrolling for navigation
 */
function setupSmoothScrolling() {
    const navButtons = document.querySelectorAll('.btn');
    
    navButtons.forEach(button => {
        if (!button.getAttribute('type')) {  // Skip submit buttons
            button.addEventListener('click', function(event) {
                // Only apply smooth scrolling for same-page navigation
                const href = this.getAttribute('href');
                if (href && href.startsWith('#')) {
                    event.preventDefault();
                    
                    const targetElement = document.querySelector(href);
                    if (targetElement) {
                        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            });
        }
    });
}

/**
 * Highlights the current risk level in the results table
 */
function highlightRiskLevel() {
    const totalScoreElement = document.querySelector('.summary p');
    if (totalScoreElement) {
        const totalScoreText = totalScoreElement.textContent;
        const totalScore = parseInt(totalScoreText.match(/\d+/)[0]);
        
        let riskLevelClass = '';
        if (totalScore <= 17) {
            riskLevelClass = 'risk-low';
        } else if (totalScore <= 28) {
            riskLevelClass = 'risk-medium';
        } else if (totalScore <= 39) {
            riskLevelClass = 'risk-high';
        } else {
            riskLevelClass = 'risk-very-high';
        }
        
        const riskLevelElement = document.querySelector('.summary h2');
        if (riskLevelElement) {
            riskLevelElement.classList.add(riskLevelClass);
        }
    }
}

/**
 * Adds animation to questions as they come into view
 */
document.addEventListener('scroll', function() {
    const questions = document.querySelectorAll('.question');
    
    questions.forEach(question => {
        const rect = question.getBoundingClientRect();
        const isVisible = (
            rect.top >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight)
        );
        
        if (isVisible) {
            question.classList.add('visible');
        }
    });
});

/**
 * Handles radio button selection with keyboard navigation
 */
document.addEventListener('keydown', function(event) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const activeElement = document.activeElement;
        
        if (activeElement.type === 'radio') {
            const questionGroup = activeElement.name;
            const options = document.querySelectorAll(`input[name="${questionGroup}"]`);
            const currentIndex = Array.from(options).indexOf(activeElement);
            
            let newIndex;
            if (event.key === 'ArrowLeft') {
                newIndex = (currentIndex - 1 + options.length) % options.length;
            } else {
                newIndex = (currentIndex + 1) % options.length;
            }
            
            options[newIndex].checked = true;
            options[newIndex].focus();
            updateCurrentScore();
            
            event.preventDefault();
        }
    }
});

/**
 * Adds confirmation before leaving page with unsaved answers
 */
window.addEventListener('beforeunload', function(event) {
    const form = document.querySelector('form');
    if (form) {
        const radioButtons = form.querySelectorAll('input[type="radio"]:checked');
        
        // If user has started answering but not submitted
        if (radioButtons.length > 0 && radioButtons.length < document.querySelectorAll('.question').length) {
            event.preventDefault();
            event.returnValue = 'You have unsaved answers. Are you sure you want to leave?';
            return event.returnValue;
        }
    }
});

/**
 * Adds accessibility features
 */
function enhanceAccessibility() {
    // Add ARIA labels to radio buttons
    const radioButtons = document.querySelectorAll('input[type="radio"]');
    radioButtons.forEach(radio => {
        const questionText = radio.closest('.question').querySelector('h3').textContent;
        const optionText = radio.nextElementSibling.textContent;
        radio.setAttribute('aria-label', `${questionText}: ${optionText}`);
    });
    
    // Make sure all interactive elements are keyboard accessible
    const interactiveElements = document.querySelectorAll('a, button, input');
    interactiveElements.forEach(element => {
        if (!element.getAttribute('tabindex')) {
            element.setAttribute('tabindex', '0');
        }
    });
}

// Call accessibility enhancements after DOM is loaded
document.addEventListener('DOMContentLoaded', enhanceAccessibility);

document.addEventListener('DOMContentLoaded', function () {
    const formButton = document.querySelector('.btn'); // Select the button
    const inputs = document.querySelectorAll('.input-box'); // Select all input boxes
    const dropdowns = document.querySelectorAll('.dropdown-box'); // Select all dropdowns

    formButton.addEventListener('click', function (event) {
        let isValid = true; // Flag to track if the form is valid

        // Clear previous error highlights
        inputs.forEach(input => {
            input.style.border = '1px solid #ccc'; // Reset border
            input.style.backgroundColor = ''; // Reset background color
        });
        dropdowns.forEach(dropdown => {
            dropdown.style.border = '1px solid #ccc'; // Reset border
            dropdown.style.backgroundColor = ''; // Reset background color
        });

        // Validate input boxes
        inputs.forEach(input => {
            if (input.value.trim() === '') {
                isValid = false;
                input.style.border = '2px solid red'; // Highlight the input box
                input.style.backgroundColor = '#ffcccc'; // Add light red background
            }
        });

        // Validate dropdowns
        dropdowns.forEach(dropdown => {
            if (dropdown.value === '') {
                isValid = false;
                dropdown.style.border = '2px solid red'; // Highlight the dropdown
                dropdown.style.backgroundColor = '#ffcccc'; // Add light red background
            }
        });

        // If the form is invalid, show an error message and prevent submission
        if (!isValid) {
            event.preventDefault(); // Prevent the default button action
            alert('Please fill out all required fields.'); // Show error message
        }
    });
});

document.addEventListener('DOMContentLoaded', function () {
    // Select all images in the segment
    const images = document.querySelectorAll('.segment-image');

    // Add click behavior to each image
    images.forEach((image, index) => {
        image.addEventListener('click', function () {
            const descriptions = [
                'Bagong Pilipinas',
                'Department of Justice',
                'Parole and Probation'
            ];
            alert(descriptions[index]); // Show an alert with the description
        });

        // Add hover behavior to change opacity and show tooltip
        image.addEventListener('mouseenter', function () {
            image.style.opacity = '0.8'; // Reduce opacity on hover
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.innerText = image.alt; // Use the alt text as the tooltip
            tooltip.style.position = 'absolute';
            tooltip.style.top = `${image.getBoundingClientRect().top - 30}px`;
            tooltip.style.left = `${image.getBoundingClientRect().left}px`;
            tooltip.style.backgroundColor = 'black';
            tooltip.style.color = 'white';
            tooltip.style.padding = '5px 10px';
            tooltip.style.borderRadius = '5px';
            tooltip.style.fontSize = '12px';
            tooltip.style.zIndex = '1001';
            tooltip.id = `tooltip-${index}`;
            document.body.appendChild(tooltip);
        });

        // Remove tooltip and reset opacity on mouse leave
        image.addEventListener('mouseleave', function () {
            image.style.opacity = '1'; // Reset opacity
            const tooltip = document.getElementById(`tooltip-${index}`);
            if (tooltip) {
                tooltip.remove(); // Remove the tooltip
            }
        });
    });
});

document.addEventListener('DOMContentLoaded', function() {
    const notesTextarea = document.getElementById('notes');

    function saveNotes() {
        const notes = notesTextarea.value;

        fetch('{{ url_for("save_notes") }}', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': '{{ csrf_token() }}'  // Include CSRF token if using Flask-WTF
            },
            body: new URLSearchParams({
                'notes': notes
            })
        }).then(response => {
            if (!response.ok) {
                console.error('Failed to save notes');
            }
        }).catch(error => {
            console.error('Error:', error);
        });
    }

    notesTextarea.addEventListener('blur', saveNotes);

    document.querySelector('form').addEventListener('submit', function(event) {
        saveNotes();
    });
});

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('questionForm');
    if (form) {
        // Disable the default HTML5 validation
        form.setAttribute('novalidate', 'true');
        
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Remove existing highlights
            document.querySelectorAll('.question').forEach(q => {
                q.classList.remove('highlight', 'shake');
            });

            // Check for unanswered questions
            const questions = document.querySelectorAll('.question');
            let allAnswered = true;
            let firstUnanswered = null;
            
            questions.forEach(question => {
                const radioButtons = question.querySelectorAll('input[type="radio"]');
                const isAnswered = Array.from(radioButtons).some(radio => radio.checked);
                
                if (!isAnswered) {
                    allAnswered = false;
                    question.classList.add('highlight');
                    if (!firstUnanswered) {
                        firstUnanswered = question;
                    }
                }
            });

            if (!allAnswered && firstUnanswered) {
                // Add shake animation to first unanswered question
                firstUnanswered.classList.add('shake');
                
                // Scroll to the first unanswered question
                firstUnanswered.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
                
                // Remove shake animation after it completes
                setTimeout(() => {
                    firstUnanswered.classList.remove('shake');
                }, 820);
                
                return false;
            }

            // If all questions are answered, submit the form
            this.submit();
        });

        // Remove highlighting when user answers a question
        form.addEventListener('change', function(e) {
            if (e.target.type === 'radio') {
                const question = e.target.closest('.question');
                if (question) {
                    question.classList.remove('highlight', 'shake');
                }
            }
        });
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('questionForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Remove existing highlights and classes
            document.querySelectorAll('.question').forEach(q => {
                q.classList.remove('highlight', 'unanswered', 'highlight-focus', 'shake');
            });

            // Check for unanswered questions
            const questions = this.querySelectorAll('.question');
            let allAnswered = true;
            let firstUnanswered = null;
            
            questions.forEach(question => {
                const radioButtons = question.querySelectorAll('input[type="radio"]');
                const isAnswered = Array.from(radioButtons).some(radio => radio.checked);
                
                if (!isAnswered) {
                    allAnswered = false;
                    question.classList.add('highlight', 'unanswered');
                    if (!firstUnanswered) {
                        firstUnanswered = question;
                    }
                }
            });

            if (!allAnswered && firstUnanswered) {
                // Add special highlight to first unanswered question
                firstUnanswered.classList.add('highlight-focus');
                
                // Scroll to the first unanswered question
                firstUnanswered.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
                
                // Add shake animation
                firstUnanswered.classList.add('shake');
                setTimeout(() => {
                    firstUnanswered.classList.remove('shake');
                }, 820);
                
                return false;
            }

            // If all questions are answered, submit the form
            this.submit();
        });
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('questionForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Remove existing highlights
            document.querySelectorAll('.question').forEach(q => {
                q.classList.remove('highlight', 'shake');
            });

            // Check for unanswered questions
            const questions = document.querySelectorAll('.question');
            let allAnswered = true;
            let firstUnanswered = null;
            
            questions.forEach(question => {
                const radioButtons = question.querySelectorAll('input[type="radio"]');
                const isAnswered = Array.from(radioButtons).some(radio => radio.checked);
                
                if (!isAnswered) {
                    allAnswered = false;
                    question.classList.add('highlight');
                    if (!firstUnanswered) {
                        firstUnanswered = question;
                    }
                }
            });

            if (!allAnswered && firstUnanswered) {
                // Add shake animation
                firstUnanswered.classList.add('shake');
                
                // Scroll to first unanswered question
                firstUnanswered.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
                
                // Remove shake after animation
                setTimeout(() => {
                    firstUnanswered.classList.remove('shake');
                }, 820);
                
                return false;
            }

            // If all questions are answered, submit the form
            this.submit();
        });
    }
});

// Add real-time validation as user interacts with radio buttons
document.addEventListener('change', function(e) {
    if (e.target.type === 'radio') {
        const question = e.target.closest('.question');
        if (question) {
            question.classList.remove('highlight', 'shake');
        }
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('questionForm');
    
    form.addEventListener('submit', function(e) {
        const questions = document.querySelectorAll('.question');
        let firstUnansweredQuestion = null;
        
        questions.forEach(question => {
            const radioButtons = question.querySelectorAll('input[type="radio"]');
            const isAnswered = Array.from(radioButtons).some(radio => radio.checked);
            
            // Remove previous highlighting
            question.classList.remove('unanswered', 'highlight-focus');
            
            if (!isAnswered) {
                question.classList.add('unanswered');
                if (!firstUnansweredQuestion) {
                    firstUnansweredQuestion = question;
                }
            }
        });
        
        if (firstUnansweredQuestion) {
            e.preventDefault();
            
            // Add special highlight to first unanswered question
            firstUnansweredQuestion.classList.add('highlight-focus');
            
            // Scroll to the unanswered question
            firstUnansweredQuestion.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
            
            // Add shake animation
            firstUnansweredQuestion.classList.add('shake');
            setTimeout(() => {
                firstUnansweredQuestion.classList.remove('shake');
            }, 820);
        }
    });
});

function handleFormSubmission(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    // Show loading indicator
    showLoadingIndicator();
    
    // Submit form data
    fetch(form.action, {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) throw new Error('Form submission failed');
        return response.json();
    })
    .then(data => {
        hideLoadingIndicator();
        if (data.redirect) {
            window.location.href = data.redirect;
        }
    })
    .catch(error => {
        hideLoadingIndicator();
        showError('An error occurred. Please try again.');
        console.error('Error:', error);
    });
}

// Add loading indicator functions
function showLoadingIndicator() {
    // Implementation
}

function hideLoadingIndicator() {
    // Implementation
}

function showError(message) {
    // Implementation
}