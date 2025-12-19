const uploadForm = document.getElementById('upload-form');
const statusDiv = document.getElementById('status');
const fileInput = document.getElementById('file-input');

fileInput.addEventListener('change', function() {
    if (fileInput.files.length > 0) {
        statusDiv.textContent = `Selected file: ${fileInput.files[0].name}`;
    } else {
        statusDiv.textContent = '';
    }
});

uploadForm.addEventListener('submit', handleUpload);

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
            // Optionally redirect to home or show success
            setTimeout(() => window.location.href = '/home', 2000);
        } else {
            statusDiv.textContent = `Error: ${data.message}`;
        }
    } catch (error) {
        statusDiv.textContent = 'Error uploading file';
    }
}