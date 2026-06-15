// AlphaDino 2D Cartoon Game Engine (Looney Tunes Style)

document.addEventListener('DOMContentLoaded', () => {
  let hasRequestedFullscreen = false;
  const requestFullscreen = () => {
    if (hasRequestedFullscreen) return;
    hasRequestedFullscreen = true;
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) {
      docEl.requestFullscreen().catch(e => console.log(e));
    } else if (docEl.webkitRequestFullscreen) {
      docEl.webkitRequestFullscreen().catch(e => console.log(e));
    }
  };
  document.addEventListener('touchstart', requestFullscreen, { passive: true, once: true });
  document.addEventListener('mousedown', requestFullscreen, { passive: true, once: true });

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // Load Session Data
  const playerName = sessionStorage.getItem('alphadino_active_player') || 'AlphaPlayer';
  const charType = sessionStorage.getItem('alphadino_active_char') || 'raptor';
  const selectedLevelNum = parseInt(sessionStorage.getItem('alphadino_active_level') || '1', 10);

  // DDA: Load consecutive deaths on this level
  const levelDeathsKey = `alphadino_deaths_level_${selectedLevelNum}`;
  let levelDeaths = parseInt(localStorage.getItem(levelDeathsKey) || '0', 10);


  // HUD Elements
  const hudPlayerName = document.getElementById('hud-player-name');
  const hudCharEmoji = document.getElementById('hud-char-emoji');
  const hudScore = document.getElementById('hud-score');
  const hudCoins = document.getElementById('hud-coins');
  const hudTime = document.getElementById('hud-time');
  const powerupStatusBar = document.getElementById('powerup-status-bar');
  const powerupName = document.getElementById('powerup-name');
  const powerupProgressFill = document.getElementById('powerup-progress-fill');

  // Overlays
  const gameoverOverlay = document.getElementById('gameover-overlay');
  const pauseOverlay = document.getElementById('pause-overlay');
  const newHighscoreBadge = document.getElementById('new-highscore-badge');
  const goPlayer = document.getElementById('go-player');
  const goChar = document.getElementById('go-char');
  const goCoins = document.getElementById('go-coins');
  const goTime = document.getElementById('go-time');
  const goScore = document.getElementById('go-score');

  // Buttons
  const btnAudioToggle = document.getElementById('btn-audio-toggle');
  const btnPauseToggle = document.getElementById('btn-pause-toggle');
  const btnResume = document.getElementById('btn-resume');
  const btnRestart = document.getElementById('btn-restart');
  const btnHome = document.getElementById('btn-home');
  const btnPauseHome = document.getElementById('btn-pause-home');

  hudPlayerName.textContent = playerName;
  const emojis = { raptor: '🦖', ptera: '🦅', trex: '🦕', trike: '🦏', stego: '🐢' };
  const names = { raptor: 'Raptor', ptera: 'Ptera', trex: 'T-Rex', trike: 'Trike', stego: 'Stego' };
  hudCharEmoji.textContent = emojis[charType] || '🦖';

  // ----------------------------------------------------
  // AUDIO SYNTHESIZER (Web Audio API)
  // ----------------------------------------------------
  let audioCtx = null;
  let isMuted = false;

  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playSound(freqs, durations, type = 'square', gainVals = [0.1, 0]) {
    if (isMuted) return;
    initAudio();
    try {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.type = type;
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      const now = audioCtx.currentTime;
      if (freqs.length === 1) {
        osc.frequency.setValueAtTime(freqs[0], now);
      } else {
        osc.frequency.setValueAtTime(freqs[0], now);
        let timeOffset = 0;
        for (let i = 1; i < freqs.length; i++) {
          timeOffset += durations[i - 1] || 0.1;
          osc.frequency.exponentialRampToValueAtTime(freqs[i], now + timeOffset);
        }
      }
      
      gainNode.gain.setValueAtTime(gainVals[0], now);
      let volOffset = 0;
      for (let i = 1; i < gainVals.length; i++) {
        volOffset += durations[i - 1] || 0.1;
        gainNode.gain.linearRampToValueAtTime(gainVals[i], now + volOffset);
      }
      
      const totalDuration = durations.reduce((a, b) => a + b, 0);
      osc.start(now);
      osc.stop(now + totalDuration);
    } catch (e) {
      console.warn("Audio Context blocked:", e);
    }
  }

  const sounds = {
    jump: () => playSound([180, 580], [0.12], 'triangle', [0.12, 0]),
    stomp: () => playSound([120, 30], [0.12], 'triangle', [0.22, 0]),
    coin: () => playSound([980, 1310], [0.08, 0.18], 'sine', [0.08, 0.08, 0]),
    powerup: () => playSound([330, 440, 550, 660], [0.06, 0.06, 0.06, 0.15], 'square', [0.08, 0.08, 0.08, 0]),
    powerdown: () => playSound([660, 550, 440, 330], [0.06, 0.06, 0.06, 0.15], 'triangle', [0.12, 0.12, 0]),
    shoot: () => playSound([700, 150], [0.1], 'sawtooth', [0.08, 0]),
    dash: () => playSound([80, 260, 60], [0.04, 0.12], 'sawtooth', [0.12, 0]),
    hit: () => playSound([260, 60], [0.2], 'sawtooth', [0.15, 0]),
    victory: () => playSound([523, 659, 783, 1046, 783, 1046], [0.1, 0.1, 0.1, 0.15, 0.1, 0.3], 'square', [0.12, 0.12, 0.12, 0.12, 0.12, 0]),
    gameover: () => playSound([440, 415, 392, 293], [0.15, 0.15, 0.15, 0.45], 'square', [0.12, 0.12, 0.12, 0])
  };

  btnAudioToggle.addEventListener('click', () => {
    isMuted = !isMuted;
    btnAudioToggle.textContent = isMuted ? '🔇' : '🔊';
    initAudio();
  });

  function triggerVibrate(pattern) {
    if ('vibrate' in navigator) {
      try { navigator.vibrate(pattern); } catch (e) {}
    }
  }

  // ----------------------------------------------------
  // IMAGE ASSETS LOADING (Looney Tunes sprites)
  // ----------------------------------------------------
const assets = {
    bg: new Image(),
    dinos: {},
    enemies: {},
    tiles: {}
  };
  
  const levelBgs = {
    1: 'assets/backgrounds/bg_forest.png',
    2: 'assets/backgrounds/bg_desert.png',
    3: 'assets/backgrounds/bg_cave.png',
    4: 'assets/backgrounds/bg_forest.png',
    5: 'assets/backgrounds/bg_lava.png'
  };

  const dinoNames = ['raptor_0', 'raptor_1', 'ptero_0', 'ptero_1', 'rex_0', 'rex_1', 'trike_0', 'trike_1', 'stego_0', 'stego_1'];
  const enemyNames = ['goomba', 'koopa', 'beetle', 'drone', 'bowser'];
  const tileNames = ['grass_left', 'grass_right', 'brick1', 'brick2', 'item_block', 'coin', 'pipe', 'flagpole'];

  const totalAssets = 1 + dinoNames.length + enemyNames.length + tileNames.length;
  let assetsLoaded = 0;

  function checkAssetsLoaded() {
    assetsLoaded++;
    if (assetsLoaded === totalAssets) {
      requestAnimationFrame(gameLoop);
    }
  }

  const CACHE_BUST = '?v=' + Date.now();

  assets.bg.onload = checkAssetsLoaded;
  assets.bg.onerror = checkAssetsLoaded;
  assets.bg.src = (levelBgs[selectedLevelNum] || levelBgs[1]) + CACHE_BUST;

  dinoNames.forEach(name => {
    assets.dinos[name] = new Image();
    assets.dinos[name].onload = checkAssetsLoaded;
    assets.dinos[name].onerror = checkAssetsLoaded;
    assets.dinos[name].src = `assets/characters/sprites/${name}.png${CACHE_BUST}`;
  });

  enemyNames.forEach(name => {
    assets.enemies[name] = new Image();
    assets.enemies[name].onload = checkAssetsLoaded;
    assets.enemies[name].onerror = checkAssetsLoaded;
    assets.enemies[name].src = `assets/enemies/sprites/${name}.png${CACHE_BUST}`;
  });

  tileNames.forEach(name => {
    assets.tiles[name] = new Image();
    assets.tiles[name].onload = checkAssetsLoaded;
    assets.tiles[name].onerror = checkAssetsLoaded;
    assets.tiles[name].src = `assets/tiles/sprites/${name}.png${CACHE_BUST}`;
  });

  // ----------------------------------------------------
  // LEVEL GRID CONFIGURATION (12 rows high, 120 cols wide)
  // ----------------------------------------------------
  const BLOCK_SIZE = 60;
  
  // Floating Text class for arcade visual juice (floating BAM, COMBO, points)
  class FloatingText {
    constructor(x, y, text, color = '#ffffff', size = 22) {
      this.x = x;
      this.y = y;
      this.text = text;
      this.color = color;
      this.size = size;
      this.life = 1.0;
      this.vy = -2.0;
    }
    update() {
      this.y += this.vy;
      this.life -= 0.025;
    }
    draw() {
      ctx.save();
      ctx.globalAlpha = this.life;
      ctx.font = `bold ${this.size}px var(--font-display)`;
      ctx.fillStyle = this.color;
      ctx.strokeStyle = '#4a2810';
      ctx.lineWidth = 4;
      ctx.textAlign = 'center';
      const screen = worldToScreen(this.x, this.y);
      ctx.strokeText(this.text, screen.x, screen.y);
      ctx.fillText(this.text, screen.x, screen.y);
      ctx.restore();
    }

  }

  let floatingTexts = [];
  let screenShakeDuration = 0;
  let screenShakeIntensity = 0;
  let hitstopTimer = 0;

  function triggerScreenShake(intensity, duration) {
    screenShakeIntensity = intensity;
    screenShakeDuration = duration;
  }
  
  // Wacky progressive cartoon level maps (12 rows, exact length per row)
  const levelMaps = {
    1: [
      "                                                                                                                                                                                    ",
      "                                                                                                                                                                                    ",
      "                                                                                                                                                                                    ",
      "                                                                                                                                                                                    ",
      "                                                                                                                                                                                    ",
      "                                                                                                  CCC                                                                               ",
      "                                                                                     CCC                                                                                            ",
      "                  BBB BMB BBB                  BBB                              BBB BSB BBB               BBB                                                                       ",
      "                                                                                                                                                                                    ",
      "                                                                                                                                                                                    ",
      "               E    E              E  E      E              E  E  E                       E  E           E                  E  E            E                         E  E        L ",
      "GGGGGGGGGGGGGGGGGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGGG    GGGGGGGGGGGGGGGGGGGGGGGGGG    GGGGGGGGGGGGGGGGGGGGGGGGGG     GGGGGGGGGGGGGGGGGGGGGGGGGGGGGG    GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
    ],
    2: [
      "                                                                                                                                                                                                        ",
      "                                                                                                                                                                                                        ",
      "                                                                                                                                                                                                        ",
      "                                                                                                                                                                                                        ",
      "                                                                                                                                                                                                        ",
      "                                                  CCC                                                               CCC                                CCC                                              ",
      "                                                                                                                                                                                                        ",
      "                    BBB BMB BBB         BBB                           BBB                                BBB BSB BBB              BBB                           BBB                                     ",
      "                                                                                                                                                                                                        ",
      "                                                                                                                                                                                                        ",
      "                  E   K               K   K       E   E                 K   E   K                   E   K       K   E                 K   K      E  E             K   E               K   K     L       ",
      "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGG    GGGGGGGGGGGGGGGGGGGGGGGGGG    GGGGGGGGGGGGGGGGGGGGGGGGGG     GGGGGGGGGGGGGGGGGGGGGGGGG     GGGGGGGGGGGGGGGGGGGGGGGGG      GGGGGGGGGGGGGGGGGGG    GGGGGGGGGGGGGGGGGGGGG",
    ],
    3: [
      "                                                                                                                                                                                                                            ",
      "                                                                                                                                                                                                                            ",
      "                                                                                                                                                                                                                            ",
      "                                                                                                                                                                                                                            ",
      "                                                                                                                                                                                                                            ",
      "                              CCC                                               CCC                                               CCC                                               CCC                                     ",
      "                                                                                                                                                                                                                            ",
      "                  BBB BMB BBB           BBB                         BBB                     BBB                       BBB                     BBB                       BBB BSB BBB                                         ",
      "                                                                                                                                                                                                                            ",
      "                                                                                                                                                                                                                            ",
      "               T            T         T                T  T                   T      T                   T    T                 T   T                      T    T                   T      T                T   T     L     ",
      "GGGGGGGGGGGGGGGGGGGG     GGGGGGGGGGGGGGGGGGGG     GGGGGGGGGGGGGGGGGGGG      GGGGGGGGGGGGGGGGGGG      GGGGGGGGGGGGGGGGGGG       GGGGGGGGGGGGGGGGGG      GGGGGGGGGGGGGGGGGGG       GGGGGGGGGGGGGGGGGG     GGGGGGGGGGGGGGGGGGGG",
    ],
    4: [
      "                                                                                                                                                                                                                                                ",
      "                                                                                                                                                                                                                                                ",
      "                                                                                                                                                                                                                                                ",
      "                                                                                                                                                                                                                                                ",
      "                            CCC                                                 CCC                                                         CCC                                                         CCC                                     ",
      "                                        D                                   D                                       D                                       D                                       D                                           ",
      "                      D                                 D                                       D                                       D                                       D                                       D                       ",
      "                            BBB BMB BBB D                       BBB         D                 BBB                   D       BBB                           BBB                           BBB         D                 BBB BSB BBB               ",
      "                  D                                 D                                       D                                       D                                       D                                       D                           ",
      "                                                                                                                                                                                                                                                ",
      "                                                                                                                                                                                                                        L                       ",
      "GGGGGGGGGGGGGGGGGGGGGGGGG    GGGGGGGGGGGGGGGGGGGGGGGGGG     GGGGGGGGGGGGGGGGGGGGGGGGG      GGGGGGGGGGGGGGGGGGGGGGGG      GGGGGGGGGGGGGGGGGGGGGGGG      GGGGGGGGGGGGGGGGGGGGGGGG       GGGGGGGGGGGGGGGGGGGGGGG     GGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
    ],
    5: [
      "                                                                                                                                                                                                                                                                    ",
      "                                                                                                                                                                                                                                                                    ",
      "                                                                                                                                                                                                                                                                    ",
      "                                                                                                                                                                                                                                                                    ",
      "                                                                                                                                                                                                                                                                    ",
      "                         CC                                                CC                                                CC                                                          CC                                                                         ",
      "                                                                                                                                                                                                                                                                    ",
      "                    BBB BMB BBB                                                           BBB BSB BBB                                                                                                                                                               ",
      "                                                                                                                                                                                                                                                                    ",
      "                                                                                                                                                                                                                                                                    ",
      "               E  K           T  D                  E  E  K                   T   D                     K  K  T                    E  D                  K  T                     E  K  T                  D  D      T  K                   X               L       ",
      "GGGGGGGGGGGGGGGGGGGG     GGGGGGGGGGGGGGGGGGGG     GGGGGGGGGGGGGGGGGGGG      GGGGGGGGGGGGGGGGGGG      GGGGGGGGGGGGGGGGGGG      GGGGGGGGGGGGGGGGGGG       GGGGGGGGGGGGGGGGGG       GGGGGGGGGGGGGGGGGG       GGGGGGGGGGGGGGGGGG      GGGGGGGGGGGGGGGGGGGGGG        GGGG",
    ],
  };

  const activeGrid = levelMaps[selectedLevelNum] || levelMaps[1];
  const gridRows = activeGrid.length;
  const gridCols = activeGrid[0].length;

  // ----------------------------------------------------
  // GAME SYSTEM VARIABLES
  // ----------------------------------------------------
  let gameState = 'PLAYING';
  let score = 0;
  let coins = 0;
  let timeElapsed = 0;
  let levelComplete = false;
  let shieldCooldownTimer = 0;
  
  let cameraX = 0;
  let cameraY = 0;

  // Normalization Layer: Convert World Coordinates to Screen Coordinates
  function worldToScreen(worldX, worldY) {
    return {
      x: worldX - cameraX,
      y: worldY - cameraY
    };
  }


  function drawSprite(ctx, imageGroup, type, rowIdx, colIdx, screenX, screenY, destWidth, destHeight, facingRight, rotation = 0, opacity = 1, isEnemy = false, isSquashed = false) {
    let img;
    let sW, sH;
    let isDino = (type === 'dino');

    if (isDino) {
      const dinoTypes = ['raptor', 'ptero', 'rex', 'trike', 'stego'];
      let dType = dinoTypes[rowIdx] || 'raptor';
      let frame = colIdx % 2;
      img = imageGroup[`${dType}_${frame}`];
    } else {
      img = imageGroup[type];
    }

    if (!img || !img.complete || img.naturalWidth === 0) return;

    sW = img.width;
    sH = img.height;

    let scale = destHeight / sH;
    let renderW = sW * scale;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(screenX + destWidth / 2, screenY + destHeight);
    
    if (!facingRight) ctx.scale(-1, 1);
    if (rotation !== 0) ctx.rotate(rotation);
    if (isSquashed) ctx.scale(1, 0.4);

    ctx.drawImage(
      img,
      0, 0, sW, sH,
      -renderW / 2,
      -destHeight,
      renderW,
      destHeight
    );
    ctx.restore();
  }

  function drawTileCell(ctx, imageGroup, typeStr, colIdx, screenX, screenY, destWidth, destHeight) {
    let imgName = '';
    if (typeStr === 'ground') {
      imgName = (colIdx % 2 === 0) ? 'grass_left' : 'grass_right';
    } else if (typeStr === 'brick') {
      imgName = (colIdx % 2 === 0) ? 'brick1' : 'brick2';
    } else if (typeStr === 'item_block' || typeStr === 'star_block') {
      imgName = 'item_block';
    } else if (typeStr === 'coin') {
      imgName = 'coin';
    } else if (typeStr === 'flagpole') {
      imgName = 'flagpole';
    } else if (typeStr === 'pipe') {
      imgName = 'pipe';
    } else {
      return;
    }

    let img = imageGroup[imgName];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    ctx.save();
    ctx.drawImage(
      img,
      0, 0, img.width, img.height,
      screenX, screenY, destWidth, destHeight
    );
    ctx.restore();
  }

  class Block {
    constructor(gridX, gridY, type, itemType = 'coin') {
      this.gridX = gridX;
      this.gridY = gridY;
      this.x = gridX * BLOCK_SIZE;
      this.y = gridY * BLOCK_SIZE;
      this.type = type;
      this.itemType = itemType;
      this.width = BLOCK_SIZE;
      this.height = BLOCK_SIZE;
      
      this.hit = false;
      this.hitOffset = 0;
      this.hitSpeed = 0;

      this.sliceIndices = { ground: 0, brick: 1, question: 2, pipe: 4 };
      this.sliceIdx = this.sliceIndices[type] || 0;
    }

    update() {
      if (this.hit && this.hitOffset > -10 && this.hitSpeed <= 0) {
        this.hitOffset -= 2;
        if (this.hitOffset <= -10) {
          this.hitSpeed = 2;
        }
      } else if (this.hit && this.hitOffset < 0 && this.hitSpeed > 0) {
        this.hitOffset += this.hitSpeed;
        if (this.hitOffset >= 0) {
          this.hitOffset = 0;
          this.hitSpeed = 0;
        }
      }
    }

    draw() {
      let tileRow = 0;
      if (selectedLevelNum === 2) tileRow = 2;
      else if (selectedLevelNum === 3 || selectedLevelNum === 5) tileRow = 4;

      const screen = worldToScreen(this.x, this.y - this.hitOffset);

      if (this.type === 'brick') {
        drawBrickBlock(ctx, screen.x, screen.y, this.width, this.height, tileRow);
      } else if (this.type === 'question') {
        drawQuestionBlock(ctx, screen.x, screen.y, this.width, this.height, this.hit, tileRow);
      } else {
        let drawColIdx = this.sliceIdx;
        if (this.type === 'ground') {
          drawColIdx = getGroundSliceIdx(this.gridX, this.gridY);
        }
        drawTileCell(ctx, assets.tiles, this.type, drawColIdx, screen.x, screen.y, this.width, this.height);
      }
    }
  }


  // ----------------------------------------------------
  // COINS CLASS
  // ----------------------------------------------------
  class Coin {
    constructor(gridX, gridY) {
      this.x = gridX * BLOCK_SIZE + 15;
      this.y = gridY * BLOCK_SIZE + 10;
      this.width = 30;
      this.height = 39;
      this.collected = false;
      this.vx = 0;
      this.vy = 0;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
    }

    draw() {
      let tileRow = 0;
      if (selectedLevelNum === 2) tileRow = 2;
      else if (selectedLevelNum === 3 || selectedLevelNum === 5) tileRow = 4;

      const screen = worldToScreen(this.x, this.y);
      drawTileCell(ctx, assets.tiles, 'coin', 0, screen.x, screen.y, this.width, this.height);
    }
  }


  // ----------------------------------------------------
  // FLAGPOLE CLASS (Victory Target)
  // ----------------------------------------------------
  class Flagpole {
    constructor(gridX, gridY) {
      this.x = gridX * BLOCK_SIZE;
      this.y = gridY * BLOCK_SIZE - 300;
      this.width = 60;
      this.height = 360;
    }

    update() {}

    draw() {
      let tileRow = 0;
      if (selectedLevelNum === 2) tileRow = 2;
      else if (selectedLevelNum === 3 || selectedLevelNum === 5) tileRow = 4;

      for (let i = 0; i < 6; i++) {
        const screen = worldToScreen(this.x, this.y + (i * BLOCK_SIZE));
        drawTileCell(ctx, assets.tiles, 'flagpole', 0, screen.x, screen.y, BLOCK_SIZE, BLOCK_SIZE);
      }
    }
  }



  // ----------------------------------------------------
  // ENEMY CLASS
  // ----------------------------------------------------
  class Enemy {
    constructor(gridX, gridY, type) {
      this.x = gridX * BLOCK_SIZE;
      this.type = type; // 'goomba', 'koopa', 'beetle', 'drone', 'bowser'
      this.width = 54;
      this.height = 54;
      this.y = gridY * BLOCK_SIZE + (BLOCK_SIZE - this.height);
      this.speedX = -1.8;
      
      if (type === 'bowser') {
        this.width = 110;
        this.height = 110;
        this.y = gridY * BLOCK_SIZE + (BLOCK_SIZE - this.height);
        this.hp = 10;
        this.shootTimer = 0;
        this.jumpTimer = 0;
        this.vy = 0;
        this.onGround = true;
      }
      
      this.stamped = false;
      this.stampTimer = 0;
      
      // Slice indices from enemies.png
      // Goomba = 0, Koopa = 1, Beetle = 2, Drone = 3, Bowser = 4
      this.sliceIndices = { goomba: 0, koopa: 1, beetle: 2, drone: 3, bowser: 4 };
      this.sliceIdx = this.sliceIndices[type] || 0;
      this.bounceDir = 1;
      this.bounceY = 0;
    }

    update(dt) {
      if (this.stamped) {
        this.stampTimer += dt;
        return;
      }

      if (this.type === 'drone') {
        // Drone moves left/right but floats up/down
        this.x += this.speedX;
        this.bounceY += 0.05 * this.bounceDir;
        if (Math.abs(this.bounceY) > 1.2) {
          this.bounceDir *= -1;
        }
        this.y = (this.y - this.bounceY);
      }
      else if (this.type === 'bowser') {
        if (!this.onGround) {
          this.vy += 0.82;
          this.y += this.vy;
        }
        
        let hitGroundThisFrame = false;
        let myBox = { left: this.x, right: this.x + this.width, top: this.y, bottom: this.y + this.height };
        collidables.forEach(block => {
          let bBox = { left: block.x, right: block.x + block.width, top: block.y, bottom: block.y + block.height };
          if (myBox.right > bBox.left && myBox.left < bBox.right && myBox.bottom > bBox.top && myBox.top < bBox.bottom) {
            if (this.vy >= 0 && (myBox.bottom - this.vy <= bBox.top + 12)) {
              this.y = bBox.top - this.height;
              this.vy = 0;
              hitGroundThisFrame = true;
            }
          }
        });
        
        if (hitGroundThisFrame) {
          if (!this.onGround) {
            this.onGround = true;
            sounds.stomp();
            triggerScreenShake(20, 250);
            createImpactExplosion(this.x + this.width / 2, this.y + this.height, '#ff5500');
          }
        } else {
          this.onGround = false;
        }

        this.shootTimer += dt;
        const isEnraged = this.hp <= 5;
        const ddaDelay = Math.min(levelDeaths * 400, 1600);
        const shootInterval = (isEnraged ? 1200 : 2000) + ddaDelay;
        
        if (this.shootTimer >= shootInterval && Math.abs(player.x - this.x) < 650) {
          this.shootTimer = 0;
          sounds.shoot();
          
          if (isEnraged) {
            projectiles.push(new Projectile(this.x - 10, this.y + 20, -1, true));
            const p1 = new Projectile(this.x - 10, this.y + 10, -1, true); p1.vy = -3; projectiles.push(p1);
            const p2 = new Projectile(this.x - 10, this.y + 30, -1, true); p2.vy = 3; projectiles.push(p2);
          } else {
            const p = new Projectile(this.x - 10, this.y + 20, -1, true);
            const dy = (player.y + player.height / 2) - (this.y + 50);
            p.vy = Math.min(Math.max(dy / 50, -4), 4);
            projectiles.push(p);
          }
        }
        
        this.jumpTimer += dt;
        if (this.onGround && this.jumpTimer >= (isEnraged ? 2500 : 4000) && Math.abs(player.x - this.x) < 450) {
          this.jumpTimer = 0;
          this.vy = -14;
          this.onGround = false;
          this.speedX = (player.x < this.x ? -3.5 : 3.5);
        }
        
        if (this.onGround) {
          this.x += (player.x < this.x ? -1 : 1) * (isEnraged ? 1.8 : 0.8);
        } else {
          this.x += this.speedX;
        }

        if (this.x < 10) this.x = 10;
        if (this.x > (gridCols * BLOCK_SIZE) - this.width - 10) {
          this.x = (gridCols * BLOCK_SIZE) - this.width - 10;
        }
      } else {
        // Goomba / Koopa walking
        this.x += this.speedX;

        // Check horizontal boundary to bounce back (robust AABB intersection)
        let collided = false;
        const myBox = {
          left: this.x,
          right: this.x + this.width,
          top: this.y,
          bottom: this.y + this.height
        };
        collidables.forEach(block => {
          const bBox = {
            left: block.x,
            right: block.x + block.width,
            top: block.y,
            bottom: block.y + block.height
          };
          const overlapX = myBox.right > bBox.left && myBox.left < bBox.right;
          const overlapY = (myBox.bottom - 4) > bBox.top && (myBox.top + 4) < bBox.bottom;
          if (overlapX && overlapY) {
            collided = true;
          }
        });
        if (collided || this.x < 10 || this.x > (gridCols * BLOCK_SIZE) - this.width - 10) {
          this.speedX *= -1;
          this.x += this.speedX * 2;
        }
      }

    }

    takeStompDamage() {
      if (this.type === 'bowser') {
        this.hp--;
        sounds.hit();
        triggerVibrate([80, 40, 80]);
        triggerScreenShake(15, 250);
        hitstopTimer = 100; // Freeze frame impact!
        floatingTexts.push(new FloatingText(this.x + this.width/2, this.y - 20, `BOWSER HP: ${this.hp}`, "#ff3333", 26));
        createImpactExplosion(this.x + this.width/2, this.y + this.height/2, '#ff5500');
        if (this.hp <= 0) {
          this.stamped = true;
          score += 2000;
          sounds.stomp();
          triggerScreenShake(30, 500);
          floatingTexts.push(new FloatingText(this.x + this.width/2, this.y - 20, "BOSS DEFEATED! +2000", "#ffea00", 30));
          createImpactExplosion(this.x + this.width/2, this.y + this.height/2, '#ffea00');
        }
      } else {
        this.stamped = true;
        player.stompCombo++;
        const comboBonus = 150 * player.stompCombo;
        score += 300 + comboBonus;
        sounds.stomp();
        triggerVibrate(30);
        triggerScreenShake(8, 120);
        hitstopTimer = 60; // short freeze frame
        floatingTexts.push(new FloatingText(this.x + this.width/2, this.y - 20, player.stompCombo > 1 ? `COMBO x${player.stompCombo}! +${300 + comboBonus}` : "+300", "#ffd700", 22));
        createImpactExplosion(this.x + this.width/2, this.y + this.height/2, '#ff0055');
      }
    }

    draw() {
      const animFrame = Math.floor(Date.now() / 250) % 2;
      const screenPos = worldToScreen(this.x, this.y);
      const facingRight = (this.speedX <= 0 || this.type === 'bowser');
      const opacity = this.stamped ? Math.max(0, 1 - this.stampTimer / 500) : 1;

      ctx.save();
      const isEnraged = (this.type === 'bowser' && this.hp <= 5);
      if (isEnraged && !this.stamped) {
        ctx.shadowBlur = 25;
        ctx.shadowColor = '#ff0000';
      }

      drawSprite(
        ctx,
        assets.enemies,
        this.type,
        animFrame,
        this.sliceIdx,
        screenPos.x,
        screenPos.y,
        this.width,
        this.height,
        facingRight,
        0,
        opacity,
        true,
        this.stamped
      );
      ctx.restore();
    }

  }

  // ----------------------------------------------------
  // ITEMS CLASS
  // ----------------------------------------------------
  class Item {
    constructor(x, y, type) {
      this.x = x;
      this.y = y;
      this.type = type; // 'mushroom', 'fireflower', 'star', 'magnet'
      this.width = 45;
      this.height = 45;
      this.vy = -7.5; // bounce up
      this.vx = 2.25;
      this.onGround = false;
      this.collected = false;

      // Slice index mapping from Tiles/Dinos or custom
      // Mushroom = Red box, Flower = Orange box, Star = Yellow box, Magnet = Cyan box
      this.colors = { mushroom: '#ff0055', fireflower: '#ffaa00', star: '#ffea00', magnet: '#00f0ff' };
      this.color = this.colors[type] || '#ffffff';
    }

    update() {
      this.x += this.vx;
      this.vy += 0.4;
      this.y += this.vy;

      // Collisions against structures (robust AABB intersection)
      collidables.forEach(block => {
        const iBox = { left: this.x, right: this.x + this.width, top: this.y, bottom: this.y + this.height };
        const bBox = { left: block.x, right: block.x + block.width, top: block.y, bottom: block.y + block.height };
        
        if (iBox.right > bBox.left && iBox.left < bBox.right && iBox.bottom > bBox.top && iBox.top < bBox.bottom) {
          const overlapX = Math.min(iBox.right - bBox.left, bBox.right - iBox.left);
          const overlapY = Math.min(iBox.bottom - bBox.top, bBox.bottom - iBox.top);
          
          if (overlapY < overlapX) {
            // Vertical collision resolution
            if (this.vy >= 0 && iBox.bottom - this.vy <= bBox.top + 15) {
              this.y = bBox.top - this.height;
              this.vy = 0;
              this.onGround = true;
            }
          } else {
            // Horizontal collision resolution (bounce back)
            this.vx *= -1;
            this.x += this.vx;
          }
        }
      });
    }

    draw() {
      ctx.save();
      const center = worldToScreen(this.x + this.width / 2, this.y + this.height / 2);
      const cx = center.x;
      const cy = center.y;

      if (this.type === 'mushroom') {
        // Shadow
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff3355';

        // Cream Stalk
        ctx.fillStyle = '#fff0d0';
        ctx.strokeStyle = '#4a2306';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(cx - 9, cy - 2, 18, 20, 4);
        ctx.fill();
        ctx.stroke();

        // Stalk Eyes
        ctx.fillStyle = '#000000';
        ctx.fillRect(cx - 4, cy + 4, 2, 6);
        ctx.fillRect(cx + 2, cy + 4, 2, 6);

        ctx.shadowBlur = 0; // reset shadow for cap

        // Red Cap
        ctx.fillStyle = '#ff3355';
        ctx.beginPath();
        ctx.arc(cx, cy, 18, Math.PI, 0, false);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // White Spots
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy - 10, 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx - 11, cy - 3, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx + 11, cy - 3, 3, 0, Math.PI * 2);
        ctx.fill();

      } else if (this.type === 'fireflower') {
        // Shadow
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff9900';

        // Green Stem & Leaves
        ctx.fillStyle = '#2be01b';
        ctx.strokeStyle = '#0f5207';
        ctx.lineWidth = 3;
        // Stem
        ctx.fillRect(cx - 3, cy, 6, 18);
        ctx.strokeRect(cx - 3, cy, 6, 18);
        // Leaves
        ctx.beginPath();
        ctx.ellipse(cx - 10, cy + 9, 6, 3, Math.PI / 6, 0, Math.PI * 2);
        ctx.ellipse(cx + 10, cy + 9, 6, 3, -Math.PI / 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Outer Oval Petals (Red)
        ctx.fillStyle = '#ff3333';
        ctx.strokeStyle = '#2d0606';
        ctx.beginPath();
        ctx.ellipse(cx, cy - 6, 18, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Middle Oval Petals (Orange)
        ctx.fillStyle = '#ff9900';
        ctx.beginPath();
        ctx.ellipse(cx, cy - 6, 13, 8.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner Petals (Yellow/White)
        ctx.fillStyle = '#ffff33';
        ctx.beginPath();
        ctx.ellipse(cx, cy - 6, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Eyes
        ctx.fillStyle = '#000000';
        ctx.fillRect(cx - 3, cy - 8, 1.5, 4);
        ctx.fillRect(cx + 1.5, cy - 8, 1.5, 4);

      } else if (this.type === 'star') {
        // Glowing Golden Star
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ffea00';

        ctx.fillStyle = '#ffea00';
        ctx.strokeStyle = '#614b00';
        ctx.lineWidth = 3;

        ctx.save();
        ctx.translate(cx, cy);
        const rot = (Date.now() / 250) % (Math.PI * 2);
        ctx.rotate(rot);
        
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const angle = (i * Math.PI) / 5 - Math.PI / 2;
          const r = (i % 2 === 0) ? 19 : 8.5;
          ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Eyes (drawn unrotated in center)
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#000000';
        ctx.fillRect(cx - 3, cy - 3, 1.8, 6);
        ctx.fillRect(cx + 1.2, cy - 3, 1.8, 6);

      } else if (this.type === 'magnet') {
        // Red Horseshoe Magnet
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#00f0ff';

        // Red Body
        ctx.fillStyle = '#ff3333';
        ctx.strokeStyle = '#4a0303';
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        // Outer U
        ctx.arc(cx, cy + 4, 15, 0, Math.PI, false);
        ctx.lineTo(cx - 15, cy - 10);
        ctx.lineTo(cx - 7, cy - 10);
        // Inner U
        ctx.lineTo(cx - 7, cy + 4);
        ctx.arc(cx, cy + 4, 7, Math.PI, 0, true);
        ctx.lineTo(cx + 7, cy - 10);
        ctx.lineTo(cx + 15, cy - 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Silver Tips
        ctx.fillStyle = '#dddddd';
        ctx.fillRect(cx - 15, cy - 10, 8, 4);
        ctx.fillRect(cx + 7, cy - 10, 8, 4);
        ctx.strokeRect(cx - 15, cy - 10, 8, 4);
        ctx.strokeRect(cx + 7, cy - 10, 8, 4);

        // Magnetic waves pulsing cyan
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(0, 240, 255, ' + (0.3 + 0.3 * Math.sin(Date.now() / 150)) + ')';
        ctx.lineWidth = 3.5;
        
        ctx.beginPath();
        ctx.arc(cx - 11, cy - 16, 6, Math.PI, 0, false);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx + 11, cy - 16, 6, Math.PI, 0, false);
        ctx.stroke();
      }

      ctx.restore();
    }

  }

  // ----------------------------------------------------
  // PROJECTILE CLASS
  // ----------------------------------------------------
  class Projectile {
    constructor(x, y, dir, isEnemy = false) {
      this.x = x;
      this.y = y;
      this.dir = dir;
      this.isEnemy = isEnemy;
      this.width = 24;
      this.height = 24;
      this.vx = 9 * dir;
      this.vy = 2;
      this.destroyed = false;
    }

    update() {
      this.x += this.vx;
      this.vy += 0.3;
      this.y += this.vy;

      // Pipe / brick bounces (robust AABB intersection)
      collidables.forEach(block => {
        const pBox = { left: this.x, right: this.x + this.width, top: this.y, bottom: this.y + this.height };
        const bBox = { left: block.x, right: block.x + block.width, top: block.y, bottom: block.y + block.height };
        
        if (pBox.right > bBox.left && pBox.left < bBox.right && pBox.bottom > bBox.top && pBox.top < bBox.bottom) {
          const overlapX = Math.min(pBox.right - bBox.left, bBox.right - pBox.left);
          const overlapY = Math.min(pBox.bottom - bBox.top, bBox.bottom - pBox.top);
          
          if (overlapY < overlapX) {
            if (this.vy >= 0 && pBox.bottom - this.vy <= bBox.top + 12) {
              this.y = bBox.top - this.height;
              this.vy = -4.5; // bounce up
            }
          } else {
            this.destroyed = true;
          }
        }
      });
    }

    draw() {
      ctx.save();
      const color = this.isEnemy ? '#ff0055' : '#ff7700';
      ctx.fillStyle = color;
      ctx.shadowBlur = 12;
      ctx.shadowColor = color;
      
      const center = worldToScreen(this.x + 12, this.y + 12);
      ctx.beginPath();
      ctx.arc(center.x, center.y, 12, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

  }

  // ----------------------------------------------------
  // PARTICLE CLASS
  // ----------------------------------------------------
  class Particle {
    constructor(x, y, color) {
      this.x = x;
      this.y = y;
      this.size = Math.random() * 8 + 3;
      this.vx = (Math.random() - 0.5) * 9;
      this.vy = (Math.random() - 0.5) * 9;
      this.color = color;
      this.life = 1.0;
      this.decay = Math.random() * 0.04 + 0.02;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.vy += 0.15; // gravity pull
      this.life -= this.decay;
    }

    draw() {
      ctx.save();
      ctx.globalAlpha = this.life;
      ctx.fillStyle = this.color;
      ctx.shadowBlur = 4;
      ctx.shadowColor = this.color;
      const screen = worldToScreen(this.x, this.y);
      ctx.fillRect(screen.x, screen.y, this.size, this.size);
      ctx.restore();
    }

  }

  // Helper: explosions on impact
  function createImpactExplosion(x, y, colorHex) {
    for (let i = 0; i < 12; i++) {
      particles.push(new Particle(x, y, colorHex));
    }
  }

  // ----------------------------------------------------
  // GRID LOADER & BUILDER
  // ----------------------------------------------------
  let flagpoleInstance = null;

  function loadLevelFromGrid() {
    collidables.length = 0;
    interactiveBlocks.length = 0;
    coinsList.length = 0;
    enemies.length = 0;
    items.length = 0;
    projectiles.length = 0;
    particles.length = 0;
    
    flagpoleInstance = null;

    for (let r = 0; r < gridRows; r++) {
      const rowString = activeGrid[r];
      for (let c = 0; c < gridCols; c++) {
        const char = rowString[c];
        
        if (char === 'G') {
          collidables.push(new Block(c, r, 'ground'));
        } 
        else if (char === 'B') {
          const block = new Block(c, r, 'brick');
          collidables.push(block);
          interactiveBlocks.push(block);
        }
        else if (char === 'Q') {
          const block = new Block(c, r, 'question', 'coin');
          collidables.push(block);
          interactiveBlocks.push(block);
        }
        else if (char === 'M') {
          const block = new Block(c, r, 'question', 'mushroom');
          collidables.push(block);
          interactiveBlocks.push(block);
        }
        else if (char === 'F') {
          const block = new Block(c, r, 'question', 'fireflower');
          collidables.push(block);
          interactiveBlocks.push(block);
        }
        else if (char === 'S') {
          const block = new Block(c, r, 'question', 'star');
          collidables.push(block);
          interactiveBlocks.push(block);
        }
        else if (char === 'A') {
          const block = new Block(c, r, 'question', 'magnet');
          collidables.push(block);
          interactiveBlocks.push(block);
        }
        else if (char === 'P') {
          collidables.push(new Block(c, r, 'pipe'));
        }
        else if (char === 'C') {
          coinsList.push(new Coin(c, r));
        }
        else if (char === 'E') {
          enemies.push(new Enemy(c, r, 'goomba'));
        }
        else if (char === 'K') {
          enemies.push(new Enemy(c, r, 'koopa'));
        }
        else if (char === 'T') {
          enemies.push(new Enemy(c, r, 'beetle'));
        }
        else if (char === 'D') {
          enemies.push(new Enemy(c, r, 'drone'));
        }
        else if (char === 'X') {
          enemies.push(new Enemy(c, r, 'bowser'));
        }
        else if (char === 'L') {
          flagpoleInstance = new Flagpole(c, r);
        }
      }
    }
  }

  // ----------------------------------------------------
  // COLLISION DETECTION & RESOLUTION
  // ----------------------------------------------------
  function resolveCollisions() {
    if (levelComplete) return;

    // AABB Player box
    let pBox = {
      left: player.x,
      right: player.x + player.width,
      top: player.y,
      bottom: player.y + player.height
    };

    let stoodOnObject = false;

    // 1. Collisions against Solid structures
    collidables.forEach(block => {
      let bBox = {
        left: block.x,
        right: block.x + block.width,
        top: block.y,
        bottom: block.y + block.height
      };

      // Check intersections
      if (pBox.right > bBox.left && pBox.left < bBox.right &&
          pBox.bottom > bBox.top && pBox.top < bBox.bottom) {
        
        // Resolve axis of least penetration
        const overlapX = Math.min(pBox.right - bBox.left, bBox.right - pBox.left);
        const overlapY = Math.min(pBox.bottom - bBox.top, bBox.bottom - pBox.top);

        if (overlapY < overlapX) {
          // Vertical Collision
          if (player.vy >= 0 && pBox.bottom - player.vy <= bBox.top + 12) {
            player.y = bBox.top - player.height;
            player.vy = 0;
            stoodOnObject = true;
            player.stompCombo = 0;
          } 
          else if (player.vy < 0 && pBox.top - player.vy >= bBox.bottom - 12) {
            player.y = bBox.bottom;
            player.vy = 0.5; // bounce down
            
            // Trigger block action
            if (block.type === 'brick' || block.type === 'question') {
              if (!block.hit) {
                block.hit = true;
                sounds.hit();
                triggerVibrate(15);
                
                if (block.itemType === 'coin') {
                  coins++;
                  score += 200;
                  hudCoins.textContent = `💰 ${String(coins).padStart(2, '0')}`;
                  sounds.coin();
                  triggerScreenShake(4, 100);
                  floatingTexts.push(new FloatingText(block.x + BLOCK_SIZE/2, block.y - 20, "+200", "#ffd700"));
                  
                  // Spawn coin jump
                  const pop = new Coin(block.gridX, block.gridY - 1);
                  pop.vy = -6;
                  setTimeout(() => {
                    const idx = coinsList.indexOf(pop);
                    if (idx > -1) coinsList.splice(idx, 1);
                  }, 300);
                  coinsList.push(pop);
                } else {
                  // Spawn Powerup
                  items.push(new Item(block.x + 5, block.y - 30, block.itemType));
                  triggerScreenShake(6, 120);
                  floatingTexts.push(new FloatingText(block.x + BLOCK_SIZE/2, block.y - 20, "ITEM!", "#ffe066"));
                }
              }
            }
          }
        } else {
          // Horizontal Collision
          if (pBox.left + player.width/2 < bBox.left + block.width/2) {
            player.x = bBox.left - player.width;
          } else {
            player.x = bBox.right;
          }
          player.vx = 0;
        }

        // Re-sync bounding box
        pBox = {
          left: player.x,
          right: player.x + player.width,
          top: player.y,
          bottom: player.y + player.height
        };
      }
    });

    player.onGround = stoodOnObject;

    // 2. Collisions against Coins
    const isMagnetActive = (player.powerup === 'magnet' || charType === 'stego');
    const magnetRadius = (player.powerup === 'magnet') ? 220 : 90;

    coinsList.forEach(coin => {
      if (coin.collected) return;

      const dx = (player.x + player.width/2) - (coin.x + coin.width/2);
      const dy = (player.y + player.height/2) - (coin.y + coin.height/2);
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      if (isMagnetActive && dist < magnetRadius) {
        coin.vx = (dx / dist) * 7.5;
        coin.vy = (dy / dist) * 7.5;
      }

      if (pBox.right > coin.x && pBox.left < coin.x + coin.width &&
          pBox.bottom > coin.y && pBox.top < coin.y + coin.height) {
        coin.collected = true;
        coins++;
        score += 200;
        hudCoins.textContent = `💰 ${String(coins).padStart(2, '0')}`;
        sounds.coin();
        triggerVibrate(10);
        floatingTexts.push(new FloatingText(coin.x + coin.width/2, coin.y - 15, "+200", "#ffd700", 18));
      }
    });
    coinsList = coinsList.filter(c => !c.collected);

    // 3. Collisions against Power-up Items
    items.forEach(item => {
      if (item.collected) return;
      if (pBox.right > item.x && pBox.left < item.x + item.width &&
          pBox.bottom > item.y && pBox.top < item.y + item.height) {
        item.collected = true;
        player.applyPowerup(item.type);
        score += 500;
        triggerScreenShake(8, 150);
        floatingTexts.push(new FloatingText(player.x + player.width/2, player.y - 20, item.type.toUpperCase(), "#ff8c00", 24));
        
        if (item.type !== 'mushroom') {
          powerupStatusBar.style.display = 'flex';
          powerupName.textContent = item.type.toUpperCase();
          powerupName.style.color = (item.type === 'star') ? 'var(--toon-red)' : 'var(--toon-blue)';
          powerupProgressFill.style.width = '100%';
        }
      }
    });
    items = items.filter(i => !i.collected);

    // 4. Collisions against Enemies
    enemies.forEach(enemy => {
      if (enemy.stamped) return;

      let enemyBox = {
        left: enemy.x,
        right: enemy.x + enemy.width,
        top: enemy.y,
        bottom: enemy.y + enemy.height
      };

      // Check Fireballs against enemy
      projectiles.forEach(p => {
        if (!p.destroyed && !p.isEnemy) {
          if (p.x + p.width > enemyBox.left && p.x < enemyBox.right &&
              p.y + p.height > enemyBox.top && p.y < enemyBox.bottom) {
            p.destroyed = true;
            enemy.takeStompDamage();
          }
        }
      });

      // Check Player against enemy
      if (pBox.right > enemyBox.left && pBox.left < enemyBox.right &&
          pBox.bottom > enemyBox.top && pBox.top < enemyBox.bottom) {
        
        if (player.powerup === 'star' || player.isDashing) {
          enemy.takeStompDamage();
        }
        // Jump Stomp from top (cannot stomp beetle spikes!)
        else if (player.vy > 0 && pBox.bottom - player.vy <= enemyBox.top + 12 && enemy.type !== 'beetle') {
          player.vy = -8.5; // bounce up
          player.onGround = false;
          enemy.takeStompDamage();
        }
        // Take damage
        else {
          player.takeDamage();
        }
      }
    });

    // Check Enemy Fireballs hitting Player
    projectiles.forEach(p => {
      if (p.isEnemy && !p.destroyed) {
        if (p.x + p.width > pBox.left && p.x < pBox.right &&
            p.y + p.height > pBox.top && p.y < pBox.bottom) {
          p.destroyed = true;
          player.takeDamage();
        }
      }
    });

    // Clean squashed enemies
    enemies.forEach((e, idx) => {
      if (e.stamped && e.stampTimer >= 500) {
        enemies.splice(idx, 1);
      }
    });

    // 5. Victory Flagpole Trigger
    if (flagpoleInstance && !levelComplete) {
      if (pBox.right > flagpoleInstance.x && pBox.left < flagpoleInstance.x + flagpoleInstance.width &&
          pBox.bottom > flagpoleInstance.y && pBox.top < flagpoleInstance.y + flagpoleInstance.height) {
        triggerVictory();
      }
    }
  }

  // ----------------------------------------------------
  // VICTORY / DEATH SEQUENCES
  // ----------------------------------------------------
  function triggerVictory() {
    localStorage.setItem(levelDeathsKey, '0');
    
    // Unlock next level
    if (selectedLevelNum < 5) {
      let maxLevel = parseInt(localStorage.getItem('alphadino_max_level')) || 1;
      if (selectedLevelNum + 1 > maxLevel) {
        localStorage.setItem('alphadino_max_level', selectedLevelNum + 1);
      }
    }

    levelComplete = true;
    gameState = 'PAUSED';
    sounds.victory();
    triggerVibrate([50, 100, 150, 200]);
    
    player.vx = 0;
    player.vy = 2; // slowly slide down the flagpole

    setTimeout(() => {
      goPlayer.textContent = playerName;
      goChar.textContent = `${names[charType]} ${emojis[charType]}`;
      goCoins.textContent = `💰 ${coins}`;
      goTime.textContent = `${timeElapsed.toFixed(1)}s`;
      
      const finalScoreValue = Math.floor(score + coins * 150 + Math.max(0, 300 - timeElapsed) * 10);
      goScore.textContent = finalScoreValue;
      
      // Calculate rating Rank
      let ratingRank = 'C';
      if (finalScoreValue > 15000) ratingRank = 'S';
      else if (finalScoreValue > 10000) ratingRank = 'A';
      else if (finalScoreValue > 6000) ratingRank = 'B';
      
      const goRank = document.getElementById('go-rank');
      if (goRank) {
        goRank.textContent = ratingRank;
        const rankColors = { S: '#ffd700', A: '#36b1e3', B: '#ff8c00', C: '#7c5436' };
        goRank.style.color = rankColors[ratingRank];
        goRank.style.textShadow = '2.5px 2.5px 0px var(--toon-brown)';
      }
      
      const records = JSON.parse(localStorage.getItem('alphadino_leaderboard')) || [];
      const newEntry = {
        name: playerName,
        character: charType,
        coins: coins,
        time: Math.floor(timeElapsed),
        score: finalScoreValue
      };
      records.push(newEntry);
      records.sort((a,b) => b.score - a.score);
      localStorage.setItem('alphadino_leaderboard', JSON.stringify(records.slice(0, 10)));

      const modalTitle = document.querySelector('#gameover-overlay .card-title');
      modalTitle.textContent = "FASE CONCLUÍDA!";
      modalTitle.className = "card-title text-center neon-text-cyan";
      
      const restartBtn = document.getElementById('btn-restart');
      if (selectedLevelNum < 5) {
        restartBtn.textContent = `Ir para Fase ${selectedLevelNum + 1}`;
        restartBtn.onclick = () => {
          sessionStorage.setItem('alphadino_active_level', selectedLevelNum + 1);
          window.location.reload();
        };
      } else {
        restartBtn.textContent = "Jogar Novamente";
        restartBtn.onclick = () => window.location.reload();
      }

      gameoverOverlay.style.display = 'flex';
    }, 1500);
  }

  function triggerDeath() {
    levelDeaths++;
    localStorage.setItem(levelDeathsKey, levelDeaths);
    gameState = 'GAMEOVER';
    sounds.gameover();
    triggerVibrate([300, 100, 300]);
    
    goPlayer.textContent = playerName;
    goChar.textContent = `${names[charType]} ${emojis[charType]}`;
    goCoins.textContent = `💰 ${coins}`;
    goTime.textContent = `${timeElapsed.toFixed(1)}s`;
    
    const finalScoreValue = Math.floor(score + coins * 100);
    goScore.textContent = finalScoreValue;
    
    // Death rating Rank
    let ratingRank = 'C';
    if (finalScoreValue > 8000) ratingRank = 'B';
    else if (finalScoreValue > 4000) ratingRank = 'C';
    
    const goRank = document.getElementById('go-rank');
    if (goRank) {
      goRank.textContent = ratingRank;
      const rankColors = { S: '#ffd700', A: '#36b1e3', B: '#ff8c00', C: '#7c5436' };
      goRank.style.color = rankColors[ratingRank];
      goRank.style.textShadow = '2.5px 2.5px 0px var(--toon-brown)';
    }

    const modalTitle = document.querySelector('#gameover-overlay .card-title');
    modalTitle.textContent = "FIM DE JOGO";
    modalTitle.className = "card-title text-center neon-text-magenta";

    const restartBtn = document.getElementById('btn-restart');
    restartBtn.textContent = "Jogar Novamente";
    restartBtn.onclick = () => {
      window.location.reload();
    };

    gameoverOverlay.style.display = 'flex';
  }

  // ----------------------------------------------------
  // MAIN GAME LOOP MAPPED TO 2D CANVAS
  // ----------------------------------------------------
  let lastTime = performance.now();

  function update(dt) {
    if (gameState !== 'PLAYING') return;
    
    if (hitstopTimer > 0) {
      hitstopTimer -= dt;
      return;
    }

    timeElapsed += dt / 1000;
    hudTime.textContent = `${timeElapsed.toFixed(1)}s`;
    
    score += Math.floor(dt * 0.005);
    hudScore.textContent = String(score).padStart(5, '0');

    // Update player
    player.update(dt);

    // Camera follow X & Y smoothly with LERP clamping bounds (centering player)
    const targetCamX = player.x + player.width / 2 - canvas.width / 2;
    const targetCamY = player.y + player.height / 2 - canvas.height / 2;

    const lerpSpeed = 0.08;
    const t = 1 - Math.exp(-lerpSpeed * (dt / 16.66));

    cameraX += (targetCamX - cameraX) * t;
    cameraY += (targetCamY - cameraY) * t;

    // Clamp camera to world boundaries
    const maxCamX = (gridCols * BLOCK_SIZE) - canvas.width;
    if (cameraX < 0) cameraX = 0;
    if (cameraX > maxCamX) cameraX = maxCamX;

    const maxCamY = (gridRows * BLOCK_SIZE) - canvas.height;
    if (cameraY < 0) cameraY = 0;
    if (cameraY > maxCamY) cameraY = maxCamY;


    // Update status HUD bar
    if (player.powerup && player.powerup !== 'mushroom') {
      const percentage = (player.powerupDuration / player.powerupMaxDuration) * 100;
      powerupProgressFill.style.width = `${Math.max(0, percentage)}%`;
    } else {
      powerupStatusBar.style.display = 'none';
    }

    // Update entities
    interactiveBlocks.forEach(b => b.update());
    coinsList.forEach(c => c.update());
    enemies.forEach(e => e.update(dt));
    
    projectiles.forEach(p => p.update());
    
    floatingTexts.forEach(t => t.update());
    floatingTexts = floatingTexts.filter(t => t.life > 0);
    
    particles.forEach((p, idx) => {
      p.update();
      if (p.life <= 0) particles.splice(idx, 1);
    });

    // Clean projectiles
    projectiles.forEach((p, idx) => {
      if (p.destroyed || p.x < player.x - 600 || p.x > player.x + 600) {
        projectiles.splice(idx, 1);
      }
    });

    // Collisions
    resolveCollisions();
  }

  function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    // Screen shake translate
    if (screenShakeDuration > 0) {
      const shakeX = (Math.random() - 0.5) * screenShakeIntensity;
      const shakeY = (Math.random() - 0.5) * screenShakeIntensity;
      ctx.translate(shakeX, shakeY);
      screenShakeDuration -= 16.6; // ~1 frame at 60fps
    }

    // 1. Draw seamless looping parallax backgrounds
    if (assets.bg && assets.bg.complete && assets.bg.naturalWidth > 0) {
      let bgOffset = (-cameraX * 0.25) % canvas.width;
      ctx.drawImage(assets.bg, bgOffset, 0, canvas.width, canvas.height);
      ctx.drawImage(assets.bg, bgOffset + canvas.width, 0, canvas.width, canvas.height);
    }

    // Contrast tint overlay: washes out the background slightly so characters stand out!
    let overlayColor = 'rgba(255, 255, 255, 0.4)'; // Default Forest/Skyline (white fog)
    if (selectedLevelNum === 2) {
      overlayColor = 'rgba(253, 240, 210, 0.35)'; // Desert (warm sand mist)
    } else if (selectedLevelNum === 3) {
      overlayColor = 'rgba(200, 200, 240, 0.35)'; // Cave (cool cave haze)
    } else if (selectedLevelNum === 5) {
      overlayColor = 'rgba(110, 40, 40, 0.35)'; // Lava (dark red heat haze)
    }
    ctx.fillStyle = overlayColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);


    // 2. Draw Tiles, Coins, Flagpole
    collidables.forEach(block => block.draw());
    coinsList.forEach(coin => coin.draw());
    if (flagpoleInstance) flagpoleInstance.draw();

    // 3. Draw Enemies, Items, Projectiles, and Particles
    enemies.forEach(e => e.draw());
    items.forEach(i => i.draw());
    projectiles.forEach(p => p.draw());
    particles.forEach(p => p.draw());

    // 4. Draw Player
    player.draw();
    
    // 5. Draw Floating Texts
    floatingTexts.forEach(t => t.draw());
    
    ctx.restore();
  }

  let accumulator = 0;
  const dtLogical = 1000 / 60; // 60Hz physics update (16.66ms per step)
  const maxFrameTime = 250; // clamp to prevent spiral of death

  function gameLoop(timestamp) {
    let frameTime = timestamp - lastTime;
    if (frameTime > maxFrameTime) {
      frameTime = maxFrameTime;
    }
    lastTime = timestamp;

    accumulator += frameTime;

    // Run physics updates at fixed intervals
    while (accumulator >= dtLogical) {
      update(dtLogical);
      accumulator -= dtLogical;
    }

    // Draw the current state
    draw();

    requestAnimationFrame(gameLoop);
  }


  // Load level blocks
  loadLevelFromGrid();

  // ----------------------------------------------------
  // INPUT EVENT LISTENERS (Keyboards & Joystick Touch)
  // ----------------------------------------------------
  function setLeft(state) {
    keys.left = state;
    initAudio();
  }
  function setRight(state) {
    keys.right = state;
    initAudio();
  }
  function setJump(state) {
    keys.jump = state;
    if (state) {
      player.jumpBufferTimer = 150; // set 150ms buffer timer
    }
    initAudio();
  }

  function triggerSpecial() {
    keys.special = true;
    initAudio();
  }

  // A. Key Down/Up
  window.addEventListener('keydown', e => {
    if (gameState !== 'PLAYING') return;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') setLeft(true);
    if (e.code === 'KeyD' || e.code === 'ArrowRight') setRight(true);
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') setJump(true);
    if (e.code === 'KeyX' || e.code === 'ShiftLeft') triggerSpecial();
  });

  window.addEventListener('keyup', e => {
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') setLeft(false);
    if (e.code === 'KeyD' || e.code === 'ArrowRight') setRight(false);
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') setJump(false);
  });

  // B. Mobile Touch mapping (Joystick)
  const joystickBase = document.getElementById('joystick-base');
  const joystickHandle = document.getElementById('joystick-handle');
  const joystickContainer = document.getElementById('joystick-container');

  let joystickActive = false;
  let joystickTouchId = null;
  let startX = 0;
  let startY = 0;
  const maxDrag = 40;

  function handleJoystickStart(e) {
    if (e.cancelable) e.preventDefault();
    const touch = e.changedTouches[0];
    joystickActive = true;
    joystickTouchId = touch.identifier;
    
    const rect = joystickContainer.getBoundingClientRect();
    const x = touch.clientX - rect.left - 53;
    const y = touch.clientY - rect.top - 53;
    
    joystickBase.style.position = 'absolute';
    joystickBase.style.left = `${x}px`;
    joystickBase.style.top = `${y}px`;
    joystickBase.style.bottom = 'auto';
    joystickBase.style.opacity = '1';
    
    startX = touch.clientX;
    startY = touch.clientY;
    
    initAudio();
  }

  function handleJoystickMove(e) {
    if (e.cancelable) e.preventDefault();
    if (!joystickActive) return;
    
    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      if (touch.identifier === joystickTouchId) {
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        let moveX = dx;
        let moveY = dy;
        
        if (dist > maxDrag) {
          moveX = (dx / dist) * maxDrag;
          moveY = (dy / dist) * maxDrag;
        }
        
        joystickHandle.style.transform = `translate(${moveX}px, ${moveY}px)`;
        
        const threshold = 12;
        if (moveX < -threshold) {
          keys.left = true;
          keys.right = false;
        } else if (moveX > threshold) {
          keys.right = true;
          keys.left = false;
        } else {
          keys.left = false;
          keys.right = false;
        }
      }
    }
  }

  function handleJoystickEnd(e) {
    if (e.cancelable) e.preventDefault();
    if (!joystickActive) return;
    
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickTouchId) {
        joystickActive = false;
        joystickTouchId = null;
        
        joystickBase.style.position = 'absolute';
        joystickBase.style.left = '40px';
        joystickBase.style.bottom = '40px';
        joystickBase.style.top = 'auto';
        joystickBase.style.opacity = '0.4';
        joystickHandle.style.transform = 'translate(0px, 0px)';
        
        keys.left = false;
        keys.right = false;
      }
    }
  }


  if (joystickContainer) {
    joystickContainer.addEventListener('touchstart', handleJoystickStart, { passive: false });
    window.addEventListener('touchmove', handleJoystickMove, { passive: false });
    window.addEventListener('touchend', handleJoystickEnd, { passive: false });
    window.addEventListener('touchcancel', handleJoystickEnd, { passive: false });

    // Desktop Mouse Emulation
    let mouseActive = false;
    joystickContainer.addEventListener('mousedown', e => {
      mouseActive = true;
      const rect = joystickContainer.getBoundingClientRect();
      const x = e.clientX - rect.left - 53;
      const y = e.clientY - rect.top - 53;
      joystickBase.style.position = 'absolute';
      joystickBase.style.left = `${x}px`;
      joystickBase.style.top = `${y}px`;
      joystickBase.style.bottom = 'auto';
      joystickBase.style.opacity = '1';
      startX = e.clientX;
      startY = e.clientY;
      initAudio();
    });

    window.addEventListener('mousemove', e => {
      if (!mouseActive) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      let moveX = dx;
      let moveY = dy;
      if (dist > maxDrag) {
        moveX = (dx / dist) * maxDrag;
        moveY = (dy / dist) * maxDrag;
      }
      joystickHandle.style.transform = `translate(${moveX}px, ${moveY}px)`;
      const threshold = 12;
      if (moveX < -threshold) {
        keys.left = true;
        keys.right = false;
      } else if (moveX > threshold) {
        keys.right = true;
        keys.left = false;
      } else {
        keys.left = false;
        keys.right = false;
      }
    });

    window.addEventListener('mouseup', () => {
      if (mouseActive) {
        mouseActive = false;
        joystickBase.style.position = 'absolute';
        joystickBase.style.left = '40px';
        joystickBase.style.bottom = '40px';
        joystickBase.style.top = 'auto';
        joystickBase.style.opacity = '0.4';
        joystickHandle.style.transform = 'translate(0px, 0px)';
        keys.left = false;
        keys.right = false;
      }
    });
  }

  const btnJump = document.getElementById('ctrl-jump');
  const btnSpecial = document.getElementById('ctrl-special');
  const lblSpecial = document.getElementById('ctrl-special-label');
  
  const specialLabels = {
    raptor: 'FIRE',
    ptera: 'GLIDE',
    trex: 'SHIELD',
    trike: 'DASH',
    stego: 'MAGNET'
  };
  lblSpecial.textContent = specialLabels[charType] || 'SP';

  function bindTouchButton(element, pressCallback, releaseCallback) {
    element.addEventListener('touchstart', e => {
      e.preventDefault();
      pressCallback();
    }, { passive: false });
    
    element.addEventListener('touchend', e => {
      e.preventDefault();
      if (releaseCallback) releaseCallback();
    }, { passive: false });

    // Fallbacks
    element.addEventListener('mousedown', e => {
      e.preventDefault();
      pressCallback();
    });
    element.addEventListener('mouseup', e => {
      e.preventDefault();
      if (releaseCallback) releaseCallback();
    });
    element.addEventListener('mouseleave', e => {
      if (releaseCallback) releaseCallback();
    });
  }

  if (btnJump) {
    bindTouchButton(btnJump, () => setJump(true), () => setJump(false));
  }
  if (btnSpecial) {
    bindTouchButton(btnSpecial, () => triggerSpecial(), null);
  }

  // C. Pause Toggle & Navigation Handlers
  btnPauseToggle.addEventListener('click', () => {
    if (gameState === 'PLAYING') {
      gameState = 'PAUSED';
      btnPauseToggle.textContent = '▶️';
      pauseOverlay.style.display = 'flex';
    } else if (gameState === 'PAUSED') {
      gameState = 'PLAYING';
      btnPauseToggle.textContent = '⏸️';
      pauseOverlay.style.display = 'none';
      lastTime = performance.now();
    }
  });

  btnResume.addEventListener('click', () => {
    gameState = 'PLAYING';
    btnPauseToggle.textContent = '⏸️';
    pauseOverlay.style.display = 'none';
    lastTime = performance.now();
  });

  btnHome.addEventListener('click', () => {
    window.location.href = '../index.html';
  });
  btnPauseHome.addEventListener('click', () => {
    window.location.href = '../index.html';
  });
  // Prevent browser gestures, pull-to-refresh, and scrolling on the game page
  document.addEventListener('touchmove', e => {
    if (e.target.closest('.canvas-container') || e.target.closest('.mobile-controls') || e.target.id === 'gameCanvas') {
      if (e.cancelable) e.preventDefault();
    }
  }, { passive: false });
});


