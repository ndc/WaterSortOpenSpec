// tests/logic.test.js
// Node-runnable verification for the pure game logic in game.js.
// Run with: node --test tests/logic.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import * as WaterSort from '../game.js';

const {
    Tube, GameState, isValidMove, pourWater, getAllValidMoves, getRandomValidMove,
    checkWinCondition, createSolvedState, generatePuzzle, isSolvable, validateConfig,
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
    const config = { numColors: 4, numTubes: 6, capacity: 4 };
    const tubes = createSolvedState(config);
    assert.equal(tubes.length, 6);
    const full = tubes.filter((t) => t.isMonochromeFull());
    const empty = tubes.filter((t) => t.isEmpty());
    assert.equal(full.length, 4);
    assert.equal(empty.length, 2);
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

// ---- Puzzle generation + solvability (3.4, 8.2) ----
test('generatePuzzle: produces solvable puzzles across configs', () => {
    const configs = [
        { numColors: 2, numTubes: 4, capacity: 4 },
        { numColors: 4, numTubes: 6, capacity: 4 },
        { numColors: 6, numTubes: 8, capacity: 4 },
        { numColors: 1, numTubes: 3, capacity: 4 },
        { numColors: 2, numTubes: 8, capacity: 3 } // many spare tubes relative to numColors
    ];
    configs.forEach((config) => {
        for (let i = 0; i < 5; i++) {
            const tubes = generatePuzzle(config);
            assert.equal(isSolvable(tubes), true, `puzzle for config ${JSON.stringify(config)} must be solvable`);
        }
    });
});

// Regression test for the "tubes already sorted at start" bug: generation
// used to shuffle by replaying valid pours from a solved state, which can
// only ever relocate whole same-color tubes and therefore always produced an
// already-solved board. A correct generator must produce unsolved puzzles
// with genuinely mixed tubes.
test('generatePuzzle: result is not already solved and contains genuinely mixed tubes', () => {
    const config = { numColors: 4, numTubes: 6, capacity: 4 };
    for (let i = 0; i < 20; i++) {
        const tubes = generatePuzzle(config);
        assert.equal(checkWinCondition(tubes), false, 'freshly generated puzzle must not already be solved');
        const hasMixedTube = tubes.some((t) => new Set(t.contents).size > 1);
        assert.equal(hasMixedTube, true, 'at least one tube should contain more than one color');
    }
});

// Regression test for the "too many empty tubes" bug: an unbiased shuffle
// converges to a low occupied-tube-count equilibrium regardless of how many
// spare tubes are available, so configs with numTubes >> numColors used to
// generate puzzles that were far too easy (e.g. 16/20 tubes left empty for
// 4 colors/20 tubes/capacity 4). A correct generator must reliably occupy
// close to numTubes - emptyTubes tubes.
//
// This does not also re-check isSolvable here: BFS verification is only
// practical at the small scale used by the test above - at this config's
// scale the reachable state space is large enough that isSolvable's search
// budget is exhausted long before it can confirm or refute a solution,
// making it both too slow for a unit test and prone to false negatives.
// Solvability at this scale relies on generatePuzzle's construction
// guarantee instead (see the comment above generatePuzzle).
test('generatePuzzle: occupies close to the target tube count even with many spare tubes', () => {
    const config = { numColors: 4, numTubes: 20, capacity: 4 };
    // Mirrors generatePuzzle's own occupiedTarget formula: never more tubes
    // occupied than there are total units to fill them with (here, 16), even
    // though numTubes - emptyTubes would otherwise ask for 18.
    const totalUnits = config.numColors * config.capacity;
    const target = Math.min(totalUnits, config.numTubes - 2); // default desiredEmptyTubes is 2
    for (let i = 0; i < 10; i++) {
        const tubes = generatePuzzle(config);
        assert.equal(checkWinCondition(tubes), false, 'freshly generated puzzle must not already be solved');
        const occupied = tubes.filter((t) => t.contents.length > 0).length;
        assert.ok(occupied >= target, `expected at least ${target} occupied tubes, got ${occupied}`);
    }
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
    const cfg = validateConfig({ numColors: -5, numTubes: 1000, capacity: 0.4 });
    assert.equal(cfg.numColors, 1);
    assert.equal(cfg.capacity, 2);
    assert.ok(cfg.numTubes <= 20);
    assert.ok(cfg.numTubes >= cfg.numColors + 1);
});

test('validateConfig: rejects non-numeric input via fallback to defaults', () => {
    const cfg = validateConfig({ numColors: 'abc', numTubes: null, capacity: undefined });
    assert.equal(cfg.numColors, DEFAULT_CONFIG.numColors);
    assert.equal(cfg.capacity, DEFAULT_CONFIG.capacity);
});

// ---- Edge cases (8.3) ----
test('edge case: single color puzzle is trivially solvable', () => {
    const config = { numColors: 1, numTubes: 3, capacity: 4 };
    const tubes = generatePuzzle(config);
    assert.equal(isSolvable(tubes), true);
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
