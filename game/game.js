// AlphaDino 2D Cartoon Game Engine (Looney Tunes Style)

document.addEventListener('DOMContentLoaded', () => {
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
    dinos: new Image(),
    enemies: new Image(),
    tiles: new Image(),
    bg: new Image()
  };

  // Set Sources
  assets.dinos.src = '../assets/characters/dinos.png';
  assets.enemies.src = '../assets/enemies/enemies.png';
  assets.tiles.src = '../assets/tiles/tiles.png';
  
  const levelBgs = {
    1: '../assets/backgrounds/bg_forest.png',
    2: '../assets/backgrounds/bg_desert.png',
    3: '../assets/backgrounds/bg_cave.png',
    4: '../assets/backgrounds/bg_forest.png',
    5: '../assets/backgrounds/bg_lava.png'
  };
  assets.bg.src = levelBgs[selectedLevelNum] || levelBgs[1];

  let assetsLoaded = 0;
  const totalAssets = 4;
  
  function checkAssetsLoaded() {
    assetsLoaded++;
    if (assetsLoaded === totalAssets) {
      // Start Game Loops
      requestAnimationFrame(gameLoop);
    }
  }

  assets.dinos.onload = () => {
    dinoBounds = scanDinoBounds(assets.dinos);
    checkAssetsLoaded();
  };
  assets.enemies.onload = () => {
    enemyBounds = scanEnemyBounds(assets.enemies);
    checkAssetsLoaded();
  };
  assets.tiles.onload = checkAssetsLoaded;
  assets.bg.onload = checkAssetsLoaded;


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
      "                                                                                                                                                                                                ",
      "                                                                                                                                                                                                ",
      "                                                                                                                                                                                                ",
      "                                                                                                                                                                                                ",
      "                                                                                                                                                                                                ",
      "                 B Q B             C C C             B M B                               B Q B                                                                                                  ",
      "                                                                                                                                                                                                ",
      "                                C C C                                                                         C C C                                                                             ",
      "                             B Q M Q B                                                                     B Q S Q B                                                                            ",
      "          P                                                             P B P                                                                  P                                             L  ",
      "         P P               E               E               E           P B B P            E               E               E                   P P                                            ",
      "GGGGGGGGGGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGG   GGGGGGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGGGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG"
    ],
    2: [
      "                                                                                                                                                                                                                                ",
      "                                                                                                                                                                                                                                ",
      "                                                                                                                                                                                                                                ",
      "                                                                                                                                                                                                                                ",
      "                                                                                                                                                                                                                                ",
      "                 B S B             C C C             B Q B                                                                                             B Q B                                                                    ",
      "                                  B Q F B                                                                                                           B Q S B                                                                     ",
      "                                                                                                                                                                                                                                ",
      "                                                                        C C C                                                                                                   C C C                                           ",
      "                             K                                         B Q Q B                            E              E              K                                      B Q Q B                                       L  ",
      "          P                 P P                                       P B B P                            P P            P P            P P                                    P B B P                                       ",
      "GGGGGGGGGGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGG   GGGGGGGGGGGGGG   GGGGGGGGGGGGGG   GGGGGGGGGGGGGG   GGGGGGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG"
    ],
    3: [
      "                                                                                                                                                                                                                                                ",
      "                                                                                                                                                                                                                                                ",
      "                                                                                                                                                                                                                                                ",
      "                                                                                                                                                                                                                                                ",
      "                                                                                                                                                                                                                                                ",
      "                 B A B                               B Q B                                                                                             B Q B                                                                            ",
      "                                                                                                                                                                                                                                                ",
      "                                C C C                                                                                                               C C C                                                                               ",
      "                             B Q M Q B                    T                                             T                                            B Q M Q B                                                                          ",
      "          T                                                              C C                                                                                                 C C                                                     L  ",
      "          P                 P P                                         P B P                           P P            P P                                                  P B P                                                   ",
      "GGGGGGGGGGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGG   GGGGGGGGGGGGGG   GGGGGGGGGGGGGG   GGGGGGGGGGGGGG   GGGGGGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG"
    ],
    4: [
      "                                                                                                                                                                                                                                                                ",
      "                                                                                                                                                                                                                                                                ",
      "                                                                                                                                                                                                                                                                ",
      "                                                                                                                                                                                                                                                                ",
      "                                                                                                                                                                                                                                                                ",
      "                 B S B                                                                                             B S B                                                                                                                                        ",
      "                                                                                                                                                                                                                                                                ",
      "                                C D C                                                                                                               C D C                                                                                                       ",
      "                             B Q F Q B                                                                                                           B Q F Q B                                                                                                      ",
      "          P                                                             P B P                                           P                                                               P B P                                                        L  ",
      "         P P               D               D                           P B B P            D               D            P P                                                             P B B P                                                       ",
      "GGGGGGGGGGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGG   GGGGGGGGGGGGGG   GGGGGGGGGGGGGG   GGGGGGGGGGGGGG   GGGGGGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG"
    ],
    5: [
      "                                                                                                                                                                                                                                                                                ",
      "                                                                                                                                                                                                                                                                                ",
      "                                                                                                                                                                                                                                                                                ",
      "                                                                                                                                                                                                                                                                                ",
      "                                                                                                                                                                                                                                                                                ",
      "                 B S B                                                                                             B S B                                                                                                                                                        ",
      "                                                                                                                                                                                                                                                                                ",
      "                                C C C                                                                                                               C C C                                                                                                                       ",
      "                             B Q M Q B                                                                                                           B Q M Q B                                                                                                                      ",
      "          P                                                                                             P B P                                                                                           P B P                                                                L  ",
      "         P P               K               T               D               E                           P B B P            E               K               T               D                             P B B P                              X                               ",
      "GGGGGGGGGGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGG   GGGGGGGGGGGGGG   GGGGGGGGGGGGGG   GGGGGGGGGGGGGG   GGGGGGGGGGGGGG   GGGGGGGGGGGGGG   GGGGGGGGGGGGGG   GGGGGGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG"
    ]
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

  // Pre-calculated boundaries for spritesheets
  let dinoBounds = null;
  let enemyBounds = null;

  function scanDinoBounds(image) {
    const cols = 5;
    const rows = 5;
    const frameWidth = image.width / cols;
    const frameHeight = image.height / rows;
    const canvas = document.createElement('canvas');
    canvas.width = frameWidth;
    canvas.height = frameHeight;
    const tempCtx = canvas.getContext('2d');
    const bounds = [];
    
    for (let r = 0; r < rows; r++) {
      let globalMinX = frameWidth;
      let globalMaxX = 0;
      let globalMinY = frameHeight;
      let globalMaxY = 0;
      let foundAny = false;
      
      for (let c = 0; c < cols; c++) {
        tempCtx.clearRect(0, 0, frameWidth, frameHeight);
        tempCtx.drawImage(image, c * frameWidth, r * frameHeight, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
        
        let imgData;
        try {
          imgData = tempCtx.getImageData(0, 0, frameWidth, frameHeight);
        } catch (e) {
          foundAny = false;
          break;
        }
        
        for (let y = 0; y < frameHeight; y++) {
          for (let x = 0; x < frameWidth; x++) {
            const idx = (y * frameWidth + x) * 4;
            const alpha = imgData.data[idx + 3];
            if (alpha > 10) {
              if (x < globalMinX) globalMinX = x;
              if (x > globalMaxX) globalMaxX = x;
              if (y < globalMinY) globalMinY = y;
              if (y > globalMaxY) globalMaxY = y;
              foundAny = true;
            }
          }
        }
      }
      
      if (!foundAny) {
        bounds[r] = { minX: 0, maxX: frameWidth - 1, minY: 0, maxY: frameHeight - 1, sWidth: frameWidth, sHeight: frameHeight };
      } else {
        bounds[r] = {
          minX: globalMinX, maxX: globalMaxX, minY: globalMinY, maxY: globalMaxY,
          sWidth: globalMaxX - globalMinX + 1, sHeight: globalMaxY - globalMinY + 1
        };
      }
    }
    return bounds;
  }

  function scanEnemyBounds(image) {
    const cols = 5;
    const rows = 2;
    const frameWidth = image.width / cols;
    const frameHeight = image.height / rows;
    const canvas = document.createElement('canvas');
    canvas.width = frameWidth;
    canvas.height = frameHeight;
    const tempCtx = canvas.getContext('2d');
    const bounds = [];
    
    for (let c = 0; c < cols; c++) {
      let globalMinX = frameWidth;
      let globalMaxX = 0;
      let globalMinY = frameHeight;
      let globalMaxY = 0;
      let foundAny = false;
      
      for (let r = 0; r < rows; r++) {
        tempCtx.clearRect(0, 0, frameWidth, frameHeight);
        tempCtx.drawImage(image, c * frameWidth, r * frameHeight, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
        
        let imgData;
        try {
          imgData = tempCtx.getImageData(0, 0, frameWidth, frameHeight);
        } catch (e) {
          foundAny = false;
          break;
        }
        
        for (let y = 0; y < frameHeight; y++) {
          for (let x = 0; x < frameWidth; x++) {
            const idx = (y * frameWidth + x) * 4;
            const alpha = imgData.data[idx + 3];
            if (alpha > 10) {
              if (x < globalMinX) globalMinX = x;
              if (x > globalMaxX) globalMaxX = x;
              if (y < globalMinY) globalMinY = y;
              if (y > globalMaxY) globalMaxY = y;
              foundAny = true;
            }
          }
        }
      }
      
      if (!foundAny) {
        bounds[c] = { minX: 0, maxX: frameWidth - 1, minY: 0, maxY: frameHeight - 1, sWidth: frameWidth, sHeight: frameHeight };
      } else {
        bounds[c] = {
          minX: globalMinX, maxX: globalMaxX, minY: globalMinY, maxY: globalMaxY,
          sWidth: globalMaxX - globalMinX + 1, sHeight: globalMaxY - globalMinY + 1
        };
      }
    }
    return bounds;
  }

  // Unified rendering layer aligning sprite center of mass with collision hitbox
  function drawSprite(ctx, image, type, rowIdx, colIdx, screenX, screenY, destWidth, destHeight, facingRight, rotation = 0, opacity = 1, isEnemy = false, isSquashed = false) {
    ctx.save();
    ctx.globalAlpha = opacity;

    let bounds = null;
    let frameWidth = 0;
    let frameHeight = 0;
    let sX, sY, sW, sH;

    if (!isEnemy) {
      frameWidth = image.width / 5;
      frameHeight = image.height / 5;
      bounds = dinoBounds ? dinoBounds[rowIdx] : null;
    } else {
      frameWidth = image.width / 5;
      frameHeight = image.height / 2;
      bounds = enemyBounds ? enemyBounds[colIdx] : null;
    }

    if (bounds) {
      sX = colIdx * frameWidth + bounds.minX;
      sY = rowIdx * frameHeight + bounds.minY;
      sW = bounds.sWidth;
      sH = bounds.sHeight;
    } else {
      frameWidth = image.width / 5;
      frameHeight = isEnemy ? (image.height / 2) : (image.height / 5);
      sW = frameWidth;
      sH = frameHeight;
      sX = colIdx * frameWidth;
      sY = rowIdx * frameHeight;
    }

    let scale = destHeight / sH;
    let renderW = sW * scale;
    let renderH = destHeight;

    if (isSquashed) {
      ctx.translate(screenX + destWidth / 2, screenY + destHeight);
      ctx.scale(1.3, 0.25);
      ctx.translate(0, -renderH / 2);
      if (!facingRight) ctx.scale(-1, 1);
      ctx.drawImage(image, sX, sY, sW, sH, -renderW / 2, -renderH / 2, renderW, renderH);
    } else {
      ctx.translate(screenX + destWidth / 2, screenY + destHeight / 2);
      if (rotation !== 0) {
        ctx.rotate(rotation);
      }
      if (!facingRight) {
        ctx.scale(-1, 1);
      }
      let drawX = -renderW / 2;
      let drawY = destHeight / 2 - renderH;
      ctx.drawImage(image, sX, sY, sW, sH, drawX, drawY, renderW, renderH);
    }

    ctx.restore();
  }


  // Entity Lists
  const collidables = [];
  const interactiveBlocks = [];
  let coinsList = [];
  let enemies = [];
  let items = [];
  let projectiles = [];
  let particles = [];

  const keys = {
    left: false,
    right: false,
    jump: false,
    special: false
  };

  // Dino Sprite sheet slice indices
  const dinoSliceIndices = {
    raptor: 0,
    ptera: 1,
    trex: 2,
    trike: 3,
    stego: 4
  };
  const activeDinoIdx = dinoSliceIndices[charType] || 0;

  // ----------------------------------------------------
  // PLAYER CLASS
  // ----------------------------------------------------
  class Player {
    constructor() {
      this.x = 80;
      this.y = 100;
      this.vx = 0;
      this.vy = 0;
      this.width = 60;
      this.height = 80;
      
      this.onGround = false;
      this.gravity = 0.82;
      this.jumpPower = -17.5;
      this.walkSpeed = 5.4;
      this.stompCombo = 0;
      
      this.life = 1;
      this.hasShield = (charType === 'trex');
      this.powerup = null;
      this.powerupDuration = 0;
      this.powerupMaxDuration = 10000;
      
      this.shootCooldown = 0;
      this.dashCooldown = 0;
      this.isDashing = false;
      this.dashTimer = 0;
      this.jumpHoldTimer = 0;
      this.isGliding = false;
      
      this.facingRight = true;
      this.walkFrameCycle = 0;
      
      this.timeSinceLastOnGround = 0;
      this.jumpBufferTimer = 0;
      this.hasJumpedThisLeap = false;
    }


    update(dt) {
      if (this.shootCooldown > 0) this.shootCooldown -= dt;
      if (this.dashCooldown > 0) this.dashCooldown -= dt;

      // Update coyote and jump buffer timers
      if (this.onGround) {
        this.timeSinceLastOnGround = 0;
        this.hasJumpedThisLeap = false;
      } else {
        this.timeSinceLastOnGround += dt;
      }

      if (this.jumpBufferTimer > 0) {
        this.jumpBufferTimer -= dt;
      }

      // Check jump buffer on landing
      if (this.onGround && this.jumpBufferTimer > 0) {
        this.vy = this.jumpPower;
        this.onGround = false;
        this.jumpBufferTimer = 0;
        this.hasJumpedThisLeap = true;
        sounds.jump();
        triggerVibrate(20);
      }


      // Shield recharge (T-Rex)
      if (charType === 'trex' && !this.hasShield) {
        shieldCooldownTimer += dt;
        if (shieldCooldownTimer >= 30000) {
          this.hasShield = true;
          shieldCooldownTimer = 0;
          sounds.powerup();
          createImpactExplosion(this.x + this.width/2, this.y + this.height/2, '#00f0ff');
        }
      }

      // Dash (Trike)
      if (this.isDashing) {
        this.dashTimer += dt;
        if (this.dashTimer >= 200) {
          this.isDashing = false;
        } else {
          if (Math.random() < 0.4) {
            particles.push(new Particle(this.x + Math.random() * this.width, this.y + Math.random() * this.height, '#ffea00'));
          }
        }
      }

      // Powerup Timers
      if (this.powerup) {
        this.powerupDuration -= dt;
        if (this.powerupDuration <= 0) {
          this.removePowerup();
        }
      }

      // Horizontal Walking Input
      if (!levelComplete && gameState === 'PLAYING') {
        if (this.isDashing) {
          this.vx = 16.5 * (this.facingRight ? 1 : -1);
        } else {
          if (keys.left) {
            this.vx = -this.walkSpeed;
            this.facingRight = false;
            this.walkFrameCycle += 0.25;
          } else if (keys.right) {
            this.vx = this.walkSpeed;
            this.facingRight = true;
            this.walkFrameCycle += 0.25;
          } else {
            this.vx *= 0.75;
            if (Math.abs(this.vx) < 0.1) this.vx = 0;
          }
        }
      }

      // Jump & Glide (Ptera)
      if (keys.jump && !levelComplete && gameState === 'PLAYING') {
        const canCoyoteJump = !this.onGround && (this.timeSinceLastOnGround < 100) && !this.hasJumpedThisLeap;
        if (this.onGround || canCoyoteJump) {
          this.vy = this.jumpPower;
          this.onGround = false;
          this.jumpHoldTimer = 0;
          this.isGliding = false;
          this.hasJumpedThisLeap = true;
          this.jumpBufferTimer = 0; // consumed
          sounds.jump();
          triggerVibrate(20);
        } else {
          this.jumpHoldTimer += dt;
          if (this.jumpHoldTimer < 180) {
            this.vy -= 0.27;
          }
          if (charType === 'ptera' && this.vy > 0) {
            this.isGliding = true;
            this.vy = 1.8; // glide terminal velocity
            if (Math.random() < 0.15) {
              particles.push(new Particle(this.x, this.y + this.height/2, '#00f0ff'));
            }
          }
        }
      } else {
        this.isGliding = false;
      }


      // Gravity
      if (!this.onGround && !this.isGliding && !this.isDashing) {
        this.vy += this.gravity;
      }

      // Apply positions
      this.x += this.vx;
      this.y += this.vy;

      // Screen bounds
      if (this.x < 10) this.x = 10;
      if (this.x > (gridCols * BLOCK_SIZE) - this.width - 10) {
        this.x = (gridCols * BLOCK_SIZE) - this.width - 10;
      }

      // Power-up modifications
      if (this.powerup === 'mushroom') {
        this.width = 84;
        this.height = 112;
      } else {
        this.width = 60;
        this.height = 80;
      }

      // Check Special Ability
      if (keys.special && !levelComplete && gameState === 'PLAYING') {
        this.useSpecialAbility();
        keys.special = false;
      }

      // Star trail
      if (this.powerup === 'star') {
        const colors = ['#ff007f', '#00f0ff', '#ffea00', '#39ff14', '#ff6700'];
        const rColor = colors[Math.floor(Date.now() / 40) % colors.length];
        if (Math.random() < 0.5) {
          particles.push(new Particle(this.x + Math.random() * this.width, this.y + Math.random() * this.height, rColor));
        }
      }

      // Out of bounds check
      if (this.y > canvas.height + 50) {
        triggerDeath();
      }
    }

    useSpecialAbility() {
      if (charType === 'raptor' || this.powerup === 'fireflower') {
        if (this.shootCooldown <= 0) {
          const dir = this.facingRight ? 1 : -1;
          projectiles.push(new Projectile(this.x + (this.facingRight ? this.width : -16), this.y + this.height/3, dir));
          sounds.shoot();
          this.shootCooldown = 600;
        }
      }
      else if (charType === 'trike') {
        if (this.dashCooldown <= 0) {
          this.isDashing = true;
          this.dashTimer = 0;
          this.dashCooldown = 3000;
          sounds.dash();
          triggerVibrate([40,20,40]);
          createImpactExplosion(this.x + (this.facingRight ? this.width : 0), this.y + this.height/2, '#ffea00');
        }
      }
    }

    applyPowerup(type) {
      if (type === 'mushroom') {
        sounds.powerup();
        this.powerup = 'mushroom';
        this.life = 2;
        this.powerupDuration = this.powerupMaxDuration;
        createImpactExplosion(this.x + this.width/2, this.y + this.height/2, '#ff0055');
      }
      else if (type === 'fireflower') {
        sounds.powerup();
        this.powerup = 'fireflower';
        this.powerupDuration = this.powerupMaxDuration;
        createImpactExplosion(this.x + this.width/2, this.y + this.height/2, '#ffaa00');
      }
      else if (type === 'star') {
        sounds.powerup();
        this.powerup = 'star';
        this.powerupDuration = 8000;
        createImpactExplosion(this.x + this.width/2, this.y + this.height/2, '#00f0ff');
      }
      else if (type === 'magnet') {
        sounds.powerup();
        this.powerup = 'magnet';
        this.powerupDuration = 12000;
        createImpactExplosion(this.x + this.width/2, this.y + this.height/2, '#00f0ff');
      }
    }

    removePowerup() {
      sounds.powerdown();
      this.powerup = null;
      this.life = 1;
    }

    takeDamage() {
      if (this.powerup === 'star' || this.isDashing || levelComplete) return;
      if (this.hasShield) {
        this.hasShield = false;
        shieldCooldownTimer = 0;
        sounds.hit();
        triggerVibrate([100,50,100]);
        createImpactExplosion(this.x + this.width/2, this.y + this.height/2, '#00f0ff');
        return;
      }
      if (this.life > 1) {
        this.removePowerup();
        sounds.hit();
        triggerVibrate([80,80]);
        return;
      }
      triggerDeath();
    }

    draw() {
      // Calculate walking frame cycle (0 to 4)
      let animFrame = 0;
      if (Math.abs(this.vx) > 0.1 && this.onGround) {
        animFrame = Math.floor(this.walkFrameCycle) % 5;
      }

      // Add walk cycle frame tilt
      let walkRotation = 0;
      if (Math.abs(this.vx) > 0.1 && this.onGround) {
        walkRotation = Math.sin(this.walkFrameCycle) * 0.08;
      }

      // Calculate screen coordinates using normalization layer
      const screenPos = worldToScreen(this.x, this.y);

      ctx.save();
      // Star rainbow color overlay filter
      if (this.powerup === 'star') {
        ctx.shadowBlur = 15;
        const colors = ['#ff007f', '#00f0ff', '#ffea00', '#39ff14', '#ff6700'];
        ctx.shadowColor = colors[Math.floor(Date.now() / 80) % colors.length];
      } else if (this.powerup === 'fireflower') {
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff5500';
      }

      // Draw the player dino using drawSprite, which handles scale, horizontal centering, bottom-alignment, and flipping!
      drawSprite(
        ctx,
        assets.dinos,
        'dino',
        activeDinoIdx,
        animFrame,
        screenPos.x,
        screenPos.y,
        this.width,
        this.height,
        this.facingRight,
        walkRotation
      );
      ctx.restore();

      // Draw active shield bubble (centered on physical hitbox)
      if (this.hasShield) {
        ctx.save();
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00f0ff';
        ctx.beginPath();
        const center = worldToScreen(this.x + this.width / 2, this.y + this.height / 2);
        ctx.arc(center.x, center.y, Math.max(this.width, this.height) * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Draw magnet ring (centered on physical hitbox)
      if (this.powerup === 'magnet' || charType === 'stego') {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 234, 0, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const center = worldToScreen(this.x + this.width / 2, this.y + this.height / 2);
        ctx.arc(center.x, center.y, (this.powerup === 'magnet' ? 140 : 60), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

  }

  let player = new Player();

  // ----------------------------------------------------
  // BLOCKS CLASS
  // ----------------------------------------------------
  class Block {
    constructor(gridX, gridY, type, itemType = 'coin') {
      this.gridX = gridX;
      this.gridY = gridY;
      this.x = gridX * BLOCK_SIZE;
      this.y = gridY * BLOCK_SIZE;
      this.type = type; // 'ground', 'brick', 'question', 'pipe'
      this.itemType = itemType;
      this.width = BLOCK_SIZE;
      this.height = BLOCK_SIZE;
      this.height = BLOCK_SIZE;
      
      this.hit = false;
      this.hitOffset = 0;
      this.hitSpeed = 0;

      // Slice indices from tiles.png
      // Ground = 0, Brick = 1, Question = 2, Coin = 3, Pipe = 4, Flagpole = 5
      this.sliceIndices = { ground: 0, brick: 1, question: 2, pipe: 4 };
      this.sliceIdx = this.sliceIndices[type] || 0;
    }

    update() {
      // Bonking springy bounce
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
      const frameWidth = assets.tiles.width / 6;
      const frameHeight = assets.tiles.height / 3;

      let renderIdx = this.sliceIdx;
      // If question block was hit, draw it as an empty block (same slice as Pipe top or a dark version of Ground/Brick)
      if (this.type === 'question' && this.hit) {
        renderIdx = 1; // display as standard brick
      }

      let tileRow = 0;
      if (selectedLevelNum === 2) tileRow = 1;
      else if (selectedLevelNum === 3 || selectedLevelNum === 5) tileRow = 2;

      ctx.save();
      // Emissives on question block
      if (this.type === 'question' && !this.hit) {
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#ffea00';
      }

      const screen = worldToScreen(this.x, this.y - this.hitOffset);
      ctx.drawImage(
        assets.tiles,
        renderIdx * frameWidth, tileRow * frameHeight, frameWidth, frameHeight,
        screen.x, screen.y, this.width, this.height
      );
      ctx.restore();
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
      const frameWidth = assets.tiles.width / 6;
      const frameHeight = assets.tiles.height / 3;
      
      let tileRow = 0;
      if (selectedLevelNum === 2) tileRow = 1;
      else if (selectedLevelNum === 3 || selectedLevelNum === 5) tileRow = 2;

      ctx.save();
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#ffea00';

      const screen = worldToScreen(this.x, this.y);
      ctx.drawImage(
        assets.tiles,
        3 * frameWidth, tileRow * frameHeight, frameWidth, frameHeight, // index 3 is Coin
        screen.x, screen.y, this.width, this.height
      );
      ctx.restore();
    }
  }

  // ----------------------------------------------------
  // FLAGPOLE CLASS (Victory Target)
  // ----------------------------------------------------
  class Flagpole {
    constructor(gridX, gridY) {
      this.x = gridX * BLOCK_SIZE;
      this.y = gridY * BLOCK_SIZE - 300; // Flagpole spans 6 tiles high
      this.width = 60;
      this.height = 360;
    }

    update() {}

    draw() {
      const frameWidth = assets.tiles.width / 6;
      const frameHeight = assets.tiles.height / 3;

      let tileRow = 0;
      if (selectedLevelNum === 2) tileRow = 1;
      else if (selectedLevelNum === 3 || selectedLevelNum === 5) tileRow = 2;

      // Draw the flagpole repeating 6 times vertically
      for (let i = 0; i < 6; i++) {
        const screen = worldToScreen(this.x, this.y + (i * BLOCK_SIZE));
        ctx.drawImage(
          assets.tiles,
          5 * frameWidth, tileRow * frameHeight, frameWidth, frameHeight, // index 5 is Flagpole
          screen.x, screen.y, BLOCK_SIZE, BLOCK_SIZE
        );
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
        this.hp = 5;
        this.shootTimer = 0;
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
        // Boss fights fireballs
        this.shootTimer += dt;
        // DDA: Add 500ms shooting delay per death, max 2000ms
        const ddaDelay = Math.min(levelDeaths * 500, 2000);
        const shootInterval = 2200 + ddaDelay;
        if (this.shootTimer >= shootInterval && Math.abs(player.x - this.x) < 550) {
          this.shootTimer = 0;
          sounds.shoot();
          projectiles.push(new Projectile(this.x - 10, this.y + 20, -1, true));
        }
        if (Math.random() < 0.01 && Math.abs(player.x - this.x) < 300) {
          this.x += (player.x < this.x ? -15 : 15);
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

      drawSprite(
        ctx,
        assets.enemies,
        'enemy',
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
      ctx.fillStyle = this.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = this.color;
      
      // Draw round capsule item using worldToScreen coordinates
      const center = worldToScreen(this.x + 22.5, this.y + 22.5);
      ctx.beginPath();
      ctx.arc(center.x, center.y, 18, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw inner pattern
      ctx.fillStyle = '#080813';
      ctx.shadowBlur = 0;
      const pattern = worldToScreen(this.x + 19.5, this.y + 19.5);
      ctx.fillRect(pattern.x, pattern.y, 6, 6);

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
    let bgOffset = (-cameraX * 0.25) % canvas.width;
    ctx.drawImage(assets.bg, bgOffset, 0, canvas.width, canvas.height);
    ctx.drawImage(assets.bg, bgOffset + canvas.width, 0, canvas.width, canvas.height);

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
    const x = touch.clientX - rect.left - 50;
    const y = touch.clientY - rect.top - 50;
    
    joystickBase.style.position = 'absolute';
    joystickBase.style.left = `${x}px`;
    joystickBase.style.top = `${y}px`;
    
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
        
        joystickBase.style.position = '';
        joystickBase.style.left = '';
        joystickBase.style.top = '';
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
      const x = e.clientX - rect.left - 50;
      const y = e.clientY - rect.top - 50;
      joystickBase.style.position = 'absolute';
      joystickBase.style.left = `${x}px`;
      joystickBase.style.top = `${y}px`;
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
        joystickBase.style.position = '';
        joystickBase.style.left = '';
        joystickBase.style.top = '';
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


