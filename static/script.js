// Page-specific initialization
document.addEventListener('DOMContentLoaded', function() {
    const currentPage = window.location.pathname;

    if (currentPage === '/study' || currentPage === '/') {
        initializeStudyPage();
    }

    // Common functionality for all pages
    initializeCommonFeatures();

    // Ensure upload works on dashboard
    const uploadForm = document.getElementById('upload-form');
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleUpload);
    }
});

function initializeCommonFeatures() {
    // Any common functionality that should run on all pages
}

function initializeStudyPage() {
    // Study page specific initialization
    const card = document.getElementById('card');
    const factText = document.getElementById('fact-text');
    const factTextBack = document.getElementById('fact-text-back');
    const statusDiv = document.getElementById('status');
    const loadSampleBtn = document.getElementById('load-sample-btn');
    const progressDiv = document.querySelector('.progress');
    const shareBtn = document.getElementById('share-btn');
    const shuffleBtn = document.getElementById('shuffle-btn');
    const deckListDiv = document.getElementById('deck-list');

    // New feature elements
    const speakBtn = document.getElementById('speak-btn');
    const answerButtons = document.getElementById('answer-buttons');
    const toggleSessionBtn = document.getElementById('toggle-session');
    const sessionPanel = document.getElementById('session-panel');

    // Study mode elements
    const modeButtons = document.querySelectorAll('.mode-btn');

    // Session variables
    let currentFactId = null;
    let currentStudyMode = 'spaced';
    let currentSessionActive = false;

    let totalFacts = 0;
    let viewedFacts = 0;
    let totalFactsAllTime = parseInt(localStorage.getItem('totalFactsAllTime')) || 0;
    let decksLoaded = parseInt(localStorage.getItem('decksLoaded')) || 0;
    let isFlipped = false;

    // Event listeners for study page
    if (card) card.addEventListener('click', () => nextFact());
    if (loadSampleBtn) loadSampleBtn.addEventListener('click', loadSampleDeck);
    if (shareBtn) shareBtn.addEventListener('click', shareFact);
    if (shuffleBtn) shuffleBtn.addEventListener('click', toggleShuffle);
    if (speakBtn) speakBtn.addEventListener('click', speakFact);
    if (toggleSessionBtn) toggleSessionBtn.addEventListener('click', toggleSession);

    // Study mode event listeners
    modeButtons.forEach(button => {
        button.addEventListener('click', () => setStudyMode(button.dataset.mode));
    });

    // Answer quality buttons
    document.querySelectorAll('.quality-btn').forEach(button => {
        button.addEventListener('click', () => submitAnswer(button.dataset.quality));
    });

    // Session controls
    const startSessionBtn = document.getElementById('start-session');
    const endSessionBtn = document.getElementById('end-session');
    const factLimitInput = document.getElementById('fact-limit');
    const timeLimitInput = document.getElementById('time-limit');
    const tagFilterInput = document.getElementById('tag-filter');

    if (startSessionBtn) startSessionBtn.addEventListener('click', startCustomSession);
    if (endSessionBtn) endSessionBtn.addEventListener('click', endSession);

    // Load initial deck list
    loadDeckList();

    // Load initial status
    updateStatus();

    // Study functions (moved inside the function scope)
    async function speakFact() {
        const text = isFlipped ? factTextBack.textContent : factText.textContent;
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.8;
            utterance.pitch = 1;
            utterance.volume = 0.8;

            // Try to find an English voice
            const voices = speechSynthesis.getVoices();
            const englishVoice = voices.find(voice => voice.lang.startsWith('en'));
            if (englishVoice) {
                utterance.voice = englishVoice;
            }

        } catch (error) {
            console.error('Error loading next fact:', error);
            statusDiv.textContent = 'Error loading fact';
        }
    }

    function updateProgress() {
        const progressFill = document.getElementById('progress-fill');
        const viewedCount = document.getElementById('viewed-count');
        const totalCount = document.getElementById('total-count');

        if (viewedCount && totalCount) {
            viewedCount.textContent = viewedFacts;
            totalCount.textContent = totalFacts;
        }

        if (progressFill) {
            const percentage = totalFacts > 0 ? (viewedFacts / totalFacts) * 100 : 0;
            progressFill.style.width = `${percentage}%`;
        }
    }

    async function loadSampleDeck() {
        try {
            const response = await fetch('/load_sample');
            const data = await response.json();

            if (data.status === 'success') {
                totalFacts = data.total_facts;
                viewedFacts = 0;
                updateProgress();
                statusDiv.textContent = `Loaded sample deck with ${totalFacts} facts`;
                document.getElementById('study-interface').style.display = 'block';
                nextFact();
            } else {
                statusDiv.textContent = 'Error loading sample deck';
            }
        } catch (error) {
            console.error('Error loading sample deck:', error);
            statusDiv.textContent = 'Error loading sample deck';
        }
    }

    async function loadDeckList() {
        try {
            const response = await fetch('/list_decks');
            const decks = await response.json();

            if (deckListDiv) {
                deckListDiv.innerHTML = '';

                if (decks.length === 0) {
                    deckListDiv.innerHTML = '<p>No decks saved yet.</p>';
                    return;
                }

                decks.forEach(deck => {
                    const deckItem = document.createElement('button');
                    deckItem.className = 'btn';
                    deckItem.textContent = deck.name;
                    deckItem.onclick = () => loadDeck(deck.name);
                    deckListDiv.appendChild(deckItem);
                });
            }
        } catch (error) {
            console.error('Error loading decks:', error);
        }
    }

    async function loadDeck(deckName) {
        try {
            const response = await fetch(`/get_deck/${deckName}`);
            const data = await response.json();

            if (data.status === 'success') {
                totalFacts = data.total_facts;
                viewedFacts = 0;
                updateProgress();
                statusDiv.textContent = `Loaded deck: ${deckName}`;
                document.getElementById('study-interface').style.display = 'block';
                nextFact();
            } else {
                statusDiv.textContent = 'Error loading deck';
            }
        } catch (error) {
            console.error('Error loading deck:', error);
            statusDiv.textContent = 'Error loading deck';
        }
    }

    function toggleShuffle() {
        shuffle_mode = !shuffle_mode;
        shuffleBtn.textContent = `Shuffle: ${shuffle_mode ? 'On' : 'Off'}`;
        statusDiv.textContent = `Shuffle ${shuffle_mode ? 'enabled' : 'disabled'}`;
    }

    function shareFact() {
        const text = isFlipped ? factTextBack.textContent : factText.textContent;
        if (navigator.share) {
            navigator.share({
                title: 'FactFlare Fact',
                text: text,
            });
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(text).then(() => {
                statusDiv.textContent = 'Fact copied to clipboard!';
            });
        }
    }

    function toggleSession() {
        if (sessionPanel) {
            sessionPanel.classList.toggle('hidden');
        }
    }

    async function startCustomSession() {
        const factLimit = parseInt(document.getElementById('fact-limit').value) || null;
        const timeLimit = parseInt(document.getElementById('time-limit').value) || null;
        const tagFilter = document.getElementById('tag-filter').value.trim() || null;

        // Implementation for custom session would go here
        statusDiv.textContent = 'Custom session started';
        currentSessionActive = true;
        document.getElementById('start-session').classList.add('hidden');
        document.getElementById('end-session').classList.remove('hidden');
    }

    function endSession() {
        statusDiv.textContent = 'Session ended';
        currentSessionActive = false;
        document.getElementById('start-session').classList.remove('hidden');
        document.getElementById('end-session').classList.add('hidden');
    }

    async function updateStatus() {
        try {
            const response = await fetch('/get_status');
            const data = await response.json();

            if (data.total_facts !== undefined) {
                totalFacts = data.total_facts;
                updateProgress();
            }
        } catch (error) {
            console.error('Error updating status:', error);
        }
    }

    async function checkAchievements() {
        try {
            const response = await fetch('/get_achievements');
            const data = await response.json();

            data.achievements.forEach(achievement => {
                if (achievement.unlocked && !achievement.notified) {
                    showAchievementNotification(achievement);
                }
            });
        } catch (error) {
            console.error('Error checking achievements:', error);
        }
    }

    function showAchievementNotification(achievement) {
        // Implementation for achievement notifications would go here
        statusDiv.textContent = `Achievement unlocked: ${achievement.name}!`;
    }
}

// Remove old global event listeners that are now handled in initializeStudyPage
// New feature event listeners
if (document.getElementById('speak-btn')) document.getElementById('speak-btn').addEventListener('click', speakFact);
if (document.getElementById('toggle-achievements')) document.getElementById('toggle-achievements').addEventListener('click', toggleAchievements);
if (document.getElementById('toggle-analytics')) document.getElementById('toggle-analytics').addEventListener('click', toggleAnalytics);
if (document.getElementById('toggle-session')) document.getElementById('toggle-session').addEventListener('click', toggleSession);
if (document.getElementById('toggle-tags')) document.getElementById('toggle-tags').addEventListener('click', toggleTags);

// Study mode buttons
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => setStudyMode(btn.dataset.mode));
});

// Answer quality buttons (dynamically added)
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('quality-btn')) {
        submitAnswer(parseInt(e.target.dataset.quality));
    }
});

// Tag management
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('tag-filter')) {
        filterByTag(e.target.textContent);
    }
});

if (document.getElementById('add-tags')) {
    document.getElementById('add-tags').addEventListener('click', addTagsToFact);
}

if (document.getElementById('start-session')) {
    document.getElementById('start-session').addEventListener('click', startCustomSession);
}

if (document.getElementById('end-session')) {
    document.getElementById('end-session').addEventListener('click', endSession);
}
            currentStudyMode = mode;
            // Update UI
            modeButtons.forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.mode === mode) {
                    btn.classList.add('active');
                }
            });
            statusDiv.textContent = `Study mode set to: ${mode}`;
            
            // Show/hide answer buttons based on mode
            if (mode === 'spaced') {
                answerButtons.style.display = 'block';
            } else {
                answerButtons.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error setting study mode:', error);
    }
}

// Answer Quality Submission (Spaced Repetition)
async function submitAnswer(quality) {
    if (!currentFactId) return;
    
    try {
        const response = await fetch(`/submit_answer/${currentFactId}/${quality}`);
        const data = await response.json();
        if (data.status === 'success') {
            // Hide answer buttons temporarily
            answerButtons.style.display = 'none';
            // Continue to next fact
            setTimeout(() => nextFact(), 500);
        }
    } catch (error) {
        console.error('Error submitting answer:', error);
    }
}

// UI Toggle Functions
function toggleAchievements() {
    if (achievementsPanel.classList.contains('hidden')) {
        achievementsPanel.classList.remove('hidden');
        toggleAchievementsBtn.textContent = 'Hide Achievements & Progress';
        loadAchievements();
    } else {
        achievementsPanel.classList.add('hidden');
        toggleAchievementsBtn.textContent = 'Achievements & Progress';
    }
}

function toggleAnalytics() {
    if (analyticsPanel.classList.contains('hidden')) {
        analyticsPanel.classList.remove('hidden');
        toggleAnalyticsBtn.textContent = 'Hide Study Analytics';
        loadAnalytics();
    } else {
        analyticsPanel.classList.add('hidden');
        toggleAnalyticsBtn.textContent = 'Study Analytics';
    }
}

function toggleSession() {
    if (sessionPanel.classList.contains('hidden')) {
        sessionPanel.classList.remove('hidden');
        toggleSessionBtn.textContent = 'Hide Custom Session';
    } else {
        sessionPanel.classList.add('hidden');
        toggleSessionBtn.textContent = 'Custom Session';
    }
}

function toggleTags() {
    if (tagsPanel.classList.contains('hidden')) {
        tagsPanel.classList.remove('hidden');
        toggleTagsBtn.textContent = 'Hide Tag Management';
        loadTags();
    } else {
        tagsPanel.classList.add('hidden');
        toggleTagsBtn.textContent = 'Manage Tags';
    }
}
    try {
        const response = await fetch('/get_study_stats');
        const data = await response.json();
        
        document.getElementById('total-facts').textContent = data.total_facts;
        document.getElementById('reviewed-facts').textContent = data.reviewed_facts;
        document.getElementById('due-facts').textContent = data.due_facts;
        document.getElementById('new-facts').textContent = data.new_facts;
        document.getElementById('avg-ease').textContent = data.avg_ease_factor;
        
        // Display recent sessions
        const sessionsList = document.getElementById('sessions-list');
        sessionsList.innerHTML = '';
        data.study_sessions.forEach(session => {
            const sessionDiv = document.createElement('div');
            sessionDiv.className = 'session-item';
            sessionDiv.innerHTML = `
                <h5>${session.mode.charAt(0).toUpperCase() + session.mode.slice(1)} Session</h5>
                <p>Started: ${new Date(session.start_time).toLocaleString()}</p>
                <p>Facts Studied: ${session.facts_studied}</p>
                <p>Accuracy: ${session.accuracy}%</p>
            `;
            sessionsList.appendChild(sessionDiv);
        });
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

async function loadTags() {
    try {
        // Load current fact tags
        if (currentFactId) {
            const response = await fetch(`/get_fact_details/${currentFactId}`);
            const data = await response.json();
            displayFactTags(data.tags);
        }
        
        // Load all available tags
        const tagsResponse = await fetch('/get_tags');
        const tagsData = await tagsResponse.json();
        displayAvailableTags(tagsData.tags);
    } catch (error) {
        console.error('Error loading tags:', error);
    }
}

function displayFactTags(tags) {
    const tagsContainer = document.getElementById('fact-tags');
    tagsContainer.innerHTML = '';
    tags.forEach(tag => {
        const tagSpan = document.createElement('span');
        tagSpan.className = 'tag';
        tagSpan.textContent = tag;
        tagsContainer.appendChild(tagSpan);
    });
}

function displayAvailableTags(tags) {
    const tagsContainer = document.getElementById('tag-list');
    tagsContainer.innerHTML = '';
    tags.forEach(tag => {
        const tagBtn = document.createElement('button');
        tagBtn.className = 'tag-filter';
        tagBtn.textContent = tag;
        tagsContainer.appendChild(tagBtn);
    });
}

// Tag Management Functions
async function addTagsToFact() {
    if (!currentFactId) {
        alert('No fact currently displayed');
        return;
    }
    
    const tagInput = document.getElementById('tag-input');
    const tags = tagInput.value.split(',').map(t => t.trim()).filter(t => t);
    
    if (tags.length === 0) {
        alert('Please enter at least one tag');
        return;
    }
    
    try {
        const response = await fetch(`/update_fact_tags/${currentFactId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ tags: tags })
        });
        
        const data = await response.json();
        if (data.status === 'success') {
            tagInput.value = '';
            loadTags(); // Refresh tags display
            statusDiv.textContent = 'Tags added successfully';
        }
    } catch (error) {
        console.error('Error adding tags:', error);
    }
}

async function filterByTag(tag) {
    // This would require modifying the backend to support tag filtering
    // For now, just show a message
    statusDiv.textContent = `Filtering by tag: ${tag} (feature coming soon)`;
}

// Custom Session Functions
async function startCustomSession() {
    const factLimit = document.getElementById('fact-limit').value;
    const timeLimit = document.getElementById('time-limit').value;
    const tagFilter = document.getElementById('tag-filter').value;
    
    const tags = tagFilter ? tagFilter.split(',').map(t => t.trim()) : [];
    
    try {
        const response = await fetch('/create_custom_session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                mode: currentStudyMode,
                fact_limit: factLimit ? parseInt(factLimit) : null,
                time_limit: timeLimit ? parseInt(timeLimit) : null,
                tags: tags
            })
        });
        
        const data = await response.json();
        if (data.status === 'success') {
            currentSessionActive = true;
            document.getElementById('start-session').style.display = 'none';
            document.getElementById('end-session').style.display = 'inline-block';
            statusDiv.textContent = 'Custom session started';
            updateSessionProgress();
        }
    } catch (error) {
        console.error('Error starting session:', error);
    }
}

async function endSession() {
    try {
        const response = await fetch('/end_session');
        const data = await response.json();
        if (data.status === 'success') {
            currentSessionActive = false;
            document.getElementById('start-session').style.display = 'inline-block';
            document.getElementById('end-session').style.display = 'none';
            document.getElementById('session-progress').classList.add('hidden');
            statusDiv.textContent = `Session ended - ${data.session.facts_studied} facts studied, ${data.session.accuracy}% accuracy`;
        }
    } catch (error) {
        console.error('Error ending session:', error);
    }
}

async function updateSessionProgress() {
    if (!currentSessionActive) return;
    
    try {
        const response = await fetch('/get_session_progress');
        const data = await response.json();
        
        const progressDiv = document.getElementById('session-progress');
        progressDiv.innerHTML = `
            <p><strong>Session Progress</strong></p>
            <p>Facts Studied: ${data.facts_studied}</p>
            <p>Correct Answers: ${data.correct_answers}</p>
            <p>Accuracy: ${data.accuracy}%</p>
        `;
        progressDiv.classList.remove('hidden');
    } catch (error) {
        console.error('Error updating session progress:', error);
    }
}

// Initialize speech synthesis voices
if ('speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = () => {
        // Voices loaded
    };
}

// Initialize
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
        } else {
            factText.textContent = 'Load a deck to get started';
            statusDiv.textContent = 'No deck loaded';
        }
        await loadDeckLibrary();
        await loadAchievements(); // Load achievements
        
        // Initialize study mode UI
        setStudyMode(currentStudyMode);
        
        // Hide answer buttons initially
        if (answerButtons) answerButtons.style.display = 'none';
        
    } catch (error) {
        console.error('Error initializing:', error);
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
            statusDiv.textContent = `Deck uploaded: ${data.deckName} (${data.count} facts)`;
            exportBtn.style.display = 'inline-block';
            totalFacts = data.count;
            viewedFacts = 0;
            updateProgress();
            decksLoaded++;
            localStorage.setItem('decksLoaded', decksLoaded);
            await loadDeckLibrary();
            await nextFact(); // Load first fact
        } else {
            statusDiv.textContent = `Error: ${data.message}`;
        }
    } catch (error) {
        statusDiv.textContent = 'Error uploading file';
    }
}

// UI Toggle Functions
                    factImageBack.appendChild(img.cloneNode());
                } else {
                    factImage.appendChild(img);
                }
            }
            
            // 3D Flip animation
            card.classList.add('flipped');
            setTimeout(() => {
                if (isFlipped) {
                    factTextBack.textContent = data.fact;
                } else {
                    factText.textContent = data.fact;
                }
                isFlipped = !isFlipped;
                card.classList.remove('flipped');
            }, 400);

            viewedFacts++;
            totalFactsAllTime++;
            localStorage.setItem('totalFactsAllTime', totalFactsAllTime);
            updateProgress();
            
            // Show answer buttons for spaced repetition mode
            if (currentStudyMode === 'spaced') {
                setTimeout(() => {
                    answerButtons.style.display = 'block';
                }, 600);
            }
            
            // Update session progress if active
            if (currentSessionActive) {
                updateSessionProgress();
            }
            
            // Load tags for current fact
            if (tagsPanel && !tagsPanel.classList.contains('hidden')) {
                loadTags();
            }
            
            playSound('flip');
            
            // Handle achievements
            if (data.new_achievements && data.new_achievements.length > 0) {
                setTimeout(() => {
                    data.new_achievements.forEach(achievement => {
                        showAchievementNotification(achievement);
                    });
                    // Reload achievements after showing notifications
                    setTimeout(() => loadAchievements(), 1000);
                }, 1000);
            }
        } else {
            factText.textContent = 'No deck loaded';
            factTextBack.textContent = 'No deck loaded';
            currentFactId = null;
            answerButtons.style.display = 'none';
        }
    } catch (error) {
        console.error('Error fetching fact:', error);
        factText.textContent = 'Error loading fact';
        factTextBack.textContent = 'Error loading fact';
        currentFactId = null;
        answerButtons.style.display = 'none';
    }
}

function updateProgress() {
    const progressFill = document.getElementById('progress-fill');
    const viewedCount = document.getElementById('viewed-count');
    const totalCount = document.getElementById('total-count');
    viewedCount.textContent = viewedFacts;
    totalCount.textContent = totalFacts;
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
            await loadDeckLibrary();
            await nextFact(); // Load first fact
        } else {
            statusDiv.textContent = `Error: ${data.message}`;
        }
    } catch (error) {
        statusDiv.textContent = 'Error loading sample deck';
    }
}

async function toggleShuffle() {
    try {
        const response = await fetch('/toggle_shuffle');
        const data = await response.json();
        shuffleBtn.textContent = `Shuffle: ${data.shuffle ? 'On' : 'Off'}`;
        statusDiv.textContent = `Shuffle mode ${data.shuffle ? 'enabled' : 'disabled'}`;
    } catch (error) {
        statusDiv.textContent = 'Error toggling shuffle';
    }
}

function toggleDeckManagement() {
    if (deckMgmtPanel.classList.contains('hidden')) {
        deckMgmtPanel.classList.remove('hidden');
        toggleDeckMgmtBtn.textContent = 'Hide Deck Management';
    } else {
        deckMgmtPanel.classList.add('hidden');
        toggleDeckMgmtBtn.textContent = 'Deck Management';
    }
}

async function loadDeckLibrary() {
    try {
        const response = await fetch('/list_decks');
        const decks = await response.json();
        deckListDiv.innerHTML = '';
        decks.forEach((deck) => {
            const container = document.createElement('div');
            const loadBtn = document.createElement('button');
            loadBtn.textContent = deck.replace(/_/g, ' ');
            loadBtn.className = 'btn glow-btn';
            loadBtn.onclick = () => loadSpecificDeck(deck);

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.className = 'btn glow-btn';
            deleteBtn.style.backgroundColor = '#dc3545';
            deleteBtn.onclick = () => deleteDeck(deck);

            container.appendChild(loadBtn);
            container.appendChild(deleteBtn);
            deckListDiv.appendChild(container);
        });
    } catch (error) {
        deckListDiv.innerHTML = 'Error loading decks';
    }
}

async function loadSpecificDeck(deckName) {
    try {
        const response = await fetch(`/get_deck/${encodeURIComponent(deckName)}`);
        const data = await response.json();
        if (data.error) {
            statusDiv.textContent = `Error: ${data.error}`;
        } else {
            statusDiv.textContent = `Deck loaded: ${data.deckName}`;
            totalFacts = data.facts.length;
            viewedFacts = 0;
            updateProgress();
            await nextFact(); // Load first fact
        }
    } catch (error) {
        statusDiv.textContent = 'Error loading deck';
    }
}

async function deleteDeck(deckName) {
    if (confirm(`Are you sure you want to delete the deck "${deckName}"? This action cannot be undone.`)) {
        try {
            const response = await fetch(`/delete_deck/${encodeURIComponent(deckName)}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.status === 'success') {
                alert(data.message);
                await loadDeckLibrary(); // Refresh the list
            } else {
                alert(`Error: ${data.message}`);
            }
        } catch (error) {
            alert('Error deleting deck');
        }
    }
}

function shareFact() {
    const currentFact = isFlipped ? factTextBack.textContent : factText.textContent;
    if (navigator.share) {
        navigator.share({
            title: 'FactFlare',
            text: currentFact,
            url: window.location.href
        });
    } else {
        navigator.clipboard.writeText(currentFact).then(() => {
            statusDiv.textContent = 'Fact copied to clipboard';
        });
    }
}

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


// Ensure handleUpload is globally available before any event listeners are attached
async function handleUpload(e) {
    e.preventDefault();
    const uploadForm = document.getElementById('upload-form');
    const statusDiv = document.getElementById('status');
    const exportBtn = document.getElementById('export-btn');
    let totalFacts = 0;
    let viewedFacts = 0;
    let decksLoaded = parseInt(localStorage.getItem('decksLoaded')) || 0;
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
            // updateProgress(); // If you have a global updateProgress, call it here
            decksLoaded++;
            localStorage.setItem('decksLoaded', decksLoaded);
            if (typeof playSound === 'function') playSound('success');
            if (typeof nextFact === 'function') await nextFact(); // Load first fact
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
            const container = document.createElement('div');
            container.style.display = 'flex';
            container.style.alignItems = 'center';
            container.style.marginBottom = '10px';
            
            const btn = document.createElement('button');
            btn.textContent = deck.replace('_', ' ');
            btn.onclick = () => loadSpecificDeck(deck);
            btn.style.flex = '1';
            btn.style.opacity = '0';
            btn.style.transform = 'translateY(20px)';
            btn.style.transition = 'all 0.3s ease';
            
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.style.marginLeft = '10px';
            deleteBtn.style.backgroundColor = '#dc3545';
            deleteBtn.style.color = 'white';
            deleteBtn.style.border = 'none';
            deleteBtn.style.padding = '5px 10px';
            deleteBtn.style.borderRadius = '4px';
            deleteBtn.style.cursor = 'pointer';
            deleteBtn.onclick = () => deleteDeck(deck);
            deleteBtn.style.opacity = '0';
            deleteBtn.style.transform = 'translateY(20px)';
            deleteBtn.style.transition = 'all 0.3s ease';
            
            container.appendChild(btn);
            container.appendChild(deleteBtn);
            deckListDiv.appendChild(container);
            
            // Staggered animation
            setTimeout(() => {
                btn.style.opacity = '1';
                btn.style.transform = 'translateY(0)';
                deleteBtn.style.opacity = '1';
                deleteBtn.style.transform = 'translateY(0)';
            }, index * 100);
        });
    } catch (error) {
        deckListDiv.innerHTML = 'Error loading decks';
    }
}

async function deleteDeck(deckName) {
    if (confirm(`Are you sure you want to delete the deck "${deckName}"? This action cannot be undone.`)) {
        try {
            const response = await fetch(`/delete_deck/${encodeURIComponent(deckName)}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.status === 'success') {
                alert(data.message);
                await loadDeckLibrary(); // Refresh the list
            } else {
                alert(`Error: ${data.message}`);
            }
        } catch (error) {
            alert('Error deleting deck');
        }
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

// Achievement System Functions
async function loadAchievements() {
    try {
        const [progressResponse, achievementsResponse, userAchievementsResponse] = await Promise.all([
            fetch('/get_progress'),
            fetch('/get_achievements'),
            fetch('/get_user_achievements')
        ]);

        const progress = await progressResponse.json();
        const allAchievements = await achievementsResponse.json();
        const userAchievements = await userAchievementsResponse.json();

        updateProgressStats(progress);
        displayAchievements(allAchievements, userAchievements);
    } catch (error) {
        console.error('Error loading achievements:', error);
    }
}

function updateProgressStats(progress) {
    document.getElementById('current-streak').textContent = progress.current_streak;
    document.getElementById('longest-streak').textContent = progress.longest_streak;
    document.getElementById('total-xp').textContent = progress.total_xp;
    document.getElementById('facts-viewed').textContent = progress.facts_viewed;
    document.getElementById('decks-completed').textContent = progress.decks_completed;
}

function displayAchievements(allAchievements, userAchievements) {
    const userAchievementsDiv = document.getElementById('user-achievements');
    const allAchievementsDiv = document.getElementById('all-achievements');

    // Clear existing content
    userAchievementsDiv.innerHTML = '';
    allAchievementsDiv.innerHTML = '';

    // Display user's unlocked achievements
    userAchievements.forEach(achievement => {
        const achievementDiv = createAchievementElement(achievement, true);
        userAchievementsDiv.appendChild(achievementDiv);
    });

    // Display all available achievements
    allAchievements.forEach(achievement => {
        const isUnlocked = userAchievements.some(ua => ua.id === achievement.id);
        const achievementDiv = createAchievementElement(achievement, isUnlocked);
        allAchievementsDiv.appendChild(achievementDiv);
    });
}

function createAchievementElement(achievement, isUnlocked) {
    const div = document.createElement('div');
    div.className = `achievement-item ${isUnlocked ? 'unlocked' : 'locked'}`;

    div.innerHTML = `
        <div class="achievement-icon">${achievement.icon}</div>
        <div class="achievement-name">${achievement.name}</div>
        <div class="achievement-desc">${achievement.description}</div>
        <div class="achievement-xp">${achievement.xp} XP</div>
    `;

    return div;
}

function showAchievementNotification(achievement) {
    const popup = document.createElement('div');
    popup.className = 'achievement-popup';
    popup.id = 'achievement-popup';

    popup.innerHTML = `
        <div class="achievement-content">
            <div id="achievement-icon">${achievement.icon}</div>
            <div id="achievement-title">${achievement.name}</div>
            <div id="achievement-desc">${achievement.description}</div>
            <div id="achievement-xp">+${achievement.xp} XP</div>
        </div>
    `;

    document.body.appendChild(popup);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (popup.parentNode) {
            popup.parentNode.removeChild(popup);
        }
    }, 5000);

    // Play achievement sound
    playSound('achievement');
}

// Update nextFact to handle achievements
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

            // Handle achievements
            if (data.new_achievements && data.new_achievements.length > 0) {
                setTimeout(() => {
                    data.new_achievements.forEach(achievement => {
                        showAchievementNotification(achievement);
                    });
                    // Reload achievements after showing notifications
                    setTimeout(() => loadAchievements(), 1000);
                }, 1000);
            }
        }
    } catch (error) {
        console.error('Error fetching fact');
    }
}

// Add achievement sound
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
    } else if (type === 'achievement') {
        // Achievement fanfare sound
        oscillator.frequency.setValueAtTime(523, audioContext.currentTime); // C5
        oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1); // E5
        oscillator.frequency.setValueAtTime(784, audioContext.currentTime + 0.2); // G5
        oscillator.frequency.setValueAtTime(1047, audioContext.currentTime + 0.3); // C6
        gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    }
}

// Initialize achievements on page load
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
        await loadAchievements(); // Load achievements
    } catch (error) {
        console.error('Error initializing:', error);
    }
};