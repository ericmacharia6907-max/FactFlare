const card = document.getElementById('card');
const factText = document.getElementById('fact-text');
const exportBtn = document.getElementById('export-btn');
const statusDiv = document.getElementById('status');
const loadSampleBtn = document.getElementById('load-sample-btn');
const progressDiv = document.getElementById('progress');
const themeClassic = document.getElementById('theme-classic');
const themeDark = document.getElementById('theme-dark');
const themeNeon = document.getElementById('theme-neon');
const shareBtn = document.getElementById('share-btn');
const statsBtn = document.getElementById('stats-btn');
const studyModeSelect = document.getElementById('study-mode');
const answerButtons = document.getElementById('answer-buttons');
const factInfo = document.getElementById('fact-info');
const easeFactorSpan = document.getElementById('ease-factor');
const repetitionsSpan = document.getElementById('repetitions');
const nextReviewSpan = document.getElementById('next-review');

let totalFacts = 0;
let viewedFacts = 0;
let totalFactsAllTime = parseInt(localStorage.getItem('totalFactsAllTime')) || 0;
let decksLoaded = parseInt(localStorage.getItem('decksLoaded')) || 0;
let currentFactId = null;

// Swipe variables
let startX = 0;
let startY = 0;

card.addEventListener('click', nextFact);
exportBtn.addEventListener('click', exportDeck);
loadSampleBtn.addEventListener('click', loadSampleDeck);
themeClassic.addEventListener('click', () => setTheme('classic'));
themeDark.addEventListener('click', () => setTheme('dark'));
themeNeon.addEventListener('click', () => setTheme('neon'));
shareBtn.addEventListener('click', shareFact);
statsBtn.addEventListener('click', () => window.location.href = '/stats');
studyModeSelect.addEventListener('change', changeStudyMode);

// Answer button event listeners
document.querySelectorAll('.answer-btn').forEach(btn => {
    btn.addEventListener('click', (e) => submitAnswer(e.target.dataset.quality));
});

// Swipe events
card.addEventListener('touchstart', handleTouchStart);
card.addEventListener('touchend', handleTouchEnd);

window.onload = async () => {
    try {
        const response = await fetch('/get_status');
        const data = await response.json();
        if (data.loaded) {
            statusDiv.textContent = `Deck loaded: ${data.deckName} (${data.count} facts)`;
            exportBtn.style.display = 'inline-block';
            totalFacts = data.count;
            viewedFacts = 0;
            updateProgress();
            await nextFact(); // Load first fact
        }
    } catch (error) {
        console.error('Error checking status');
    }
};

async function nextFact() {
    try {
        const response = await fetch('/next_fact');
        const data = await response.json();
        if (data.fact) {
            // Fade out
            factText.classList.add('fade');
            setTimeout(() => {
                factText.textContent = '';
                factText.classList.remove('fade');
                factText.classList.add('show', 'typing');
                card.classList.add('flip');
                setTimeout(() => card.classList.remove('flip'), 600);
                
                // Typing effect
                let i = 0;
                const text = data.fact;
                const typeWriter = () => {
                    if (i < text.length) {
                        factText.textContent += text.charAt(i);
                        i++;
                        setTimeout(typeWriter, 50);
                    } else {
                        factText.classList.remove('typing');
                        viewedFacts++;
                        totalFactsAllTime++;
                        localStorage.setItem('totalFactsAllTime', totalFactsAllTime);
                        updateProgress();
                    }
                };
                typeWriter();
            }, 300);
        }
    } catch (error) {
        factText.textContent = 'Error loading fact';
    }
}

function updateProgress() {
    const progressFill = document.getElementById('progress-fill');
    const progressText = progressDiv.querySelector('div');
    progressText.textContent = `Facts viewed: ${viewedFacts} / ${totalFacts}`;
    const percentage = totalFacts > 0 ? (viewedFacts / totalFacts) * 100 : 0;
    progressFill.style.width = `${percentage}%`;
}

async function exportDeck() {
    try {
        const response = await fetch('/export');
        const data = await response.json();
        if (data.error) {
            statusDiv.textContent = 'No deck loaded to export';
            return;
        }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.deckName}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        statusDiv.textContent = 'Deck exported successfully';
    } catch (error) {
        statusDiv.textContent = 'Error exporting deck';
    }
}

async function loadSampleDeck() {
    try {
        const response = await fetch('/load_sample');
        const data = await response.json();
        if (data.status === 'success') {
            statusDiv.textContent = `Deck loaded: ${data.deckName} (${data.count} facts)`;
            exportBtn.style.display = 'inline-block';
            totalFacts = data.count;
            viewedFacts = 0;
            updateProgress();
            decksLoaded++;
            localStorage.setItem('decksLoaded', decksLoaded);
            playSound('success');
            await nextFact(); // Load first fact
        } else {
            statusDiv.textContent = `Error: ${data.message}`;
        }
    } catch (error) {
        statusDiv.textContent = 'Error loading sample deck';
    }
}

function setTheme(theme) {
    document.body.className = theme;
    localStorage.setItem('theme', theme);
}

// Load saved theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    setTheme(savedTheme);
}

function shareFact() {
    if (navigator.share) {
        navigator.share({
            title: 'FactFlare',
            text: factText.textContent,
            url: window.location.href
        });
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(factText.textContent).then(() => {
            statusDiv.textContent = 'Fact copied to clipboard';
        });
    }
}

function playSound(type) {
    // Assuming you have sound files, but for now, just log
    console.log(`Playing ${type} sound`);
}

// Swipe functions
function handleTouchStart(e) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
}

function handleTouchEnd(e) {
    if (!startX || !startY) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = startX - endX;
    const diffY = startY - endY;
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
        if (diffX > 0) {
            // Swipe left - next fact
            nextFact();
        } else {
            // Swipe right - maybe previous, but for now next
            nextFact();
        }
    }
    startX = 0;
    startY = 0;
}