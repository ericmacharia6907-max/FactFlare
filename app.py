from flask import Flask, render_template, request, jsonify, send_file
import json
import os
import random

app = Flask(__name__)

current_deck = None
viewed = set()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload():
    file = request.files.get('file')
    if file:
        try:
            data = json.load(file)
            if 'deckName' in data and 'facts' in data and isinstance(data['facts'], list) and data['facts']:
                # Save to decks/
                filename = data['deckName'].replace(' ', '_') + '.json'
                filepath = os.path.join('decks', filename)
                with open(filepath, 'w') as f:
                    json.dump(data, f)
                global current_deck, viewed
                current_deck = data
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
    if current_deck:
        return jsonify(current_deck)
    return jsonify({'error': 'No deck loaded'})

@app.route('/load_sample')
def load_sample():
    sample_path = os.path.join('decks', 'Sample_Facts.json')
    if os.path.exists(sample_path):
        with open(sample_path, 'r') as f:
            data = json.load(f)
        global current_deck, viewed
        current_deck = data
        viewed = set()
        return jsonify({'status': 'success', 'deckName': data['deckName'], 'count': len(data['facts'])})
    return jsonify({'status': 'error', 'message': 'Sample deck not found'})

@app.route('/download_sample')
def download_sample():
    sample_path = os.path.join('decks', 'Sample_Facts.json')
    if os.path.exists(sample_path):
        return send_file(sample_path, as_attachment=True, download_name='Sample_Facts.json')
    return jsonify({'error': 'Sample deck not found'})

@app.route('/next_fact')
def next_fact():
    if not current_deck:
        return jsonify({'fact': 'No deck loaded'})
    facts = current_deck['facts']
    if len(viewed) == len(facts):
        viewed.clear()
    available = [i for i in range(len(facts)) if i not in viewed]
    if not available:
        available = list(range(len(facts)))
        viewed.clear()
    index = random.choice(available)
    viewed.add(index)
    return jsonify({'fact': facts[index]})

if __name__ == '__main__':
    app.run(debug=True)