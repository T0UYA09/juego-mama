const TILE_WIDTH = 64; 
const TILE_HEIGHT = 84;
const Z_OFFSET_X = -4; 
const Z_OFFSET_Y = -6; 

const boardEl = document.getElementById('board');
const scoreEl = document.getElementById('score');
const pairsLeftEl = document.getElementById('pairs-left');
const restartBtn = document.getElementById('restart-btn');
const modalRestartBtn = document.getElementById('modal-restart-btn');
const modal = document.getElementById('victory-modal');
const musicBtn = document.getElementById('music-btn');
const toastEl = document.getElementById('toast');

let activeTiles = [];
let selectedTile = null;
let score = 0;
let pairsLeft = 0;

// Audio System
let audioCtx = null;
let isMusicOn = false;
let musicInterval = null;
const pentatonic = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25]; // C4, D4, E4, G4, A4, C5

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playMatchSound() {
    if (!isMusicOn || !audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
}

function playChime() {
    if (!isMusicOn || !audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    const freq = pentatonic[Math.floor(Math.random() * pentatonic.length)];
    osc.type = 'triangle';
    osc.frequency.value = freq;
    
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 0.5);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 3);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 3.5);
}

function toggleMusic() {
    initAudio();
    isMusicOn = !isMusicOn;
    if (isMusicOn) {
        musicBtn.textContent = '🎵 Música: On';
        if (audioCtx.state === 'suspended') audioCtx.resume();
        musicInterval = setInterval(playChime, 2000);
        playChime();
    } else {
        musicBtn.textContent = '🎵 Música: Off';
        clearInterval(musicInterval);
    }
}

musicBtn.addEventListener('click', toggleMusic);

function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.remove('hidden');
    setTimeout(() => {
        toastEl.classList.add('hidden');
    }, 2500);
}

// 40 tiles = 20 pairs
const LAYOUT = [
    // Layer 0 - 24 tiles
    {x:0,y:0,z:0}, {x:1,y:0,z:0}, {x:2,y:0,z:0}, {x:3,y:0,z:0}, {x:4,y:0,z:0}, {x:5,y:0,z:0},
    {x:0,y:1,z:0}, {x:1,y:1,z:0}, {x:2,y:1,z:0}, {x:3,y:1,z:0}, {x:4,y:1,z:0}, {x:5,y:1,z:0},
    {x:0,y:2,z:0}, {x:1,y:2,z:0}, {x:2,y:2,z:0}, {x:3,y:2,z:0}, {x:4,y:2,z:0}, {x:5,y:2,z:0},
    {x:0,y:3,z:0}, {x:1,y:3,z:0}, {x:2,y:3,z:0}, {x:3,y:3,z:0}, {x:4,y:3,z:0}, {x:5,y:3,z:0},
    // Layer 1 - 12 tiles
    {x:1.5,y:0.5,z:1}, {x:2.5,y:0.5,z:1}, {x:3.5,y:0.5,z:1}, {x:4.5,y:0.5,z:1},
    {x:1.5,y:1.5,z:1}, {x:2.5,y:1.5,z:1}, {x:3.5,y:1.5,z:1}, {x:4.5,y:1.5,z:1},
    {x:1.5,y:2.5,z:1}, {x:2.5,y:2.5,z:1}, {x:3.5,y:2.5,z:1}, {x:4.5,y:2.5,z:1},
    // Layer 2 - 4 tiles
    {x:2.5,y:1,z:2}, {x:3.5,y:1,z:2},
    {x:2.5,y:2,z:2}, {x:3.5,y:2,z:2}
];

function initGame() {
    boardEl.innerHTML = '';
    activeTiles = [];
    selectedTile = null;
    score = 0;
    
    // We have 40 tiles, so we need 20 pairs
    pairsLeft = LAYOUT.length / 2;
    updateUI();
    modal.classList.add('hidden');

    // Create pairs of Pokemon IDs
    let pokemonIds = [];
    for (let i = 1; i <= pairsLeft; i++) {
        // Start from Bulbasaur (1) up to 20
        pokemonIds.push(i, i);
    }
    
    // Shuffle
    pokemonIds = pokemonIds.sort(() => Math.random() - 0.5);

    // Calculate board size for centering
    let maxX = Math.max(...LAYOUT.map(t => t.x));
    let maxY = Math.max(...LAYOUT.map(t => t.y));
    boardEl.style.width = (maxX + 1) * TILE_WIDTH + 'px';
    boardEl.style.height = (maxY + 1) * TILE_HEIGHT + 'px';

    // Create tile objects
    LAYOUT.forEach((pos, index) => {
        const id = index;
        const pokemonId = pokemonIds[index];
        
        const tileData = {
            id,
            pokemonId,
            x: pos.x,
            y: pos.y,
            z: pos.z,
            element: null
        };
        
        activeTiles.push(tileData);
    });

    renderBoard();
}

function renderBoard() {
    boardEl.innerHTML = '';
    
    // Sort by z, then y, then x so DOM order matches visual stack naturally
    activeTiles.sort((a, b) => {
        if (a.z !== b.z) return a.z - b.z;
        if (a.y !== b.y) return a.y - b.y;
        return a.x - b.x;
    });

    activeTiles.forEach(tile => {
        const el = document.createElement('div');
        el.className = 'tile';
        
        // Setup image
        const img = document.createElement('img');
        img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${tile.pokemonId}.png`;
        img.alt = `Pokemon ${tile.pokemonId}`;
        
        // Fallback if image fails to load
        img.onerror = () => {
            img.style.display = 'none';
            el.textContent = `#${tile.pokemonId}`;
            el.style.fontSize = '20px';
            el.style.fontWeight = 'bold';
        };

        el.appendChild(img);

        // Position
        el.style.left = (tile.x * TILE_WIDTH) + (tile.z * Z_OFFSET_X) + 'px';
        el.style.top = (tile.y * TILE_HEIGHT) + (tile.z * Z_OFFSET_Y) + 'px';
        el.style.zIndex = tile.z * 10 + Math.floor(tile.y * 5) + Math.floor(tile.x);

        // Interactions
        el.addEventListener('click', () => handleTileClick(tile));

        tile.element = el;
        boardEl.appendChild(el);
    });

    updatePlayability();
    setTimeout(checkAndShuffleIfNeeded, 500); // Check initial state
}

function updatePlayability() {
    activeTiles.forEach(tile => {
        if (isTileFree(tile)) {
            tile.element.classList.remove('blocked');
        } else {
            tile.element.classList.add('blocked');
        }
    });
}

function isTileFree(tile) {
    let hasAbove = false;
    let blockedLeft = false;
    let blockedRight = false;

    for (let other of activeTiles) {
        if (other.id === tile.id) continue;

        // Check if other is above
        if (other.z > tile.z) {
            if (Math.abs(other.x - tile.x) < 1 && Math.abs(other.y - tile.y) < 1) {
                hasAbove = true;
            }
        }

        // Check if other is on the same level blocking sides
        if (other.z === tile.z) {
            // Overlaps vertically?
            if (Math.abs(other.y - tile.y) < 1) {
                if (other.x < tile.x && (tile.x - other.x) <= 1) blockedLeft = true;
                if (other.x > tile.x && (other.x - tile.x) <= 1) blockedRight = true;
            }
        }
    }

    return !hasAbove && (!blockedLeft || !blockedRight);
}

function checkAndShuffleIfNeeded() {
    if (pairsLeft === 0) return;

    const freeTiles = activeTiles.filter(t => isTileFree(t));
    const availableIds = new Set();
    let hasMoves = false;

    for (let t of freeTiles) {
        if (availableIds.has(t.pokemonId)) {
            hasMoves = true;
            break;
        }
        availableIds.add(t.pokemonId);
    }

    if (!hasMoves) {
        showToast("¡No hay pares libres! Mezclando fichas...");
        setTimeout(() => {
            // Extract remaining IDs and shuffle
            let ids = activeTiles.map(t => t.pokemonId);
            ids.sort(() => Math.random() - 0.5);
            
            // Reassign IDs and update images
            activeTiles.forEach((t, i) => {
                t.pokemonId = ids[i];
                const img = t.element.querySelector('img');
                img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${t.pokemonId}.png`;
            });
            
            // Re-check after shuffling to ensure a move exists
            checkAndShuffleIfNeeded();
        }, 1500);
    }
}

function handleTileClick(tile) {
    if (!isTileFree(tile)) return;
    initAudio(); // Initialize audio context on first user interaction if not done

    // Deselect if clicking the same tile
    if (selectedTile && selectedTile.id === tile.id) {
        selectedTile.element.classList.remove('selected');
        selectedTile = null;
        return;
    }

    // Select first tile
    if (!selectedTile) {
        selectedTile = tile;
        tile.element.classList.add('selected');
        return;
    }

    // Check for match
    if (selectedTile.pokemonId === tile.pokemonId) {
        // Match!
        handleMatch(selectedTile, tile);
    } else {
        // No match, swap selection
        selectedTile.element.classList.remove('selected');
        selectedTile = tile;
        tile.element.classList.add('selected');
    }
}

function handleMatch(tile1, tile2) {
    playMatchSound();
    
    // Visual effect
    tile1.element.classList.add('matched');
    tile2.element.classList.add('matched');
    
    // Create particles
    createParticles(tile1.element);
    createParticles(tile2.element);

    // Remove from active
    setTimeout(() => {
        tile1.element.remove();
        tile2.element.remove();
        
        activeTiles = activeTiles.filter(t => t.id !== tile1.id && t.id !== tile2.id);
        
        score += 100;
        pairsLeft--;
        updateUI();
        updatePlayability();

        if (pairsLeft === 0) {
            setTimeout(showVictory, 500);
        } else {
            checkAndShuffleIfNeeded(); // Check for deadlocks
        }
        
    }, 300); // match animation duration

    selectedTile = null;
}

function createParticles(element) {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    for (let i = 0; i < 8; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.backgroundColor = i % 2 === 0 ? 'var(--primary-color)' : 'var(--secondary-color)';
        
        // Random direction
        const angle = Math.random() * Math.PI * 2;
        const distance = 30 + Math.random() * 50;
        const tx = Math.cos(angle) * distance + 'px';
        const ty = Math.sin(angle) * distance + 'px';
        
        particle.style.setProperty('--tx', tx);
        particle.style.setProperty('--ty', ty);
        
        // Absolute position on body
        particle.style.left = centerX + 'px';
        particle.style.top = centerY + 'px';
        
        document.body.appendChild(particle);
        
        setTimeout(() => particle.remove(), 600);
    }
}

function updateUI() {
    scoreEl.textContent = score;
    pairsLeftEl.textContent = pairsLeft;
}

function showVictory() {
    modal.classList.remove('hidden');
}

restartBtn.addEventListener('click', initGame);
modalRestartBtn.addEventListener('click', initGame);

// Start game
initGame();