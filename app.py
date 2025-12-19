from flask import Flask, render_template, request, jsonify, redirect, url_for
import json
import os
import random
from flask_sqlalchemy import SQLAlchemy
from datetime import date

app = Flask(__name__)

# Database configuration - For production, use environment variables
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///factflare.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Models
class Deck(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    facts = db.relationship('Fact', backref='deck', lazy=True)

class Fact(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    deck_id = db.Column(db.Integer, db.ForeignKey('deck.id'), nullable=False)
    # Spaced repetition fields
    ease_factor = db.Column(db.Float, default=2.5)  # SM-2 algorithm ease factor
    interval = db.Column(db.Integer, default=1)  # Days between reviews
    repetitions = db.Column(db.Integer, default=0)  # Number of successful reviews
    next_review_date = db.Column(db.Date, nullable=True)  # When to review next
    last_reviewed = db.Column(db.Date, nullable=True)  # Last review date
    # Study mode tracking
    times_shown = db.Column(db.Integer, default=0)  # Total times shown
    times_correct = db.Column(db.Integer, default=0)  # Times answered correctly
    # Additional metadata
    created_date = db.Column(db.DateTime, default=db.func.current_timestamp())
    tags = db.Column(db.Text, default='')  # Comma-separated tags
    image_url = db.Column(db.Text, nullable=True)  # For image support

class UserProgress(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    total_facts_viewed = db.Column(db.Integer, default=0)
    decks_loaded = db.Column(db.Integer, default=0)
    current_streak = db.Column(db.Integer, default=0)
    longest_streak = db.Column(db.Integer, default=0)
    total_xp = db.Column(db.Integer, default=0)
    last_study_date = db.Column(db.Date, nullable=True)
    achievements = db.Column(db.Text, default='[]')  # JSON string of achievement IDs

class Achievement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=False)
    icon = db.Column(db.String(50), nullable=False)
    xp_reward = db.Column(db.Integer, default=0)
    requirement_type = db.Column(db.String(50), nullable=False)  # 'facts_viewed', 'decks_loaded', 'streak', etc.
    requirement_value = db.Column(db.Integer, nullable=False)

class StudySession(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    mode = db.Column(db.String(50), nullable=False)  # 'review', 'cram', 'random', 'spaced'
    deck_id = db.Column(db.Integer, db.ForeignKey('deck.id'), nullable=False)
    start_time = db.Column(db.DateTime, default=db.func.current_timestamp())
    end_time = db.Column(db.DateTime, nullable=True)
    facts_studied = db.Column(db.Integer, default=0)
    correct_answers = db.Column(db.Integer, default=0)
    total_time = db.Column(db.Integer, default=0)  # Time in seconds

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

current_deck_id = None
viewed = set()
shuffle_mode = False
current_study_mode = 'spaced'  # 'spaced', 'review', 'cram', 'random'
current_session = None

def get_user_progress():
    """Get or create user progress record"""
    progress = UserProgress.query.first()
    if not progress:
        progress = UserProgress()
        db.session.add(progress)
        db.session.commit()
    return progress

def update_streak(progress):
    """Update study streak based on last study date"""
    from datetime import date, timedelta
    
    today = date.today()
    if progress.last_study_date:
        days_diff = (today - progress.last_study_date).days
        if days_diff == 1:
            # Consecutive day
            progress.current_streak += 1
        elif days_diff > 1:
            # Streak broken
            progress.current_streak = 1
        # If days_diff == 0, already studied today, keep current streak
    else:
        # First time studying
        progress.current_streak = 1
    
    if progress.current_streak > progress.longest_streak:
        progress.longest_streak = progress.current_streak
    
    progress.last_study_date = today

def check_achievements(progress):
    """Check and award new achievements"""
    import json
    
    achievements = Achievement.query.all()
    current_achievements = json.loads(progress.achievements) if progress.achievements else []
    
    new_achievements = []
    for achievement in achievements:
        if achievement.id not in current_achievements:
            achieved = False
            
            if achievement.requirement_type == 'facts_viewed':
                achieved = progress.total_facts_viewed >= achievement.requirement_value
            elif achievement.requirement_type == 'decks_loaded':
                achieved = progress.decks_loaded >= achievement.requirement_value
            elif achievement.requirement_type == 'streak':
                achieved = progress.current_streak >= achievement.requirement_value
            elif achievement.requirement_type == 'xp':
                achieved = progress.total_xp >= achievement.requirement_value
            
            if achieved:
                current_achievements.append(achievement.id)
                progress.total_xp += achievement.xp_reward
                new_achievements.append({
                    'id': achievement.id,
                    'name': achievement.name,
                    'description': achievement.description,
                    'icon': achievement.icon,
                    'xp_reward': achievement.xp_reward
                })
    
    progress.achievements = json.dumps(current_achievements)
    return new_achievements

def initialize_achievements():
    """Create default achievements if they don't exist"""
    if Achievement.query.count() == 0:
        achievements = [
            Achievement(name="First Steps", description="View your first fact", icon="🎯", xp_reward=10, requirement_type="facts_viewed", requirement_value=1),
            Achievement(name="Getting Started", description="View 10 facts", icon="📚", xp_reward=25, requirement_type="facts_viewed", requirement_value=10),
            Achievement(name="Knowledge Seeker", description="View 50 facts", icon="🧠", xp_reward=50, requirement_type="facts_viewed", requirement_value=50),
            Achievement(name="Scholar", description="View 100 facts", icon="🎓", xp_reward=100, requirement_type="facts_viewed", requirement_value=100),
            Achievement(name="Deck Explorer", description="Load your first deck", icon="🗂️", xp_reward=15, requirement_type="decks_loaded", requirement_value=1),
            Achievement(name="Deck Master", description="Load 5 different decks", icon="👑", xp_reward=75, requirement_type="decks_loaded", requirement_value=5),
            Achievement(name="Dedicated Learner", description="Maintain a 3-day streak", icon="🔥", xp_reward=30, requirement_type="streak", requirement_value=3),
            Achievement(name="Consistency King", description="Maintain a 7-day streak", icon="👑", xp_reward=100, requirement_type="streak", requirement_value=7),
            Achievement(name="XP Hunter", description="Earn 500 XP", icon="💎", xp_reward=50, requirement_type="xp", requirement_value=500),
        ]
        for achievement in achievements:
            db.session.add(achievement)
        db.session.commit()

# Spaced Repetition Functions
def calculate_next_review(fact, quality):
    """
    SM-2 Algorithm implementation
    quality: 0-5 (0=complete blackout, 5=perfect response)
    """
    from datetime import date, timedelta

    if quality < 3:
        # Failed response - reset to initial interval
        fact.repetitions = 0
        fact.interval = 1
    else:
        # Successful response
        fact.repetitions += 1
        if fact.repetitions == 1:
            fact.interval = 1
        elif fact.repetitions == 2:
            fact.interval = 6
        else:
            fact.interval = int(fact.interval * fact.ease_factor)

        # Update ease factor
        fact.ease_factor = max(1.3, fact.ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))

    # Set next review date
    fact.next_review_date = date.today() + timedelta(days=fact.interval)
    fact.last_reviewed = date.today()

def get_due_facts(deck_id):
    """Get facts that are due for review"""
    from datetime import date
    return Fact.query.filter_by(deck_id=deck_id).filter(
        db.or_(Fact.next_review_date.is_(None), Fact.next_review_date <= date.today())
    ).all()

def get_new_facts(deck_id, limit=20):
    """Get facts that haven't been reviewed yet"""
    return Fact.query.filter_by(deck_id=deck_id).filter(
        Fact.next_review_date.is_(None)
    ).limit(limit).all()

def select_fact_for_review(deck_id, mode='spaced'):
    """Select the next fact based on study mode"""
    if mode == 'spaced':
        # Prioritize due facts, then new facts
        due_facts = get_due_facts(deck_id)
        if due_facts:
            # Sort by urgency (earliest next_review_date first)
            due_facts.sort(key=lambda f: f.next_review_date or date.min)
            return random.choice(due_facts[:5])  # Random from top 5 most urgent

        # No due facts, get new ones
        new_facts = get_new_facts(deck_id, 10)
        if new_facts:
            return random.choice(new_facts)

    elif mode == 'review':
        # Review all facts in order
        facts = Fact.query.filter_by(deck_id=deck_id).all()
        if facts:
            return random.choice(facts)

    elif mode == 'cram':
        # Focus on facts with low ease factor (harder facts)
        hard_facts = Fact.query.filter_by(deck_id=deck_id).filter(
            Fact.ease_factor < 2.0
        ).all()
        if hard_facts:
            return random.choice(hard_facts)
        # If no hard facts, fall back to random
        facts = Fact.query.filter_by(deck_id=deck_id).all()
        if facts:
            return random.choice(facts)

    elif mode == 'random':
        facts = Fact.query.filter_by(deck_id=deck_id).all()
        if facts:
            return random.choice(facts)

    return None

@app.route('/')
def index():
    return redirect(url_for('home'))

@app.route('/home')
def home():
    return render_template('home.html')

@app.route('/study')
def study():
    return render_template('study.html')

@app.route('/data')
def data():
    return render_template('data.html')

@app.route('/upload', methods=['POST'])
def upload():
    global current_deck_id, viewed
    file = request.files.get('file')
    if file:
        try:
            # Decode file as UTF-8 string, then parse JSON
            file_content = file.read().decode('utf-8')
            data = json.loads(file_content)
            if 'deckName' in data and 'facts' in data and isinstance(data['facts'], list) and data['facts']:
                # Check if deck already exists
                existing_deck = Deck.query.filter_by(name=data['deckName']).first()
                if existing_deck:
                    return jsonify({'status': 'error', 'message': 'Deck with this name already exists'})
                
                # Create new deck
                new_deck = Deck(name=data['deckName'])
                db.session.add(new_deck)
                db.session.commit()
                
                # Add facts
                for fact in data['facts']:
                    new_fact = Fact(content=fact, deck_id=new_deck.id)
                    db.session.add(new_fact)
                db.session.commit()
                
                current_deck_id = new_deck.id
                viewed = set()
                
                # Update user progress for deck loading
                progress = get_user_progress()
                progress.decks_loaded += 1
                new_achievements = check_achievements(progress)
                db.session.commit()
                
                return jsonify({
                    'status': 'success', 
                    'deckName': data['deckName'], 
                    'count': len(data['facts']),
                    'new_achievements': new_achievements,
                    'xp': progress.total_xp,
                    'streak': progress.current_streak
                })
            else:
                return jsonify({'status': 'error', 'message': 'Invalid JSON format: must have deckName and facts array'})
        except json.JSONDecodeError:
            return jsonify({'status': 'error', 'message': 'Invalid JSON file'})
        except Exception as e:
            return jsonify({'status': 'error', 'message': str(e)})
    return jsonify({'status': 'error', 'message': 'No file uploaded'})

@app.route('/export')
def export():
    if current_deck_id:
        deck = Deck.query.get(current_deck_id)
        if deck:
            facts = [fact.content for fact in deck.facts]
            data = {'deckName': deck.name, 'facts': facts}
            return jsonify(data)
    return jsonify({'error': 'No deck loaded'})

@app.route('/load_sample')
def load_sample():
    global current_deck_id, viewed
    sample_path = os.path.join(BASE_DIR, 'decks', 'Sample_Facts.json')
    if os.path.exists(sample_path):
        with open(sample_path, 'r') as f:
            data = json.load(f)
        
        # Check if sample deck exists
        existing_deck = Deck.query.filter_by(name=data['deckName']).first()
        if existing_deck:
            current_deck_id = existing_deck.id
            viewed = set()
            
            # Update user progress for deck loading (even if already exists)
            progress = get_user_progress()
            progress.decks_loaded += 1
            new_achievements = check_achievements(progress)
            db.session.commit()
            
            return jsonify({
                'status': 'success', 
                'deckName': data['deckName'], 
                'count': len(data['facts']),
                'new_achievements': new_achievements,
                'xp': progress.total_xp,
                'streak': progress.current_streak
            })
        
        # Create sample deck
        new_deck = Deck(name=data['deckName'])
        db.session.add(new_deck)
        db.session.commit()
        
        for fact in data['facts']:
            new_fact = Fact(content=fact, deck_id=new_deck.id)
            db.session.add(new_fact)
        db.session.commit()
        
        current_deck_id = new_deck.id
        viewed = set()
        
        # Update user progress for deck loading
        progress = get_user_progress()
        progress.decks_loaded += 1
        new_achievements = check_achievements(progress)
        db.session.commit()
        
        return jsonify({
            'status': 'success', 
            'deckName': data['deckName'], 
            'count': len(data['facts']),
            'new_achievements': new_achievements,
            'xp': progress.total_xp,
            'streak': progress.current_streak
        })
    return jsonify({'status': 'error', 'message': 'Sample deck not found'})

@app.route('/get_status')
def get_status():
    if current_deck_id:
        deck = Deck.query.get(current_deck_id)
        if deck:
            return jsonify({'loaded': True, 'deckName': deck.name, 'count': len(deck.facts)})
    return jsonify({'loaded': False})

@app.route('/list_decks')
def list_decks():
    try:
        decks = [deck.name for deck in Deck.query.all()]
        return jsonify(decks)
    except:
        return jsonify([])

@app.route('/get_deck/<deck_name>')
def get_deck(deck_name):
    global current_deck_id, viewed
    deck = Deck.query.filter_by(name=deck_name).first()
    if deck:
        facts = [fact.content for fact in deck.facts]
        data = {'deckName': deck.name, 'facts': facts}
        current_deck_id = deck.id
        viewed = set()
        return jsonify(data)
    return jsonify({'error': 'Deck not found'})

@app.route('/delete_deck/<deck_name>', methods=['DELETE'])
def delete_deck(deck_name):
    global current_deck_id, viewed
    try:
        deck = Deck.query.filter_by(name=deck_name).first()
        if deck:
            # If the current deck is being deleted, reset
            if current_deck_id == deck.id:
                current_deck_id = None
                viewed = set()
            # Delete facts first due to foreign key
            Fact.query.filter_by(deck_id=deck.id).delete()
            db.session.delete(deck)
            db.session.commit()
            return jsonify({'status': 'success', 'message': f'Deck "{deck_name}" deleted'})
        else:
            return jsonify({'status': 'error', 'message': 'Deck not found'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)})

@app.route('/next_fact')
def next_fact():
    global viewed, current_session
    if not current_deck_id:
        return jsonify({'fact': 'No deck loaded'})

    # Select fact based on current study mode
    fact = select_fact_for_review(current_deck_id, current_study_mode)
    if not fact:
        return jsonify({'fact': 'No facts available'})

    # Update fact statistics
    fact.times_shown += 1

    # Create or update study session
    if not current_session:
        current_session = StudySession(mode=current_study_mode, deck_id=current_deck_id)
        db.session.add(current_session)
    current_session.facts_studied += 1

    # Update user progress
    progress = get_user_progress()
    progress.total_facts_viewed += 1
    update_streak(progress)
    new_achievements = check_achievements(progress)
    db.session.commit()

    return jsonify({
        'fact': fact.content,
        'fact_id': fact.id,
        'new_achievements': new_achievements,
        'xp': progress.total_xp,
        'streak': progress.current_streak,
        'study_mode': current_study_mode,
        'ease_factor': fact.ease_factor,
        'repetitions': fact.repetitions,
        'next_review': fact.next_review_date.isoformat() if fact.next_review_date else None
    })

@app.route('/set_study_mode/<mode>')
def set_study_mode(mode):
    global current_study_mode, current_session
    if mode in ['spaced', 'review', 'cram', 'random']:
        current_study_mode = mode
        # End current session if exists
        if current_session:
            current_session.end_time = db.func.current_timestamp()
            db.session.commit()
        current_session = None  # Will be created on next fact
        return jsonify({'status': 'success', 'mode': mode})
    return jsonify({'status': 'error', 'message': 'Invalid mode'})

@app.route('/submit_answer/<int:fact_id>/<int:quality>')
def submit_answer(fact_id, quality):
    """Submit answer quality for spaced repetition"""
    if quality < 0 or quality > 5:
        return jsonify({'status': 'error', 'message': 'Quality must be 0-5'})

    fact = Fact.query.get(fact_id)
    if not fact:
        return jsonify({'status': 'error', 'message': 'Fact not found'})

    # Update spaced repetition algorithm
    calculate_next_review(fact, quality)

    # Update session stats
    global current_session
    if current_session and quality >= 3:  # Consider 3+ as correct
        current_session.correct_answers += 1

    db.session.commit()

    return jsonify({
        'status': 'success',
        'next_review': fact.next_review_date.isoformat() if fact.next_review_date else None,
        'ease_factor': fact.ease_factor,
        'interval': fact.interval
    })

@app.route('/get_study_stats')
def get_study_stats():
    """Get detailed study statistics for analytics"""
    if not current_deck_id:
        return jsonify({'error': 'No deck loaded'})

    facts = Fact.query.filter_by(deck_id=current_deck_id).all()

    total_facts = len(facts)
    reviewed_facts = len([f for f in facts if f.repetitions > 0])
    due_facts = len([f for f in facts if f.next_review_date and f.next_review_date <= date.today()])
    new_facts = len([f for f in facts if f.repetitions == 0])

    # Calculate average ease factor
    ease_factors = [f.ease_factor for f in facts if f.repetitions > 0]
    avg_ease = sum(ease_factors) / len(ease_factors) if ease_factors else 2.5

    # Study sessions
    sessions = StudySession.query.filter_by(deck_id=current_deck_id).order_by(StudySession.start_time.desc()).limit(10).all()

    return jsonify({
        'total_facts': total_facts,
        'reviewed_facts': reviewed_facts,
        'due_facts': due_facts,
        'new_facts': new_facts,
        'avg_ease_factor': round(avg_ease, 2),
        'study_sessions': [{
            'mode': s.mode,
            'start_time': s.start_time.isoformat(),
            'facts_studied': s.facts_studied,
            'correct_answers': s.correct_answers,
            'accuracy': round((s.correct_answers / s.facts_studied * 100), 1) if s.facts_studied > 0 else 0
        } for s in sessions]
    })

@app.route('/get_progress')
def get_progress():
    progress = get_user_progress()
    return jsonify({
        'total_facts_viewed': progress.total_facts_viewed,
        'decks_loaded': progress.decks_loaded,
        'current_streak': progress.current_streak,
        'longest_streak': progress.longest_streak,
        'total_xp': progress.total_xp,
        'achievements': json.loads(progress.achievements) if progress.achievements else []
    })

@app.route('/get_achievements')
def get_achievements():
    achievements = Achievement.query.all()
    return jsonify([{
        'id': a.id,
        'name': a.name,
        'description': a.description,
        'icon': a.icon,
        'xp_reward': a.xp_reward,
        'requirement_type': a.requirement_type,
        'requirement_value': a.requirement_value
    } for a in achievements])

@app.route('/get_user_achievements')
def get_user_achievements():
    progress = get_user_progress()
    user_achievement_ids = json.loads(progress.achievements) if progress.achievements else []
    achievements = Achievement.query.filter(Achievement.id.in_(user_achievement_ids)).all()
    return jsonify([{
        'id': a.id,
        'name': a.name,
        'description': a.description,
        'icon': a.icon,
        'xp_reward': a.xp_reward
    } for a in achievements])

@app.route('/speak_text', methods=['POST'])
def speak_text():
    """Text-to-speech endpoint for audio support"""
    data = request.get_json()
    text = data.get('text', '')
    if not text:
        return jsonify({'status': 'error', 'message': 'No text provided'})

    # For now, return success - frontend will handle TTS with Web Speech API
    # In production, you could integrate with services like Google TTS, AWS Polly, etc.
    return jsonify({'status': 'success', 'message': 'Text ready for speech synthesis'})

@app.route('/add_image/<int:fact_id>', methods=['POST'])
def add_image(fact_id):
    """Add image to a fact"""
    fact = Fact.query.get(fact_id)
    if not fact:
        return jsonify({'status': 'error', 'message': 'Fact not found'})

    data = request.get_json()
    image_url = data.get('image_url', '')
    if not image_url:
        return jsonify({'status': 'error', 'message': 'No image URL provided'})

    fact.image_url = image_url
    db.session.commit()

    return jsonify({'status': 'success', 'image_url': image_url})

@app.route('/get_fact_details/<int:fact_id>')
def get_fact_details(fact_id):
    """Get detailed information about a fact including tags and image"""
    fact = Fact.query.get(fact_id)
    if not fact:
        return jsonify({'error': 'Fact not found'})

    return jsonify({
        'id': fact.id,
        'content': fact.content,
        'tags': fact.tags.split(',') if fact.tags else [],
        'image_url': fact.image_url,
        'ease_factor': fact.ease_factor,
        'repetitions': fact.repetitions,
        'next_review': fact.next_review_date.isoformat() if fact.next_review_date else None,
        'times_shown': fact.times_shown,
        'times_correct': fact.times_correct
    })

@app.route('/update_fact_tags/<int:fact_id>', methods=['POST'])
def update_fact_tags(fact_id):
    """Update tags for a fact"""
    fact = Fact.query.get(fact_id)
    if not fact:
        return jsonify({'status': 'error', 'message': 'Fact not found'})

    data = request.get_json()
    tags = data.get('tags', [])
    fact.tags = ','.join(tags)
    db.session.commit()

    return jsonify({'status': 'success', 'tags': tags})

@app.route('/get_tags')
def get_tags():
    """Get all unique tags across all facts"""
    all_tags = set()
    facts = Fact.query.all()
    for fact in facts:
        if fact.tags:
            all_tags.update(fact.tags.split(','))

    return jsonify({'tags': sorted(list(all_tags))})

@app.route('/get_facts_by_tag/<tag>')
def get_facts_by_tag(tag):
    """Get facts filtered by tag"""
    if not current_deck_id:
        return jsonify({'error': 'No deck loaded'})

    facts = Fact.query.filter_by(deck_id=current_deck_id).filter(
        Fact.tags.contains(tag)
    ).all()

    return jsonify([{
        'id': f.id,
        'content': f.content,
        'tags': f.tags.split(',') if f.tags else [],
        'image_url': f.image_url
    } for f in facts])

@app.route('/create_custom_session', methods=['POST'])
def create_custom_session():
    """Create a custom study session with specific parameters"""
    global current_session

    if not current_deck_id:
        return jsonify({'status': 'error', 'message': 'No deck loaded'})

    data = request.get_json()
    mode = data.get('mode', 'spaced')
    fact_limit = data.get('fact_limit', None)  # Limit number of facts
    time_limit = data.get('time_limit', None)  # Time limit in minutes
    tags = data.get('tags', [])  # Filter by tags

    # End current session if exists
    if current_session:
        current_session.end_time = db.func.current_timestamp()
        db.session.commit()

    # Create new custom session
    current_session = StudySession(mode=mode, deck_id=current_deck_id)
    db.session.add(current_session)
    db.session.commit()

    return jsonify({
        'status': 'success',
        'session_id': current_session.id,
        'mode': mode,
        'fact_limit': fact_limit,
        'time_limit': time_limit,
        'tags': tags
    })

@app.route('/get_session_progress')
def get_session_progress():
    """Get current session progress"""
    if not current_session:
        return jsonify({'error': 'No active session'})

    return jsonify({
        'session_id': current_session.id,
        'mode': current_session.mode,
        'facts_studied': current_session.facts_studied,
        'correct_answers': current_session.correct_answers,
        'start_time': current_session.start_time.isoformat(),
        'accuracy': round((current_session.correct_answers / current_session.facts_studied * 100), 1) if current_session.facts_studied > 0 else 0
    })

@app.route('/end_session')
def end_session():
    """End the current study session"""
    global current_session
    if current_session:
        current_session.end_time = db.func.current_timestamp()
        db.session.commit()
        session_data = {
            'session_id': current_session.id,
            'facts_studied': current_session.facts_studied,
            'correct_answers': current_session.correct_answers,
            'accuracy': round((current_session.correct_answers / current_session.facts_studied * 100), 1) if current_session.facts_studied > 0 else 0
        }
        current_session = None
        return jsonify({'status': 'success', 'session': session_data})
    return jsonify({'status': 'error', 'message': 'No active session'})

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        initialize_achievements()
    app.run(debug=True)