# FactFlare - Production-Quality Flashcard Web App

A visually stunning, interactive flashcard application built with Flask, featuring smooth 3D animations, glowing effects, and a clean professional interface.

## 🚀 Features

### Core Functionality
- **Interactive Flashcards**: Click to reveal facts with smooth 3D flip animations
- **Deck Management**: Upload, export, and delete custom decks
- **Shuffle Mode**: Optional random fact ordering
- **Progress Tracking**: Visual progress bar and fact counters
- **Share Facts**: Native sharing or clipboard copy
- **Responsive Design**: Works on desktop and mobile

### Visual Design
- **Gothic Typography**: Cinzel font for headings, modern sans-serif for body
- **Animated Background**: Shifting gradient with ambient effects
- **Glowing Card Effects**: Pulsing neon borders with gradient transitions
- **Smooth Animations**: CSS keyframes and transitions throughout
- **Professional UI**: Glassmorphism design with backdrop blur

## 🛠️ Tech Stack

- **Backend**: Flask (Python)
- **Database**: PostgreSQL with SQLAlchemy
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Deployment**: Ready for Render/Heroku with Gunicorn

## 📁 Project Structure

```
factflare/
├── app.py                 # Flask application
├── Procfile              # Render deployment config
├── requirements.txt      # Python dependencies
├── templates/
│   └── index.html        # Main application template
├── static/
│   ├── style.css         # Production CSS with animations
│   └── script.js         # Vanilla JS functionality
└── decks/                # Sample deck storage
```

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- PostgreSQL database

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd factflare
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up database**
   - Create a PostgreSQL database
   - Update `DATABASE_URL` in `app.py` or set environment variable

4. **Run the application**
   ```bash
   python app.py
   ```

5. **Open in browser**
   ```
   http://127.0.0.1:5000
   ```

## 📤 Deployment

### Render Deployment
1. Connect your GitHub repository to Render
2. Set build command: `pip install -r requirements.txt`
3. Set start command: `gunicorn app:app`
4. Add environment variable: `DATABASE_URL` (your PostgreSQL connection string)

### Local Production
```bash
gunicorn app:app
```

## 🎨 Design Philosophy

- **Minimal Clutter**: Centered layout with focused functionality
- **Premium Feel**: Glassmorphism, gradients, and micro-interactions
- **Smooth UX**: No abrupt changes, everything animated
- **Accessibility**: Responsive design, clear typography, keyboard navigation

## 📊 API Endpoints

- `GET /` - Main application
- `POST /upload` - Upload deck JSON
- `GET /export` - Export current deck
- `DELETE /delete_deck/<name>` - Delete deck
- `GET /next_fact` - Get next fact
- `GET /get_status` - Current deck status
- `GET /list_decks` - List all decks
- `GET /get_deck/<name>` - Load specific deck
- `GET /toggle_shuffle` - Toggle shuffle mode

## 🎯 Deck Format

```json
{
  "deckName": "My Amazing Facts",
  "facts": [
    "Fact 1: Something interesting",
    "Fact 2: Another cool fact",
    "Fact 3: Mind-blowing information"
  ]
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Flask framework for the robust backend
- CSS animations inspired by modern web design trends
- PostgreSQL for reliable data persistence

---

**FactFlare** - Where knowledge meets stunning visuals ✨