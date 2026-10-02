// game.js
// Pure game logic for the Water Sort puzzle: no DOM/canvas dependencies so it
// can be imported directly by the browser (as an ES module) and by Node.js
// tests.

// ---- Color palette ----
// Fixed palette of visually distinct hex colors. Colors are assigned to a
// puzzle by taking the first `numColors` entries, so assignment is
// consistent across runs for the same numColors value.
export const COLOR_PALETTE = [
    '#E63946', '#457B9D', '#2A9D8F', '#F4A261',
    '#8E44AD', '#E9C46A', '#06D6A0', '#EF476F',
    '#118AB2', '#FFD166', '#073B4C', '#B5838D',
    '#3A86FF', '#FB5607', '#8338EC', '#FF006E'
];

export function getColorPalette(numColors) {
    if (numColors > COLOR_PALETTE.length) {
        throw new Error('numColors exceeds available palette size of ' + COLOR_PALETTE.length);
    }
    return COLOR_PALETTE.slice(0, numColors);
}

// ---- Tube ----
export class Tube {
    constructor(capacity, contents) {
        this.capacity = capacity;
        this.contents = contents ? contents.slice() : [];
    }

    getTop() {
        return this.contents.length ? this.contents[this.contents.length - 1] : null;
    }

    isEmpty() {
        return this.contents.length === 0;
    }

    isFull() {
        return this.contents.length === this.capacity;
    }

    isMonochromeFull() {
        return this.isFull() && this.contents.every((c) => c === this.contents[0]);
    }

    // Number of consecutive units of the top color, counted down from the top.
    topRunLength() {
        if (this.isEmpty()) return 0;
        const top = this.getTop();
        let count = 0;
        for (let i = this.contents.length - 1; i >= 0; i--) {
            if (this.contents[i] !== top) break;
            count++;
        }
        return count;
    }

    add(color, count = 1) {
        if (this.contents.length + count > this.capacity) {
            throw new Error('Tube overflow');
        }
        for (let i = 0; i < count; i++) this.contents.push(color);
    }

    remove(count = 1) {
        if (count > this.contents.length) {
            throw new Error('Tube underflow');
        }
        return this.contents.splice(this.contents.length - count, count);
    }

    clone() {
        return new Tube(this.capacity, this.contents);
    }
}

// ---- GameState ----
// Wraps the tubes array plus config, an undo history stack, and the initial
// puzzle snapshot (used for restart). Tubes are deep-copied whenever they
// are captured, so history entries are never mutated by later moves.
export class GameState {
    constructor(config, tubes) {
        this.config = { ...config };
        this.tubes = tubes;
        this.history = [];
        this.initialTubes = GameState.cloneTubes(tubes);
    }

    static cloneTubes(tubes) {
        return tubes.map((t) => t.clone());
    }

    pushHistory() {
        this.history.push(GameState.cloneTubes(this.tubes));
    }

    canUndo() {
        return this.history.length > 0;
    }

    undo() {
        if (!this.canUndo()) return false;
        this.tubes = this.history.pop();
        return true;
    }

    restart() {
        this.tubes = GameState.cloneTubes(this.initialTubes);
        this.history = [];
    }

    // Replace the current puzzle (used by "New Game") and reset undo history.
    setPuzzle(tubes) {
        this.tubes = tubes;
        this.initialTubes = GameState.cloneTubes(tubes);
        this.history = [];
    }

    clone() {
        const gs = new GameState(this.config, GameState.cloneTubes(this.tubes));
        gs.history = this.history.map(GameState.cloneTubes);
        gs.initialTubes = GameState.cloneTubes(this.initialTubes);
        return gs;
    }
}

// ---- Move validation & execution ----
export function isValidMove(tubes, from, to) {
    if (from === to) return false;
    if (from < 0 || from >= tubes.length) return false;
    if (to < 0 || to >= tubes.length) return false;
    const src = tubes[from];
    const dst = tubes[to];
    if (src.isEmpty()) return false;
    if (dst.isFull()) return false;
    if (!dst.isEmpty() && dst.getTop() !== src.getTop()) return false;
    return true;
}

export function pourWater(tubes, from, to) {
    if (!isValidMove(tubes, from, to)) return false;
    const src = tubes[from];
    const dst = tubes[to];
    const color = src.getTop();
    const moveCount = Math.min(src.topRunLength(), dst.capacity - dst.contents.length);
    src.remove(moveCount);
    dst.add(color, moveCount);
    return true;
}

export function getAllValidMoves(tubes) {
    const moves = [];
    for (let i = 0; i < tubes.length; i++) {
        for (let j = 0; j < tubes.length; j++) {
            if (i !== j && isValidMove(tubes, i, j)) moves.push([i, j]);
        }
    }
    return moves;
}

export function getRandomValidMove(tubes, rng = Math.random) {
    const moves = getAllValidMoves(tubes);
    if (moves.length === 0) return null;
    return moves[Math.floor(rng() * moves.length)];
}

export function checkWinCondition(tubes) {
    return tubes.every((t) => t.isEmpty() || t.isMonochromeFull());
}

// ---- Puzzle generation ----
// Builds a fully solved board with the requested number of empty tubes.
// Every remaining tube is full and monochrome; colors repeat across full
// tubes when there are more filled tubes than colors. Used as the starting
// point for generatePuzzle() below, and as a test/reference utility.
export function createSolvedState(config) {
    const { numColors, numTubes, capacity } = config;
    const emptyTubes = config.emptyTubes ?? DEFAULT_CONFIG.emptyTubes;
    const filledTubeCount = numTubes - emptyTubes;
    if (filledTubeCount < numColors) {
        throw new Error('at least one full tube is required for each color');
    }
    const colors = getColorPalette(numColors);
    const tubes = [];
    let i;
    for (i = 0; i < filledTubeCount; i++) {
        tubes.push(new Tube(capacity, new Array(capacity).fill(colors[i % numColors])));
    }
    for (i = filledTubeCount; i < numTubes; i++) {
        tubes.push(new Tube(capacity, []));
    }
    return tubes;
}

function shuffleInPlace(items, rng) {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
}

function everyOccupiedTubeIsMixed(tubes) {
    return tubes.every((tube) => tube.isEmpty() || new Set(tube.contents).size >= 2);
}

function createRandomizedMixedState(config, rng) {
    const { numTubes, capacity } = config;
    const emptyTubes = config.emptyTubes ?? DEFAULT_CONFIG.emptyTubes;
    const filledTubeCount = numTubes - emptyTubes;
    const solvedTubes = createSolvedState(config);
    const colorCounts = new Map();

    for (let i = 0; i < filledTubeCount; i++) {
        for (const color of solvedTubes[i].contents) {
            colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
        }
    }

    const colorOrder = shuffleInPlace(Array.from(colorCounts.keys()), rng);
    const tubes = Array.from({ length: numTubes }, () => new Tube(capacity));

    // Seed each occupied tube with two different colors; shuffle the rest
    // into the remaining slots so every generated tube stays mixed.
    for (let i = 0; i < filledTubeCount; i++) {
        colorOrder.sort((a, b) => colorCounts.get(b) - colorCounts.get(a));
        const first = colorOrder[0];
        const second = colorOrder.find((color) => colorCounts.get(color) > 0 && color !== first);
        if (!second || colorCounts.get(first) === 0) {
            throw new Error('unable to generate a mixed puzzle for this configuration');
        }

        colorCounts.set(first, colorCounts.get(first) - 1);
        colorCounts.set(second, colorCounts.get(second) - 1);
        if (rng() < 0.5) {
            tubes[i].add(first);
            tubes[i].add(second);
        } else {
            tubes[i].add(second);
            tubes[i].add(first);
        }
    }

    const remainingUnits = [];
    for (const [color, count] of colorCounts) {
        for (let i = 0; i < count; i++) remainingUnits.push(color);
    }
    const remainingSlots = [];
    for (let tubeIndex = 0; tubeIndex < filledTubeCount; tubeIndex++) {
        for (let slot = 2; slot < capacity; slot++) remainingSlots.push(tubeIndex);
    }
    shuffleInPlace(remainingUnits, rng);
    shuffleInPlace(remainingSlots, rng);

    for (let i = 0; i < remainingUnits.length; i++) {
        tubes[remainingSlots[i]].add(remainingUnits[i]);
    }
    for (let i = 0; i < filledTubeCount; i++) {
        shuffleInPlace(tubes[i].contents, rng);
    }

    return tubes;
}

// Generates a randomized deal while preserving the configured color-unit
// counts, exact empty-tube count, full occupancy, and mixed-tube invariant.
// Solvability is intentionally not checked or guaranteed.
export function generatePuzzle(config, options = {}) {
    const rng = options.rng || Math.random;
    const { numColors, capacity } = config;
    const emptyTubes = config.emptyTubes ?? DEFAULT_CONFIG.emptyTubes;
    const filledTubeCount = config.numTubes - emptyTubes;
    if (numColors === 2 && capacity === 2 && filledTubeCount % 2 !== 0) {
        throw new Error('two colors with capacity 2 require an even number of filled tubes');
    }

    const tubes = createRandomizedMixedState(config, rng);
    if (!everyOccupiedTubeIsMixed(tubes)) {
        throw new Error('unable to generate a puzzle with every occupied tube mixed');
    }
    return tubes;
}

// Optional BFS utility; puzzle generation does not call it.
export function isSolvable(tubes, maxStates = 200000) {
    if (checkWinCondition(tubes)) return true;

    const visited = new Set([serializeTubes(tubes)]);
    let queue = [tubes];
    let statesVisited = 0;

    while (queue.length > 0 && statesVisited < maxStates) {
        const next = [];
        for (const current of queue) {
            const moves = getAllValidMoves(current);
            for (const [from, to] of moves) {
                const cloned = GameState.cloneTubes(current);
                pourWater(cloned, from, to);
                const key = serializeTubes(cloned);
                if (visited.has(key)) continue;
                if (checkWinCondition(cloned)) return true;
                visited.add(key);
                next.push(cloned);
                statesVisited++;
                if (statesVisited >= maxStates) break;
            }
            if (statesVisited >= maxStates) break;
        }
        queue = next;
    }
    return false;
}

export function serializeTubes(tubes) {
    return tubes.map((t) => t.contents.join(',')).join('|');
}

// ---- Configuration defaults & validation ----
export const DEFAULT_CONFIG = { numColors: 4, numTubes: 6, capacity: 4, emptyTubes: 1 };
export const CONFIG_BOUNDS = {
    numColors: { min: 2, max: COLOR_PALETTE.length },
    numTubes: { min: 3, max: 20 },
    capacity: { min: 2, max: 12 },
    emptyTubes: { min: 1, max: 19 }
};

function clampInt(value, min, max, fallback) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

// Clamps raw (possibly invalid) config input to safe integer bounds. At least
// one empty tube is always retained, and every configured color is assigned
// at least one full tube in the solved state.
export function validateConfig(rawConfig) {
    const cfg = { ...DEFAULT_CONFIG, ...rawConfig };
    const numColors = clampInt(cfg.numColors, CONFIG_BOUNDS.numColors.min, CONFIG_BOUNDS.numColors.max, DEFAULT_CONFIG.numColors);
    const capacity = clampInt(cfg.capacity, CONFIG_BOUNDS.capacity.min, CONFIG_BOUNDS.capacity.max, DEFAULT_CONFIG.capacity);
    let numTubes = clampInt(cfg.numTubes, CONFIG_BOUNDS.numTubes.min, CONFIG_BOUNDS.numTubes.max, DEFAULT_CONFIG.numTubes);

    if (numTubes < numColors + 1) {
        numTubes = Math.min(CONFIG_BOUNDS.numTubes.max, numColors + 1);
    }
    let emptyTubes = clampInt(
        cfg.emptyTubes,
        CONFIG_BOUNDS.emptyTubes.min,
        Math.min(CONFIG_BOUNDS.emptyTubes.max, numTubes - numColors),
        DEFAULT_CONFIG.emptyTubes
    );
    if (numColors === 2 && capacity === 2 && (numTubes - emptyTubes) % 2 !== 0) {
        emptyTubes++;
    }

    return { numColors, numTubes, capacity, emptyTubes };
}
