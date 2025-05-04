from flask import Flask, render_template, request, redirect, url_for, session, flash, send_file, send_from_directory
from weasyprint import HTML
from io import BytesIO
import os
import requests
from datetime import datetime
import logging
import uuid
import hashlib
import re
import time
import json

# Load Google OAuth credentials
try:
    with open('client_secret.json') as f:
        secrets = json.load(f)['web']
except (FileNotFoundError, KeyError) as e:
    logging.error(f"Error loading client_secret.json: {str(e)}")
    secrets = {
        'client_id': '1007036578695-pegi9ds4q0smfchmp6dapmjjs5idm2if.apps.googleusercontent.com',
        'client_secret': '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',
        'redirect_uri': 'http://127.0.0.1:5000/authorize'
    }

# Import OAuth library
from authlib.integrations.flask_client import OAuth

app = Flask(__name__)
app.secret_key = os.urandom(24)
# Set a shorter session lifetime (30 minutes)
app.config['PERMANENT_SESSION_LIFETIME'] = 1800
app.config['SESSION_COOKIE_SECURE'] = False  # Set to True in production with HTTPS
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# CSRF Protection
def csrf_token():
    if 'csrf_token' not in session:
        session['csrf_token'] = os.urandom(24).hex()
    return session['csrf_token']

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("app.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# OAuth Setup
oauth = OAuth(app)
google = oauth.register(
    name='google',
    client_id=secrets.get('client_id'),
    client_secret=secrets.get('client_secret'),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile',
        'access_type': 'offline',
        'prompt': 'consent'
    },
    redirect_uri=secrets.get('redirect_uri', 'http://127.0.0.1:5000/authorize')
)

# Google Sheets integration
GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwJQOCb4ow-54vKYhvhne3PC-TERIosb7LYMXKeqQP9kiOPMejuvZGXNtxEdnroc-E8/exec"

# Add zip to Jinja environment
app.jinja_env.globals.update(zip=zip)

# Helper function to generate secure URL tokens
def generate_secure_token(text, salt=None):
    """Generate a secure token for URL based on text and optional salt"""
    if not salt:
        salt = str(int(time.time()))
    text = str(text) + salt
    return hashlib.md5(text.encode('utf-8')).hexdigest()[:12]

# Generate a unique session ID
def generate_session_id():
    """Generate a unique session ID"""
    return str(uuid.uuid4())

# Helper function to validate tokens
def validate_token(token, expected_token):
    """Validate that a token matches the expected token"""
    return token == expected_token

# Decorator to require valid session
def session_required(f):
    """Decorator to ensure session is valid before accessing a page"""
    def decorated_function(*args, **kwargs):
        if 'session_id' not in session:
            flash("Your session has expired. Please start a new assessment.")
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

# Wrapper for url_for to add token
def secure_url_for(endpoint, **kwargs):
    """Add a secure token to a URL"""
    if 'session_id' in session:
        # Generate a unique token for the endpoint
        token = generate_secure_token(session['session_id'] + endpoint)
        # Store the tokens in session for later verification
        if 'endpoint_tokens' not in session:
            session['endpoint_tokens'] = {}
        session['endpoint_tokens'][endpoint] = token
        kwargs['token'] = token
    return url_for(endpoint, **kwargs)

# Helper function to validate tokens, including those stored in the session
def extended_validate_token(token, endpoint):
    """Validate token against both expected and stored tokens"""
    if not token:
        return False
        
    # Generate the expected token
    session_id = session.get('session_id', '')
    if not session_id:
        return False
        
    expected_token = generate_secure_token(session_id + endpoint)
    
    # Check against the main expected token
    if validate_token(token, expected_token):
        return True
        
    # Check against stored tokens
    endpoint_tokens = session.get('endpoint_tokens', {})
    stored_token = endpoint_tokens.get(endpoint)
    if stored_token and validate_token(token, stored_token):
        return True
    
    # Check against token history for this endpoint
    token_history = session.get('token_history', {}).get(endpoint, [])
    if token in token_history:
        return True
        
    return False

# Add functions to Jinja environment
app.jinja_env.globals.update(secure_url_for=secure_url_for)
app.jinja_env.globals.update(generate_secure_token=generate_secure_token)
app.jinja_env.globals.update(csrf_token=csrf_token)

segment_questions = {
    1: [
        "Age at First Misconduct",
        "Number of Previous Misconduct(s)",
        "Extent of Involvment in Organized Crimes",
        "Derogatory Record",
        "Type of Offender",
        "History of Violence"
    ],
    2: [
        "Type of Companions",
        "Type of Activities with Companions",
        "Friends' Support"
    ],
    3: [
        "Is it okay to break the rules/laws as long as I can help my family.",
        "Is it okay to break the rules/laws because I don't know it.",
        "Is it okay to break the rules/laws when nobody sees me or I don't get caught.",
        "It is okay to commit a crime if you're a victim of social injustice/inequality.",
        "Is it okay to commit a crime when you are in a desperate situation/crisis"
    ],
    4: [
        "I find it hard to follow rules.",
        "I lie and cheat to get what I want.",
        "I act without thinking of the consequences of my actions.",
        "I easily get irritated or angry.",
        "I don't care who gets hurt as long as I get what I want.",
        "I find it hard to follow through with responsibilities/assigned tasks"
    ],
    5: [
        "Educational Attainment",
        "Educational Attachment",
        "Overall Conduct in School",
        "Employment Status at the Time of Arrest",
        "Employable Skills",
        "Employment History"
    ],
    6: [
        "Quality of Family/Marital Relationships",
        "Parental Guidance and Supervision",
        "Family Acceptability in the Community",
        "Spirituality/Religiosity"
    ],
    7: [
        "History of Drug Abuse",
        "Frequency of Drug Use",
        "History of Alcohol Abuse",
        "Frequency of Alcohol Use",
        "Desire/Urge for Substance Use",
        "Cut down onn Substance Use",
        "Family History of Substance Use"
    ],
    8: [
        "I can perform my daily activities with minimal support from others",
        "I can easily make good decisions on my own",
        "I have experienced sadness for 14 days over the last 6 months",
        "I have received consultation/treatment/counseling for a psychological/psychiatric problem",
        "I sometimes hear or see things not normally seen or heard by others"
    ]
}

# Add this dictionary to your app.py after the segment_questions dictionary
segment_answers_data = {
    1: {  # Criminal History
        0: [  # First question
            {"text": "26 years old and above", "value": 0},
            {"text": "18-25 years old", "value": 1},
            {"text": "17 years old and below", "value": 2}
        ],
        1: [  # Second question
            {"text": "No misconduct", "value": 0},
            {"text": "1 misconduct", "value": 1},
            {"text": "2 or more misconducts", "value": 2}
        ],
        2: [  # Third question
            {"text": "Not a member", "value": 0},
            {"text": "Member but inactive", "value": 1},
            {"text": "Active membership", "value": 2}
        ],
        3: [  # Fourth question
            {"text": "No record", "value": 0},
            {"text": "With 1 record", "value": 1},
            {"text": "With 2 or more records", "value": 2}
        ],
        4: [  # Fifth question
            {"text": "Situational/Circumstantial", "value": 0},
            {"text": "Paminsan-minsan", "value": 1},
            {"text": "Career offender", "value": 2}
        ],
        5: [  # Sixth question
            {"text": "No history of violence", "value": 0},
            {"text": "1 incident of violence", "value": 1},
            {"text": "2 or more history of violence", "value": 2}
        ]
    },
    2: {  # Pro-Criminal Companions
        0: [
            {"text": "Mostly conventional", "value": 0},
            {"text": "Sometimes conventional, sometimes delinquent", "value": 1},
            {"text": "Mostly delinquent", "value": 2}
        ],
        1: [
            {"text": "Mostly conventional", "value": 0},
            {"text": "Sometimes conventional, sometimes delinquent", "value": 1},
            {"text": "Mostly delinquent", "value": 2}
        ],
        2: [
            {"text": "Mostly supportive friends", "value": 0},
            {"text": "Few supportive friends", "value": 1},
            {"text": "No supportive friends", "value": 2}
        ]
    },
    3: {  # Pro-Criminal Attitudes & Cognitions
        0: [
            {"text": "NO", "value": 0},
            {"text": "YES", "value": 2}
        ],
        1: [
            {"text": "NO", "value": 0},
            {"text": "YES", "value": 2}
        ],
        2: [
            {"text": "NO", "value": 0},
            {"text": "YES", "value": 2}
        ], 
        3: [
            {"text": "NO", "value": 0},
            {"text": "YES", "value": 2}
        ],
        4: [   
            {"text": "NO", "value": 0},
            {"text": "YES", "value": 2}
        ]
    },
    4: {  # Anti-Social Personality Patterns
        0: [
            {"text": "NO", "value": 0},
            {"text": "YES", "value": 1}
        ],
        1: [
            {"text": "NO", "value": 0},
            {"text": "YES", "value": 1}
        ],
        2: [
            {"text": "NO", "value": 0},
            {"text": "YES", "value": 1}
        ],
        3: [
            {"text": "NO", "value": 0},
            {"text": "YES", "value": 1}
        ],
        4: [
            {"text": "NO", "value": 0},
            {"text": "YES", "value": 1}
        ],
        5: [
            {"text": "NO", "value": 0},
            {"text": "YES", "value": 1}
        ]
    },
    5: {  # Education and Employment
        0: [
            {"text": "Vocational/College level & above", "value": 0},
            {"text": "Grade 7 to 12", "value": 1},
            {"text": "Grade 6 and below", "value": 2}
        ],
        1: [
            {"text": "Interested in school", "value": 0},
            {"text": "Lacks interest in school", "value": 1},
            {"text": "Did not get along well with teachers and other students/No interest in school", "value": 2}
        ],
        2: [
            {"text": "Without misdemeanor", "value": 0},
            {"text": "With misdemeanor", "value": 2}
        ],
        3: [
            {"text": "Employed", "value": 0},
            {"text": "Irregularly employed", "value": 1},
            {"text": "Unemployed", "value": 2}
        ],
        4: [
            {"text": "With at least employable skill", "value": 0},
            {"text": "No employable skill but with potential and capacity to acquire one", "value": 1},
            {"text": "No employable skill", "value": 2}
        ],
        5: [
            {"text": "Treats job seriously; Finds work rewarding; Good relationship with employer and co-workers", "value": 0},
            {"text": "Inconsistent employment; No employment that lasts 3 months; Minimum attachment to work", "value": 1},
            {"text": "Does not like/love job; Conflict with the employer; No interest in working; No attachments to work; Frequently fired from work", "value": 2}
        ]
    },
    6: {  # Family and Marital Status
        0: [
            {"text": "With positive influence", "value": 0},
            {"text": "With occasional negative influence", "value": 1},
            {"text": "With regular negative influence", "value": 2}
        ],
        1: [
            {"text": "Adequate guidance and supervision", "value": 0},
            {"text": "Minimal guidance and supervision", "value": 1},
            {"text": "Without guidance and supervision; Overbearing/Over Protective", "value": 2}
        ],
        2: [
            {"text": "Acceptable", "value": 0},
            {"text": "Unacceptable", "value": 1},
            {"text": "Highly unacceptable", "value": 2}
        ],
        3: [
            {"text": "Integrated spiritual belief and religious activities", "value": 0},
            {"text": "Disintegrated spiritual belief but with some manifested positive religious belief", "value": 1},
            {"text": "Disintegrated religious belief and negative religious activities", "value": 2}
        ]
    },
    7: {  # Substance Abuse
        0: [
            {"text": "If client abused drugs (other than those required for medical reasons)", "value": 1},
            {"text": "Never", "value": 0}
        ],
        1: [
            {"text": "No usage", "value": 0},
            {"text": "At least once a month", "value": 1},
            {"text": "At least once a week", "value": 2},
            {"text": "Almost daily", "value": 3}
        ],
        2: [
            {"text": "If client abused alcoholic beverages", "value": 1},
            {"text": "Never", "value": 0}
        ],
        3: [
            {"text": "No usage", "value": 0},
            {"text": "At least once a month", "value": 1},
            {"text": "At least once a week", "value": 2},
            {"text": "Almost daily", "value": 3}
        ],
        4: [
            {"text": "Never", "value": 0},
            {"text": "Sometimes", "value": 1},
            {"text": "Always", "value": 2}
        ],
        5: [  # Cut down on Substance Use
            {"text": "Always able to stop", "value": 0},
            {"text": "Unable to stop", "value": 1}
        ],
        6: [  # Family History of Substance Use
            {"text": "YES", "value": 1},
            {"text": "NO", "value": 0}
        ]
    },
    8: {  # Mental Health
        0: [
            {"text": "YES", "value": 0},
            {"text": "NO", "value": 1}
        ],
        1: [
            {"text": "YES", "value": 0},
            {"text": "NO", "value": 1}
        ], 
        2: [
            {"text": "YES", "value": 1},
            {"text": "NO", "value": 0}
        ],
        3: [
            {"text": "YES", "value": 1},
            {"text": "NO", "value": 0}
        ],
        4: [
            {"text": "YES", "value": 1},
            {"text": "NO", "value": 0}
        ]
    }
}

# Segment titles
segment_titles = {
    1: "CRIMINAL HISTORY",
    2: "PRO-CRIMINAL COMPANIONS",
    3: "PRO-CRIMINAL ATTITUDES & COGNITIONS",
    4: "ANTI-SOCIAL PERSONALITY PATTERNS",
    5: "EDUCATION AND EMPLOYMENT",
    6: "FAMILY AND MARITAL STATUS",
    7: "SUBSTANCE ABUSE",
    8: "MENTAL HEALTH"
}

# Update segment thresholds
segment_thresholds = {
    1: {"threshold": 5, "program": "ICARE", "highest_score": 10},
    2: {"threshold": 4, "program": "ICARE", "highest_score": 8},
    3: {"threshold": 4, "program": "ICARE", "highest_score": 8},
    4: {"threshold": 4, "program": "ICARE", "highest_score": 8},
    5: {
        "threshold": 4, 
        "program": "LEAP",
        "highest_score": 8,
        "education": {
            "name": "EDUCATION",
            "threshold": 4,
            "questions": [0, 1, 2]  # indices of education questions
        },
        "employment": {
            "name": "EMPLOYMENT",
            "threshold": 4,
            "questions": [3, 4, 5]  # indices of employment questions
        }
    },
    6: {"threshold": 4, "program": "LEAP", "highest_score": 8},
    7: {"threshold": 4, "program": "ICARE", "highest_score": 8},
    8: {"threshold": 4, "program": "Hulagpos", "highest_score": 8}
}

# Mandatory programs
mandatory_programs = [
    "Monthly/periodic report-in-person",
    "Monitoring and Supervision",
    "Therapeutic Community Ladderized Program (TCLP) Mandatory Reinforcing Activities",
    "Restorative Justice Processes",
    "Individual/Group Family/Marital Coaching",
    "Community Work Service/Involvement in community/barangay integration activities",
    "Spiritual/Moral Formation/Reformation activities"
]

def assess_risk_level(total_score, length_of_sentence):
    """Enhanced risk assessment that includes both probation types"""
    if total_score <= 17:
        return {
            "level": "Low Risk (Level 1)",
            "probation_sentenced": "6 months",
            "probation_other": "1 year",
            "probation": "6 months" if length_of_sentence == "2-years-or-less" else "1 year",
            "supervision": "Once in 2 months"
        }
    elif total_score <= 28:
        return {
            "level": "Medium Risk (Level 2)",
            "probation_sentenced": "6 months",
            "probation_other": "1 year",
            "probation": "6 months" if length_of_sentence == "2-years-or-less" else "1 year",
            "supervision": "Once a month"
        }
    elif total_score <= 39:
        return {
            "level": "High Risk (Level 3)",
            "probation_sentenced": "1 year",
            "probation_other": "2 years",
            "probation": "1 year" if length_of_sentence == "2-years-or-less" else "2 years",
            "supervision": "Twice a month"
        }
    else:
        return {
            "level": "Very High Risk (Level 4)",
            "probation_sentenced": "2 years",
            "probation_other": "3 years",
            "probation": "2 years" if length_of_sentence == "2-years-or-less" else "3 years",
            "supervision": "Twice a month"
        }

def calculate_segments_per_page():
    """Calculate how many segments fit on first page based on content height"""
    average_segment_height = 200  # pixels
    page_height = 1122  # A4 height in pixels at 96dpi
    usable_height = page_height - 150  # Subtract header
    segments_per_column = usable_height // average_segment_height
    return segments_per_column * 2  # Two columns per page

@app.route('/', methods=['GET', 'POST'])
def index():
    # Check if user is logged in with Google
    if 'google_token' not in session:
        return redirect(url_for('login'))
        
    # Clear session when starting a new assessment but keep Google token
    google_token = session.get('google_token')
    user_info = session.get('user')
    email = session.get('email')
    session.clear()
    
    # Restore Google session data
    if google_token:
        session['google_token'] = google_token
        session['user'] = user_info
        session['email'] = email
        
    # Create a new session ID
    session['session_id'] = generate_session_id()
    session.permanent = True
    
    if request.method == 'POST':
        try:
            # Save index form answers as segment0
            session['segment0'] = {
                'email': session.get('email', ''),  # Use email from Google login
                'client_name': request.form.get('client_name', ''),
                'length_of_sentence': request.form.get('length_of_sentence', ''),
                'officer_name': request.form.get('officer_name', ''),
                'chief_name': request.form.get('chief_name', '')
            }
            token = generate_secure_token(session['session_id'] + 'segment')
            # Store this token for fallback validation later
            session['current_segment_token'] = token
            return redirect(url_for('segment', segment_id=1, token=token))
        except Exception as e:
            logger.error(f"Error in index: {str(e)}")
            flash("An error occurred. Please try again.")
            return redirect(url_for('index'))
    return render_template('index.html')

@app.route('/login')
def login():
    return render_template('login.html')

@app.route('/login_google')
def login_google():
    redirect_uri = url_for('authorize', _external=True)  # _external=True generates full URL
    return google.authorize_redirect(redirect_uri)

@app.route('/authorize')
def authorize():
    try:
        token = google.authorize_access_token()
        print("Token request details: ", token)
        resp = google.get('https://openidconnect.googleapis.com/v1/userinfo', token=token)
        user_info = resp.json()

        logger.debug(f"User Info: {user_info}")

        session.permanent = True
        session['google_token'] = token
        session['user'] = user_info
        session['email'] = user_info['email']

        return redirect(url_for('index'))
    except Exception as e:
        logger.error(f"Error during Google login: {str(e)}")
        flash("Failed to login with Google. Please try again.")
        return redirect(url_for('login'))

@app.route('/logout')
def logout():
    session.clear()
    flash("You have been logged out.")
    # Redirect to login page after logout
    return redirect(url_for('login'))

@app.before_request
def require_login():
    allowed_routes = {'login', 'login_google', 'authorize', 'static'}
    endpoint = request.endpoint

    # Skip check for static resources or unknown endpoints
    if endpoint is None or endpoint.startswith('static'):
        return

    # Skip auth for public routes
    if endpoint in allowed_routes:
        return

    # Enforce login for all other routes
    if 'google_token' not in session:
        logger.debug("Redirecting to login - no google_token in session")
        return redirect(url_for('login'))

@app.route('/segment/<int:segment_id>', methods=['GET', 'POST'])
@session_required
def segment(segment_id):
    try:
        # Debug logging
        logger.debug(f"Processing segment {segment_id}, method: {request.method}")
        if request.method == 'POST':
            logger.debug(f"Form data: {request.form}")
        
        # Validate token for GET requests
        if request.method == 'GET':
            token = request.args.get('token', '')
            # Use the extended validation that checks both expected and stored tokens
            is_valid = extended_validate_token(token, 'segment')
            
            if not is_valid:
                logger.warning(f"Token validation failed for segment GET. Token: {token}")
                flash("Security token is invalid or expired. Please start over for your security.")
                return redirect(url_for('index'))
            
            # Store the token in session for use in the form submission
            session['current_segment_token'] = token
            
            # Also keep a history of tokens for this endpoint
            if 'token_history' not in session:
                session['token_history'] = {}
            if 'segment' not in session['token_history']:
                session['token_history']['segment'] = []
            if token not in session['token_history']['segment']:
                session['token_history']['segment'].append(token)
            
        # For POST requests, we need to be more lenient with token validation
        elif request.method == 'POST':
            token = request.form.get('token', '')
            logger.debug(f"Token from form: {token}")
            
            # Check token against current token and token history
            current_token = session.get('current_segment_token', '')
            is_valid = validate_token(token, current_token) or token in session.get('token_history', {}).get('segment', [])
            
            if not is_valid:
                logger.warning(f"Token validation failed for segment POST. Got {token}, expected {current_token}")
                flash("Security token is invalid or expired. Please start over for your security.")
                return redirect(url_for('index'))
            
        # Ensure segment_id is valid (between 1 and 8)
        if segment_id < 1 or segment_id > 8:
            flash("Invalid segment ID. Please start over.")
            return redirect(url_for('index'))
            
        if request.method == 'POST':
            # Save scores from the current segment
            scores = []
            form_data = [k for k in request.form.keys() if k.startswith(f'seg{segment_id}_q')]
            question_count = len(form_data)
            
            # Extract scores in order
            for i in range(1, question_count + 1):
                score = int(request.form.get(f'seg{segment_id}_q{i}', 0))
                scores.append(score)
            
            session[f'segment{segment_id}_scores'] = scores
            # Also store complete form data for Google Sheets
            session[f'segment{segment_id}'] = request.form.to_dict()
            
            # If we've completed all segments, submit to Google Sheets and go to results
            if segment_id == 8:
                try:
                    ordered_data = prepare_google_sheets_data()
                    response = requests.post(
                        GOOGLE_SCRIPT_URL,
                        json=ordered_data,
                        headers={'Content-Type': 'application/json'},
                        timeout=15
                    )
                    
                    if response.status_code != 200:
                        logger.error(f"Google Sheets Error: Status {response.status_code}")
                        flash("Failed to save responses to Google Sheets, but continuing to results.")
                    
                except Exception as e:
                    logger.error(f"Google Sheets Error: {str(e)}")
                    flash("Failed to save to Google Sheets, but continuing to results.")
                
                # Generate a new token for results
                token = generate_secure_token(session['session_id'] + 'results')
                session['current_results_token'] = token
                
                # Store token in history
                if 'token_history' not in session:
                    session['token_history'] = {}
                if 'results' not in session['token_history']:
                    session['token_history']['results'] = []
                session['token_history']['results'].append(token)
                
                return redirect(url_for('results', token=token))
            
            # Generate new token for next segment
            next_token = generate_secure_token(session['session_id'] + 'segment')
            # Store this token for the next segment
            session['current_segment_token'] = next_token
            
            # Add to token history
            if 'token_history' not in session:
                session['token_history'] = {}
            if 'segment' not in session['token_history']:
                session['token_history']['segment'] = []
            if next_token not in session['token_history']['segment']:
                session['token_history']['segment'].append(next_token)
                
            return redirect(url_for('segment', segment_id=segment_id+1, token=next_token))
                
        # Render the template with the current token
        token = session.get('current_segment_token', generate_secure_token(session['session_id'] + 'segment'))
        # Add to token history
        if 'token_history' not in session:
            session['token_history'] = {}
        if 'segment' not in session['token_history']:
            session['token_history']['segment'] = []
        if token not in session['token_history']['segment']:
            session['token_history']['segment'].append(token)
            
        return render_template(
            'segment.html', 
            segment_id=segment_id, 
            title=segment_titles[segment_id],
            next_segment=segment_id + 1,
            token=token
        )
    except Exception as e:
        logger.error(f"Error in segment {segment_id}: {str(e)}")
        flash("An error occurred processing your request. Please start over.")
        return redirect(url_for('index'))

@app.route('/save_notes', methods=['POST'])
@session_required
def save_notes():
    try:
        # We already validated the session in the decorator
        # Validate CSRF token
        received_token = request.headers.get('X-CSRFToken')
        if not received_token or received_token != session.get('csrf_token'):
            logger.warning("CSRF token validation failed for save_notes")
            return 'CSRF validation failed', 403
            
        notes = request.form.get('notes', '')
        session['notes'] = notes
        return '', 204
    except Exception as e:
        logger.error(f"Error saving notes: {str(e)}")
        return 'Error saving notes', 500

def prepare_google_sheets_data():
    """Prepare data for Google Sheets submission"""
    try:
        ordered_data = {
            "Timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "Email Address": session.get('segment0', {}).get('email', ''),
            "Name of Petitioner/Probation/Parole": session.get('segment0', {}).get('client_name', ''),
            "Length of Sentence": session.get('segment0', {}).get('length_of_sentence', ''),
            "Name & Position of Inv/Supvg Officer": session.get('segment0', {}).get('officer_name', ''),
            "Chief Probation Officer/Officer-in-Charge": session.get('segment0', {}).get('chief_name', '')
        }

        # Add segment scores with error handling
        for i in range(1, 9):
            segment_scores = session.get(f'segment{i}_scores', [])
            segment_data = session.get(f'segment{i}', {})
            
            # Criminal History (Segment 1)
            if i == 1:
                ordered_data.update({
                    "Age at First Misconduct": segment_data.get('seg1_q1', '0'),
                    "Number of Previous Misconduct(s)": segment_data.get('seg1_q2', '0'),
                    "Extent of Involvement in Organized Crimes": segment_data.get('seg1_q3', '0'),
                    "Derogatory Record": segment_data.get('seg1_q4', '0'),
                    "Type of Offender": segment_data.get('seg1_q5', '0'),
                    "History of Violence": segment_data.get('seg1_q6', '0')
                })
            
            # Pro-Criminal Companions (Segment 2)
            elif i == 2:
                ordered_data.update({
                    "Type of Companions": segment_data.get('seg2_q1', '0'),
                    "Type of Activities with Companions": segment_data.get('seg2_q2', '0'),
                    "Friends' Support": segment_data.get('seg2_q3', '0')
                })
            
            # Pro-Criminal Attitudes (Segment 3)
            elif i == 3:
                ordered_data.update({
                    "It is okay to break the rules/laws as long as I can help my family.": segment_data.get('seg3_q1', '0'),
                    "It is okay to break the rules/laws because I don't know it.": segment_data.get('seg3_q2', '0'),
                    "It is okay to break the rules/laws when nobody sees me or I don't get caught.": segment_data.get('seg3_q3', '0'),
                    "It is okay to commit a crime if you're a victim of social injustice/inequality.": segment_data.get('seg3_q4', '0'),
                    "It is okay to commit a crime when you are in a desperate situation/crisis.": segment_data.get('seg3_q5', '0')
                })
            
            # Anti-Social Personality (Segment 4)
            elif i == 4:
                ordered_data.update({
                    "I find it hard to follow rules.": segment_data.get('seg4_q1', '0'),
                    "I lie and cheat to get what I want.": segment_data.get('seg4_q2', '0'),
                    "I act without thinking of the consequences of my actions.": segment_data.get('seg4_q3', '0'),
                    "I easily get irritated or angry.": segment_data.get('seg4_q4', '0'),
                    "I don't care who gets hurt as long as I get what I want.": segment_data.get('seg4_q5', '0'),
                    "I find it hard to follow through with responsibilities/assigned tasks.": segment_data.get('seg4_q6', '0')
                })
            
            # Education and Employment (Segment 5)
            elif i == 5:
                ordered_data.update({
                    "Educational Attainment": segment_data.get('seg5_q1', '0'),
                    "Educational Attachment": segment_data.get('seg5_q2', '0'),
                    "Overall Conduct in School": segment_data.get('seg5_q3', '0'),
                    "Employment Status at the Time of Arrest": segment_data.get('seg5_q4', '0'),
                    "Employable Skills": segment_data.get('seg5_q5', '0'),
                    "Employment History": segment_data.get('seg5_q6', '0')
                })
            
            # Family and Marital (Segment 6)
            elif i == 6:
                ordered_data.update({
                    "Quality of Family/Marital Relationships": segment_data.get('seg6_q1', '0'),
                    "Parental Guidance and Supervision": segment_data.get('seg6_q2', '0'),
                    "Family Acceptability in the Community": segment_data.get('seg6_q3', '0'),
                    "Spirituality/Religiosity": segment_data.get('seg6_q4', '0')
                })
            
            # Substance Abuse (Segment 7)
            elif i == 7:
                ordered_data.update({
                    "History of Drug Abuse": segment_data.get('seg7_q1', '0'),
                    "Frequency of Drug Use": segment_data.get('seg7_q2', '0'),
                    "History of Alcohol Abuse": segment_data.get('seg7_q3', '0'),
                    "Frequency of Alcohol Use": segment_data.get('seg7_q4', '0'),
                    "Desire/Urge for Substance Use": segment_data.get('seg7_q5', '0'),
                    "Cut Down on Substance Use (Reverse Coded)": segment_data.get('seg7_q6', '0'),
                    "Family History of Substance Use": segment_data.get('seg7_q7', '0')
                })
            
            # Mental Health (Segment 8)
            elif i == 8:
                ordered_data.update({
                    "I can perform my daily activities with minimal support from others": segment_data.get('seg8_q1', '0'),
                    "I can easily make good decisions on my own": segment_data.get('seg8_q2', '0'),
                    "I have experienced sadness for 14 days over the last 6 months": segment_data.get('seg8_q3', '0'),
                    "I have received consultation/treatment/counseling for a psychological/psychiatric problem": segment_data.get('seg8_q4', '0'),
                    "I sometimes hear or see things not normally seen or heard by others": segment_data.get('seg8_q5', '0')
                })

            # Add segment total score
            ordered_data[f"Segment {i} Total"] = str(sum(int(score) for score in segment_scores))

        # Add final calculations
        total_score = sum(sum(int(score) for score in session.get(f'segment{i}_scores', [])) for i in range(1, 9))
        ordered_data["Total Risk Score"] = str(total_score)
        
        risk_assessment = assess_risk_level(total_score, session.get('length_of_sentence', '2-years-or-less'))
        ordered_data["Risk Level"] = risk_assessment["level"]
        ordered_data["Probation Period"] = risk_assessment["probation"]
        ordered_data["Supervision Intensity"] = risk_assessment["supervision"]
        
        return ordered_data

    except Exception as e:
        logger.error(f"Error preparing Google Sheets data: {str(e)}")
        raise

@app.route('/results')
@session_required
def results():
    # Validate token
    token = request.args.get('token', '')
    logger.debug(f"Results page - Token: {token}")
    
    # Check token against current token and token history
    is_valid = extended_validate_token(token, 'results')
    current_token = session.get('current_results_token', '')
    token_history = session.get('token_history', {}).get('results', [])
    
    # Check both the extended validation and the stored token history
    if not (is_valid or (current_token and validate_token(token, current_token)) or token in token_history):
        logger.warning(f"Token validation failed for results. Token: {token}, Expected: {current_token}")
        flash("Security token is invalid or expired. Please start over for your security.")
        return redirect(url_for('index'))
    
    # Add to token history (if needed)
    if token and 'token_history' in session and 'results' in session['token_history'] and token not in session['token_history']['results']:
        session['token_history']['results'].append(token)
    
    subtotals = {}
    total_score = 0
    
    for i in range(1, 9):
        segment_scores = session.get(f'segment{i}_scores', [])
        if i == 5:  # Handle split segment
            subtotals[5] = sum(segment_scores[:3]) if len(segment_scores) >= 3 else 0
            subtotals[6] = sum(segment_scores[3:]) if len(segment_scores) > 3 else 0
            total_score += sum(segment_scores)
        elif i < 5:
            subtotal = sum(segment_scores)
            subtotals[i] = subtotal
            total_score += subtotal
        else:
            subtotal = sum(segment_scores)
            subtotals[i+1] = subtotal
            total_score += subtotal
    
    length_of_sentence = session.get('length_of_sentence', '2-years-or-less')
    risk_assessment = assess_risk_level(total_score, length_of_sentence)
    
    # Determine recommended programs
    recommended_programs = []
    for segment_id, data in segment_thresholds.items():
        threshold_met = subtotals.get(segment_id, 0) >= data.get("threshold", 0)
        if threshold_met:
            program_name = f"{data.get('program', 'Unknown')} ({data.get('name', segment_titles.get(segment_id, ''))})"
            recommended_programs.append(program_name)
    
    # Store the current results token for potential future use
    session['current_results_token'] = token
    
    return render_template(
        'results.html',
        subtotals=subtotals,
        total_score=total_score,
        risk_assessment=risk_assessment,
        recommended_programs=recommended_programs,
        mandatory_programs=mandatory_programs,
        segment_titles=segment_titles,
        segment_thresholds=segment_thresholds,
        notes=session.get('notes', '')
    )

def calculate_split_scores(segment_answers, segment_id=5):
    """Calculate separate scores for education and employment sections"""
    education_score = 0
    employment_score = 0
    
    if segment_id in segment_answers:
        edu_indices = segment_thresholds[segment_id]['education']['questions']
        emp_indices = segment_thresholds[segment_id]['employment']['questions']
        
        for i, score in enumerate(segment_answers[segment_id]['scores']):
            if i in edu_indices:
                education_score += score
            elif i in emp_indices:
                employment_score += score
    
    return education_score, employment_score

@app.route('/generate_pdf')
@session_required
def generate_pdf():
    try:
        # Validate token
        token = request.args.get('token', '')
        session_id = session.get('session_id', '')
        expected_token = generate_secure_token(session_id + 'generate_pdf')
        
        logger.debug(f"PDF Generation - Token: {token}, Expected: {expected_token}")
        
        if not validate_token(token, expected_token):
            logger.error(f"Token validation failed for PDF generation. Got {token}, expected {expected_token}")
            flash("Invalid or expired session. Please try again.")
            return redirect(url_for('results'))
            
        subtotals = {}
        segment_answers = {}
        segment_data = {}  # New dictionary to store remapped data
        total_score = 0
        
        # First, collect all scores
        for i in range(1, 9):
            segment_scores = session.get(f'segment{i}_scores', [])
            if not segment_scores:
                logger.warning(f"No scores found for segment {i}, using default empty list")
                segment_scores = [0] * len(segment_questions.get(i, []))
                
            if i == 5:  # Split segment
                # Education (stays as segment 5)
                subtotals[5] = sum(segment_scores[:3]) if len(segment_scores) >= 3 else 0
                segment_answers[5] = {
                    'questions': segment_questions[5][:3] if len(segment_questions.get(5, [])) >= 3 else [],
                    'scores': segment_scores[:3] if len(segment_scores) >= 3 else []
                }
                segment_data[5] = segment_answers_data.get(5, {})  # Education data
                
                # Employment (becomes segment 6)
                subtotals[6] = sum(segment_scores[3:]) if len(segment_scores) > 3 else 0
                segment_answers[6] = {
                    'questions': segment_questions[5][3:] if len(segment_questions.get(5, [])) > 3 else [],
                    'scores': segment_scores[3:] if len(segment_scores) > 3 else []
                }
                # Create new employment data from second half of segment 5
                segment_data[6] = {
                    k-3: segment_answers_data.get(5, {}).get(k, {}) 
                    for k in range(3, 6) if k in segment_answers_data.get(5, {})
                }
                
                total_score += sum(segment_scores)
            elif i < 5:  # Segments 1-4 stay the same
                subtotal = sum(segment_scores)
                subtotals[i] = subtotal
                total_score += subtotal
                segment_answers[i] = {
                    'questions': segment_questions.get(i, []),
                    'scores': segment_scores
                }
                segment_data[i] = segment_answers_data.get(i, {})
            else:  # Segments 6-8 become 7-9
                subtotal = sum(segment_scores)
                subtotals[i+1] = subtotal
                total_score += subtotal
                segment_answers[i+1] = {
                    'questions': segment_questions.get(i, []),
                    'scores': segment_scores
                }
                segment_data[i+1] = segment_answers_data.get(i, {})
        
        length_of_sentence = session.get('length_of_sentence', '2-years-or-less')
        risk_assessment = assess_risk_level(total_score, length_of_sentence)
        
        # Determine recommended programs
        recommended_programs = []
        for segment_id, data in segment_thresholds.items():
            if subtotals.get(segment_id, 0) >= data.get("threshold", 0):
                program_name = f"{data.get('program', 'Unknown')} ({data.get('name', segment_titles.get(segment_id, ''))})"
                recommended_programs.append(program_name)
        
        # Calculate education and employment scores
        try:
            education_score, employment_score = calculate_split_scores(segment_answers)
        except Exception as split_error:
            logger.error(f"Error calculating split scores: {str(split_error)}")
            education_score, employment_score = 0, 0
        
        client_name = session.get('client_name', '')
        officer_name = session.get('officer_name', '')
        chief_name = session.get('chief_name', '')
        
        logger.debug(f"Rendering PDF template with: client={client_name}, total_score={total_score}")
        
        # Render the PDF template
        html = render_template(
            'pdf_template.html',
            subtotals=subtotals,
            total_score=total_score,
            risk_assessment=risk_assessment,
            recommended_programs=recommended_programs,
            mandatory_programs=mandatory_programs,
            segment_titles=segment_titles,
            segment_answers=segment_answers,
            segment_thresholds=segment_thresholds,
            length_of_sentence=length_of_sentence,
            client_name=client_name,
            officer_name=officer_name,
            chief_name=chief_name,
            date=datetime.now().strftime("%B %d, %Y"),
            segment_answers_data=segment_data,  # Pass the remapped data
            education_score=education_score,
            employment_score=employment_score,
            session_id=session_id  # Pass session ID for added security
        )
        
        # Set a unique filename with timestamp and session hash for additional security
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        session_hash = hashlib.md5(session_id.encode()).hexdigest()[:8]
        filename = f"risk_assessment_{timestamp}_{session_hash}.pdf"
        
        logger.debug("Converting HTML to PDF with WeasyPrint...")
        
        try:
            # Convert the HTML to a PDF
            pdf = HTML(string=html).write_pdf()
            logger.debug(f"PDF generated successfully, size: {len(pdf)} bytes")
            
            # Create byte stream
            pdf_io = BytesIO(pdf)
            pdf_io.seek(0)
            
            # Create response with explicit headers to force download
            response = send_file(
                pdf_io,
                download_name=filename,
                as_attachment=True,
                mimetype='application/pdf'
            )
            
            # Add additional headers to ensure download
            response.headers["Content-Disposition"] = f"attachment; filename={filename}"
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
            
            logger.debug("Returning PDF response with appropriate headers")
            return response
            
        except Exception as pdf_error:
            logger.error(f"Error in WeasyPrint PDF generation: {str(pdf_error)}")
            flash("Error generating PDF with WeasyPrint. Please try again.")
            return redirect(url_for('results'))
        
    except Exception as e:
        logger.error(f"Error generating PDF: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        flash("Error generating PDF. Please try again.")
        return redirect(url_for('results'))

@app.route('/direct_pdf_download')
@session_required
def direct_pdf_download():
    """Generate a PDF without token verification - simpler approach for direct download"""
    try:
        logger.debug("Direct PDF download requested")
        
        subtotals = {}
        segment_answers = {}
        segment_data = {}
        total_score = 0
        
        # First, collect all scores
        for i in range(1, 9):
            segment_scores = session.get(f'segment{i}_scores', [])
            if not segment_scores:
                logger.warning(f"No scores found for segment {i}, using default empty list")
                segment_scores = [0] * len(segment_questions.get(i, []))
                
            if i == 5:  # Split segment
                subtotals[5] = sum(segment_scores[:3]) if len(segment_scores) >= 3 else 0
                segment_answers[5] = {
                    'questions': segment_questions[5][:3] if len(segment_questions.get(5, [])) >= 3 else [],
                    'scores': segment_scores[:3] if len(segment_scores) >= 3 else []
                }
                segment_data[5] = segment_answers_data.get(5, {})
                
                subtotals[6] = sum(segment_scores[3:]) if len(segment_scores) > 3 else 0
                segment_answers[6] = {
                    'questions': segment_questions[5][3:] if len(segment_questions.get(5, [])) > 3 else [],
                    'scores': segment_scores[3:] if len(segment_scores) > 3 else []
                }
                segment_data[6] = {
                    k-3: segment_answers_data.get(5, {}).get(k, {}) 
                    for k in range(3, 6) if k in segment_answers_data.get(5, {})
                }
                
                total_score += sum(segment_scores)
            elif i < 5:
                subtotal = sum(segment_scores)
                subtotals[i] = subtotal
                total_score += subtotal
                segment_answers[i] = {
                    'questions': segment_questions.get(i, []),
                    'scores': segment_scores
                }
                segment_data[i] = segment_answers_data.get(i, {})
            else:
                subtotal = sum(segment_scores)
                subtotals[i+1] = subtotal
                total_score += subtotal
                segment_answers[i+1] = {
                    'questions': segment_questions.get(i, []),
                    'scores': segment_scores
                }
                segment_data[i+1] = segment_answers_data.get(i, {})
        
        length_of_sentence = session.get('segment0', {}).get('length_of_sentence', '2-years-or-less')
        risk_assessment = assess_risk_level(total_score, length_of_sentence)
        
        # Determine recommended programs
        recommended_programs = []
        for segment_id, data in segment_thresholds.items():
            if subtotals.get(segment_id, 0) >= data.get("threshold", 0):
                program_name = f"{data.get('program', 'Unknown')} ({data.get('name', segment_titles.get(segment_id, ''))})"
                recommended_programs.append(program_name)
        
        # Calculate education and employment scores
        try:
            education_score, employment_score = calculate_split_scores(segment_answers)
        except Exception as split_error:
            logger.error(f"Error calculating split scores: {str(split_error)}")
            education_score, employment_score = 0, 0
        
        client_name = session.get('segment0', {}).get('client_name', '')
        officer_name = session.get('segment0', {}).get('officer_name', '')
        chief_name = session.get('segment0', {}).get('chief_name', '')
        
        logger.debug(f"Rendering PDF template with direct download: client={client_name}, total_score={total_score}")
        
        # Render the PDF template
        html = render_template(
            'pdf_template.html',
            subtotals=subtotals,
            total_score=total_score,
            risk_assessment=risk_assessment,
            recommended_programs=recommended_programs,
            mandatory_programs=mandatory_programs,
            segment_titles=segment_titles,
            segment_answers=segment_answers,
            segment_thresholds=segment_thresholds,
            length_of_sentence=length_of_sentence,
            client_name=client_name,
            officer_name=officer_name,
            chief_name=chief_name,
            date=datetime.now().strftime("%B %d, %Y"),
            segment_answers_data=segment_data,
            education_score=education_score,
            employment_score=employment_score,
            session_id=session.get('session_id', '')
        )
        
        # Set a unique filename with timestamp and client name for easier identification
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        safe_client_name = "".join([c if c.isalnum() else "_" for c in client_name])[:30]
        filename = f"risk_assessment_{safe_client_name}_{timestamp}.pdf"
        
        logger.debug("Converting HTML to PDF with WeasyPrint for direct download...")
        
        try:
            # Convert the HTML to a PDF
            pdf = HTML(string=html).write_pdf()
            logger.debug(f"Direct PDF generated successfully, size: {len(pdf)} bytes")
            
            # Create byte stream
            pdf_io = BytesIO(pdf)
            pdf_io.seek(0)
            
            # Create response with enhanced headers to force download
            response = send_file(
                pdf_io,
                download_name=filename,
                as_attachment=True,
                mimetype='application/pdf'
            )
            
            # Add additional headers to ensure download
            response.headers["Content-Disposition"] = f"attachment; filename={filename}"
            response.headers["Content-Type"] = "application/pdf"
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
            
            logger.debug("Returning direct PDF download response")
            return response
            
        except Exception as pdf_error:
            logger.error(f"Error in WeasyPrint PDF generation for direct download: {str(pdf_error)}")
            flash("Error generating PDF with WeasyPrint. Please try again.")
            return redirect(url_for('results'))
        
    except Exception as e:
        logger.error(f"Error in direct PDF download: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        flash("Error generating PDF. Please try again.")
        return redirect(url_for('results'))

@app.route('/get_pdf_token')
@session_required
def get_pdf_token():
    """Generate a fresh token for PDF download"""
    try:
        session_id = session.get('session_id', '')
        token = generate_secure_token(session_id + 'generate_pdf')
        logger.debug(f"Generated fresh PDF token: {token}")
        return {"token": token}
    except Exception as e:
        logger.error(f"Error generating PDF token: {str(e)}")
        return {"error": "Failed to generate token"}, 500

@app.route('/test_pdf')
def test_pdf():
    """Generate a simple test PDF to check if WeasyPrint is working correctly"""
    try:
        logger.debug("Testing PDF generation with WeasyPrint")
        
        # Create a simple HTML document
        html_content = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Test PDF</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 2cm; }
                h1 { color: #4285f4; }
                p { margin-bottom: 1em; }
            </style>
        </head>
        <body>
            <h1>WeasyPrint Test Document</h1>
            <p>This is a test PDF document generated with WeasyPrint.</p>
            <p>If you can see this PDF, the WeasyPrint library is working correctly.</p>
            <p>Generated at: """ + datetime.now().strftime("%Y-%m-%d %H:%M:%S") + """</p>
        </body>
        </html>
        """
        
        # Convert the HTML to a PDF
        pdf = HTML(string=html_content).write_pdf()
        logger.debug(f"Test PDF generated successfully, size: {len(pdf)} bytes")
        
        # Create byte stream
        pdf_io = BytesIO(pdf)
        pdf_io.seek(0)
        
        # Create filename
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        filename = f"weasyprint_test_{timestamp}.pdf"
        
        # Return the PDF with proper headers
        response = send_file(
            pdf_io,
            download_name=filename,
            as_attachment=True,
            mimetype='application/pdf'
        )
        
        # Add additional headers to ensure download
        response.headers["Content-Disposition"] = f"attachment; filename={filename}"
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        
        return response
        
    except Exception as e:
        logger.error(f"Error generating test PDF: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return "Error generating test PDF: " + str(e), 500

@app.route('/favicon.ico')
def favicon():
    return send_from_directory('static', 'favicon.ico', mimetype='image/vnd.microsoft.icon')

@app.route('/navigate/<target>')
@session_required
def navigate(target):
    """Special navigation handler that generates fresh tokens for each endpoint"""
    try:
        # Generate a fresh token for the requested endpoint
        session_id = session.get('session_id', '')
        
        # Ensure we have a session ID, generate one if missing
        if not session_id:
            session_id = generate_session_id()
            session['session_id'] = session_id
            logger.warning(f"Created missing session_id during navigation: {session_id}")
            
        if target == 'index':
            return redirect(url_for('index'))
            
        if target.startswith('segment_'):
            # Extract segment ID from the endpoint
            try:
                segment_id = int(target.split('_')[1])
                if 1 <= segment_id <= 8:
                    token = generate_secure_token(session_id + 'segment')
                    # Store token for fallback validation
                    session['current_segment_token'] = token
                    
                    # Also store in token history
                    if 'token_history' not in session:
                        session['token_history'] = {}
                    if 'segment' not in session['token_history']:
                        session['token_history']['segment'] = []
                    if token not in session['token_history']['segment']:
                        session['token_history']['segment'].append(token)
                        
                    logger.debug(f"Navigating to segment {segment_id} with token {token}")
                    return redirect(url_for('segment', segment_id=segment_id, token=token))
                else:
                    logger.warning(f"Invalid segment ID: {segment_id}")
            except (ValueError, IndexError) as e:
                logger.error(f"Error parsing segment ID from {target}: {str(e)}")
                flash("Invalid segment ID format.")
                return redirect(url_for('index'))
                
        if target == 'results':
            token = generate_secure_token(session_id + 'results')
            # Store in session and token history
            session['current_results_token'] = token
            
            if 'token_history' not in session:
                session['token_history'] = {}
            if 'results' not in session['token_history']:
                session['token_history']['results'] = []
            if token not in session['token_history']['results']:
                session['token_history']['results'].append(token)
                
            return redirect(url_for('results', token=token))
            
        # Default case - redirect to index
        logger.warning(f"Invalid navigation target: {target}")
        flash("Invalid navigation request.")
        return redirect(url_for('index'))
        
    except Exception as e:
        logger.error(f"Error in navigation: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        flash("An error occurred during navigation. Please try again.")
        return redirect(url_for('index'))

if __name__ == '__main__':
    app.run(debug=True)