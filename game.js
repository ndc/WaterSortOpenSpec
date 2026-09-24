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
// Builds a fully solved board: each color fills exactly one tube, remaining
// tubes are empty. Requires numTubes >= numColors. Used as the starting
// point for generatePuzzle() below, and as a test/reference utility.
export function createSolvedState(config) {
    const { numColors, numTubes, capacity } = config;
    if (numTubes < numColors) {
        throw new Error('numTubes must be >= numColors to hold a solved state');
    }
    const colors = getColorPalette(numColors);
    const tubes = [];
    let i;
    for (i = 0; i < numColors; i++) {
        tubes.push(new Tube(capacity, new Array(capacity).fill(colors[i])));
    }
    for (i = numColors; i < numTubes; i++) {
        tubes.push(new Tube(capacity, []));
    }
    return tubes;
}

// Finds every (source, destination, maxAmount) triple that is safe to use as
// a "shuffle move" (see applyShuffleMove) in the given tube arrangement.
function findShuffleCandidates(tubes) {
    const candidates = [];
    for (let from = 0; from < tubes.length; from++) {
        const src = tubes[from];
        if (src.isEmpty()) continue;
        const runLength = src.topRunLength();
        // Moving the *entire* top run is only safe when it is all of the
        // tube's contents (the tube becomes empty, not "a different color
        // exposed"). Otherwise at least one unit of the run must stay behind
        // so the tube's exposed top color does not change. See
        // applyShuffleMove for why this is what guarantees reversibility.
        // This phase runs *before* the spread phase (see generatePuzzle), so
        // it is free to fully drain tubes and use empty destinations - any
        // resulting dip in occupied-tube count is topped back up afterward.
        const safeMax = runLength === src.contents.length ? runLength : runLength - 1;
        if (safeMax < 1) continue;
        for (let to = 0; to < tubes.length; to++) {
            if (to === from) continue;
            const room = tubes[to].capacity - tubes[to].contents.length;
            if (room < 1) continue;
            candidates.push({ from, to, maxAmount: Math.min(safeMax, room) });
        }
    }
    return candidates;
}

// Like findShuffleCandidates, but restricted to moves that grow the number
// of occupied tubes: the destination must be genuinely empty, and the moved
// amount is always exactly 1 unit (see applySpreadMove for why). A tube can
// be a source only if its top run holds at least 2 units of the same color,
// so peeling 1 off still leaves at least 1 behind - both keeping the source
// occupied and leaving its exposed top color unchanged (the reversibility
// requirement shared with shuffle moves; see applyMoveFromCandidates).
function findSpreadCandidates(tubes) {
    const candidates = [];
    for (let from = 0; from < tubes.length; from++) {
        if (tubes[from].topRunLength() < 2) continue;
        for (let to = 0; to < tubes.length; to++) {
            if (to === from || !tubes[to].isEmpty()) continue;
            candidates.push({ from, to });
        }
    }
    return candidates;
}

// Shared executor for both move kinds above: picks a random candidate and
// applies it in place, moving `fixedAmount` units if given, otherwise a
// random amount within the candidate's cap.
//
// The amount moved (whether fixed or randomly capped by the caller) always
// leaves the source tube's exposed top color unchanged. That is exactly what
// guarantees the move can always be undone later by a single valid *player*
// pour: immediately after the move, the destination's top is the color that
// was just added (so pouring it back out is legal), and the source's top is
// still the same color it was before (empty, or unchanged - so pouring back
// onto it is legal too). Chaining these reversals in reverse chronological
// order therefore always reconstructs the solved state through nothing but
// valid player moves, which is what proves every generated puzzle is
// solvable - without needing to run a separate solver.
//
// Returns false (and changes nothing) if there are no candidates.
function applyMoveFromCandidates(tubes, rng, candidates, fixedAmount) {
    if (candidates.length === 0) return false;
    const choice = candidates[Math.floor(rng() * candidates.length)];
    const amount = fixedAmount ?? 1 + Math.floor(rng() * choice.maxAmount);
    const src = tubes[choice.from];
    const dst = tubes[choice.to];
    const color = src.getTop();
    src.remove(amount);
    dst.add(color, amount);
    return true;
}

// Applies one random "shuffle move" in place: moves a capped amount of the
// top color from a random source tube to a random destination tube, WITHOUT
// requiring the destination's top color to match the source's (unlike a real
// player pour - see isValidMove). This is what allows one color to end up
// stacked on top of a *different* color, i.e. genuine mixing.
function applyShuffleMove(tubes, rng) {
    return applyMoveFromCandidates(tubes, rng, findShuffleCandidates(tubes));
}

// Applies one random "spread move": like applyShuffleMove, but restricted to
// growing the number of occupied tubes (see findSpreadCandidates). Always
// moves exactly 1 unit: peeling off the minimum possible amount each time
// means a single source tube can seed multiple new occupied tubes (its top
// run shrinks by only 1 each time, so it can stay a valid spread source
// across several moves) instead of exhausting its "spreadability" in one
// large jump. That is what lets the spread phase reliably reach its target
// occupied-tube count instead of stalling far short of it.
function applySpreadMove(tubes, rng) {
    return applyMoveFromCandidates(tubes, rng, findSpreadCandidates(tubes), 1);
}

function countOccupiedTubes(tubes) {
    return tubes.reduce((count, t) => count + (t.isEmpty() ? 0 : 1), 0);
}

// Sum, across all tubes, of how many more times each could still act as a
// spread-move source (see findSpreadCandidates) before its top run shrinks
// to a single unit and it becomes permanently ineligible. This is exactly
// the number of additional occupied tubes that could still be created by
// spreading alone, regardless of which eligible tubes are actually chosen -
// see applyGuardedShuffleMove for why that makes it useful as a safety
// check.
function totalSpreadPotential(tubes) {
    return tubes.reduce((sum, t) => sum + (t.isEmpty() ? 0 : t.topRunLength() - 1), 0);
}

// Like applyShuffleMove, but only accepts a randomly chosen candidate if,
// after applying it, there would still be enough spread potential (see
// totalSpreadPotential) left to reach `occupiedTarget` via spreading alone.
// Plain unbiased mixing has no such safeguard: it is just as likely to
// merge two differently-colored single-unit tubes together (permanently
// destroying both units' spread potential, since the resulting tube's top
// run is only 1 unit of a color that differs from what is beneath it) as
// it is to do anything else, and repeatedly doing so is what collapses
// occupied-tube count back down to the low equilibrium generatePuzzle's
// spread phase exists to avoid - even when interleaved with periodic
// top-ups (see generatePuzzle), because by the time a top-up runs, the
// potential it would have needed may already be gone. Guarding each
// individual move, rather than only checking after the fact, is what keeps
// that from happening. Tries a handful of random candidates before giving
// up and returning false (meaning: no safe move found this round).
function applyGuardedShuffleMove(tubes, rng, occupiedTarget) {
    const candidates = findShuffleCandidates(tubes);
    if (candidates.length === 0) return false;
    const maxAttempts = Math.min(candidates.length, 10);
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const choice = candidates[Math.floor(rng() * candidates.length)];
        const amount = 1 + Math.floor(rng() * choice.maxAmount);
        const src = tubes[choice.from];
        const dst = tubes[choice.to];
        const color = src.getTop();
        src.remove(amount);
        dst.add(color, amount);
        const gap = occupiedTarget - countOccupiedTubes(tubes);
        if (totalSpreadPotential(tubes) >= gap) {
            return true;
        }
        // Not safe - undo and try a different candidate.
        dst.remove(amount);
        src.add(color, amount);
    }
    return false;
}

// Generates a puzzle by starting from a solved state (see createSolvedState)
// and repeatedly applying random moves that are reversible by construction
// (see applyShuffleMove / applySpreadMove).
//
// This deliberately does NOT build the puzzle by applying ordinary valid
// pour moves (pourWater/isValidMove) in reverse. A valid pour can only ever
// move an already-homogeneous run of one color onto an empty tube or onto a
// matching top color - it can never introduce a NEW boundary between two
// different colors within a tube. So starting from a solved state (every
// tube monochrome-or-empty) and only ever applying valid pours can only ever
// reach OTHER monochrome-or-empty states: colors end up relocated to
// different tubes, but every tube still holds a single color, which is
// already a win by checkWinCondition(). That was the cause of puzzles
// appearing "already sorted" at the start of the game. applyShuffleMove
// lifts the color-matching restriction (while still capping the transfer
// amount to stay provably reversible), which is what actually produces tubes
// with different colors stacked on top of each other.
//
// Generation interleaves two kinds of moves:
//   - Mix (applyGuardedShuffleMove): an unbiased shuffle that produces the
//     actual color mixing within tubes, guarded so it never accepts a move
//     that would leave too little spread potential to still reach
//     `occupiedTarget` (see applyGuardedShuffleMove). Without that guard,
//     plain unbiased mixing settles into a statistical equilibrium
//     occupied-tube count that depends only on capacity/color counts, not
//     on `numTubes` or how many moves are run (more moves does not change
//     it) - or can even run itself into a dead end where no further move of
//     any kind is possible. When numTubes is much larger than numColors
//     that equilibrium leaves most tubes empty, which made puzzles
//     trivially easy: abundant empty tubes are unlimited "workspace" for
//     the player.
//   - Spread (applySpreadMove): deterministically grows the occupied-tube
//     count by peeling exactly 1 unit off some tube's top run into an empty
//     tube. Peeling only 1 unit at a time (rather than a random amount) is
//     what lets a single source tube seed several new occupied tubes
//     instead of exhausting its "spreadability" in one large jump.
//
// An up-front top-up reaches `occupiedTarget` (at most `emptyTubes` tubes
// left empty, default 2 - matching typical water-sort puzzles, and chosen
// so the default config's own natural equilibrium is unaffected) from the
// pristine solved state, where doing so is always fully achievable. Mixing
// then runs move-by-move, with a top-up after each one: the guard makes
// sure a top-up is always able to fully close whatever gap the preceding
// mix move opened, so occupied-tube count is effectively held at
// `occupiedTarget` for the rest of generation instead of drifting back
// toward the unbiased equilibrium.
export function generatePuzzle(config, options = {}) {
    const rng = options.rng || Math.random;
    const { numColors, numTubes, capacity } = config;
    const totalUnits = numColors * capacity;
    const desiredEmptyTubes = options.emptyTubes ?? 2;
    // Can't occupy more tubes than there are units to fill them with, and
    // never fewer than the solved state's own tube count.
    const occupiedTarget = Math.min(totalUnits, Math.max(numColors, numTubes - desiredEmptyTubes));

    const tubes = createSolvedState(config);

    function topUpOccupancy() {
        let needed = occupiedTarget - countOccupiedTubes(tubes);
        while (needed > 0) {
            if (!applySpreadMove(tubes, rng)) break;
            needed--;
        }
    }

    const shuffleMoves = options.shuffleMoves || Math.max(40, numColors * capacity * 4, occupiedTarget * 6);
    topUpOccupancy();
    for (let i = 0; i < shuffleMoves; i++) {
        if (!applyGuardedShuffleMove(tubes, rng, occupiedTarget)) break;
        topUpOccupancy();
    }

    // Defensive fallback: a freshly generated board should never already be
    // solved (even the degenerate numColors === 1 case can land back on a
    // single full tube purely by chance). This should be rare. Prefer a
    // spread move so occupied-tube count is never undone by this rare path;
    // fall back to an ordinary shuffle move if no spread move is available.
    let extraAttempts = 0;
    while (checkWinCondition(tubes) && extraAttempts < 50) {
        if (!applySpreadMove(tubes, rng) && !applyShuffleMove(tubes, rng)) break;
        extraAttempts++;
    }

    return tubes;
}

// BFS solver used to verify puzzles are solvable (see tasks 3.4 / 8.2) and
// for automated testing. Not exposed as a player-facing hint feature.
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
export const DEFAULT_CONFIG = { numColors: 4, numTubes: 6, capacity: 4 };
export const CONFIG_BOUNDS = {
    numColors: { min: 1, max: COLOR_PALETTE.length },
    numTubes: { min: 3, max: 20 },
    capacity: { min: 2, max: 12 }
};

function clampInt(value, min, max, fallback) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

// Clamps raw (possibly invalid) config input to safe integer bounds and
// ensures at least one empty tube exists so generation/moves are possible.
export function validateConfig(rawConfig) {
    const cfg = { ...DEFAULT_CONFIG, ...rawConfig };
    const numColors = clampInt(cfg.numColors, CONFIG_BOUNDS.numColors.min, CONFIG_BOUNDS.numColors.max, DEFAULT_CONFIG.numColors);
    const capacity = clampInt(cfg.capacity, CONFIG_BOUNDS.capacity.min, CONFIG_BOUNDS.capacity.max, DEFAULT_CONFIG.capacity);
    let numTubes = clampInt(cfg.numTubes, CONFIG_BOUNDS.numTubes.min, CONFIG_BOUNDS.numTubes.max, DEFAULT_CONFIG.numTubes);

    if (numTubes < numColors + 1) {
        numTubes = Math.min(CONFIG_BOUNDS.numTubes.max, numColors + 1);
    }

    return { numColors, numTubes, capacity };
}
