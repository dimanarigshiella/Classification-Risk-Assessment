/**
 * main.js - Consolidated JavaScript file for the Risk Assessment Application
 * Version: 1.0.0 (Consolidated May 2025)
 * 
 * This file contains all the JavaScript functionality for the application,
 * including form handling, validation, UI interactions, and data management.
 * All functionality from script.js has been merged into this file.
 */

// Secure Storage Module - Encrypts all localStorage data
const SecureStorage = (function() {
    // Generate a device-specific key that is derived from browser and device info
    // This is not perfect security, but adds a layer of protection
    function generateDeviceKey() {
        const browserInfo = navigator.userAgent;
        const screenInfo = `${window.screen.width}x${window.screen.height}`;
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const baseString = `${browserInfo}|${screenInfo}|${timeZone}`;
        
        // Create a hash of the device info as the encryption key
        return CryptoJS.SHA256(baseString).toString().substring(0, 32);
    }
    
    // Get the encryption key (with optional salt for even more security)
    function getEncryptionKey(salt = '') {
        const deviceKey = generateDeviceKey();
        const masterKey = deviceKey + salt;
        // Add application-specific salt
        return CryptoJS.SHA256('RiskAssessmentApp2025' + masterKey).toString();
    }
    
    // Encrypt data
    function encrypt(data, customSalt = '') {
        try {
            const jsonString = JSON.stringify(data);
            const encryptedData = CryptoJS.AES.encrypt(jsonString, getEncryptionKey(customSalt)).toString();
            return encryptedData;
        } catch (error) {
            console.error('Encryption error:', error.name);
            // Return the original data if encryption fails
            return JSON.stringify(data);
        }
    }
    
    // Decrypt data
    function decrypt(encryptedData, customSalt = '') {
        try {
            const bytes = CryptoJS.AES.decrypt(encryptedData, getEncryptionKey(customSalt));
            const decryptedJson = bytes.toString(CryptoJS.enc.Utf8);
            return JSON.parse(decryptedJson);
        } catch (error) {
            console.error('Decryption error:', error.name);
            // Return null if decryption fails
            return null;
        }
    }
    
    // Set item with encryption
    function setItem(key, value, customSalt = '') {
        try {
            // Sanitize and mask PII data before storing
            const sanitizedValue = (typeof value === 'object') 
                ? sanitizeDataForStorage(value) 
                : value;
                
            const encryptedValue = encrypt(sanitizedValue, customSalt);
            localStorage.setItem(`secure_${key}`, encryptedValue);
            return true;
        } catch (error) {
            console.error('Error setting encrypted item:', error.name);
            // Fall back to unencrypted storage as last resort
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (fallbackError) {
                console.error('Fallback storage error:', fallbackError.name);
                return false;
            }
        }
    }
    
    // Sanitize and mask sensitive data fields
    function sanitizeDataForStorage(data) {
        if (!data || typeof data !== 'object') return data;
        
        const sanitized = {...data};
        
        // Mask PII fields - shows only last few characters
        // Example: if there's an email field, store only domain or mask most of it
        if (sanitized.email) {
            const emailParts = sanitized.email.split('@');
            if (emailParts.length === 2) {
                const username = emailParts[0];
                sanitized.email = `${username.substring(0, 2)}***@${emailParts[1]}`;
            }
        }
        
        // If there's a client_name field, mask the middle
        if (sanitized.client_name) {
            const name = sanitized.client_name;
            if (name.length > 4) {
                sanitized.client_name = `${name.substring(0, 2)}*****${name.substring(name.length - 2)}`;
            }
        }
        
        return sanitized;
    }
    
    // Get item with decryption
    function getItem(key, customSalt = '') {
        try {
            const encryptedValue = localStorage.getItem(`secure_${key}`);
            if (!encryptedValue) {
                // Try to get from unencrypted fallback
                const fallbackValue = localStorage.getItem(key);
                if (fallbackValue) {
                    try {
                        return JSON.parse(fallbackValue);
                    } catch (parseError) {
                        return fallbackValue;
                    }
                }
                return null;
            }
            return decrypt(encryptedValue, customSalt);
        } catch (error) {
            console.error('Error getting encrypted item:', error.name);
            return null;
        }
    }
    
    // Remove item 
    function removeItem(key) {
        try {
            localStorage.removeItem(`secure_${key}`);
            localStorage.removeItem(key); // Also remove unencrypted version if exists
            return true;
        } catch (error) {
            console.error('Error removing item:', error.name);
            return false;
        }
    }
    
    // Clear all secure items
    function clear() {
        try {
            // Find all secure keys
            const secureKeys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('secure_')) {
                    secureKeys.push(key);
                }
            }
            
            // Remove all secure items
            secureKeys.forEach(key => localStorage.removeItem(key));
            return true;
        } catch (error) {
            console.error('Error clearing secure storage:', error.name);
            return false;
        }
    }
    
    // Return public methods
    return {
        setItem,
        getItem,
        removeItem,
        clear
    };
})();

// Input Sanitizer Module
const InputSanitizer = (function() {
    // Sanitize text input to prevent XSS
    function sanitizeText(text) {
        if (!text) return '';
        
        // Convert text to string if it isn't already
        const str = String(text);
        
        // Replace potentially dangerous characters
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    // Validate email format
    function validateEmail(email) {
        if (!email) return false;
        // Basic email validation regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    // Sanitize and validate form inputs
    function sanitizeFormData(formData) {
        const sanitized = {};
        
        Object.keys(formData).forEach(key => {
            const value = formData[key];
            
            // Handle different input types
            if (key.includes('email')) {
                // Email validation
                sanitized[key] = validateEmail(value) ? value : '';
            } else if (typeof value === 'string') {
                // Basic text sanitization for strings
                sanitized[key] = sanitizeText(value);
            } else {
                // For non-text values (like numbers), pass through
                sanitized[key] = value;
            }
        });
        
        return sanitized;
    }
    
    return {
        sanitizeText,
        validateEmail,
        sanitizeFormData
    };
})();

// SecureLogger - Masks sensitive data in logs
const SecureLogger = (function() {
    const sensitiveFields = ['email', 'client_name', 'officer_name', 'chief_name', 'notes'];
    
    // Mask sensitive data in log messages
    function maskSensitiveData(data) {
        if (!data || typeof data !== 'object') return data;
        
        const masked = {...data};
        
        sensitiveFields.forEach(field => {
            if (masked[field]) {
                if (field === 'email' && typeof masked[field] === 'string') {
                    const parts = masked[field].split('@');
                    if (parts.length === 2) {
                        masked[field] = `***@${parts[1]}`;
                    } else {
                        masked[field] = '***@***.***';
                    }
                } else {
                    masked[field] = '******';
                }
            }
        });
        
        return masked;
    }
    
    // Safe console logging that masks sensitive data
    function log(message, data) {
        if (data) {
            console.log(message, maskSensitiveData(data));
        } else {
            console.log(message);
        }
    }
    
    function error(message, data) {
        if (data) {
            console.error(message, maskSensitiveData(data));
        } else {
            console.error(message);
        }
    }
    
    function warn(message, data) {
        if (data) {
            console.warn(message, maskSensitiveData(data));
        } else {
            console.warn(message);
        }
    }
    
    return {
        log,
        error,
        warn,
        maskSensitiveData
    };
})();

document.addEventListener('DOMContentLoaded', function() {
    // Fix overlay issue - ensure overlay is properly hidden
    const overlay = document.querySelector('.overlay');
    if (overlay && overlay.classList.contains('active')) {
        overlay.classList.remove('active');
    }
    
    // Add click handler for the entire document to remove any stuck overlay
    document.addEventListener('click', function() {
        const overlay = document.querySelector('.overlay');
        if (overlay && overlay.classList.contains('active') && 
            !document.querySelector('.sidebar').classList.contains('active')) {
            overlay.classList.remove('active');
        }
    });
    
    // Get DOM elements
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const closeBtn = document.querySelector('.close-btn');
    const mainContent = document.querySelector('.main-content');

    // Form elements
    const form = document.getElementById('questionForm');
    const formButton = document.querySelector('.btn');

    // ==================== FORM DATA MANAGEMENT ====================

    // Function to get CSRF token from meta tag
    function getCsrfToken() {
        const metaTag = document.querySelector('meta[name="csrf-token"]');
        return metaTag ? metaTag.getAttribute('content') : '';
    }

    // Function to save all form data to localStorage
    function saveFormData() {
        try {
            const formData = {};
            
            // Save radio buttons
            document.querySelectorAll('input[type="radio"]:checked').forEach(radio => {
                formData[radio.name] = radio.value;
            });
            
            // Save text inputs - sanitize before saving
            document.querySelectorAll('input[type="text"], input[type="email"]').forEach(input => {
                formData[input.name] = InputSanitizer.sanitizeText(input.value);
            });
            
            // Save select dropdowns
            document.querySelectorAll('select').forEach(select => {
                formData[select.name] = select.value;
            });
            
            // Save textarea - sanitize before saving
            document.querySelectorAll('textarea').forEach(textarea => {
                formData[textarea.name] = InputSanitizer.sanitizeText(textarea.value);
            });
            
            // Get current segment ID from URL
            const currentPath = window.location.pathname;
            let segmentId = currentPath.split('/').pop();
            
            // Handle both /segment/1 and /segment_1 format
            if (segmentId.match(/^\d+$/)) {
                SecureLogger.log(`Saving data for segment ID from URL: ${segmentId}`);
            } else if (currentPath.includes('segment_')) {
                segmentId = currentPath.match(/segment_(\d+)/)[1];
                SecureLogger.log(`Saving data for segment_ format: ${segmentId}`);
            }
            
            // Use secure encrypted storage instead of raw localStorage
            SecureStorage.setItem(`segment_${segmentId}`, formData);
            SecureLogger.log(`Saved form data for segment ${segmentId}`, { count: Object.keys(formData).length });
            
            // Also save to a master record for easier checking
            const allData = SecureStorage.getItem('allSegmentData') || {};
            allData[`segment_${segmentId}`] = formData;
            SecureStorage.setItem('allSegmentData', allData);
            
            // Prevent browser "unsaved changes" prompt after saving
            if (form) {
                // Mark the form as pristine by storing the current state and
                // creating a flag that indicates we've saved the data
                form.setAttribute('data-saved', 'true');
                
                // For all form inputs, add a flag to indicate their state has been saved
                document.querySelectorAll('input, select, textarea').forEach(input => {
                    input.setAttribute('data-saved-value', input.value);
                });
                
                // For radio buttons, mark the checked ones as saved
                document.querySelectorAll('input[type="radio"]').forEach(radio => {
                    radio.setAttribute('data-saved-checked', radio.checked);
                });
            }
        } catch (error) {
            SecureLogger.error('Error saving form data:', error);
        }
    }

    // Function to load form data from localStorage
    function loadFormData() {
        try {
            const currentPath = window.location.pathname;
            let segmentId = currentPath.split('/').pop();
            
            // Handle both /segment/1 and /segment_1 format
            if (segmentId.match(/^\d+$/)) {
                SecureLogger.log(`Loading data for segment ID from URL: ${segmentId}`);
            } else if (currentPath.includes('segment_')) {
                segmentId = currentPath.match(/segment_(\d+)/)[1];
                SecureLogger.log(`Loading data for segment_ format: ${segmentId}`);
            }
            
            // Load from secure storage instead of raw localStorage
            const formData = SecureStorage.getItem(`segment_${segmentId}`);
            SecureLogger.log(`Attempting to load data for segment ${segmentId}: ${formData ? 'Data found' : 'No data'}`);
            
            if (formData) {
                SecureLogger.log(`Parsed form data with ${Object.keys(formData).length} items`);
                
                // Restore radio buttons
                Object.entries(formData).forEach(([name, value]) => {
                    const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
                    if (radio && radio.type === 'radio') {
                        radio.checked = true;
                        SecureLogger.log(`Restored radio: ${name} = ${value}`);
                    }
                    
                    // Restore text inputs
                    const textInput = document.querySelector(`input[name="${name}"]`);
                    if (textInput && (textInput.type === 'text' || textInput.type === 'email')) {
                        textInput.value = value;
                    }
                    
                    // Restore select dropdowns
                    const select = document.querySelector(`select[name="${name}"]`);
                    if (select) {
                        select.value = value;
                    }
                    
                    // Restore textarea
                    const textarea = document.querySelector(`textarea[name="${name}"]`);
                    if (textarea) {
                        textarea.value = value;
                    }
                });
                
                // Update the current score if applicable
                if (typeof updateCurrentScore === 'function') {
                    updateCurrentScore();
                }
            }
        } catch (error) {
            SecureLogger.error('Error loading form data:', error);
        }
    }

    // Function to clear all saved form data
    function clearAllFormData() {
        try {
            SecureLogger.log('Clearing all form data...');
            
            // Clear all segment data using secure storage
            for (let i = 0; i <= 8; i++) {
                SecureStorage.removeItem(`segment_${i}`);
            }
            
            // Clear all master data and special flags
            SecureStorage.removeItem('allSegmentData');
            SecureStorage.removeItem('riskAssessmentData');
            localStorage.removeItem('isSidebarNavigation');  // This should be session, not security-sensitive
            SecureStorage.removeItem('notes');
            
            // Also clear any legacy unencrypted data
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.startsWith('segment_') || 
                            key.startsWith('seg') || 
                            key.includes('assessment') || 
                            key.includes('risk'))) {
                    keysToRemove.push(key);
                }
            }
            
            // Remove identified keys
            keysToRemove.forEach(key => {
                localStorage.removeItem(key);
            });
            
            // Clear all form fields if any forms exist on the current page
            const forms = document.querySelectorAll('form');
            forms.forEach(form => {
                form.reset(); // Use the native reset method first
                
                // Then manually clear all inputs for thoroughness
                const inputs = form.querySelectorAll('input, textarea, select');
                inputs.forEach(input => {
                    if (input.type === 'radio' || input.type === 'checkbox') {
                        input.checked = false;
                    } else if (input.type !== 'submit' && input.type !== 'button') {
                        input.value = '';
                    }
                });
            });
            
            // Clear any notes textarea specifically
            const notesTextarea = document.getElementById('notes');
            if (notesTextarea) {
                notesTextarea.value = '';
            }
            
            // Update UI to reflect cleared state
            if (typeof updateSidebarCheckmarks === 'function') {
                updateSidebarCheckmarks();
            }
            
            if (typeof updateResultsLinkVisibility === 'function') {
                updateResultsLinkVisibility();
            }
            
            SecureLogger.log('All form data cleared successfully');
            return true;
        } catch (error) {
            SecureLogger.error('Error clearing form data:', error);
            return false;
        }
    }
    

    // ==================== FORM VALIDATION ====================

    // Function to check if all questions in a segment are answered
    function checkSegmentCompletion(segmentId) {
        try {
            // First try to check current DOM if we're on that segment
            const questions = document.querySelectorAll(`.question input[type="radio"]`);
            const segmentQuestions = Array.from(questions).filter(q => q.name.startsWith(`seg${segmentId}_`));
            
            if (segmentQuestions.length > 0) {
                const questionGroups = {};
                segmentQuestions.forEach(q => {
                    const questionName = q.name;
                    if (!questionGroups[questionName]) {
                        questionGroups[questionName] = [];
                    }
                    questionGroups[questionName].push(q);
                });

                return Object.values(questionGroups).every(group => 
                    group.some(radio => radio.checked)
                );
            } else {
                // If not on that segment, check localStorage
                const savedData = SecureStorage.getItem(`segment_${segmentId}`);
                if (!savedData) return false;
                
                const formData = SecureStorage.getItem(`segment_${segmentId}`);
                // Get expected question count for each segment
                const expectedQuestionCounts = {
                    1: 6, // Criminal History
                    2: 3, // Pro-Criminal Companions
                    3: 5, // Pro-Criminal Attitudes and Cognitions
                    4: 6, // Anti-Social Personality Pattern
                    5: 6, // Education and Employment
                    6: 4, // Family and Marital Status
                    7: 7, // Substance Abuse
                    8: 5  // Mental Health
                };
                
                // Check if we have the expected number of answers
                const segmentAnswers = Object.keys(formData).filter(key => key.startsWith(`seg${segmentId}_`));
                return segmentAnswers.length >= expectedQuestionCounts[segmentId];
            }
        } catch (error) {
            SecureLogger.error('Error checking segment completion:', error);
            return false;
        }
    }

    // Function to get all incomplete segments
    function getIncompleteSegments() {
        const incompleteSegments = [];
        for (let i = 1; i <= 8; i++) {
            if (!checkSegmentCompletion(i)) {
                incompleteSegments.push(i);
            }
        }
        return incompleteSegments;
    }

    // Validate the form and return unanswered questions
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
            
            questionDiv.classList.remove('unanswered', 'shake', 'highlight-question', 'highlight', 'highlight-focus');
            
            if (!answered) {
                unansweredQuestions.push(questionDiv);
            }
        });
        
        return unansweredQuestions;
    }

    // Highlight unanswered questions and scroll to the first one
    function highlightUnansweredQuestions(questions) {
        if (questions.length > 0) {
            const firstUnanswered = questions[0];
            
            // Add highlighting to all unanswered questions
            questions.forEach(question => {
                question.classList.add('unanswered', 'highlight');
            });

            // Add special highlight to first unanswered question
            firstUnanswered.classList.add('highlight-focus');

            // Scroll the first unanswered question into center view
            firstUnanswered.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });

            // Add shake animation
            firstUnanswered.classList.add('shake');
            setTimeout(() => {
                firstUnanswered.classList.remove('shake');
            }, 820);
        }
    }

    // Validate form inputs and dropdowns
    function validateInputs() {
        const inputs = document.querySelectorAll('.input-box');
        const dropdowns = document.querySelectorAll('.dropdown-box');
        let isValid = true;

        // Clear previous error highlights
        inputs.forEach(input => {
            input.style.border = '1px solid #ccc';
            input.style.backgroundColor = '';
        });
        
        dropdowns.forEach(dropdown => {
            dropdown.style.border = '1px solid #ccc';
            dropdown.style.backgroundColor = '';
        });

        // Validate input boxes
        inputs.forEach(input => {
            if (input.value.trim() === '') {
                isValid = false;
                input.style.border = '2px solid red';
                input.style.backgroundColor = '#ffcccc';
            }
        });

        // Validate dropdowns
        dropdowns.forEach(dropdown => {
            if (dropdown.value === '') {
                isValid = false;
                dropdown.style.border = '2px solid red';
                dropdown.style.backgroundColor = '#ffcccc';
            }
        });

        return isValid;
    }

    // ==================== UI FUNCTIONS ====================

    // Function to update sidebar checkmarks
    function updateSidebarCheckmarks() {
        const menuItems = document.querySelectorAll('.sidebar-menu a');
        menuItems.forEach(item => {
            const href = item.getAttribute('href');
            if (href.includes('segment')) {
                let segmentId;
                if (href.includes('segment_id=')) {
                    segmentId = href.match(/segment_id=(\d+)/)[1];
                } else if (href.includes('segment/')) {
                    segmentId = href.match(/segment\/(\d+)/)[1];
                } else if (href.includes('segment_')) {
                    segmentId = href.match(/segment_(\d+)/)[1];
                }
                
                if (segmentId) {
                    // Calculate completion percentage
                    const segmentCompletion = calculateSegmentCompletionPercentage(segmentId);
                    
                    // Remove any existing indicators
                    const existingIndicators = item.querySelectorAll('.checkmark, .incomplete-indicator, .progress-indicator');
                    existingIndicators.forEach(indicator => indicator.remove());
                    
                    // If fully complete, show checkmark
                    if (segmentCompletion === 100) {
                        const checkmark = document.createElement('i');
                        checkmark.className = 'fas fa-check checkmark';
                        checkmark.style.marginLeft = '10px';
                        checkmark.style.color = '#28a745';
                        checkmark.style.fontSize = '1.2em';
                        item.appendChild(checkmark);
                        SecureLogger.log('Added checkmark for segment:', segmentId);
                    }
                    // If partially complete, show progress circle
                    else if (segmentCompletion > 0) {
                        const progressIndicator = document.createElement('div');
                        progressIndicator.className = 'progress-indicator';
                        progressIndicator.style.marginLeft = '10px';
                        progressIndicator.style.width = '18px';
                        progressIndicator.style.height = '18px';
                        progressIndicator.style.display = 'inline-block';
                        progressIndicator.style.position = 'relative';
                        
                        // Create the progress circle using SVG
                        const svgNS = "http://www.w3.org/2000/svg";
                        const svg = document.createElementNS(svgNS, "svg");
                        svg.setAttribute("width", "18");
                        svg.setAttribute("height", "18");
                        svg.setAttribute("viewBox", "0 0 36 36");
                        
                        // Background circle
                        const bgCircle = document.createElementNS(svgNS, "circle");
                        bgCircle.setAttribute("cx", "18");
                        bgCircle.setAttribute("cy", "18");
                        bgCircle.setAttribute("r", "15.91549430918954");
                        bgCircle.setAttribute("fill", "transparent");
                        bgCircle.setAttribute("stroke", "#e9ecef");
                        bgCircle.setAttribute("stroke-width", "3");
                        
                        // Progress circle
                        const circle = document.createElementNS(svgNS, "circle");
                        circle.setAttribute("cx", "18");
                        circle.setAttribute("cy", "18");
                        circle.setAttribute("r", "15.91549430918954");
                        circle.setAttribute("fill", "transparent");
                        circle.setAttribute("stroke", "#007bff");
                        circle.setAttribute("stroke-width", "3");
                        circle.setAttribute("stroke-dasharray", `${segmentCompletion} ${100-segmentCompletion}`);
                        circle.setAttribute("stroke-dashoffset", "25");
                        
                        // Text element for percentage
                        const text = document.createElementNS(svgNS, "text");
                        text.setAttribute("x", "18");
                        text.setAttribute("y", "20");
                        text.setAttribute("font-size", "10");
                        text.setAttribute("text-anchor", "middle");
                        text.setAttribute("fill", "#007bff");
                        text.textContent = `${Math.round(segmentCompletion)}%`;
                        
                        svg.appendChild(bgCircle);
                        svg.appendChild(circle);
                        //svg.appendChild(text); // Uncomment if you want to show percentage number
                        
                        progressIndicator.appendChild(svg);
                        item.appendChild(progressIndicator);
                        
                        // Add tooltip showing exact completion
                        progressIndicator.title = `${Math.round(segmentCompletion)}% complete`;
                    }
                    // If not started, show empty circle
                    else {
                        const incompleteIcon = document.createElement('i');
                        incompleteIcon.className = 'far fa-circle incomplete-indicator';
                        incompleteIcon.style.marginLeft = '10px';
                        incompleteIcon.style.color = '#6c757d';
                        incompleteIcon.style.fontSize = '0.8em';
                        item.appendChild(incompleteIcon);
                    }
                }
            }
        });
    }

    // Calculate segment completion percentage
    function calculateSegmentCompletionPercentage(segmentId) {
        try {
            // Get expected question count for this segment
            const expectedQuestionCounts = {
                1: 6, // Criminal History
                2: 3, // Pro-Criminal Companions
                3: 5, // Pro-Criminal Attitudes and Cognitions
                4: 6, // Anti-Social Personality Pattern
                5: 6, // Education and Employment
                6: 4, // Family and Marital Status
                7: 7, // Substance Abuse
                8: 5  // Mental Health
            };
            
            const expectedCount = expectedQuestionCounts[segmentId] || 0;
            if (expectedCount === 0) return 0;
            
            // Check current DOM if we're on that segment
            if (window.location.pathname.includes(`/segment/${segmentId}`) || 
                window.location.pathname.includes(`segment_${segmentId}`)) {
                
                // Count answered questions in the DOM
                let answeredCount = 0;
                const questionGroups = {};
                
                document.querySelectorAll(`.question input[type="radio"]`).forEach(radio => {
                    if (radio.name.startsWith(`seg${segmentId}_q`)) {
                        if (!questionGroups[radio.name]) {
                            questionGroups[radio.name] = [];
                        }
                        questionGroups[radio.name].push(radio);
                    }
                });
                
                // Check each question group to see if any option is checked
                Object.values(questionGroups).forEach(group => {
                    if (group.some(radio => radio.checked)) {
                        answeredCount++;
                    }
                });
                
                return (answeredCount / expectedCount) * 100;
            } else {
                // Check localStorage
                const savedData = SecureStorage.getItem(`segment_${segmentId}`);
                if (!savedData) return 0;
                
                try {
                    const formData = SecureStorage.getItem(`segment_${segmentId}`);
                    // Count the segment questions in the saved data
                    const segmentAnswers = Object.keys(formData).filter(key => 
                        key.startsWith(`seg${segmentId}_q`)
                    );
                    
                    return (segmentAnswers.length / expectedCount) * 100;
                } catch (error) {
                    SecureLogger.error('Error parsing saved segment data:', error);
                    return 0;
                }
            }
        } catch (error) {
            SecureLogger.error('Error calculating segment completion percentage:', error);
            return 0;
        }
    }

    // Setup real-time score calculation
    function setupRealTimeScoring() {
        const radioButtons = document.querySelectorAll('input[type="radio"]');
        const scoreDisplay = document.createElement('div');
        scoreDisplay.className = 'current-score';
        scoreDisplay.innerHTML = '<strong>Current Segment Score:</strong> <span id="segment-score">0</span>';
        
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

    // Update current score display
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
            SecureLogger.error('Error updating score:', error);
        }
    }

    // Update progress bar
    function updateProgressBar() {
        const progressBar = document.querySelector('.progress');
        if (progressBar) {
            progressBar.style.transition = 'width 0.5s ease-in-out';
        }
    }

    // Setup tooltips for questions
    function setupTooltips() {
        const questions = document.querySelectorAll('.question h3');
        const tooltipTexts = {};
        
        questions.forEach(question => {
            const questionText = question.textContent.split('.')[1]?.trim();
            
            if (questionText && tooltipTexts[questionText]) {
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

    // Setup smooth scrolling for navigation
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

    // Highlight current risk level in results table
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

    // Show loading indicator for form submission
    function showLoadingIndicator() {
        const notification = document.createElement('div');
        notification.className = 'save-notification';
        notification.innerHTML = '<div class="spinner"></div><p>Saving your answers...</p>';
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        notification.style.color = 'white';
        notification.style.padding = '15px 20px';
        notification.style.borderRadius = '5px';
        notification.style.zIndex = '9999';
        notification.style.display = 'flex';
        notification.style.alignItems = 'center';
        notification.style.gap = '10px';
        document.body.appendChild(notification);
        
        // Create a spinner element
        const spinner = notification.querySelector('.spinner');
        spinner.style.width = '20px';
        spinner.style.height = '20px';
        spinner.style.border = '3px solid rgba(255, 255, 255, 0.3)';
        spinner.style.borderTop = '3px solid #fff';
        spinner.style.borderRadius = '50%';
        spinner.style.animation = 'spin 1s linear infinite';
        
        // Add spinner animation
        const style = document.createElement('style');
        style.innerHTML = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
        document.head.appendChild(style);
        
        return notification;
    }

    // Hide loading indicator
    function hideLoadingIndicator(notification) {
        if (notification) {
            notification.remove();
        }
    }

    // Show error message
    function showError(message) {
        const notification = document.createElement('div');
        notification.className = 'error-notification';
        notification.innerHTML = `<p>❌ ${message}</p>`;
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.backgroundColor = 'rgba(220, 53, 69, 0.7)';
        notification.style.color = 'white';
        notification.style.padding = '15px 20px';
        notification.style.borderRadius = '5px';
        notification.style.zIndex = '9999';
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Enhance accessibility
    function enhanceAccessibility() {
        // Add ARIA labels to radio buttons
        const radioButtons = document.querySelectorAll('input[type="radio"]');
        radioButtons.forEach(radio => {
            const questionParent = radio.closest('.question');
            if (!questionParent) return;
            
            const questionElement = questionParent.querySelector('h3');
            if (!questionElement) return;
            
            const questionText = questionElement.textContent;
            const optionText = radio.nextElementSibling?.textContent;
            if (questionText && optionText) {
                radio.setAttribute('aria-label', `${questionText}: ${optionText}`);
            }
        });
        
        // Make sure all interactive elements are keyboard accessible
        const interactiveElements = document.querySelectorAll('a, button, input');
        interactiveElements.forEach(element => {
            if (!element.getAttribute('tabindex')) {
                element.setAttribute('tabindex', '0');
            }
        });
    }

    // ==================== EVENT LISTENERS ====================

    // Save form data when radio buttons change
    document.addEventListener('change', function(e) {
        if (e.target.matches('input[type="radio"]')) {
            saveFormData();
            
            // Remove highlighting from answered questions
            const question = e.target.closest('.question');
            if (question) {
                question.classList.remove('highlight', 'unanswered', 'shake', 'highlight-question', 'highlight-focus');
            }
        }
    });

    // Save form data when text inputs change
    document.addEventListener('input', function(e) {
        if (e.target.matches('input[type="text"], input[type="email"], textarea, select')) {
            saveFormData();
        }
    });

    // Keyboard navigation for radio buttons
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
                saveFormData();
                
                event.preventDefault();
            }
        }
    });

    // Handle images in segments
    const images = document.querySelectorAll('.segment-image');
    images.forEach((image, index) => {
        // Add click behavior
        image.addEventListener('click', function () {
            const descriptions = [
                'Bagong Pilipinas',
                'Department of Justice',
                'Parole and Probation'
            ];
            alert(descriptions[index]);
        });

        // Add hover behavior
        image.addEventListener('mouseenter', function () {
            image.style.opacity = '0.8';
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.innerText = image.alt;
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

        // Remove tooltip on mouse leave
        image.addEventListener('mouseleave', function () {
            image.style.opacity = '1';
            const tooltip = document.getElementById(`tooltip-${index}`);
            if (tooltip) {
                tooltip.remove();
            }
        });
    });

    // Modify the beforeunload event listener
    window.addEventListener('beforeunload', function(event) {
        // Don't show any warning when navigating away
        return undefined;
    });

    // Add effect to questions as they come into view
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

    // Handle AJAX errors gracefully
    function setupAjaxErrorHandling() {
        // Create a global AJAX error handler
        window.addEventListener('error', function(event) {
            // Check if the error is related to a failed AJAX request
            if (event.target && (event.target.tagName === 'SCRIPT' || event.target.tagName === 'IMG')) {
                SecureLogger.log('Resource error occurred, but continuing...');
                // Prevent the default error handler
                event.preventDefault();
                return true;
            }
        }, true); // Use capture to get errors before they propagate
        
        // Create a custom function to show non-blocking errors
        window.showNonBlockingError = function(message) {
            const errorNotification = document.createElement('div');
            errorNotification.className = 'ajax-error-notification';
            errorNotification.innerHTML = `<p>⚠️ ${message}</p>`;
            errorNotification.style.position = 'fixed';
            errorNotification.style.bottom = '20px';
            errorNotification.style.right = '20px';
            errorNotification.style.backgroundColor = 'rgba(255, 193, 7, 0.9)';
            errorNotification.style.color = 'black';
            errorNotification.style.padding = '10px 15px';
            errorNotification.style.borderRadius = '5px';
            errorNotification.style.zIndex = '9999';
            errorNotification.style.maxWidth = '300px';
            
            // Add close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '&times;';
            closeBtn.style.position = 'absolute';
            closeBtn.style.top = '5px';
            closeBtn.style.right = '5px';
            closeBtn.style.background = 'none';
            closeBtn.style.border = 'none';
            closeBtn.style.fontSize = '16px';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.color = 'black';
            closeBtn.onclick = function() {
                errorNotification.remove();
            };
            
            errorNotification.appendChild(closeBtn);
            document.body.appendChild(errorNotification);
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
                if (document.body.contains(errorNotification)) {
                    errorNotification.remove();
                }
            }, 5000);
        };
    }

    // Call setup function
    setupAjaxErrorHandling();

    // Function to save notes from textarea with better error handling
    const notesTextarea = document.getElementById('notes');
    if (notesTextarea) {
        function saveNotes() {
            const notes = notesTextarea.value;
            
            // Use a relative URL instead of Flask template variable
            fetch('/save_notes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRFToken': getCsrfToken()
                },
                body: new URLSearchParams({
                    'notes': notes
                })
            }).then(response => {
                if (!response.ok) {
                    // Use non-blocking error notification instead of console error
                    window.showNonBlockingError('Notes were saved locally but not to the server. Your progress is still preserved.');
                    console.error('Failed to save notes');
                }
            }).catch(error => {
                // Use non-blocking error notification
                window.showNonBlockingError('Notes were saved locally but not to the server. Your progress is still preserved.');
                console.error('Error:', error);
            });
        }
        
        notesTextarea.addEventListener('blur', saveNotes);
    }

    // Override window.confirm for specific error messages
    const originalConfirm = window.confirm;
    window.confirm = function(message) {
        // If this is our specific error message, auto-confirm and show a nicer notification
        if (message.includes('There was an error saving your answers')) {
            // Show a more helpful notification
            window.showNonBlockingError('Your answers are saved locally. You can continue navigating safely.');
            
            // Return true to auto-confirm and allow navigation to continue
            return true;
        }
        
        // For all other confirm dialogs, use the original behavior
        return originalConfirm.apply(this, arguments);
    };

    // ==================== FORM SUBMISSION HANDLING ====================

    // Function to check if all segments are completed
    function areAllSegmentsCompleted() {
        for (let i = 1; i <= 8; i++) {
            if (!checkSegmentCompletion(i)) {
                return false;
            }
        }
        return true;
    }

    // Function to update the visibility of the Results link in the sidebar
    function updateResultsLinkVisibility() {
        const resultsLink = document.getElementById('results-link');
        if (resultsLink) {
            if (areAllSegmentsCompleted()) {
                resultsLink.style.display = 'block';
            } else {
                resultsLink.style.display = 'none';
            }
        }
    }

    // Function to show incomplete segments warning as a popup modal
    function showIncompleteSegmentsWarning(incompleteSegments, isFromSegment8 = false) {
        // Remove any existing modal
        const existingModal = document.getElementById('incomplete-segments-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        if (incompleteSegments.length === 0) return null;
        
        // Create modal container
        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'incomplete-segments-modal';
        modalOverlay.className = 'modal-overlay';
        modalOverlay.style.position = 'fixed';
        modalOverlay.style.top = '0';
        modalOverlay.style.left = '0';
        modalOverlay.style.width = '100%';
        modalOverlay.style.height = '100%';
        modalOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        modalOverlay.style.display = 'flex';
        modalOverlay.style.justifyContent = 'center';
        modalOverlay.style.alignItems = 'center';
        modalOverlay.style.zIndex = '9999';
        
        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.style.background = 'white';
        modalContent.style.padding = '20px';
        modalContent.style.borderRadius = '5px';
        modalContent.style.maxWidth = '500px';
        modalContent.style.maxHeight = '80vh';
        modalContent.style.overflowY = 'auto';
        modalContent.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
        
        // Map segment IDs to their titles
        const segmentTitles = {
            1: 'Criminal History',
            2: 'Pro-Criminal Companions',
            3: 'Pro-Criminal Attitudes & Cognitions',
            4: 'Anti-Social Personality Patterns',
            5: 'Education And Employment',
            6: 'Family And Marital Status',
            7: 'Substance Abuse',
            8: 'Mental Health'
        };
        
        // Add warning header
        const header = document.createElement('h3');
        header.style.color = '#dc3545';
        header.style.marginTop = '0';
        header.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Incomplete Segments';
        modalContent.appendChild(header);
        
        // Add warning message - different message if current segment is incomplete
        const message = document.createElement('p');
        if (isFromSegment8 && incompleteSegments.includes(8)) {
            message.innerHTML = '<strong>You must complete the current segment (Mental Health) before proceeding.</strong> Please answer all questions in this segment.';
        } else {
            message.innerHTML = '<strong>The following sections have incomplete answers. Please complete all sections for accurate results:</strong>';
        }
        modalContent.appendChild(message);
        
        // Add list of incomplete segments
        const list = document.createElement('ul');
        list.style.paddingLeft = '20px';
        incompleteSegments.forEach(segmentId => {
            const title = segmentTitles[segmentId] || `Segment ${segmentId}`;
            const listItem = document.createElement('li');
            listItem.style.margin = '8px 0';
            
            const link = document.createElement('a');
            link.href = '#';
            link.className = 'incomplete-segment-link';
            link.textContent = title;
            link.style.color = '#0587b6';
            link.style.textDecoration = 'underline';
            link.style.cursor = 'pointer';
            link.dataset.segmentId = segmentId;
            
            listItem.appendChild(link);
            list.appendChild(listItem);
        });
        modalContent.appendChild(list);
        
        // Add buttons - just a Close button, no "Continue Anyway"
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'center';
        buttonContainer.style.marginTop = '20px';
        
        const closeButton = document.createElement('button');
        closeButton.className = 'btn btn-secondary';
        closeButton.textContent = 'Close';
        closeButton.style.backgroundColor = '#6c757d';
        closeButton.style.color = 'white';
        closeButton.style.border = 'none';
        closeButton.style.padding = '10px 15px';
        closeButton.style.borderRadius = '5px';
        closeButton.style.cursor = 'pointer';
        
        buttonContainer.appendChild(closeButton);
        
        modalContent.appendChild(buttonContainer);
        
        // Add modal to page
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);
        
        // Add event listeners to the links
        const links = modalContent.querySelectorAll('.incomplete-segment-link');
        links.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const segmentId = this.dataset.segmentId;
                modalOverlay.remove();
                window.location.href = `/navigate/segment_${segmentId}`;
            });
        });
        
        // Add event listeners to close button
        closeButton.addEventListener('click', function() {
            modalOverlay.remove();
        });
        
        return modalOverlay;
    }

    // Form submission handling
    if (form) {
        // Disable the default HTML5 validation
        form.setAttribute('novalidate', 'true');
        
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Validate the form
            const unansweredQuestions = validateForm();
            if (unansweredQuestions.length > 0) {
                highlightUnansweredQuestions(unansweredQuestions);
                return false;
            }
            
            // Also validate inputs if there are any
            if (!validateInputs()) {
                alert('Please fill out all required fields.');
                return false;
            }
            
            // Save form data before submission
            saveFormData();
            
            // Check if we're on segment 8 - if so, validate all questions are answered
            const currentPath = window.location.pathname;
            if (currentPath.includes('/segment/8') || currentPath.includes('segment_8')) {
                // First, get all incomplete segments
                const incompleteSegments = getIncompleteSegments();
                
                // Check if current segment (8) is complete
                const isSegment8Complete = !incompleteSegments.includes(8);
                
                // If segment 8 is incomplete, don't allow proceeding
                if (!isSegment8Complete) {
                    showIncompleteSegmentsWarning([8], true);
                    return false;
                }
                
                // Filter out segment 8 from incomplete segments since we've verified it's complete
                const filteredIncomplete = incompleteSegments.filter(id => id !== 8);
                
                if (filteredIncomplete.length > 0) {
                    // Show the warning popup and let it handle the navigation
                    showIncompleteSegmentsWarning(filteredIncomplete, true);
                    return false;
                }
            }
            
            // Show loading indicator
            const loadingNotification = showLoadingIndicator();
            
            // Set a flag to prevent beforeunload warning
            window.isSidebarNavigation = true;
            localStorage.setItem('isSidebarNavigation', 'true');
            
            // Submit the form using traditional form submission
            // This works with redirects which is what our Flask app returns
            setTimeout(() => {
                form.submit();
            }, 500);
        });
    }

    // Handle input field validation when submit button is clicked
    if (formButton) {
        formButton.addEventListener('click', function(event) {
            if (!validateInputs()) {
                event.preventDefault();
                alert('Please fill out all required fields.');
            }
        });
    }

    // ==================== SIDEBAR FUNCTIONALITY ====================

    // Toggle sidebar when clicking the toggle button
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
            mainContent.classList.toggle('sidebar-active');
        });
    }

    // Close sidebar when clicking the close button
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            mainContent.classList.remove('sidebar-active');
        });
    }

    // Close sidebar when clicking the overlay
    if (overlay) {
        overlay.addEventListener('click', function() {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            mainContent.classList.remove('sidebar-active');
        });
    }

    // Enhanced sidebar navigation with form submission
    const menuItems = document.querySelectorAll('.sidebar-menu a');
    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const href = item.getAttribute('href');
            console.log('Menu item clicked:', href);
            
            // Set flag to prevent beforeunload warning
            window.isSidebarNavigation = true;
            localStorage.setItem('isSidebarNavigation', 'true');
            
            // Close sidebar immediately for better UX
            sidebar.classList.remove('active');
            if (overlay) overlay.classList.remove('active');
            if (mainContent) mainContent.classList.remove('sidebar-active');
            
            // Check if we're on a segment page with a form
            if (form && href.includes('segment')) {
                // Save to localStorage as a backup
                saveFormData();
                
                // Directly navigate to the next page without triggering beforeunload warning
                setTimeout(() => {
                    window.location.href = href;
                }, 50);
            } else {
                // If no form or not a segment page, just navigate directly
                window.location.href = href;
            }
        });
    });

    // Handle window resize
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            mainContent.classList.remove('sidebar-active');
        }
    });

    // ==================== INITIALIZATION ====================

    // Load saved data when page loads
    loadFormData();
    
    // Clear all data when starting a new assessment from index page
    if (window.location.pathname === '/' || window.location.pathname === '/index') {
        clearAllFormData();
        console.log('Index page loaded - cleared all previous assessment data');
    }
    
    // Initialize UI elements
    setupRealTimeScoring();
    updateProgressBar();
    setupTooltips();
    setupSmoothScrolling();
    enhanceAccessibility();
    highlightRiskLevel();
    
    // Update the visibility of the Results link
    updateResultsLinkVisibility();

    // Update sidebar indicators when any radio button changes
    document.addEventListener('change', function(e) {
        if (e.target.matches('input[type="radio"]')) {
            // Update immediately for a responsive feel
            updateSidebarCheckmarks();
            
            // Also update sidebar checkmarks when form data is saved
            if (typeof saveFormData === 'function') {
                saveFormData();
            }
            
            // Update the results link visibility
            updateResultsLinkVisibility();
        }
    });

    // Initial check for completed segments
    updateSidebarCheckmarks();

    // Special handling for results page
    if (window.location.pathname.includes('/results')) {
        updatePdfButton();
        
        // Check if all segments are complete - if not, redirect to segment 1
        const incompleteSegments = getIncompleteSegments();
        if (incompleteSegments.length > 0) {
            // Show a message about why we're redirecting
            window.showNonBlockingError('All segments must be completed before viewing results.');
            
            // After a short delay, redirect to the first incomplete segment
            setTimeout(() => {
                window.location.href = `/navigate/segment_${incompleteSegments[0]}`;
            }, 2000);
        }
        
        // Handle PDF download button click
        const downloadPdfBtn = document.getElementById('downloadPdf');
        if (downloadPdfBtn) {
            downloadPdfBtn.addEventListener('click', function(e) {
                const incompleteSegments = getIncompleteSegments();
                if (incompleteSegments.length > 0) {
                    e.preventDefault();
                    
                    // We should never get here since we redirect away from results page if segments are incomplete
                    // But as a safeguard, show the incomplete segments warning
                    showIncompleteSegmentsWarning(incompleteSegments);
                    return false;
                }
            });
        }
    }

    // Call our new function to prevent unsaved changes prompt
    preventUnsavedChangesPrompt();

    // Function to handle clearing all data when clicking Start New Assessment
    document.addEventListener('DOMContentLoaded', function() {
        // Find any Start New Assessment buttons on the page
        const startNewButtons = document.querySelectorAll('#startNewAssessment, .start-new-btn');
        startNewButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                // Clear all data before starting new assessment
                SecureLogger.log('Start New Assessment button clicked - clearing data');
                clearAllFormData();
            });
        });
    });
});

// Function to disable PDF download if segments are incomplete
function updatePdfButton() {
    const downloadPdfBtn = document.getElementById('downloadPdf');
    if (!downloadPdfBtn) return;
    
    const incompleteSegments = getIncompleteSegments();
    
    if (incompleteSegments.length > 0) {
        downloadPdfBtn.disabled = true;
        downloadPdfBtn.classList.add('disabled');
        downloadPdfBtn.title = 'Complete all segments to download PDF';
    } else {
        downloadPdfBtn.disabled = false;
        downloadPdfBtn.classList.remove('disabled');
        downloadPdfBtn.title = 'Download PDF Report';
    }
}

// Function to prevent the "unsaved changes" browser prompt when navigating away
function preventUnsavedChangesPrompt() {
    // Only add this for segment pages with forms
    const form = document.getElementById('questionForm');
    if (!form) return;
    
    // Save form data initially to mark current state
    saveFormData();
    
    // Handle sidebar navigation - save before letting the navigation proceed
    document.querySelectorAll('.sidebar-menu a').forEach(link => {
        link.addEventListener('click', function(e) {
            // Don't prevent the default action - just save first
            saveFormData();
            
            // Explicitly set the flag to prevent beforeunload warning
            window.isSidebarNavigation = true;
            
            // Store the flag in localStorage as a backup
            localStorage.setItem('isSidebarNavigation', 'true');
        });
    });
    
    // For the Next button, we already save on submit so no additional handling needed
    
    // Disable the browser's beforeunload warning completely (no popup when navigating away)
    window.addEventListener('beforeunload', function (e) {
        // Always allow unload without confirmation
        return undefined;
    });
}

// Function to get all saved assessment data
function getAllSavedData() {
    try {
        // Use the secure storage to retrieve the master record
        return SecureStorage.getItem('allSegmentData') || {};
    } catch (error) {
        SecureLogger.error('Error retrieving all saved data:', error);
        return {};
    }
}

// Export all saved assessment data for download
function exportAssessmentData() {
    try {
        const data = getAllSavedData();
        
        // Add metadata for the export
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            data: data
        };
        
        // Stringify with pretty formatting
        const jsonStr = JSON.stringify(exportData, null, 2);
        
        // Create a download blob
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Create a temporary link and trigger the download
        const a = document.createElement('a');
        a.href = url;
        a.download = `risk_assessment_export_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        return true;
    } catch (error) {
        SecureLogger.error('Error exporting assessment data:', error);
        return false;
    }
}

// Function to save the final risk assessment results
function saveResults(riskScoreData) {
    try {
        // Make sure we have valid data to save
        if (!riskScoreData || typeof riskScoreData !== 'object') {
            SecureLogger.warn('Invalid risk score data provided for saving');
            return false;
        }
        
        // Add save timestamp
        riskScoreData.savedAt = new Date().toISOString();
        
        // Store in secure storage
        SecureStorage.setItem('riskAssessmentData', riskScoreData);
        
        SecureLogger.log('Risk assessment results saved successfully');
        return true;
    } catch (error) {
        SecureLogger.error('Error saving risk assessment results:', error);
        return false;
    }
}

// Function to load the saved risk assessment results
function loadResults() {
    try {
        // Retrieve from secure storage
        const results = SecureStorage.getItem('riskAssessmentData');
        
        if (!results) {
            SecureLogger.warn('No saved risk assessment results found');
            return null;
        }
        
        SecureLogger.log('Loaded risk assessment results successfully');
        return results;
    } catch (error) {
        SecureLogger.error('Error loading risk assessment results:', error);
        return null;
    }
}

// Function to save notes
function saveNotes(notesText) {
    try {
        // Sanitize notes text before saving
        const sanitizedNotes = InputSanitizer.sanitizeText(notesText);
        
        // Save to secure storage
        SecureStorage.setItem('notes', sanitizedNotes);
        
        SecureLogger.log('Notes saved successfully');
        return true;
    } catch (error) {
        SecureLogger.error('Error saving notes:', error);
        return false;
    }
}

// Function to load saved notes
function loadNotes() {
    try {
        // Retrieve from secure storage
        const notes = SecureStorage.getItem('notes');
        
        if (notes === null) {
            SecureLogger.log('No saved notes found');
            return '';
        }
        
        return notes;
    } catch (error) {
        SecureLogger.error('Error loading notes:', error);
        return '';
    }
}

// Function to check if all segments are completed
function areAllSegmentsCompleted() {
    try {
        // Get the completion status for all segments
        const totalSegments = 8; // Segments 1-8
        let completedSegments = 0;
        
        for (let i = 1; i <= totalSegments; i++) {
            if (isSegmentComplete(i)) {
                completedSegments++;
            }
        }
        
        return completedSegments === totalSegments;
    } catch (error) {
        SecureLogger.error('Error checking segment completion status:', error);
        return false;
    }
}

// Function to toggle sidebar visibility
function toggleSidebar() {
    try {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.classList.toggle('collapsed');
            
            // Save sidebar state (using regular localStorage since this is UI preference, not sensitive)
            localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
            
            // Update main content margin
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.style.marginLeft = sidebar.classList.contains('collapsed') ? '60px' : '250px';
            }
        }
    } catch (error) {
        SecureLogger.error('Error toggling sidebar:', error);
    }
}

// Function to restore sidebar state from localStorage
function restoreSidebarState() {
    try {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
            
            if (isCollapsed) {
                sidebar.classList.add('collapsed');
                
                // Update main content margin
                const mainContent = document.querySelector('.main-content');
                if (mainContent) {
                    mainContent.style.marginLeft = '60px';
                }
            }
        }
    } catch (error) {
        SecureLogger.error('Error restoring sidebar state:', error);
    }
}

// Google Login Session Management
document.addEventListener('DOMContentLoaded', function() {
    // Check login status
    const loggedInFlag = document.body.getAttribute('data-logged-in');
    if (loggedInFlag === 'true') {
        sessionStorage.setItem('loggedIn', 'true');
    }
    
    // Form validation for the index page with Google login
    const formButton = document.querySelector('.submit-button');
    const inputs = document.querySelectorAll('.input-box');
    const dropdowns = document.querySelectorAll('.dropdown-box');

    if (formButton) {
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
                if (input.value.trim() === '' && !input.readOnly) {
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
            } else {
                // Set flag to skip logout check on page load after form submit
                sessionStorage.setItem('skipLogoutCheck', 'true');
            }
        });
    }
});

// Manage login session on page load
window.addEventListener('load', function () {
    // Skip logout check if on index page and form submit button clicked recently
    if (window.location.pathname === '/index' && sessionStorage.getItem('skipLogoutCheck') === 'true') {
        sessionStorage.removeItem('skipLogoutCheck');
        return;
    }

    // Check if logged in, redirect to login if not
    if (!sessionStorage.getItem('loggedIn') && window.location.pathname !== '/login') {
        window.location.href = '/login';
    }
});

// Handle logout - clear session storage
const logoutButton = document.querySelector('.logout-button');
if (logoutButton) {
    logoutButton.addEventListener('click', function() {
        sessionStorage.removeItem('loggedIn');
    });
}

// Handle beforeunload event to warn about leaving the application
let preventUnload = true;

// Disable beforeunload confirmation on form submit and navigation links
document.addEventListener('DOMContentLoaded', function() {
    // For form submissions
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function() {
            preventUnload = false;
        });
    });
    
    // For navigation links
    const navLinks = document.querySelectorAll('a');
    navLinks.forEach(link => {
        // Only apply to internal links (those without http/https in href)
        if (link.href && !link.href.startsWith('http') && !link.getAttribute('target')) {
            link.addEventListener('click', function() {
                preventUnload = false;
            });
        }
    });
    
    // For buttons that navigate (like PDF download)
    const actionButtons = document.querySelectorAll('button[id="downloadPdf"], button[id="startNewAssessment"]');
    actionButtons.forEach(button => {
        button.addEventListener('click', function() {
            preventUnload = false;
        });
    });
    
    // For the sidebar navigation
    const sidebarLinks = document.querySelectorAll('.sidebar-menu a');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', function() {
            preventUnload = false;
        });
    });
});

// beforeunload confirmation - completely disabled, no confirmation popups
window.addEventListener('beforeunload', function (e) {
    // Always allow unload without confirmation
    return undefined;
});

// Add this to your existing JavaScript file
document.addEventListener('DOMContentLoaded', function() {
    const profileIcon = document.querySelector('.profile-icon');
    const profileDropdown = document.querySelector('.profile-dropdown');

    profileIcon.addEventListener('click', function() {
        profileDropdown.classList.toggle('active');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function(event) {
        if (!profileIcon.contains(event.target) && !profileDropdown.contains(event.target)) {
            profileDropdown.classList.remove('active');
        }
    });
});