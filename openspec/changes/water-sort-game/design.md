# Design

## Context

See proposal.md for motivation. The game needs to:
- Generate solvable water-sort puzzles on demand
- Render and interact with a game board on HTML5 Canvas
- Handle user moves with immediate visual feedback
- Maintain full move history for undo/restart

Technology constraints: Vanilla JavaScript, Canvas rendering, no backend.

## Goals / Non-Goals

**Goals:**
- Single-player web-based puzzle game experience
- Guaranteed solvable puzzles via reverse-solution approach
- Responsive Canvas UI with clear visual feedback
- Full move history and restart capability
- Configurable difficulty (colors, tubes, capacity)

**Non-Goals:**
- Multiplayer or real-time features
- Persistent game state across sessions
- Multiple puzzle levels or campaigns
- AI hints or solution solver
- Mobile optimization (though should work on modern browsers)

## Decisions

### 1. Puzzle Generation Strategy: Build from Solution
**Decision**: Generate puzzles by creating a solved state, then applying a fixed number of random "shuffle moves" that are reversible by construction but are deliberately NOT literal valid player pours.

**Rationale**: Guarantees solvability without a separate solver or retry loop. An earlier version of this decision shuffled by replaying ordinary valid pours (`pourWater`/`isValidMove`) in reverse; that turned out to be fundamentally broken, not just imprecise. A valid pour can only ever move an already-homogeneous run of one color onto an empty tube or onto a matching top color - it can never introduce a new boundary between two different colors within a tube. So starting from a solved state (every tube monochrome-or-empty) and only ever applying valid pours can only ever reach *other* monochrome-or-empty states: colors end up relocated to different tubes, but every tube still holds a single color, which `checkWinCondition` always treats as an immediate win. This was the root cause of puzzles appearing "already sorted" as soon as the game started.

The fix lifts the shuffle move's color-matching restriction (it may place one color on top of a *different* color, which a real pour never allows) while capping the transferred amount so the source tube's exposed top color never changes as a result. That cap is exactly what keeps every shuffle move reversible by a single valid player pour immediately afterward, so replaying the reverses of the whole shuffle sequence in order is always a valid solution - proving every generated puzzle solvable by construction, with no search needed at generation time.

A further refinement was needed once puzzles with many more tubes than colors were tried: applying shuffle moves with a uniformly random choice of (source, destination, amount) settles into a statistical equilibrium occupied-tube count that depends only on the number of colors and tube capacity - not on `numTubes` or how many shuffle moves are applied. When `numTubes` is much larger than `numColors` (e.g. reported: 4 colors / 20 tubes / capacity 4), that equilibrium leaves most tubes empty, which made puzzles trivially easy: abundant empty tubes are unlimited free workspace for the player. Generation now targets an explicit occupied-tube count, `occupiedTarget = min(numColors * capacity, max(numColors, numTubes - desiredEmptyTubes))` (`desiredEmptyTubes` defaults to 2, matching the original default config's own natural empty-tube count so default gameplay is unaffected), reached via two kinds of reversible move:
- **Spread moves** deterministically grow the occupied-tube count by peeling exactly 1 unit off some tube's top run onto an empty tube. Peeling only 1 unit at a time (rather than a random amount) is what lets a single source tube seed several new occupied tubes instead of exhausting its potential in one large jump.
- **Guarded shuffle moves** are ordinary shuffle moves that also produce genuine color mixing, but each randomly-picked candidate is only kept if enough "spread potential" - `topRunLength(t) - 1` summed across all tubes, an exact count of how many more tubes spreading alone could still occupy - remains afterward to still reach `occupiedTarget`. Without this guard, unbiased mixing is just as likely to merge two differently-colored single-unit tubes together (permanently destroying both units' spread potential, since the merged tube's exposed top run is only 1 unit) as it is to do anything else, which is what collapses occupied-tube count back toward the low equilibrium even when interleaved with periodic top-ups.

An up-front top-up reaches `occupiedTarget` from the pristine solved state (always achievable there, since every tube starts as a full single-color run). Guarded shuffling then runs move-by-move with a top-up after each one, holding occupied-tube count at the target for the rest of generation instead of letting it drift back toward the unbiased equilibrium.

**Alternatives Considered**:
- Reverse-solving via ordinary valid pours only: what the original decision specified; proven unable to produce anything but already-solved boards (see Rationale above) - rejected as fundamentally incorrect, not merely simplified.
- Random initialization + solvability check (deal a random arrangement, verify with a BFS solver, retry on failure): produces genuinely mixed tubes, but BFS verification is expensive for larger/more-occupied configs (multi-second, and can exhaust memory before concluding either way once state spaces get large - observed when checking a 20-tube/4-color puzzle) and retries would compound that cost - rejected in favor of a construction that guarantees solvability without needing to search.
- Uniform random shuffle with no occupied-tube target: what an earlier version of this decision did; always converges to the same low occupied-tube-count equilibrium regardless of `numTubes` or move count, making puzzles with many spare tubes far too easy - rejected in favor of the guarded-shuffle/spread-target combination above.
- Constraint-based generation: More sophisticated but complex; overkill for this scope.

### 2. Water Distribution Strategy: Flexible Distribution With an Occupied-Tube Target
**Decision**: Distribute colors flexibly across tubes; a single color may occupy multiple tubes. Total units = numColors * capacity. Generation targets leaving only `desiredEmptyTubes` (default 2) tubes empty, i.e. `occupiedTarget = min(numColors * capacity, max(numColors, numTubes - desiredEmptyTubes))`, rather than however many tubes an unbiased shuffle happens to leave empty.

**Rationale**: An earlier version of this decision left empty-tube count entirely up to shuffling, with no explicit target. That undersells difficulty once `numTubes` is much larger than `numColors`: unbiased shuffling converges to an occupied-tube count that depends only on colors/capacity, not on how many tubes exist, so most of the extra tubes stayed empty and gave the player unlimited free workspace (reported: 4 colors / 20 tubes / capacity 4 produced only ~5 occupied tubes). Targeting occupied-tube count directly (see Decision 1 for the mechanism) fixes this while keeping generation reversible-by-construction.

**Alternatives Considered**:
- Fixed distribution (e.g., each color appears exactly N times): More predictable but less flexible
- Strictly balanced: Harder to generate, unnecessary constraint
- Leaving empty-tube count entirely to chance (no target): simplest, but produces trivially easy puzzles whenever `numTubes` exceeds `numColors` by much - rejected (see Rationale)

### 3. Rendering: Canvas with Vanilla JavaScript
**Decision**: Use HTML5 Canvas to render the tubes and their water contents. Buttons (New Game, Undo, Restart) and configuration inputs are native HTML elements positioned outside the canvas, not canvas-drawn. Tube interactions are handled via mouse/touch events and canvas-based hit detection; buttons use native DOM click handlers.

**Rationale**: Canvas provides direct control over rendering the tubes/water without framework overhead, where custom drawing (rounded rects, stacked color bands, shake feedback) is most natural. Native HTML buttons and inputs give correct default accessibility, keyboard support, and enabled/disabled styling (e.g. disabling Undo when there is no history) for free, which canvas-drawn controls would otherwise have to reimplement by hand. Vanilla JS (ES modules, no bundler/framework) keeps dependencies minimal.

**Alternatives Considered**:
- All UI elements (including buttons/config) drawn to canvas: originally chosen for consistency, but requires manually reimplementing hit-testing, focus, and disabled-state styling that native elements provide automatically - rejected in favor of native HTML controls for everything that isn't the tubes/water themselves.
- DOM/CSS for tubes too: simpler but harder to animate (stacked color bands, shake-on-invalid-move feedback); interactive feedback less immediate.
- WebGL: overkill for simple shapes; added complexity.

### 4. State Management: Single Game State Object
**Decision**: Maintain a single immutable game state object with tubes[], move history[], and config. Each move creates a new state snapshot stored in history.

**Rationale**: Simplifies undo logic and move validation. Clear separation between state and rendering.

**Alternatives Considered**:
- Mutable state with undo queue: Easier initially but harder to reason about
- Event sourcing: Powerful but complex for single-player game

### 5. Move Validation: Immediate Rejection
**Decision**: Validate moves synchronously when user interacts. Invalid moves produce visual feedback and are not added to history.

**Rationale**: Instant feedback improves UX. No need for async validation in single-player context.

**Alternatives Considered**:
- Optimistic UI with rollback: Overengineering for this scope

### 6. Color Representation
**Decision**: Use hex color strings (e.g., #FF0000). Assign colors randomly or from a fixed palette.

**Rationale**: Simple to use in Canvas rendering and in-memory representation.

### 7. Tube Capacity Enforcement
**Decision**: Tube capacity is a fixed integer. Pouring transfers all top-color units up to remaining capacity.

**Rationale**: Mirrors physical puzzle mechanics; natural gameplay constraint.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| ~~Reverse-solving may take time for large puzzle sizes~~ Resolved by construction | Generation applies a fixed number of O(1) shuffle moves with no search, backtracking, or retries (see Decision 1), so generation time does not scale with puzzle size the way a solver-based approach would |
| `isSolvable`'s BFS verification (used only in tests, never at generation time) does not scale to configs with many tubes - it can take multiple seconds or exhaust memory without concluding either way once the reachable state space gets large (observed for 20 tubes / 4 colors) | Not a runtime concern since `generatePuzzle` never calls `isSolvable` (solvability is proven by construction - see Decision 1); tests verify solvability with BFS only at smaller scales and otherwise rely on the construction proof |
| Canvas rendering may be CPU-intensive for frequent redraws | Optimize canvas redraws; only redraw on state change |
| No persistence across sessions | Acceptable for single-level MVP; session storage can be added later if needed |
| Keyboard/accessibility not planned | Native HTML buttons/inputs (see Decision 3) provide keyboard and screen-reader support for free; tube interaction remains mouse/touch only for this iteration |
| Complex puzzles may be frustrating | Good default config values and ability to customize difficulty address this |

## Migration Plan

No migration needed - new feature. Implemented as a static site with no build step: `index.html` loads `app.js` as an ES module (`<script type="module">`), which imports the pure game-logic module `game.js` (also an ES module, shared unchanged with the Node unit test suite). Serving over `http://` (rather than `file://`) is required for ES modules to load in the browser; a minimal static file server (`tests/static-server.js`) provides this for automated E2E testing.

## Open Questions

None - all key design decisions are locked and implementation can proceed.

