const card = document.getElementById('card');
const factText = document.getElementById('fact-text');
const uploadForm = document.getElementById('upload-form');
const exportBtn = document.getElementById('export-btn');
const statusDiv = document.getElementById('status');

uploadForm.addEventListener('submit', handleUpload);
card.addEventListener('click', nextFact);
exportBtn.addEventListener('click', exportDeck);

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
                factText.textContent = data.fact;
                factText.classList.remove('fade');
                factText.classList.add('show');
            }, 250);
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
    } catch (error) {
        alert('Error exporting deck');
    }
}