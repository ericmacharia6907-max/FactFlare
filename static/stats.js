const statsDiv = document.getElementById('stats');

window.onload = () => {
    showStats();
};

function showStats() {
    const totalFactsAllTime = parseInt(localStorage.getItem('totalFactsAllTime')) || 0;
    const decksLoaded = parseInt(localStorage.getItem('decksLoaded')) || 0;
    statsDiv.innerHTML = `
        <h3>Your Stats</h3>
        <p>Total Facts Viewed: ${totalFactsAllTime}</p>
        <p>Decks Loaded: ${decksLoaded}</p>
    `;
}