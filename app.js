// app.js
// Canvas rendering and user interaction for the Water Sort puzzle. Imports
// game.js for all game logic; this file only deals with the DOM/canvas and
// translating user input into calls on that logic.
import * as WaterSort from './game.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const colorsInput = document.getElementById('configColors');
const tubesInput = document.getElementById('configTubes');
const capacityInput = document.getElementById('configCapacity');
const emptyTubesInput = document.getElementById('configEmptyTubes');
const newGameBtn = document.getElementById('newGameBtn');
const undoBtn = document.getElementById('undoBtn');
const restartBtn = document.getElementById('restartBtn');

let state = null; // current GameState
let lastLayout = null; // last computed layout (tube rects) for hit-testing
const uiState = {
    selected: null, // index of the tube currently selected as pour source
    won: false,
    canUndo: false,
    invalid: null // { tubes: [indices], start: timestamp } while shake feedback plays
};

// ---- Layout (5.1 support) ----
// Computes pixel rectangles for tubes based on the current canvas size and
// puzzle config, so drawing and hit-testing share geometry. Buttons are real
// DOM elements (see #controls in index.html), so they need no layout here.
function computeLayout(canvasEl, tubes, config) {
    const width = canvasEl.width;
    const height = canvasEl.height;
    const topMargin = 70;
    const bottomMargin = 30;
    const sideMargin = 30;
    const availableHeight = height - topMargin - bottomMargin;
    const tubeWidth = Math.min(70, (width - sideMargin * 2) / tubes.length - 16);
    const gap = (width - sideMargin * 2 - tubeWidth * tubes.length) / (tubes.length + 1);
    const unitHeight = availableHeight / config.capacity;

    const tubeRects = tubes.map((tube, i) => {
        const x = sideMargin + gap * (i + 1) + tubeWidth * i;
        const tubeHeight = unitHeight * tube.capacity;
        const y = topMargin + (availableHeight - tubeHeight);
        return { index: i, x, y, width: tubeWidth, height: tubeHeight, unitHeight };
    });

    return { tubeRects };
}

function roundRect(context, x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
}

// ---- Drawing (5.1, 5.4) ----
function drawHeader() {
    ctx.fillStyle = '#eeeeee';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('Water Sort Puzzle', canvas.width / 2, 30);

    if (uiState.won) {
        ctx.fillStyle = '#3ddc72';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('Solved! Click New Game to play again.', canvas.width / 2, 54);
    }
}

function drawTubes(layout) {
    layout.tubeRects.forEach((rect) => {
        const tube = state.tubes[rect.index];
        const isInvalid = uiState.invalid && uiState.invalid.tubes.indexOf(rect.index) !== -1;
        let shakeOffset = 0;
        if (isInvalid) {
            const elapsed = performance.now() - uiState.invalid.start;
            shakeOffset = Math.sin(elapsed / 25) * 4;
        }

        ctx.save();
        ctx.translate(shakeOffset, 0);

        ctx.lineWidth = 3;
        ctx.strokeStyle = isInvalid ? '#ff4d4d' : (rect.index === uiState.selected ? '#ffd54d' : '#5a6270');
        ctx.fillStyle = '#e9edf3';
        roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 10);
        ctx.fill();
        ctx.stroke();

        tube.contents.forEach((color, unitIndex) => {
            const unitY = rect.y + rect.height - (unitIndex + 1) * rect.unitHeight;
            ctx.fillStyle = color;
            ctx.fillRect(rect.x + 4, unitY + 2, rect.width - 8, rect.unitHeight - 4);
        });

        ctx.restore();
    });
}

// Master render: redraws the canvas from current state and syncs button
// enabled/disabled state (5.4).
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const layout = computeLayout(canvas, state.tubes, state.config);
    lastLayout = layout;
    uiState.canUndo = state.canUndo();
    drawHeader();
    drawTubes(layout);
    undoBtn.disabled = !uiState.canUndo;
}

// Briefly flashes/shakes the given tubes to signal an invalid move (6.2),
// then returns to a normal render. No game state changes during this.
function triggerInvalidFeedback(tubeIndices) {
    uiState.invalid = { tubes: tubeIndices, start: performance.now() };
    const duration = 300;
    function step() {
        render();
        if (performance.now() - uiState.invalid.start < duration) {
            requestAnimationFrame(step);
        } else {
            uiState.invalid = null;
            render();
        }
    }
    requestAnimationFrame(step);
}

// ---- Sizing ----
function resizeCanvasForConfig(config) {
    canvas.width = Math.max(500, 90 * config.numTubes + 60);
    canvas.height = Math.max(300, 55 * config.capacity + 160);
}

// ---- Config panel (7.1 defaults, 7.2 validation) ----
function readConfigInputs() {
    return {
        numColors: colorsInput.value,
        numTubes: tubesInput.value,
        capacity: capacityInput.value,
        emptyTubes: emptyTubesInput.value
    };
}

function writeConfigInputs(config) {
    colorsInput.value = config.numColors;
    tubesInput.value = config.numTubes;
    capacityInput.value = config.capacity;
    emptyTubesInput.value = config.emptyTubes;
}

// ---- Game actions (6.3, 6.4, 6.5) ----
function startNewGame() {
    const config = WaterSort.validateConfig(readConfigInputs());
    writeConfigInputs(config);
    const tubes = WaterSort.generatePuzzle(config);
    state = new WaterSort.GameState(config, tubes);
    uiState.won = false;
    uiState.selected = null;
    resizeCanvasForConfig(config);
    render();
}

function handleUndo() {
    if (state.undo()) {
        uiState.won = false;
        uiState.selected = null;
        render();
    }
}

function handleRestart() {
    state.restart();
    uiState.won = false;
    uiState.selected = null;
    render();
}

// ---- Tube interaction (6.1) ----
function handleTubeClick(index) {
    if (uiState.won) return;

    if (uiState.selected === null) {
        if (!state.tubes[index].isEmpty()) {
            uiState.selected = index;
            render();
        }
        return;
    }

    if (uiState.selected === index) {
        uiState.selected = null;
        render();
        return;
    }

    const from = uiState.selected;
    const to = index;
    uiState.selected = null;

    if (WaterSort.isValidMove(state.tubes, from, to)) {
        state.pushHistory();
        WaterSort.pourWater(state.tubes, from, to);
        if (WaterSort.checkWinCondition(state.tubes)) {
            uiState.won = true;
        }
        render();
    } else {
        triggerInvalidFeedback([from, to]);
    }
}

function hitTest(rects, x, y) {
    for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) return r;
    }
    return null;
}

function onCanvasClick(evt) {
    if (!lastLayout) return;
    const rect = canvas.getBoundingClientRect();
    const x = (evt.clientX - rect.left) * (canvas.width / rect.width);
    const y = (evt.clientY - rect.top) * (canvas.height / rect.height);

    const tube = hitTest(lastLayout.tubeRects, x, y);
    if (tube) {
        handleTubeClick(tube.index);
    }
}

// ---- Init ----
function init() {
    writeConfigInputs(WaterSort.DEFAULT_CONFIG);
    canvas.addEventListener('click', onCanvasClick);
    newGameBtn.addEventListener('click', startNewGame);
    undoBtn.addEventListener('click', handleUndo);
    restartBtn.addEventListener('click', handleRestart);
    startNewGame();

    // Test-only introspection hook (used by tests/game.e2e.js). Canvas pixels
    // aren't otherwise inspectable, so E2E tests read state/layout through
    // this. It has no effect on gameplay.
    window.__waterSortTest = {
        getState: () => state,
        getUi: () => uiState,
        getLayout: () => lastLayout
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
