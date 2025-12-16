const card = document.getElementById('card');
const factText = document.getElementById('fact-text');
const uploadForm = document.getElementById('upload-form');
const exportBtn = document.getElementById('export-btn');
const statusDiv = document.getElementById('status');
const loadSampleBtn = document.getElementById('load-sample-btn');
const progressDiv = document.getElementById('progress');
const themeClassic = document.getElementById('theme-classic');
const themeDark = document.getElementById('theme-dark');
const themeNeon = document.getElementById('theme-neon');
const shareBtn = document.getElementById('share-btn');
const statsBtn = document.getElementById('stats-btn');
const statsDiv = document.getElementById('stats');
const toggleDeckLibraryBtn = document.getElementById('toggle-deck-library');
const deckLibraryDiv = document.getElementById('deck-library');
const deckListDiv = document.getElementById('deck-list');

let totalFacts = 0;
let viewedFacts = 0;
let totalFactsAllTime = parseInt(localStorage.getItem('totalFactsAllTime')) || 0;
let decksLoaded = parseInt(localStorage.getItem('decksLoaded')) || 0;

// Swipe variables
let startX = 0;
let startY = 0;

uploadForm.addEventListener('submit', handleUpload);
card.addEventListener('click', nextFact);
exportBtn.addEventListener('click', exportDeck);
loadSampleBtn.addEventListener('click', loadSampleDeck);
themeClassic.addEventListener('click', () => setTheme('classic'));
themeDark.addEventListener('click', () => setTheme('dark'));
themeNeon.addEventListener('click', () => setTheme('neon'));
shareBtn.addEventListener('click', shareFact);
statsBtn.addEventListener('click', showStats);
toggleDeckLibraryBtn.addEventListener('click', toggleDeckLibrary);

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

async function handleUpload(e) {
    e.preventDefault();
    const formData = new FormData(uploadForm);
    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
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
        statusDiv.textContent = 'Error uploading file';
    }
}

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
                        setTimeout(typeWriter, 30);
                    } else {
                        factText.classList.remove('typing');
                    }
                };
                typeWriter();
            }, 250);
            viewedFacts++;
            totalFactsAllTime++;
            localStorage.setItem('totalFactsAllTime', totalFactsAllTime);
            updateProgress();
            playSound('flip');
        }
    } catch (error) {
        console.error('Error fetching fact');
    }
}

async function exportDeck() {
    try {
        const response = await fetch('/export');
        const data = await response.json();
        if (data.error) {
            alert(data.error);
            return;
        }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.deckName.replace(' ', '_')}.json`;
        a.click();
        URL.revokeObjectURL(url);
        playSound('success');
    } catch (error) {
        alert('Error exporting deck');
    }
}

function updateProgress() {
    const percentage = totalFacts > 0 ? (viewedFacts / totalFacts) * 100 : 0;
    const progressFill = document.getElementById('progress-fill');
    progressFill.style.width = `${percentage}%`;
    progressDiv.querySelector('div:first-child').textContent = `Facts viewed: ${viewedFacts} / ${totalFacts}`;
}

function setTheme(theme) {
    document.body.className = theme;
    localStorage.setItem('theme', theme);
}

// Load saved theme
const savedTheme = localStorage.getItem('theme') || 'classic';
setTheme(savedTheme);

function playSound(type) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (type === 'flip') {
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    } else if (type === 'success') {
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    }
}

function shareFact() {
    const fact = factText.textContent;
    if (navigator.share) {
        navigator.share({
            title: 'Fact from FactFlare',
            text: fact,
        });
    } else {
        navigator.clipboard.writeText(fact).then(() => {
            alert('Fact copied to clipboard!');
        });
    }
}

function showStats() {
    statsDiv.innerHTML = `
        <h3>Your Stats</h3>
        <p>Total Facts Viewed: ${totalFactsAllTime}</p>
        <p>Decks Loaded: ${decksLoaded}</p>
    `;
    if (statsDiv.style.display === 'none' || statsDiv.style.display === '') {
        statsDiv.style.display = 'block';
        setTimeout(() => statsDiv.classList.add('show'), 10);
    } else {
        statsDiv.classList.remove('show');
        setTimeout(() => statsDiv.style.display = 'none', 300);
    }
}

async function toggleDeckLibrary() {
    if (deckLibraryDiv.style.display === 'none' || deckLibraryDiv.style.display === '') {
        await loadDeckLibrary();
        deckLibraryDiv.style.display = 'block';
        setTimeout(() => deckLibraryDiv.classList.add('show'), 10);
    } else {
        deckLibraryDiv.classList.remove('show');
        setTimeout(() => deckLibraryDiv.style.display = 'none', 300);
    }
}

async function loadDeckLibrary() {
    try {
        const response = await fetch('/list_decks');
        const decks = await response.json();
        deckListDiv.innerHTML = '';
        decks.forEach((deck, index) => {
            const btn = document.createElement('button');
            btn.textContent = deck.replace('_', ' ');
            btn.onclick = () => loadSpecificDeck(deck);
            btn.style.opacity = '0';
            btn.style.transform = 'translateY(20px)';
            btn.style.transition = 'all 0.3s ease';
            deckListDiv.appendChild(btn);
            
            // Staggered animation
            setTimeout(() => {
                btn.style.opacity = '1';
                btn.style.transform = 'translateY(0)';
            }, index * 100);
        });
    } catch (error) {
        deckListDiv.innerHTML = 'Error loading decks';
    }
}

async function loadSpecificDeck(deckName) {
    const btn = event.target;
    const originalText = btn.textContent;
    btn.innerHTML = '<div class="loading"></div>Loading...';
    btn.disabled = true;
    
    try {
        const response = await fetch(`/get_deck/${deckName}`);
        const data = await response.json();
        if (data.error) {
            alert(data.error);
            return;
        }
        // Simulate loading
        current_deck = data;
        viewed = set();
        statusDiv.textContent = `Deck loaded: ${data.deckName} (${data.facts.length} facts)`;
        exportBtn.style.display = 'inline-block';
        totalFacts = data.facts.length;
        viewedFacts = 0;
        updateProgress();
        decksLoaded++;
        localStorage.setItem('decksLoaded', decksLoaded);
        playSound('success');
        await nextFact();
    } catch (error) {
        alert('Error loading deck');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

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
            // Swipe left
            nextFact();
        } else {
            // Swipe right, maybe previous, but since random, just next
            nextFact();
        }
    }
    startX = 0;
    startY = 0;
}

async function loadSampleDeck() {
    const btn = loadSampleBtn;
    const originalText = btn.textContent;
    btn.innerHTML = '<div class="loading"></div>Loading...';
    btn.disabled = true;
    
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
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}