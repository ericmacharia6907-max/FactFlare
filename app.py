from flask import Flask, render_template, request, jsonify
import json
import os
import random
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)

# Database configuration - Direct connection to Supabase
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres.jmppcheyruvpbtgfztzr:Myflashcard2024@aws-1-eu-west-1.pooler.supabase.com:5432/postgres'
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

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

current_deck_id = None
viewed = set()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload():
    global current_deck_id, viewed
    file = request.files.get('file')
    if file:
        try:
            data = json.load(file)
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
                return jsonify({'status': 'success', 'deckName': data['deckName'], 'count': len(data['facts'])})
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
            return jsonify({'status': 'success', 'deckName': data['deckName'], 'count': len(data['facts'])})
        
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
        return jsonify({'status': 'success', 'deckName': data['deckName'], 'count': len(data['facts'])})
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

@app.route('/next_fact')
def next_fact():
    global viewed
    if not current_deck_id:
        return jsonify({'fact': 'No deck loaded'})
    deck = Deck.query.get(current_deck_id)
    if not deck:
        return jsonify({'fact': 'No deck loaded'})
    facts = deck.facts
    if len(viewed) == len(facts):
        viewed.clear()
    available = [i for i in range(len(facts)) if i not in viewed]
    if not available:
        available = list(range(len(facts)))
        viewed.clear()
    index = random.choice(available)
    viewed.add(index)
    return jsonify({'fact': facts[index].content})

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)