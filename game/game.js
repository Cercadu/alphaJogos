// AlphaDino 3D WebGL Game Engine (Three.js)

document.addEventListener('DOMContentLoaded', () => {
  // ----------------------------------------------------
  // SESSION DATA & STATE
  // ----------------------------------------------------
  const playerName = sessionStorage.getItem('alphadino_active_player') || 'AlphaPlayer';
  const charType = sessionStorage.getItem('alphadino_active_char') || 'raptor';
  const selectedLevelNum = parseInt(sessionStorage.getItem('alphadino_active_level') || '1', 10);

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
  // THREE.JS INITIALIZATION
  // ----------------------------------------------------
  const container = document.querySelector('.canvas-container');
  // Clear HTML5 Canvas
  container.innerHTML = '';
  
  const scene = new THREE.Scene();
  
  // Set Scene Background based on Level
  const levelBgs = {
    1: 0x050510, // Deep Cyber space
    2: 0x180d05, // Dusty Sunset Orange
    3: 0x070212, // Dark Crystal Purple
    4: 0x050c18, // Midnight City Cyan
    5: 0x150202  // Hot Castle Lava Red
  };
  scene.background = new THREE.Color(levelBgs[selectedLevelNum] || 0x050510);
  scene.fog = new THREE.FogExp2(scene.background, 0.04);

  // Camera Setup
  const camera = new THREE.PerspectiveCamera(50, 16/9, 0.1, 1000);
  
  // Renderer Setup
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize(container.clientWidth, container.clientWidth * (9/16));
  container.appendChild(renderer.domElement);

  // Resize handler
  window.addEventListener('resize', () => {
    const w = container.clientWidth;
    const h = w * (9/16);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xffffff, 0.85);
  sunLight.position.set(10, 20, 15);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 1024;
  sunLight.shadow.mapSize.height = 1024;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 40;
  
  const dRange = 12;
  sunLight.shadow.camera.left = -dRange;
  sunLight.shadow.camera.right = dRange;
  sunLight.shadow.camera.top = dRange;
  sunLight.shadow.camera.bottom = -dRange;
  scene.add(sunLight);

  // Point lights for Cyber atmosphere
  const pointLightColors = {
    1: 0x00f0ff,
    2: 0xffea00,
    3: 0x9d4edd,
    4: 0x00f0ff,
    5: 0xff0055
  };
  const neonLight = new THREE.PointLight(pointLightColors[selectedLevelNum] || 0x00f0ff, 1.5, 30);
  scene.add(neonLight);

  // ----------------------------------------------------
  // CHARACTERS & STYLES (Voxel builder helper)
  // ----------------------------------------------------
  const charThemes = {
    raptor: { primary: 0x39ff14, secondary: 0x1b8a0a, eye: 0xff0000 },
    ptera: { primary: 0x00f0ff, secondary: 0x0088cc, eye: 0xffea00 },
    trex: { primary: 0xff007f, secondary: 0x99004c, eye: 0x00f0ff },
    trike: { primary: 0xffea00, secondary: 0xccaa00, eye: 0xff007f },
    stego: { primary: 0xff6700, secondary: 0xcc5200, eye: 0x00f0ff }
  };
  const theme = charThemes[charType] || charThemes.raptor;

  function createVoxelMesh(sizeX, sizeY, sizeZ, colorHex, opacity = 1) {
    const geo = new THREE.BoxGeometry(sizeX, sizeY, sizeZ);
    const mat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.2,
      metalness: 0.1,
      transparent: opacity < 1,
      opacity: opacity
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // ----------------------------------------------------
  // LEVEL LAYOUT STRUCTURES (Grid Maps)
  // ----------------------------------------------------
  // Legend:
  // 'G' = Ground Brick Block
  // 'B' = Destructible Brick Block
  // 'Q' = Question Mark Block (Spawns Coins)
  // 'M' = Question Block (Spawns Mushroom)
  // 'F' = Question Block (Spawns FireFlower)
  // 'S' = Question Block (Spawns Star)
  // 'A' = Question Block (Spawns Magnet)
  // 'C' = Spin Coin
  // 'P' = Pipeline block (solid green barrier)
  // 'E' = Goomba enemy (standard)
  // 'K' = Koopa enemy (hopping)
  // 'T' = Cave Beetle (Level 3 - spiky top)
  // 'D' = Cyber Drone (Level 4 - flying)
  // 'X' = Bowser Boss (Level 5 - shoots fireballs)
  // 'H' = Moving Platform
  // 'L' = Level Flagpole (Goal)
  
  const levelMaps = {
    1: [
      "                                                                                                   ",
      "                                                                                                   ",
      "                                                                                                   ",
      "                                                                                                   ",
      "                                                                                                   ",
      "                 B Q B                                                                             ",
      "                                                                                                   ",
      "                                C C C                                                              ",
      "                             B Q M Q B                                                             ",
      "                                                                         C C                       ",
      "          P                                                             P B P                   L  ",
      "GGGGGGGGGGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGG   GGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG"
    ],
    2: [
      "                                                                                                   ",
      "                                                                                                   ",
      "                                                                                                   ",
      "                                                                                                   ",
      "                                                                                                   ",
      "                 B S B             C C C                                                           ",
      "                                  B Q F B                                                          ",
      "                                                                                                   ",
      "                                                                        C C C                      ",
      "                             K                                         B Q Q B                     ",
      "          P                 P P                                       P B B P                   L  ",
      "GGGGGGGGGGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGG   GGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG"
    ],
    3: [
      "                                                                                                   ",
      "                                                                                                   ",
      "                                                                                                   ",
      "                                                                                                   ",
      "                                                                                                   ",
      "                 B A B                                                                             ",
      "                                                                                                   ",
      "                                C C C                                                              ",
      "                             B Q M Q B                    T                                        ",
      "          T                                                              C C                       ",
      "          P                 P P                                         P B P                   L  ",
      "GGGGGGGGGGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGG   GGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG"
    ],
    4: [
      "                                                                                                   ",
      "                                                                                                   ",
      "                                                                                                   ",
      "                                                                                                   ",
      "                                                                                                   ",
      "                 B S B                                                                             ",
      "                                                                                                   ",
      "                                C D C                                                              ",
      "                             B Q F Q B                                                             ",
      "                                                                         C C                       ",
      "          P                                                             P B P                   L  ",
      "GGGGGGGGGGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGG   GGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG"
    ],
    5: [
      "                                                                                                   ",
      "                                                                                                   ",
      "                                                                                                   ",
      "                                                                                                   ",
      "                                                                                                   ",
      "                 B S B                                                                             ",
      "                                                                                                   ",
      "                                C C C                                                              ",
      "                             B Q M Q B                                                             ",
      "                                                                                                   ",
      "          P                                                                X                    L  ",
      "GGGGGGGGGGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGG   GGGGGGGGGG   GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG"
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
  let victorySequenceTimer = 0;
  let shieldCooldownTimer = 0;
  
  // Entity arrays
  const collidables = []; // platforms, pipes, blocks
  const interactiveBlocks = []; // bricks, ? blocks
  let coinsList = [];
  let enemies = [];
  let items = [];
  let projectiles = [];
  const particles = [];
  
  // Keys object
  const keys = {
    left: false,
    right: false,
    jump: false,
    special: false
  };

  // ----------------------------------------------------
  // VOXEL DINO MESH GENERATION (Crossy Road Style)
  // ----------------------------------------------------
  class VoxelDino {
    constructor() {
      this.group = new THREE.Group();
      
      // Voxel Parts
      this.body = createVoxelMesh(0.8, 0.9, 0.7, theme.primary);
      this.body.position.y = 0.45;
      this.group.add(this.body);
      
      // Head
      this.head = createVoxelMesh(0.65, 0.5, 0.6, theme.primary);
      this.head.position.set(0.25, 0.9, 0);
      this.group.add(this.head);
      
      // Visor/Eye (Cyber)
      this.eye = createVoxelMesh(0.2, 0.1, 0.62, theme.eye);
      this.eye.position.set(0.4, 0.95, 0);
      this.group.add(this.eye);
      
      // Tail
      this.tail = createVoxelMesh(0.4, 0.3, 0.3, theme.primary);
      this.tail.position.set(-0.5, 0.25, 0);
      this.group.add(this.tail);
      
      // Limbs
      this.legLeft = createVoxelMesh(0.25, 0.4, 0.2, theme.secondary);
      this.legLeft.position.set(-0.15, 0.1, 0.22);
      this.group.add(this.legLeft);
      
      this.legRight = createVoxelMesh(0.25, 0.4, 0.2, theme.secondary);
      this.legRight.position.set(0.15, 0.1, -0.22);
      this.group.add(this.legRight);

      // Character-specific Voxel Accessories
      if (charType === 'ptera') {
        // Wings
        this.wingLeft = createVoxelMesh(0.1, 0.5, 0.8, theme.secondary);
        this.wingLeft.position.set(-0.1, 0.6, 0.55);
        this.wingLeft.rotation.z = Math.PI / 12;
        this.group.add(this.wingLeft);
        
        this.wingRight = createVoxelMesh(0.1, 0.5, 0.8, theme.secondary);
        this.wingRight.position.set(-0.1, 0.6, -0.55);
        this.wingRight.rotation.z = -Math.PI / 12;
        this.group.add(this.wingRight);
      }
      
      if (charType === 'trike') {
        // Horns
        this.horn1 = createVoxelMesh(0.15, 0.3, 0.1, 0xffffff);
        this.horn1.position.set(0.5, 1.1, 0.2);
        this.horn1.rotation.z = -Math.PI / 6;
        this.group.add(this.horn1);
        
        this.horn2 = createVoxelMesh(0.15, 0.3, 0.1, 0xffffff);
        this.horn2.position.set(0.5, 1.1, -0.2);
        this.horn2.rotation.z = -Math.PI / 6;
        this.group.add(this.horn2);
      }
      
      if (charType === 'stego') {
        // Back spikes
        this.spike1 = createVoxelMesh(0.2, 0.2, 0.2, 0xff007f);
        this.spike1.position.set(-0.1, 1.05, 0);
        this.group.add(this.spike1);
        
        this.spike2 = createVoxelMesh(0.2, 0.2, 0.2, 0xff007f);
        this.spike2.position.set(-0.4, 0.8, 0);
        this.group.add(this.spike2);
      }
      
      scene.add(this.group);
    }
  }

  // ----------------------------------------------------
  // PLAYER CLASS (3D platformer logic)
  // ----------------------------------------------------
  class Player {
    constructor() {
      this.voxel = new VoxelDino();
      this.x = 2.0;
      this.y = 3.0; // starts falling
      this.vx = 0;
      this.vy = 0;
      this.width = 0.9;
      this.height = 1.3;
      
      this.onGround = false;
      this.gravity = 0.012;
      this.jumpPower = 0.26;
      this.walkSpeed = 0.08;
      
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
      
      // Voxel references
      this.legCycle = 0;
    }

    update(dt) {
      // 1. Decrement cooldowns
      if (this.shootCooldown > 0) this.shootCooldown -= dt;
      if (this.dashCooldown > 0) this.dashCooldown -= dt;
      
      // Shield regeneration (T-Rex power)
      if (charType === 'trex' && !this.hasShield) {
        shieldCooldownTimer += dt;
        if (shieldCooldownTimer >= 30000) {
          this.hasShield = true;
          shieldCooldownTimer = 0;
          sounds.powerup();
          createImpactExplosion(this.x, this.y + 0.5, 0x00f0ff);
        }
      }

      // 2. Dash behavior (Trike power)
      if (this.isDashing) {
        this.dashTimer += dt;
        if (this.dashTimer >= 200) {
          this.isDashing = false;
        } else {
          // Trail particles
          if (Math.random() < 0.4) {
            particles.push(new Particle(this.x, this.y + Math.random() * 0.8, theme.primary));
          }
        }
      }

      // 3. Powerup timer update
      if (this.powerup) {
        this.powerupDuration -= dt;
        if (this.powerupDuration <= 0) {
          this.removePowerup();
        }
      }

      // 4. Handle horizontal movement input
      if (!levelComplete && gameState === 'PLAYING') {
        if (this.isDashing) {
          // Dash carries high velocity
          this.vx = 0.28 * (this.voxel.group.rotation.y > 0 ? -1 : 1);
        } else {
          if (keys.left) {
            this.vx = -this.walkSpeed;
            this.voxel.group.rotation.y = Math.PI; // Face Left
          } else if (keys.right) {
            this.vx = this.walkSpeed;
            this.voxel.group.rotation.y = 0; // Face Right
          } else {
            this.vx *= 0.75; // deceleration drag
            if (Math.abs(this.vx) < 0.005) this.vx = 0;
          }
        }
      }

      // 5. Jump & Glide mechanics
      if (keys.jump && !levelComplete && gameState === 'PLAYING') {
        if (this.onGround) {
          this.vy = this.jumpPower;
          this.onGround = false;
          this.jumpHoldTimer = 0;
          this.isGliding = false;
          sounds.jump();
          triggerVibrate(20);
        } else {
          this.jumpHoldTimer += dt;
          if (this.jumpHoldTimer < 180) {
            this.vy += 0.005; // float slightly higher on hold
          }
          if (charType === 'ptera' && this.vy < 0) {
            this.isGliding = true;
            this.vy = -0.03; // cap descent (glide)
            if (Math.random() < 0.2) {
              particles.push(new Particle(this.x - 0.3, this.y + 0.5, 0x00f0ff));
            }
          }
        }
      } else {
        this.isGliding = false;
      }

      // 6. Apply gravity
      if (!this.onGround && !this.isGliding && !this.isDashing) {
        this.vy -= this.gravity;
      }

      // 7. Update coordinates
      this.x += this.vx;
      this.y += this.vy;

      // 8. Block screen bounds
      if (this.x < 0.5) {
        this.x = 0.5;
        this.vx = 0;
      }
      if (this.x > gridCols - 0.5) {
        this.x = gridCols - 0.5;
        this.vx = 0;
      }

      // 9. Leg cycle animation
      if (Math.abs(this.vx) > 0.01 && this.onGround) {
        this.legCycle += 0.25;
        this.voxel.legLeft.position.y = 0.1 + Math.sin(this.legCycle) * 0.08;
        this.voxel.legRight.position.y = 0.1 - Math.sin(this.legCycle) * 0.08;
      } else {
        this.voxel.legLeft.position.y = 0.1;
        this.voxel.legRight.position.y = 0.1;
      }

      // 10. Wing animation (Ptera)
      if (charType === 'ptera' && this.voxel.wingLeft) {
        if (this.isGliding) {
          const flap = Math.sin(Date.now() / 80) * 0.4;
          this.voxel.wingLeft.rotation.z = Math.PI/12 + flap;
          this.voxel.wingRight.rotation.z = -Math.PI/12 - flap;
        } else {
          this.voxel.wingLeft.rotation.z = Math.PI/12;
          this.voxel.wingRight.rotation.z = -Math.PI/12;
        }
      }

      // 11. Scale powerup sizes
      if (this.powerup === 'mushroom') {
        this.voxel.group.scale.set(1.4, 1.4, 1.4);
        this.width = 1.26;
        this.height = 1.82;
      } else {
        this.voxel.group.scale.set(1.0, 1.0, 1.0);
        this.width = 0.9;
        this.height = 1.3;
      }

      // Sync 3D position
      this.voxel.group.position.set(this.x, this.y, 0);

      // Check Special Ability Trigger
      if (keys.special && !levelComplete && gameState === 'PLAYING') {
        this.useSpecialAbility();
        keys.special = false;
      }

      // Lava Pit Death Check
      if (this.y < -3.0) {
        triggerDeath();
      }
    }

    useSpecialAbility() {
      if (charType === 'raptor' || this.powerup === 'fireflower') {
        if (this.shootCooldown <= 0) {
          const dir = this.voxel.group.rotation.y > 0 ? -1 : 1;
          projectiles.push(new Projectile(this.x + dir * 0.6, this.y + 0.6, dir));
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
          triggerVibrate([40, 20, 40]);
          createImpactExplosion(this.x, this.y + 0.5, 0xffea00);
        }
      }
    }

    applyPowerup(type) {
      if (type === 'mushroom') {
        sounds.powerup();
        this.powerup = 'mushroom';
        this.life = 2;
        this.powerupDuration = this.powerupMaxDuration;
        createImpactExplosion(this.x, this.y + 0.5, 0xff0055);
      } 
      else if (type === 'fireflower') {
        sounds.powerup();
        this.powerup = 'fireflower';
        this.powerupDuration = this.powerupMaxDuration;
        createImpactExplosion(this.x, this.y + 0.5, 0xffaa00);
      } 
      else if (type === 'star') {
        sounds.powerup();
        this.powerup = 'star';
        this.powerupDuration = 8000;
        createImpactExplosion(this.x, this.y + 0.5, 0x00f0ff);
      } 
      else if (type === 'magnet') {
        sounds.powerup();
        this.powerup = 'magnet';
        this.powerupDuration = 12000;
        createImpactExplosion(this.x, this.y + 0.5, 0x00f0ff);
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
        triggerVibrate([100, 50, 100]);
        createImpactExplosion(this.x, this.y + 0.5, 0x00f0ff);
        return;
      }
      if (this.life > 1) {
        this.removePowerup();
        sounds.hit();
        triggerVibrate([80, 80]);
        return;
      }
      triggerDeath();
    }

    destroy() {
      scene.remove(this.voxel.group);
    }
  }

  let player = new Player();

  // ----------------------------------------------------
  // 3D ENTITY CLASSES (Blocks, Coins, Flags, etc.)
  // ----------------------------------------------------
  class VoxelBlock {
    constructor(gridX, gridY, type, itemType = 'coin') {
      this.gridX = gridX;
      this.gridY = gridY;
      this.x = gridX;
      this.y = gridY;
      this.type = type; // 'brick', 'question', 'solid', 'pipe'
      this.itemType = itemType;
      this.width = 1.0;
      this.height = 1.0;
      this.hit = false;
      this.hitOffset = 0;
      this.hitSpeed = 0;
      
      // Create 3D Mesh
      if (type === 'solid') {
        // Ground Grid Block
        let gColor = 0x22223b;
        if (selectedLevelNum === 2) gColor = 0xc27c38; // Desert
        if (selectedLevelNum === 3) gColor = 0x3c165a; // Crystals
        if (selectedLevelNum === 4) gColor = 0x1d3557; // Skyline
        if (selectedLevelNum === 5) gColor = 0x471212; // Lava Castle
        
        this.mesh = createVoxelMesh(1.0, 1.0, 1.0, gColor);
        // Add glowing neon strip on top of ground blocks
        const wire = new THREE.LineSegments(
          new THREE.EdgesGeometry(this.mesh.geometry),
          new THREE.LineBasicMaterial({ color: pointLightColors[selectedLevelNum] || 0x00f0ff })
        );
        this.mesh.add(wire);
      } 
      else if (type === 'pipe') {
        // Cyber Green pipe mesh
        const pipeGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.0, 8);
        const pipeMat = new THREE.MeshStandardMaterial({ color: 0x1b8a0a, roughness: 0.1 });
        this.mesh = new THREE.Mesh(pipeGeo, pipeMat);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
      }
      else if (type === 'brick') {
        // Cyber Brick (Glowing magenta seams)
        this.mesh = createVoxelMesh(1.0, 1.0, 1.0, 0x8b2e00);
        const wire = new THREE.LineSegments(
          new THREE.EdgesGeometry(this.mesh.geometry),
          new THREE.LineBasicMaterial({ color: 0xff007f })
        );
        this.mesh.add(wire);
      } 
      else if (type === 'question') {
        // Glowing gold question mark box
        this.mesh = createVoxelMesh(1.0, 1.0, 1.0, 0xffea00);
      }

      this.mesh.position.set(this.x, this.y, 0);
      scene.add(this.mesh);
    }

    update(dt) {
      // Bonking animations
      if (this.hit && this.hitOffset > -0.25 && this.hitSpeed <= 0) {
        this.hitOffset -= 0.05;
        if (this.hitOffset <= -0.25) {
          this.hitSpeed = 0.05;
        }
      } else if (this.hit && this.hitOffset < 0 && this.hitSpeed > 0) {
        this.hitOffset += this.hitSpeed;
        if (this.hitOffset >= 0) {
          this.hitOffset = 0;
          this.hitSpeed = 0;
        }
      }
      this.mesh.position.y = this.y - this.hitOffset;
    }

    destroy() {
      scene.remove(this.mesh);
    }
  }

  class VoxelCoin {
    constructor(gridX, gridY) {
      this.x = gridX;
      this.y = gridY;
      this.width = 0.6;
      this.height = 0.8;
      this.collected = false;
      this.vx = 0;
      this.vy = 0;
      
      // 3D Cylinder Coin
      const geo = new THREE.CylinderGeometry(0.25, 0.25, 0.08, 8);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffea00,
        metalness: 0.9,
        roughness: 0.1
      });
      this.mesh = new THREE.Mesh(geo, mat);
      this.mesh.rotation.x = Math.PI / 2; // face front
      this.mesh.castShadow = true;
      this.mesh.position.set(this.x, this.y, 0);
      scene.add(this.mesh);
    }

    update() {
      // Spinning cylinders
      this.mesh.rotation.y += 0.05;
      
      // Magnet pull physics
      if (this.vx !== 0 || this.vy !== 0) {
        this.x += this.vx;
        this.y += this.vy;
        this.mesh.position.set(this.x, this.y, 0);
      }
    }

    destroy() {
      scene.remove(this.mesh);
    }
  }

  class GoalFlagpole {
    constructor(gridX, gridY) {
      this.x = gridX;
      this.y = gridY;
      this.height = 5.0;
      this.width = 0.4;
      
      this.group = new THREE.Group();
      
      // Voxel Pole (tall cylinder)
      const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, this.height, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 });
      const poleMesh = new THREE.Mesh(poleGeo, poleMat);
      poleMesh.position.y = this.height / 2;
      poleMesh.castShadow = true;
      this.group.add(poleMesh);
      
      // Red Flag mesh
      this.flag = createVoxelMesh(0.8, 0.6, 0.1, 0xff0055);
      this.flag.position.set(0.4, this.height - 0.4, 0);
      this.group.add(this.flag);
      
      this.group.position.set(this.x, this.y, 0);
      scene.add(this.group);
    }

    update() {
      // Wave flag slightly
      this.flag.rotation.y = Math.sin(Date.now() / 200) * 0.15;
    }

    destroy() {
      scene.remove(this.group);
    }
  }

  // ----------------------------------------------------
  // ENEMY CLASSES (Goombas, Koopas, Boss)
  // ----------------------------------------------------
  class VoxelEnemy {
    constructor(gridX, gridY, type) {
      this.x = gridX;
      this.y = gridY;
      this.type = type; // 'goomba', 'koopa', 'beetle', 'drone', 'bowser'
      this.width = 0.8;
      this.height = 0.8;
      this.speedX = -0.035;
      
      if (type === 'bowser') {
        this.width = 2.0;
        this.height = 2.0;
        this.hp = 3;
        this.shootTimer = 0;
      }
      
      this.stamped = false;
      this.stampTimer = 0;
      
      // Create Voxel Mesh
      this.group = new THREE.Group();
      
      if (type === 'goomba') {
        this.body = createVoxelMesh(0.8, 0.5, 0.8, 0xff007f);
        this.body.position.y = 0.25;
        this.group.add(this.body);
        
        this.feet = createVoxelMesh(0.6, 0.2, 0.9, 0x8b8ba7);
        this.feet.position.y = 0.1;
        this.group.add(this.feet);
      } 
      else if (type === 'koopa') {
        this.shell = createVoxelMesh(0.7, 0.6, 0.7, 0xffea00);
        this.shell.position.y = 0.3;
        this.group.add(this.shell);
        
        this.head = createVoxelMesh(0.4, 0.4, 0.4, 0x00f0ff);
        this.head.position.set(-0.4, 0.6, 0);
        this.group.add(this.head);
      }
      else if (type === 'beetle') {
        // Spiky shell beetle
        this.shell = createVoxelMesh(0.8, 0.4, 0.8, 0x9d4edd);
        this.shell.position.y = 0.2;
        this.group.add(this.shell);
        
        // Spike spikes
        this.spike = createVoxelMesh(0.2, 0.3, 0.2, 0xffffff);
        this.spike.position.set(0, 0.45, 0);
        this.group.add(this.spike);
      }
      else if (type === 'drone') {
        this.body = createVoxelMesh(0.7, 0.4, 0.7, 0x00f0ff);
        this.body.position.y = 0.3;
        this.group.add(this.body);
        
        // Rotor blades
        this.rotor = createVoxelMesh(0.9, 0.05, 0.1, 0xffffff);
        this.rotor.position.set(0, 0.55, 0);
        this.group.add(this.rotor);
      }
      else if (type === 'bowser') {
        // Giant Boss Bowser-Dino voxel model
        this.body = createVoxelMesh(1.8, 1.5, 1.8, 0x1b8a0a); // green
        this.body.position.y = 0.75;
        this.group.add(this.body);
        
        this.shell = createVoxelMesh(1.0, 1.2, 2.0, 0x8b2e00); // spiky shell on back
        this.shell.position.set(-0.5, 0.8, 0);
        this.group.add(this.shell);
        
        this.head = createVoxelMesh(1.0, 0.8, 1.0, 0x1b8a0a);
        this.head.position.set(0.9, 1.4, 0);
        this.group.add(this.head);
        
        this.hair = createVoxelMesh(0.6, 0.4, 0.6, 0xff0055); // red hair/horns
        this.hair.position.set(0.6, 1.9, 0);
        this.group.add(this.hair);
      }

      this.group.position.set(this.x, this.y, 0);
      scene.add(this.group);
    }

    update(dt) {
      if (this.stamped) {
        this.stampTimer += dt;
        return;
      }

      if (this.type === 'drone') {
        this.rotor.rotation.y += 0.3;
        // Hover float
        this.y = 2.5 + Math.sin(Date.now() / 150) * 0.3;
      }
      
      if (this.type === 'bowser') {
        // Bowser boss AI - shoots fireballs towards player
        this.shootTimer += dt;
        if (this.shootTimer >= 2200 && Math.abs(player.x - this.x) < 16) {
          this.shootTimer = 0;
          sounds.shoot();
          projectiles.push(new Projectile(this.x - 1.1, this.y + 1.2, -1, true)); // Bowser fireball goes left
        }
        
        // Hopping logic
        if (Math.random() < 0.015 && Math.abs(player.x - this.x) < 10) {
          // Hop
          this.x += (player.x < this.x ? -0.5 : 0.5);
        }
      } else {
        // Standard walk, reverse on collisions
        this.x += this.speedX;
        
        // Simple bounding checks to reverse direction
        let checkCollision = false;
        collidables.forEach(block => {
          if (Math.abs(this.y - block.y) < 0.6 && Math.abs(this.x - block.x) < 0.9) {
            checkCollision = true;
          }
        });
        
        if (checkCollision || this.x < 1 || this.x > gridCols - 1) {
          this.speedX *= -1;
          this.x += this.speedX * 2;
        }
      }

      // Sync 3D position
      this.group.position.set(this.x, this.y, 0);
      
      // Face movement direction
      if (this.speedX > 0 && this.type !== 'bowser') {
        this.group.rotation.y = Math.PI;
      } else if (this.type !== 'bowser') {
        this.group.rotation.y = 0;
      }
    }

    takeStompDamage() {
      if (this.type === 'bowser') {
        this.hp--;
        sounds.hit();
        triggerVibrate([80, 40, 80]);
        createImpactExplosion(this.x, this.y + 1.0, 0xff0055);
        if (this.hp <= 0) {
          this.stamped = true;
          score += 2000;
          sounds.stomp();
          createImpactExplosion(this.x, this.y + 0.5, 0xffea00);
        }
      } else {
        this.stamped = true;
        score += 300;
        sounds.stomp();
        triggerVibrate(30);
        // Squash mesh animation
        this.group.scale.y = 0.2;
        this.y -= 0.3;
        this.group.position.y = this.y;
        createImpactExplosion(this.x, this.y + 0.2, 0xff007f);
      }
    }

    destroy() {
      scene.remove(this.group);
    }
  }

  // ----------------------------------------------------
  // ITEM CLASSES (Powerups)
  // ----------------------------------------------------
  class VoxelItem {
    constructor(gridX, gridY, type) {
      this.x = gridX;
      this.y = gridY;
      this.type = type; // 'mushroom', 'fireflower', 'star', 'magnet'
      this.width = 0.7;
      this.height = 0.7;
      this.vy = 0.12; // spawn pop upward
      this.vx = 0.04;
      this.onGround = false;
      this.collected = false;

      // Mesh Creation
      if (type === 'mushroom') {
        this.mesh = createVoxelMesh(0.7, 0.7, 0.7, 0xff0055);
      } else if (type === 'fireflower') {
        this.mesh = createVoxelMesh(0.7, 0.7, 0.7, 0xffaa00);
      } else if (type === 'star') {
        this.mesh = createVoxelMesh(0.7, 0.7, 0.7, 0xffea00);
      } else if (type === 'magnet') {
        this.mesh = createVoxelMesh(0.7, 0.7, 0.7, 0x00f0ff);
      }
      
      this.mesh.position.set(this.x, this.y, 0);
      scene.add(this.mesh);
    }

    update() {
      // Horizontal slide
      this.x += this.vx;
      
      // Gravity
      this.vy -= 0.008;
      this.y += this.vy;
      
      // Ground checks
      const groundY = 0.5;
      if (this.y < groundY) {
        this.y = groundY;
        this.vy = 0;
        this.onGround = true;
      }
      
      // Solid collisions
      collidables.forEach(block => {
        if (Math.abs(this.x - block.x) < 0.8) {
          // Land on top
          if (this.vy <= 0 && this.y >= block.y + 0.8 && this.y - this.vy <= block.y + 1.1) {
            this.y = block.y + 0.9;
            this.vy = 0;
            this.onGround = true;
          }
          // Hit sides - reverse direction
          else if (Math.abs(this.y - block.y) < 0.5 && Math.abs(this.x - block.x) < 0.7) {
            this.vx *= -1;
            this.x += this.vx;
          }
        }
      });

      this.mesh.position.set(this.x, this.y, 0);
      this.mesh.rotation.y += 0.03;
    }

    destroy() {
      scene.remove(this.mesh);
    }
  }

  // ----------------------------------------------------
  // FIREBALL PROJECTILE CLASS
  // ----------------------------------------------------
  class Projectile {
    constructor(x, y, dir, isEnemy = false) {
      this.x = x;
      this.y = y;
      this.dir = dir;
      this.isEnemy = isEnemy;
      this.width = 0.4;
      this.height = 0.4;
      this.vx = 0.16 * dir;
      this.vy = 0.06;
      this.destroyed = false;
      
      // Glowing Sphere Mesh
      const color = isEnemy ? 0xff0055 : 0xff7700;
      const geo = new THREE.SphereGeometry(0.2, 8, 8);
      const mat = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        roughness: 0.1
      });
      this.mesh = new THREE.Mesh(geo, mat);
      this.mesh.position.set(this.x, this.y, 0);
      scene.add(this.mesh);
    }

    update() {
      this.x += this.vx;
      this.vy -= 0.006; // gravity bounce
      this.y += this.vy;
      
      if (this.y < 0.5) {
        this.y = 0.5;
        this.vy = 0.06; // bounce
      }

      collidables.forEach(block => {
        if (Math.abs(this.x - block.x) < 0.7) {
          // Bounce on top
          if (this.vy <= 0 && this.y >= block.y + 0.8 && this.y - this.vy <= block.y + 1.1) {
            this.y = block.y + 0.9;
            this.vy = 0.06;
          }
          // Hit sides - explode
          else if (Math.abs(this.y - block.y) < 0.5 && Math.abs(this.x - block.x) < 0.6) {
            this.destroyed = true;
          }
        }
      });
      
      this.mesh.position.set(this.x, this.y, 0);
    }

    destroy() {
      scene.remove(this.mesh);
    }
  }

  // ----------------------------------------------------
  // PARTICLES (3D EXPLOSION BLOCKS)
  // ----------------------------------------------------
  class Particle {
    constructor(x, y, colorHex) {
      this.x = x;
      this.y = y;
      this.mesh = createVoxelMesh(0.12, 0.12, 0.12, colorHex);
      this.mesh.position.set(x, y, 0);
      
      this.vx = (Math.random() - 0.5) * 0.15;
      this.vy = (Math.random() - 0.2) * 0.15;
      this.life = 1.0;
      this.decay = Math.random() * 0.04 + 0.02;
      
      scene.add(this.mesh);
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.vy -= 0.005; // gravity
      this.life -= this.decay;
      
      this.mesh.position.set(this.x, this.y, 0);
      this.mesh.scale.set(this.life, this.life, this.life);
    }

    destroy() {
      scene.remove(this.mesh);
    }
  }

  // ----------------------------------------------------
  // INITIAL SCENE SPARKING (Build Level from Grid)
  // ----------------------------------------------------
  let flagpoleInstance = null;

  function loadLevelFromGrid() {
    // Reverse the rows because level arrays are top-down but Three.js coordinate system Y is bottom-up
    for (let r = 0; r < gridRows; r++) {
      const gridY = gridRows - 1 - r;
      const rowString = activeGrid[r];
      
      for (let gridX = 0; gridX < gridCols; gridX++) {
        const char = rowString[gridX];
        
        if (char === 'G') {
          // Ground Block
          const block = new VoxelBlock(gridX, gridY, 'solid');
          collidables.push(block);
        } 
        else if (char === 'B') {
          // Brick
          const block = new VoxelBlock(gridX, gridY, 'brick');
          collidables.push(block);
          interactiveBlocks.push(block);
        }
        else if (char === 'Q') {
          const block = new VoxelBlock(gridX, gridY, 'question', 'coin');
          collidables.push(block);
          interactiveBlocks.push(block);
        }
        else if (char === 'M') {
          const block = new VoxelBlock(gridX, gridY, 'question', 'mushroom');
          collidables.push(block);
          interactiveBlocks.push(block);
        }
        else if (char === 'F') {
          const block = new VoxelBlock(gridX, gridY, 'question', 'fireflower');
          collidables.push(block);
          interactiveBlocks.push(block);
        }
        else if (char === 'S') {
          const block = new VoxelBlock(gridX, gridY, 'question', 'star');
          collidables.push(block);
          interactiveBlocks.push(block);
        }
        else if (char === 'A') {
          const block = new VoxelBlock(gridX, gridY, 'question', 'magnet');
          collidables.push(block);
          interactiveBlocks.push(block);
        }
        else if (char === 'P') {
          // Pipe solid
          const block = new VoxelBlock(gridX, gridY, 'pipe');
          collidables.push(block);
        }
        else if (char === 'C') {
          // Coin
          coinsList.push(new VoxelCoin(gridX, gridY + 0.2));
        }
        else if (char === 'E') {
          enemies.push(new VoxelEnemy(gridX, gridY, 'goomba'));
        }
        else if (char === 'K') {
          enemies.push(new VoxelEnemy(gridX, gridY, 'koopa'));
        }
        else if (char === 'T') {
          enemies.push(new VoxelEnemy(gridX, gridY, 'beetle'));
        }
        else if (char === 'D') {
          enemies.push(new VoxelEnemy(gridX, gridY, 'drone'));
        }
        else if (char === 'X') {
          enemies.push(new VoxelEnemy(gridX, gridY, 'bowser'));
        }
        else if (char === 'L') {
          // Flagpole
          flagpoleInstance = new GoalFlagpole(gridX, gridY);
        }
      }
    }
  }

  // ----------------------------------------------------
  // PHYSICS COLLISION RESOLUTION (3D Box intersections)
  // ----------------------------------------------------
  function resolveCollisions() {
    if (levelComplete) return;

    // Create 3D Bounding Box for player
    const playerBox = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(player.x, player.y + player.height/2, 0),
      new THREE.Vector3(player.width, player.height, 0.5)
    );

    let stoodOnObject = false;

    // 1. Collisions against Solid structures (Bricks, Ground blocks, Pipes)
    collidables.forEach(block => {
      const blockBox = new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(block.x, block.y, 0),
        new THREE.Vector3(block.width, block.height, 1.0)
      );

      if (playerBox.intersectsBox(blockBox)) {
        // Vertical Resolution
        const overlapX = Math.min(player.x + player.width/2 - (block.x - 0.5), block.x + 0.5 - (player.x - player.width/2));
        const overlapY = Math.min(player.y + player.height - (block.y - 0.5), block.y + 0.5 - player.y);

        if (overlapY < overlapX) {
          // Colliding vertically
          if (player.vy <= 0 && player.y + player.height/2 > block.y) {
            // Landed on top of the block
            player.y = block.y + 0.5;
            player.vy = 0;
            stoodOnObject = true;
          } 
          else if (player.vy > 0 && player.y + player.height/2 < block.y) {
            // Bonked the bottom of the block
            player.y = block.y - 0.5 - player.height;
            player.vy = -0.02; // bounce down
            
            // Trigger block action if it is interactive
            if (block.type === 'brick' || block.type === 'question') {
              if (!block.hit) {
                block.hit = true;
                sounds.hit();
                triggerVibrate(15);
                
                // Spawn rewards
                if (block.itemType === 'coin') {
                  coins++;
                  score += 200;
                  hudCoins.textContent = `🪙 ${String(coins).padStart(2, '0')}`;
                  sounds.coin();
                  
                  // Spawn coin jump animation
                  const pop = new VoxelCoin(block.x, block.y + 1.0);
                  pop.vy = 0.12;
                  setTimeout(() => {
                    pop.destroy();
                    const idx = coinsList.indexOf(pop);
                    if (idx > -1) coinsList.splice(idx, 1);
                  }, 350);
                  coinsList.push(pop);
                } else {
                  // Spawn Powerup
                  items.push(new VoxelItem(block.x, block.y + 1.0, block.itemType));
                }
              }
            }
          }
        } else {
          // Horizontal Resolution (Blocking sides)
          if (player.x < block.x) {
            player.x = block.x - 0.5 - player.width/2;
          } else {
            player.x = block.x + 0.5 + player.width/2;
          }
          player.vx = 0;
        }

        // Re-sync playerBox after resolution
        playerBox.setFromCenterAndSize(
          new THREE.Vector3(player.x, player.y + player.height/2, 0),
          new THREE.Vector3(player.width, player.height, 0.5)
        );
      }
    });

    player.onGround = stoodOnObject;

    // 2. Collisions against Coins
    const isMagnetActive = (player.powerup === 'magnet' || charType === 'stego');
    const magnetRadius = (player.powerup === 'magnet') ? 5.5 : 2.5;

    coinsList.forEach(coin => {
      if (coin.collected) return;

      const coinBox = new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(coin.x, coin.y, 0),
        new THREE.Vector3(coin.width, coin.height, 0.5)
      );

      // Magnet pull physics
      const dx = player.x - coin.x;
      const dy = (player.y + player.height/2) - coin.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      if (isMagnetActive && dist < magnetRadius) {
        coin.vx = (dx / dist) * 0.18;
        coin.vy = (dy / dist) * 0.18;
      }

      if (playerBox.intersectsBox(coinBox)) {
        coin.collected = true;
        coin.destroy();
        coins++;
        score += 200;
        hudCoins.textContent = `🪙 ${String(coins).padStart(2, '0')}`;
        sounds.coin();
        triggerVibrate(10);
      }
    });
    coinsList = coinsList.filter(c => !c.collected);

    // 3. Collisions against Power-up Items
    items.forEach(item => {
      if (item.collected) return;

      const itemBox = new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(item.x, item.y, 0),
        new THREE.Vector3(item.width, item.height, 0.5)
      );

      if (playerBox.intersectsBox(itemBox)) {
        item.collected = true;
        item.destroy();
        player.applyPowerup(item.type);
        score += 500;
        
        if (item.type !== 'mushroom') {
          powerupStatusBar.style.display = 'flex';
          powerupName.textContent = item.type.toUpperCase();
          powerupName.style.color = (item.type === 'star') ? 'var(--neon-magenta)' : 'var(--neon-cyan)';
          powerupProgressFill.style.width = '100%';
        }
      }
    });
    items = items.filter(i => !i.collected);

    // 4. Collisions against Enemies
    enemies.forEach(enemy => {
      if (enemy.stamped) return;

      const enemyBox = new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(enemy.x, enemy.y + enemy.height/2, 0),
        new THREE.Vector3(enemy.width, enemy.height, 0.5)
      );

      // Check Fireball Projectiles against Enemy
      projectiles.forEach(p => {
        if (!p.destroyed && !p.isEnemy) {
          const pBox = new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(p.x, p.y, 0),
            new THREE.Vector3(p.width, p.height, 0.5)
          );
          if (pBox.intersectsBox(enemyBox)) {
            p.destroyed = true;
            enemy.takeStompDamage();
          }
        }
      });

      // Check Player against Enemy
      if (playerBox.intersectsBox(enemyBox)) {
        if (player.powerup === 'star' || player.isDashing) {
          enemy.takeStompDamage();
        }
        // Jump on top (stomp Goombas/Koopas)
        // Cave beetles ('beetle') have spikes on top - jumping on them hurts player!
        else if (player.vy < 0 && player.y > enemy.y + enemy.height * 0.4 && enemy.type !== 'beetle') {
          player.vy = 0.22; // bounce up
          player.onGround = false;
          enemy.takeStompDamage();
        } 
        else {
          player.takeDamage();
        }
      }
    });

    // Check Enemy Fireballs hitting Player
    projectiles.forEach(p => {
      if (p.isEnemy && !p.destroyed) {
        const pBox = new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(p.x, p.y, 0),
          new THREE.Vector3(p.width, p.height, 0.5)
        );
        if (playerBox.intersectsBox(pBox)) {
          p.destroyed = true;
          player.takeDamage();
        }
      }
    });

    // Clean stamped enemies
    enemies.forEach((e, idx) => {
      if (e.stamped && e.stampTimer >= 500) {
        e.destroy();
        enemies.splice(idx, 1);
      }
    });

    // 5. Collisions against Goal Flagpole (Victory Trigger)
    if (flagpoleInstance && !levelComplete) {
      const poleBox = new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(flagpoleInstance.x, flagpoleInstance.y + flagpoleInstance.height/2, 0),
        new THREE.Vector3(0.5, flagpoleInstance.height, 0.5)
      );

      if (playerBox.intersectsBox(poleBox)) {
        triggerVictory();
      }
    }
  }

  // ----------------------------------------------------
  // VICTORY SEQUENCE
  // ----------------------------------------------------
  function triggerVictory() {
    levelComplete = true;
    gameState = 'PAUSED';
    sounds.victory();
    triggerVibrate([50, 100, 150, 200]);
    victorySequenceTimer = 0;
    
    // Animate sliding down pole
    player.vx = 0;
    player.vy = -0.05; // slowly slide down
    
    setTimeout(() => {
      // Show Level Complete modal / next level options
      goPlayer.textContent = playerName;
      goChar.textContent = `${names[charType]} ${emojis[charType]}`;
      goCoins.textContent = `🪙 ${coins}`;
      goTime.textContent = `${timeElapsed.toFixed(1)}s`;
      
      const finalScoreValue = Math.floor(score + coins * 150 + (300 - timeElapsed) * 10);
      goScore.textContent = finalScoreValue;
      
      // Update highscore
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

      // Set visual GameOver modal title to "FASE CONCLUÍDA"
      const modalTitle = document.querySelector('#gameover-overlay .card-title');
      modalTitle.textContent = "FASE CONCLUÍDA!";
      modalTitle.className = "card-title text-center neon-text-cyan";
      
      // Update next phase button
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
    gameState = 'GAMEOVER';
    sounds.gameover();
    triggerVibrate([300, 100, 300]);
    
    goPlayer.textContent = playerName;
    goChar.textContent = `${names[charType]} ${emojis[charType]}`;
    goCoins.textContent = `🪙 ${coins}`;
    goTime.textContent = `${timeElapsed.toFixed(1)}s`;
    
    const finalScoreValue = Math.floor(score + coins * 100);
    goScore.textContent = finalScoreValue;

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
  // MAIN LOOPS
  // ----------------------------------------------------
  let lastTime = performance.now();

  function update(dt) {
    if (gameState !== 'PLAYING') return;

    timeElapsed += dt / 1000;
    hudTime.textContent = `${timeElapsed.toFixed(1)}s`;
    
    score += Math.floor(dt * 0.005);
    hudScore.textContent = String(score).padStart(5, '0');

    // Update player
    player.update(dt);

    // Update powerup status HUD bar
    if (player.powerup && player.powerup !== 'mushroom') {
      const percentage = (player.powerupDuration / player.powerupMaxDuration) * 100;
      powerupProgressFill.style.width = `${Math.max(0, percentage)}%`;
    } else {
      powerupStatusBar.style.display = 'none';
    }

    // Update entities
    interactiveBlocks.forEach(b => b.update(dt));
    coinsList.forEach(c => c.update());
    enemies.forEach(e => e.update(dt));
    items.forEach(i => i.update());
    projectiles.forEach(p => p.update());
    particles.forEach((p, idx) => {
      p.update();
      if (p.life <= 0) {
        p.destroy();
        particles.splice(idx, 1);
      }
    });

    if (flagpoleInstance) flagpoleInstance.update();

    // Clean projectiles
    projectiles.forEach((p, idx) => {
      if (p.destroyed || p.x < player.x - 20 || p.x > player.x + 20) {
        p.destroy();
        projectiles.splice(idx, 1);
      }
    });

    // Collisions
    resolveCollisions();
  }

  function render3D() {
    // 2.5D Side-scrolling Camera Tracking
    // Lock Y and Z, track X smoothly
    const targetCameraX = player.x + 2.0;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCameraX, 0.08);
    camera.position.y = 4.2;
    camera.position.z = 8.5;
    
    camera.lookAt(camera.position.x, 2.2, 0);

    // Dynamic light tracking
    sunLight.position.set(camera.position.x + 10, 20, 15);
    sunLight.shadow.camera.left = camera.position.x - dRange;
    sunLight.shadow.camera.right = camera.position.x + dRange;
    
    neonLight.position.set(player.x, player.y + 1.0, 0.5);

    renderer.render(scene, camera);
  }

  function gameLoop(timestamp) {
    let dt = timestamp - lastTime;
    if (dt > 100) dt = 16.66;
    lastTime = timestamp;

    update(dt);
    render3D();

    requestAnimationFrame(gameLoop);
  }

  // Load level blocks
  loadLevelFromGrid();

  // Initial Camera placement
  camera.position.set(player.x + 2.0, 4.2, 8.5);
  camera.lookAt(player.x + 2.0, 2.2, 0);

  // Trigger loop
  requestAnimationFrame(gameLoop);

  // Helper: explosions on impact
  function createImpactExplosion(x, y, colorHex) {
    for (let i = 0; i < 15; i++) {
      particles.push(new Particle(x, y, colorHex));
    }
  }

  // ----------------------------------------------------
  // INPUT EVENT LISTENERS (Keyboards & Mobile Gamepad)
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

  // B. Mobile Touch mapping (Translucent buttons & Joystick)
  const joystickBase = document.getElementById('joystick-base');
  const joystickHandle = document.getElementById('joystick-handle');
  const joystickContainer = document.getElementById('joystick-container');

  let joystickActive = false;
  let joystickTouchId = null;
  let startX = 0;
  let startY = 0;
  const maxDrag = 40; // Max drag radius in pixels

  function handleJoystickStart(e) {
    e.preventDefault();
    const touch = e.changedTouches[0];
    joystickActive = true;
    joystickTouchId = touch.identifier;
    
    const rect = joystickContainer.getBoundingClientRect();
    const x = touch.clientX - rect.left - 50; // offset half width of base (50px)
    const y = touch.clientY - rect.top - 50;  // offset half height of base (50px)
    
    joystickBase.style.position = 'absolute';
    joystickBase.style.left = `${x}px`;
    joystickBase.style.top = `${y}px`;
    
    startX = touch.clientX;
    startY = touch.clientY;
    
    initAudio();
  }

  function handleJoystickMove(e) {
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
});
