const deckListDiv = document.getElementById('deck-list');
const statusDiv = document.getElementById('status');

window.onload = async () => {
    await loadDeckLibrary();
};

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

async function loadSpecificDeck(deckName) {
    try {
        const response = await fetch(`/get_deck/${encodeURIComponent(deckName)}`);
        const data = await response.json();
        if (data.error) {
            statusDiv.textContent = `Error: ${data.error}`;
        } else {
            statusDiv.textContent = `Deck loaded: ${data.deckName}`;
            // Redirect to home to start using the deck
            window.location.href = '/home';
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