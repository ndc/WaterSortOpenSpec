// tests/logic.test.js
// Node-runnable verification for the pure game logic in game.js.
// Run with: node --test tests/logic.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import * as WaterSort from '../src/game.js';

const {
    Tube, GameState, isValidMove, pourWater, getAllValidMoves, getRandomValidMove,
    checkWinCondition, createSolvedState, generatePuzzle, validateConfig,
    DEFAULT_CONFIG
} = WaterSort;

// ---- Tube (2.1) ----
test('Tube: constructor + getTop/add/remove', () => {
    const t = new Tube(4, []);
    assert.equal(t.getTop(), null);
    t.add('red', 2);
    assert.equal(t.getTop(), 'red');
    assert.deepEqual(t.contents, ['red', 'red']);
    t.add('red');
    assert.equal(t.contents.length, 3);
    const removed = t.remove(2);
    assert.deepEqual(removed, ['red', 'red']);
    assert.equal(t.contents.length, 1);
    assert.throws(() => t.add('red', 10), /overflow/);
    assert.throws(() => t.remove(10), /underflow/);
});

test('Tube: topRunLength counts consecutive top color only', () => {
    const t = new Tube(4, ['blue', 'red', 'red']);
    assert.equal(t.topRunLength(), 2);
    assert.equal(t.isFull(), false);
    assert.equal(t.isMonochromeFull(), false);
    const full = new Tube(3, ['red', 'red', 'red']);
    assert.equal(full.isFull(), true);
    assert.equal(full.isMonochromeFull(), true);
});

// ---- GameState (2.2) ----
test('GameState: deep copy for undo does not alias tube arrays', () => {
    const tubes = [new Tube(4, ['red', 'red']), new Tube(4, [])];
    const state = new GameState(DEFAULT_CONFIG, tubes);
    state.pushHistory();
    pourWater(state.tubes, 0, 1);
    assert.equal(state.tubes[0].contents.length, 0);
    // History snapshot must be unaffected by the later mutation.
    assert.equal(state.history[0][0].contents.length, 2);
    const undone = state.undo();
    assert.equal(undone, true);
    assert.equal(state.tubes[0].contents.length, 2);
});

test('GameState: restart returns to initial puzzle and clears history', () => {
    const tubes = [new Tube(4, ['red', 'red']), new Tube(4, [])];
    const state = new GameState(DEFAULT_CONFIG, tubes);
    state.pushHistory();
    pourWater(state.tubes, 0, 1);
    state.restart();
    assert.equal(state.history.length, 0);
    assert.equal(state.tubes[0].contents.length, 2);
    assert.equal(state.canUndo(), false);
});

// ---- Color palette (2.3) ----
test('Color palette: consistent hex assignment', () => {
    const colors = WaterSort.getColorPalette(4);
    assert.equal(colors.length, 4);
    colors.forEach((c) => assert.match(c, /^#[0-9A-Fa-f]{6}$/));
    assert.deepEqual(WaterSort.getColorPalette(4), colors);
    assert.throws(() => WaterSort.getColorPalette(999), /exceeds/);
});

// ---- createSolvedState (3.1) ----
test('createSolvedState: correct tube distribution', () => {
    const config = { numColors: 4, numTubes: 6, capacity: 4, emptyTubes: 1 };
    const tubes = createSolvedState(config);
    assert.equal(tubes.length, 6);
    const full = tubes.filter((t) => t.isMonochromeFull());
    const empty = tubes.filter((t) => t.isEmpty());
    assert.equal(full.length, 5);
    assert.equal(empty.length, 1);
    assert.equal(checkWinCondition(tubes), true);
});

// ---- isValidMove (3.2) — scenarios from spec.md ----
test('isValidMove: valid pour with matching colors', () => {
    const tubes = [new Tube(4, ['red', 'red']), new Tube(4, ['red'])];
    assert.equal(isValidMove(tubes, 0, 1), true);
});

test('isValidMove: valid pour into empty tube', () => {
    const tubes = [new Tube(4, ['blue']), new Tube(4, [])];
    assert.equal(isValidMove(tubes, 0, 1), true);
});

test('isValidMove: invalid - non-matching colors', () => {
    const tubes = [new Tube(4, ['blue']), new Tube(4, ['red'])];
    assert.equal(isValidMove(tubes, 0, 1), false);
});

test('isValidMove: invalid - destination full', () => {
    const tubes = [new Tube(4, ['red']), new Tube(4, ['red', 'red', 'red', 'red'])];
    assert.equal(isValidMove(tubes, 0, 1), false);
});

test('isValidMove: invalid - empty source', () => {
    const tubes = [new Tube(4, []), new Tube(4, ['red'])];
    assert.equal(isValidMove(tubes, 0, 1), false);
});

test('isValidMove: invalid - same tube', () => {
    const tubes = [new Tube(4, ['red'])];
    assert.equal(isValidMove(tubes, 0, 0), false);
});

// ---- getRandomValidMove (3.3) ----
test('getRandomValidMove: only returns legal moves', () => {
    const config = { numColors: 3, numTubes: 5, capacity: 4 };
    for (let trial = 0; trial < 50; trial++) {
        const tubes = generatePuzzle(config);
        const move = getRandomValidMove(tubes);
        if (move) {
            assert.equal(isValidMove(tubes, move[0], move[1]), true);
        }
    }
    const solved = createSolvedState(config);
    // Our config guarantees numTubes > numColors, so at least one legal move
    // (pour into an empty tube) must exist from the solved state.
    const moves = getAllValidMoves(solved);
    assert.ok(moves.length > 0);
});

// ---- Randomized puzzle generation (3.4, 3.7, 8.2) ----
function createSeededRng(seed) {
    return () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 0x100000000;
    };
}

function countColors(tubes) {
    const counts = new Map();
    for (const tube of tubes) {
        for (const color of tube.contents) {
            counts.set(color, (counts.get(color) || 0) + 1);
        }
    }
    return counts;
}

test('generatePuzzle: preserves counts and mixed full-tube constraints across configs', () => {
    const configs = [
        { numColors: 2, numTubes: 3, capacity: 3, emptyTubes: 1 },
        { numColors: 2, numTubes: 4, capacity: 4, emptyTubes: 2 },
        { numColors: 4, numTubes: 6, capacity: 4, emptyTubes: 2 },
        { numColors: 6, numTubes: 9, capacity: 5, emptyTubes: 3 },
        { numColors: 16, numTubes: 20, capacity: 2, emptyTubes: 3 }
    ];
    configs.forEach((config) => {
        const expectedCounts = countColors(createSolvedState(config));
        for (let i = 0; i < 10; i++) {
            const tubes = generatePuzzle(config);
            assert.equal(tubes.filter((tube) => tube.isEmpty()).length, config.emptyTubes);
            assert.equal(tubes.filter((tube) => tube.isFull()).length, config.numTubes - config.emptyTubes);
            assert.equal(tubes.every((tube) => tube.isEmpty() || new Set(tube.contents).size >= 2), true);
            assert.equal(checkWinCondition(tubes), false);
            assert.deepEqual(countColors(tubes), expectedCounts);
        }
    });
});

test('generatePuzzle: different random inputs can produce different arrangements', () => {
    const config = { numColors: 4, numTubes: 6, capacity: 4, emptyTubes: 1 };
    const first = generatePuzzle(config, { rng: createSeededRng(1) });
    const second = generatePuzzle(config, { rng: createSeededRng(2) });
    assert.notEqual(WaterSort.serializeTubes(first), WaterSort.serializeTubes(second));
});

// ---- pourWater (4.1) ----
test('pourWater: transfers correctly and respects capacity', () => {
    const tubes = [new Tube(4, ['red', 'red', 'red']), new Tube(4, ['red'])];
    const ok = pourWater(tubes, 0, 1);
    assert.equal(ok, true);
    // Destination had 1 unit + room for 3; source had 3 red on top -> all 3 move.
    assert.deepEqual(tubes[1].contents, ['red', 'red', 'red', 'red']);
    assert.deepEqual(tubes[0].contents, []);
});

test('pourWater: partial transfer limited by destination capacity', () => {
    const tubes = [new Tube(4, ['blue', 'red', 'red', 'red']), new Tube(4, ['red', 'red', 'red'])];
    const ok = pourWater(tubes, 0, 1);
    assert.equal(ok, true);
    assert.deepEqual(tubes[1].contents, ['red', 'red', 'red', 'red']);
    // Only 1 of the 3 red units fit; 2 remain on top of source.
    assert.deepEqual(tubes[0].contents, ['blue', 'red', 'red']);
});

test('pourWater: rejects invalid move without changing state', () => {
    const tubes = [new Tube(4, ['blue']), new Tube(4, ['red'])];
    const ok = pourWater(tubes, 0, 1);
    assert.equal(ok, false);
    assert.deepEqual(tubes[0].contents, ['blue']);
    assert.deepEqual(tubes[1].contents, ['red']);
});

// ---- checkWinCondition (4.2) ----
test('checkWinCondition: true only when all tubes full-monochrome or empty', () => {
    const solved = [new Tube(2, ['red', 'red']), new Tube(2, [])];
    assert.equal(checkWinCondition(solved), true);
    const partial = [new Tube(2, ['red']), new Tube(2, [])];
    assert.equal(checkWinCondition(partial), false);
    const mixed = [new Tube(2, ['red', 'blue']), new Tube(2, [])];
    assert.equal(checkWinCondition(mixed), false);
});

// ---- undo (4.3) ----
test('undo: full history walk-back to initial state', () => {
    const config = { numColors: 3, numTubes: 5, capacity: 4 };
    const tubes = generatePuzzle(config);
    const state = new GameState(config, tubes);
    const snapshots = [WaterSort.serializeTubes(state.tubes)];
    let movesMade = 0;
    for (let i = 0; i < 10; i++) {
        const move = getRandomValidMove(state.tubes);
        if (!move) break;
        state.pushHistory();
        pourWater(state.tubes, move[0], move[1]);
        snapshots.push(WaterSort.serializeTubes(state.tubes));
        movesMade++;
    }
    for (let i = 0; i < movesMade; i++) {
        const ok = state.undo();
        assert.equal(ok, true);
        assert.equal(WaterSort.serializeTubes(state.tubes), snapshots[snapshots.length - 2 - i]);
    }
    assert.equal(state.canUndo(), false);
});

// ---- Configuration defaults & validation (7.1, 7.2) ----
test('validateConfig: defaults applied when config omitted', () => {
    const cfg = validateConfig({});
    assert.deepEqual(cfg, DEFAULT_CONFIG);
});

test('validateConfig: clamps out-of-range and non-integer values', () => {
    const cfg = validateConfig({ numColors: -5, numTubes: 1000, capacity: 0.4, emptyTubes: 999 });
    assert.equal(cfg.numColors, 2);
    assert.equal(cfg.capacity, 2);
    assert.ok(cfg.numTubes <= 20);
    assert.ok(cfg.numTubes >= cfg.numColors + 1);
    assert.equal(cfg.emptyTubes, cfg.numTubes - cfg.numColors);
});

test('validateConfig: normalizes an impossible two-color, capacity-two layout', () => {
    const cfg = validateConfig({ numColors: 2, numTubes: 4, capacity: 2, emptyTubes: 1 });
    assert.equal(cfg.emptyTubes, 2);
    const tubes = generatePuzzle(cfg);
    assert.equal(tubes.every((tube) => tube.isEmpty() || new Set(tube.contents).size >= 2), true);
});

test('validateConfig: rejects non-numeric input via fallback to defaults', () => {
    const cfg = validateConfig({ numColors: 'abc', numTubes: null, capacity: undefined });
    assert.equal(cfg.numColors, DEFAULT_CONFIG.numColors);
    assert.equal(cfg.capacity, DEFAULT_CONFIG.capacity);
});

// ---- Edge cases (8.3) ----
test('edge case: a one-color input is clamped to two colors', () => {
    const config = validateConfig({ numColors: 1, numTubes: 3, capacity: 4, emptyTubes: 1 });
    assert.equal(config.numColors, 2);
});

test('edge case: all empty tubes counts as solved', () => {
    const tubes = [new Tube(4, []), new Tube(4, [])];
    assert.equal(checkWinCondition(tubes), true);
});

test('edge case: maximum capacity tubes pour correctly', () => {
    const config = { numColors: 2, numTubes: 3, capacity: 12 };
    const tubes = createSolvedState(config);
    assert.equal(tubes[0].contents.length, 12);
    pourWater(tubes, 0, 2);
    assert.equal(tubes[2].contents.length, 12);
    assert.equal(tubes[0].contents.length, 0);
});

test('edge case: undo all the way to start after many moves', () => {
    const config = { numColors: 4, numTubes: 6, capacity: 4 };
    const tubes = generatePuzzle(config);
    const state = new GameState(config, tubes);
    const initialKey = WaterSort.serializeTubes(state.initialTubes);
    let made = 0;
    for (let i = 0; i < 20; i++) {
        const move = getRandomValidMove(state.tubes);
        if (!move) break;
        state.pushHistory();
        pourWater(state.tubes, move[0], move[1]);
        made++;
    }
    for (let i = 0; i < made; i++) state.undo();
    assert.equal(WaterSort.serializeTubes(state.tubes), initialKey);
});
