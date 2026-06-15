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

  const levelNames = {
    "1": "1 - Vale dos Toons",
    "2": "2 - Canyon do Coiote",
    "3": "3 - Mina do Gaguinho",
    "4": "4 - Cidade Maluca",
    "5": "5 - Vulcão do Taz"
  };

  const mapNodes = document.querySelectorAll('.map-node');
  const lblSelLevel = document.getElementById('lbl-sel-level');
  
  // 3b. Load max unlocked level
  let maxUnlocked = parseInt(localStorage.getItem('alphadino_max_level')) || 1;
  
  // Setup nodes based on unlocked status
  mapNodes.forEach(node => {
    let lvl = parseInt(node.dataset.level);
    if (lvl <= maxUnlocked) {
      node.classList.remove('locked');
    } else {
      node.classList.add('locked');
    }
  });

  // Load last selected level, ensure it's not locked
  let savedLevel = localStorage.getItem('alphadino_selected_level');
  if (savedLevel && parseInt(savedLevel) <= maxUnlocked) {
    selectedLevel = savedLevel;
  } else {
    selectedLevel = "1";
    localStorage.setItem('alphadino_selected_level', selectedLevel);
  }

  // Update UI for selected level
  mapNodes.forEach(node => {
    node.classList.remove('selected');
    if (node.dataset.level === selectedLevel) {
      node.classList.add('selected');
      lblSelLevel.textContent = levelNames[selectedLevel];
    }
  });

  // 3c. Handle map node selection
  mapNodes.forEach(node => {
    node.addEventListener('click', () => {
      if (node.classList.contains('locked')) return;
      
      mapNodes.forEach(c => c.classList.remove('selected'));
      node.classList.add('selected');
      selectedLevel = node.dataset.level;
      localStorage.setItem('alphadino_selected_level', selectedLevel);
      lblSelLevel.textContent = levelNames[selectedLevel];
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
      raptor: '#8cd83d',
      ptera: '#36b1e3',
      trex: '#e04a1d',
      trike: '#ffd700',
      stego: '#ff8c00'
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
