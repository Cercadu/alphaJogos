document.addEventListener('DOMContentLoaded', () => {
  const nameInput = document.getElementById('player-name');
  const startBtn = document.getElementById('btn-start');
  const charCards = document.querySelectorAll('#char-carousel .character-card');
  const levelCards = document.querySelectorAll('#level-carousel .character-card');
  const leaderboardBody = document.getElementById('leaderboard-body');
  const noScoresMsg = document.getElementById('no-scores-message');

  let selectedCharacter = 'raptor';
  let selectedLevel = '1';

  // 1. Load player name from localStorage
  const savedName = localStorage.getItem('alphadino_player_name');
  if (savedName) {
    nameInput.value = savedName;
  }

  // 2. Load last selected character
  const savedChar = localStorage.getItem('alphadino_selected_char');
  if (savedChar) {
    charCards.forEach(card => {
      card.classList.remove('selected');
      if (card.dataset.char === savedChar) {
        card.classList.add('selected');
        selectedCharacter = savedChar;
        // Scroll to selected card
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    });
  }

  // 3. Handle character selection
  charCards.forEach(card => {
    card.addEventListener('click', () => {
      charCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedCharacter = card.dataset.char;
      localStorage.setItem('alphadino_selected_char', selectedCharacter);
    });
  });

  // 3b. Load last selected level
  const savedLevel = localStorage.getItem('alphadino_selected_level');
  if (savedLevel) {
    levelCards.forEach(card => {
      card.classList.remove('selected');
      if (card.dataset.level === savedLevel) {
        card.classList.add('selected');
        selectedLevel = savedLevel;
        // Scroll to selected card
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    });
  }

  // 3c. Handle level selection
  levelCards.forEach(card => {
    card.addEventListener('click', () => {
      levelCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedLevel = card.dataset.level;
      localStorage.setItem('alphadino_selected_level', selectedLevel);
    });
  });

  // 4. Initialize and display Leaderboard
  const defaultLeaderboard = [
    { name: 'Yoshi 🦖', character: 'raptor', coins: 98, time: 142, score: 5880 },
    { name: 'Bowser 🔥', character: 'trex', coins: 45, time: 118, score: 4990 },
    { name: 'Mario 🍄', character: 'trike', coins: 82, time: 94, score: 4280 },
    { name: 'Luigi 🟢', character: 'ptera', coins: 64, time: 82, score: 3560 },
    { name: 'Peach 👑', character: 'stego', coins: 105, time: 64, score: 2970 }
  ];

  function getLeaderboard() {
    const rawData = localStorage.getItem('alphadino_leaderboard');
    if (!rawData) {
      localStorage.setItem('alphadino_leaderboard', JSON.stringify(defaultLeaderboard));
      return defaultLeaderboard;
    }
    try {
      return JSON.parse(rawData);
    } catch (e) {
      return defaultLeaderboard;
    }
  }

  function renderLeaderboard() {
    const scores = getLeaderboard();
    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    leaderboardBody.innerHTML = '';
    
    if (scores.length === 0) {
      noScoresMsg.style.display = 'block';
      return;
    }
    
    noScoresMsg.style.display = 'none';

    // Map character ID to a small visual details
    const charColors = {
      raptor: '#39ff14',
      ptera: '#00f0ff',
      trex: '#ff007f',
      trike: '#ffea00',
      stego: '#ff6700'
    };

    const charEmojis = {
      raptor: '🦖',
      ptera: '🦅',
      trex: '🦕',
      trike: '🦏',
      stego: '🐢'
    };

    scores.forEach((entry, index) => {
      const row = document.createElement('tr');
      const emoji = charEmojis[entry.character] || '🦖';
      const color = charColors[entry.character] || '#ffffff';
      
      row.innerHTML = `
        <td><span class="rank-num">#${index + 1}</span></td>
        <td>
          <div class="player-name-cell">
            <span style="color: ${color}; font-size: 1.1rem; filter: drop-shadow(0 0 3px ${color})">${emoji}</span>
            <span>${escapeHTML(entry.name)}</span>
          </div>
        </td>
        <td><span class="coins-num">${entry.coins}</span></td>
        <td><span class="time-num">${entry.time}s</span></td>
        <td><span class="score-num">${entry.score}</span></td>
      `;
      leaderboardBody.appendChild(row);
    });
  }

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }

  renderLeaderboard();

  // 5. Handle Game Launch
  startBtn.addEventListener('click', () => {
    let playerName = nameInput.value.trim();
    if (!playerName) {
      playerName = 'AlphaPlayer';
    }
    
    // Save player name to LocalStorage for convenience
    localStorage.setItem('alphadino_player_name', playerName);
    
    // Save session variables for the game window
    sessionStorage.setItem('alphadino_active_player', playerName);
    sessionStorage.setItem('alphadino_active_char', selectedCharacter);
    sessionStorage.setItem('alphadino_active_level', selectedLevel);
    
    // Navigate to game
    window.location.href = 'game/index.html';
  });
});
