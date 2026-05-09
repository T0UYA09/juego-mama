const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestScoreEl = document.getElementById('best-score');
const gameOverEl = document.getElementById('game-over');
const restartBtn = document.getElementById('restart-btn');
const comboDisplay = document.getElementById('combo-display');

// Game Settings
const GRID_SIZE = 8;
const CELL_SIZE = 35; // Tamaño de cada celda
const BOARD_PADDING = 15;
const BOARD_PIXEL_SIZE = GRID_SIZE * CELL_SIZE;

const BOTTOM_AREA_HEIGHT = 150;
const CANVAS_WIDTH = BOARD_PIXEL_SIZE + (BOARD_PADDING * 2);
const CANVAS_HEIGHT = BOARD_PIXEL_SIZE + (BOARD_PADDING * 2) + BOTTOM_AREA_HEIGHT;

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// Themes
const THEMES = {
    neon: {
        emptyColor: '#334155',
        colors: ['#f43f5e', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#06b6d4'],
        blockStyle: 'neon',
        particleShape: 'circle'
    },
    pastel: {
        emptyColor: '#fbcfe8',
        colors: ['#fecdd3', '#e9d5ff', '#bfdbfe', '#a7f3d0', '#fde68a', '#a5f3fc'],
        blockStyle: 'flat',
        particleShape: 'star'
    },
    retro: {
        emptyColor: '#4a5568',
        colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff'],
        blockStyle: 'retro',
        particleShape: 'square'
    },
    nature: {
        emptyColor: '#a7f3d0',
        colors: ['#059669', '#10b981', '#34d399', '#65a30d', '#84cc16', '#a3e635'],
        blockStyle: 'flat',
        particleShape: 'leaf'
    },
    mariposas_rojas: {
        emptyColor: '#450a0a',
        colors: ['#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d', '#fca5a5'],
        blockStyle: 'neon',
        particleShape: 'butterfly'
    }
};

let currentTheme = 'neon';
const themeSelector = document.getElementById('theme-selector');

themeSelector.addEventListener('change', (e) => {
    currentTheme = e.target.value;
    document.body.setAttribute('data-theme', currentTheme);
    
    // Remap colors in grid and pieces if necessary?
    // Not strictly required, they are CSS hex strings. But if colors are explicitly defined, maybe we just reset the game?
    // The user might not want a reset just for changing the theme.
    // Instead of storing hardcoded hex in grid, let's store color INDEX.
    // But since the game is already storing the color hex, changing theme will mix colors.
    // For simplicity, let's reset the game on theme change, it makes sense.
    init();
});

// Tipos de piezas
const SHAPES = [
    [[1]], // 1x1
    [[1,1],[1,1]], // 2x2
    [[1,1,1],[1,1,1],[1,1,1]], // 3x3
    [[1,1,1,1]], // H-Line 4
    [[1],[1],[1],[1]], // V-Line 4
    [[1,1,1]], // H-Line 3
    [[1],[1],[1]], // V-Line 3
    [[1,1]], // H-Line 2
    [[1],[1]], // V-Line 2
    [[1,0],[1,1]], // L pequeña
    [[0,1],[1,1]],
    [[1,1],[1,0]],
    [[1,1],[0,1]],
    [[1,0,0],[1,0,0],[1,1,1]], // L grande
    [[1,1,1],[1,0,0],[1,0,0]],
    [[0,0,1],[0,0,1],[1,1,1]],
    [[1,1,1],[0,0,1],[0,0,1]],
    [[0,1,0],[1,1,1]], // T shape
    [[1,0],[1,1],[1,0]],
    [[1,1,1],[0,1,0]],
    [[0,1],[1,1],[0,1]]
];

// Estado del juego
let grid = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(0));
let score = 0;
let bestScore = localStorage.getItem('blockPuzzleBest') || 0;
bestScoreEl.textContent = bestScore;
let streak = 0;

let availablePieces = [];
let draggingPiece = null;
let particles = [];

// Iniciar juego
function init() {
    grid = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(0));
    score = 0;
    streak = 0;
    updateScore();
    gameOverEl.classList.add('hidden');
    generatePieces();
    requestAnimationFrame(gameLoop);
}

// Genera 3 piezas nuevas en la parte inferior
function generatePieces() {
    availablePieces = [];
    const slotWidth = CANVAS_WIDTH / 3;
    const currentColors = THEMES[currentTheme].colors;
    
    for (let i = 0; i < 3; i++) {
        const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
        const color = currentColors[Math.floor(Math.random() * currentColors.length)];
        
        const scale = 0.6; // Para que quepan en el menú
        const pieceWidth = shape[0].length * CELL_SIZE;
        const pieceHeight = shape.length * CELL_SIZE;
        
        const x = (i * slotWidth) + (slotWidth / 2) - ((pieceWidth * scale) / 2);
        const y = BOARD_PIXEL_SIZE + (BOARD_PADDING * 2) + (BOTTOM_AREA_HEIGHT / 2) - ((pieceHeight * scale) / 2);

        availablePieces.push({
            id: i,
            shape: shape,
            color: color,
            x: x,
            y: y,
            originalX: x,
            originalY: y,
            scale: scale,
            placed: false
        });
    }
    checkGameOver();
}

function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
    };
}

// Eventos de Touch y Mouse
canvas.addEventListener('mousedown', onPointerDown);
canvas.addEventListener('touchstart', onPointerDown, {passive: false});

canvas.addEventListener('mousemove', onPointerMove);
canvas.addEventListener('touchmove', onPointerMove, {passive: false});

window.addEventListener('mouseup', onPointerUp);
window.addEventListener('touchend', onPointerUp);

function onPointerDown(e) {
    if(!gameOverEl.classList.contains('hidden')) return;
    const pos = getPointerPos(e);
    
    for (let i = 0; i < availablePieces.length; i++) {
        let p = availablePieces[i];
        if (p.placed) continue;
        
        const pWidth = p.shape[0].length * CELL_SIZE * p.scale;
        const pHeight = p.shape.length * CELL_SIZE * p.scale;
        
        // Colisión simple con la pieza pequeña
        if (pos.x >= p.x && pos.x <= p.x + pWidth &&
            pos.y >= p.y && pos.y <= p.y + pHeight) {
            
            draggingPiece = p;
            draggingPiece.scale = 1; // Tamaño real al arrastrar
            
            const fullWidth = p.shape[0].length * CELL_SIZE;
            const fullHeight = p.shape.length * CELL_SIZE;
            
            draggingPiece.x = pos.x - fullWidth / 2;
            draggingPiece.y = pos.y - fullHeight / 2 - (e.touches ? 40 : 0); // Offset para touch
            
            // Traer al frente
            availablePieces.splice(i, 1);
            availablePieces.push(draggingPiece);
            
            if(e.cancelable) e.preventDefault();
            break;
        }
    }
}

function onPointerMove(e) {
    if (draggingPiece) {
        if(e.cancelable) e.preventDefault();
        const pos = getPointerPos(e);
        const fullWidth = draggingPiece.shape[0].length * CELL_SIZE;
        const fullHeight = draggingPiece.shape.length * CELL_SIZE;
        
        draggingPiece.x = pos.x - fullWidth / 2;
        draggingPiece.y = pos.y - fullHeight / 2 - (e.touches ? 60 : 0); // Evitar que el dedo tape
    }
}

function onPointerUp(e) {
    if (draggingPiece) {
        // Calcular en qué celda de la cuadrícula cayó
        const gridX = Math.round((draggingPiece.x - BOARD_PADDING) / CELL_SIZE);
        const gridY = Math.round((draggingPiece.y - BOARD_PADDING) / CELL_SIZE);
        
        if (canPlace(draggingPiece.shape, gridX, gridY)) {
            placePiece(draggingPiece, gridX, gridY);
        } else {
            // Regresa a su lugar si no cabe
            draggingPiece.x = draggingPiece.originalX;
            draggingPiece.y = draggingPiece.originalY;
            draggingPiece.scale = 0.6;
        }
        draggingPiece = null;
    }
}

function canPlace(shape, gridX, gridY) {
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c] === 1) {
                const targetX = gridX + c;
                const targetY = gridY + r;
                // Fuera de límites
                if (targetX < 0 || targetX >= GRID_SIZE || targetY < 0 || targetY >= GRID_SIZE) {
                    return false;
                }
                // Celda ya ocupada
                if (grid[targetY][targetX] !== 0) {
                    return false;
                }
            }
        }
    }
    return true;
}

function placePiece(piece, gridX, gridY) {
    let blocksPlaced = 0;
    for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[r].length; c++) {
            if (piece.shape[r][c] === 1) {
                grid[gridY + r][gridX + c] = piece.color;
                blocksPlaced++;
                createParticles((gridX + c) * CELL_SIZE + BOARD_PADDING + CELL_SIZE/2, 
                                (gridY + r) * CELL_SIZE + BOARD_PADDING + CELL_SIZE/2, 
                                piece.color, 3); // Pequeño efecto al colocar
            }
        }
    }
    
    piece.placed = true;
    score += blocksPlaced; 
    
    checkLines();
    
    // Si todas están colocadas, dar nuevas
    if (availablePieces.every(p => p.placed)) {
        generatePieces();
    } else {
        checkGameOver();
    }
    updateScore();
}

function checkLines() {
    let rowsToClear = [];
    let colsToClear = [];

    // Validar filas completas
    for (let r = 0; r < GRID_SIZE; r++) {
        if (grid[r].every(cell => cell !== 0)) {
            rowsToClear.push(r);
        }
    }

    // Validar columnas completas
    for (let c = 0; c < GRID_SIZE; c++) {
        let colFull = true;
        for (let r = 0; r < GRID_SIZE; r++) {
            if (grid[r][c] === 0) {
                colFull = false;
                break;
            }
        }
        if (colFull) colsToClear.push(c);
    }

    let linesCleared = rowsToClear.length + colsToClear.length;

    if (linesCleared > 0) {
        streak++;
        // Multiplicador: Líneas simultáneas y Racha
        const points = linesCleared * 10 * linesCleared * streak;
        score += points;
        
        showComboText(linesCleared, streak, points);

        rowsToClear.forEach(r => {
            for (let c = 0; c < GRID_SIZE; c++) {
                const color = grid[r][c];
                grid[r][c] = 0;
                createParticles(c * CELL_SIZE + BOARD_PADDING + CELL_SIZE/2, 
                                r * CELL_SIZE + BOARD_PADDING + CELL_SIZE/2, color, 8);
            }
        });

        colsToClear.forEach(c => {
            for (let r = 0; r < GRID_SIZE; r++) {
                if (grid[r][c] !== 0) { 
                    const color = grid[r][c];
                    grid[r][c] = 0;
                    createParticles(c * CELL_SIZE + BOARD_PADDING + CELL_SIZE/2, 
                                    r * CELL_SIZE + BOARD_PADDING + CELL_SIZE/2, color, 8);
                }
            }
        });
    } else {
        streak = 0; // Rompe la racha si colocas algo y no limpias líneas
    }
}

function showComboText(lines, strk, pts) {
    comboDisplay.classList.remove('combo-anim');
    void comboDisplay.offsetWidth; 
    
    let text = "";
    if (lines > 1) text += `${lines} LÍNEAS! `;
    if (strk > 1) text += `RACHA x${strk}! `;
    if(text === "") text = "¡GENIAL!";
    
    comboDisplay.textContent = `${text} +${pts}`;
    comboDisplay.classList.add('combo-anim');
}

function checkGameOver() {
    let canPlaceAny = false;
    for (let p of availablePieces) {
        if (p.placed) continue;
        
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (canPlace(p.shape, c, r)) {
                    canPlaceAny = true;
                    break;
                }
            }
            if(canPlaceAny) break;
        }
        if(canPlaceAny) break;
    }

    if (!canPlaceAny) {
        gameOverEl.classList.remove('hidden');
        if (score > bestScore) {
            bestScore = score;
            localStorage.setItem('blockPuzzleBest', bestScore);
            bestScoreEl.textContent = bestScore;
        }
    }
}

function updateScore() {
    scoreEl.textContent = score;
}

// Visuales: Partículas
function createParticles(x, y, color, count) {
    const theme = THEMES[currentTheme];
    for (let i = 0; i < count; i++) {
        let isButterfly = theme.particleShape === 'butterfly';
        particles.push({
            x: x,
            y: y,
            vx: isButterfly ? (Math.random() - 0.5) * 4 : (Math.random() - 0.5) * 12,
            vy: isButterfly ? (Math.random() - 0.5) * 4 : (Math.random() - 0.5) * 12,
            life: 1,
            decay: isButterfly ? Math.random() * 0.01 + 0.005 : Math.random() * 0.05 + 0.02,
            color: color,
            size: isButterfly ? Math.random() * 6 + 4 : Math.random() * 5 + 2,
            angle: Math.random() * Math.PI * 2,
            wobbleSpeed: Math.random() * 0.2 + 0.1
        });
    }
}

function updateParticles() {
    const theme = THEMES[currentTheme];
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        if (theme.particleShape === 'butterfly') {
            p.angle += p.wobbleSpeed;
            p.x += p.vx + Math.cos(p.angle) * 1.5;
            p.y += p.vy + Math.sin(p.angle) * 1.5;
        } else {
            p.x += p.vx;
            p.y += p.vy;
        }
        p.life -= p.decay;
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawBlock(ctx, x, y, size, colorHex) {
    const theme = THEMES[currentTheme];
    const radius = theme.blockStyle === 'retro' ? 0 : 8;
    
    ctx.fillStyle = colorHex;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, radius);
    ctx.fill();
    
    if (theme.blockStyle === 'neon') {
        // Brillo superior para efecto 3D/Neon
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, size - 4, size / 3, radius - 2);
        ctx.fill();
    } else if (theme.blockStyle === 'retro') {
        // Bordes estilo retro (claro arriba/izq, oscuro abajo/der)
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(x, y, size, 4);
        ctx.fillRect(x, y, 4, size);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x, y + size - 4, size, 4);
        ctx.fillRect(x + size - 4, y, 4, size);
    } else if (theme.blockStyle === 'flat') {
        // Flat style con un ligero borde
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, size, size);
    }
}

function draw() {
    const theme = THEMES[currentTheme];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Dibujar Tablero
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const x = BOARD_PADDING + c * CELL_SIZE;
            const y = BOARD_PADDING + r * CELL_SIZE;
            
            if (grid[r][c] !== 0) {
                // grid[r][c] is actually index or color hex?
                // Wait, grid is currently storing the color hex. We should look it up if we wanted theme-specific colors.
                // Since generatePieces picks from THEMES[currentTheme].colors, and resets on theme change, grid will have correct hex colors.
                drawBlock(ctx, x, y, CELL_SIZE - 2, grid[r][c]);
            } else {
                ctx.fillStyle = theme.emptyColor;
                ctx.beginPath();
                const radius = theme.blockStyle === 'retro' ? 0 : 6;
                ctx.roundRect(x, y, CELL_SIZE - 2, CELL_SIZE - 2, radius);
                ctx.fill();
            }
        }
    }
    
    // Dibujar Piezas en el inventario
    availablePieces.forEach(p => {
        if (!p.placed && p !== draggingPiece) {
            drawPiece(p);
        }
    });
    
    // Dibujar Pieza Arrastrada encima de todo
    if (draggingPiece) {
        drawPiece(draggingPiece);
    }
    
    // Dibujar Partículas
    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        
        if (theme.particleShape === 'square') {
            ctx.rect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
        } else if (theme.particleShape === 'leaf') {
            ctx.ellipse(p.x, p.y, p.size, p.size/2, p.x + p.y, 0, Math.PI * 2);
        } else if (theme.particleShape === 'star') {
            // Draw simple star
            for(let i=0; i<5; i++){
                ctx.lineTo(p.x + Math.cos((18+i*72)/180*Math.PI)*p.size, p.y - Math.sin((18+i*72)/180*Math.PI)*p.size);
                ctx.lineTo(p.x + Math.cos((54+i*72)/180*Math.PI)*p.size/2, p.y - Math.sin((54+i*72)/180*Math.PI)*p.size/2);
            }
        } else if (theme.particleShape === 'butterfly') {
            // Simple butterfly using 4 ellipses
            ctx.ellipse(p.x - p.size/2, p.y - p.size/2, p.size, p.size/2, Math.PI/4, 0, Math.PI * 2);
            ctx.ellipse(p.x + p.size/2, p.y - p.size/2, p.size, p.size/2, -Math.PI/4, 0, Math.PI * 2);
            ctx.ellipse(p.x - p.size/3, p.y + p.size/3, p.size*0.7, p.size/3, Math.PI/4, 0, Math.PI * 2);
            ctx.ellipse(p.x + p.size/3, p.y + p.size/3, p.size*0.7, p.size/3, -Math.PI/4, 0, Math.PI * 2);
        } else {
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        }
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

function drawPiece(p) {
    const size = CELL_SIZE * p.scale;
    for (let r = 0; r < p.shape.length; r++) {
        for (let c = 0; c < p.shape[r].length; c++) {
            if (p.shape[r][c] === 1) {
                drawBlock(ctx, p.x + c * size, p.y + r * size, size - 2, p.color);
            }
        }
    }
}

function gameLoop() {
    updateParticles();
    draw();
    requestAnimationFrame(gameLoop);
}

restartBtn.addEventListener('click', init);

// Iniciar
init();