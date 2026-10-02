# Design

## Context

See proposal.md for motivation. The game needs to:
- Generate randomized water-sort puzzles on demand
- Render and interact with a game board on HTML5 Canvas
- Handle user moves with immediate visual feedback
- Maintain full move history for undo/restart

Technology constraints: Vanilla JavaScript, Canvas rendering, no backend.

## Goals / Non-Goals

**Goals:**
- Single-player web-based puzzle game experience
- Randomized starting colors with every occupied tube mixed
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

### 1. Puzzle Generation Strategy: Constrained Random Deal
**Decision**: Build a multiset of color units from the configured color distribution. Randomly seed every occupied tube with two different colors, shuffle the remaining units and tube slots, and randomize each tube's color order. Do not check whether a generated arrangement is solvable.

**Rationale**: Randomly distributing individual units makes the starting tubes less predictable than the previous fixed exchange pattern. Preserving the multiset retains the configured color totals, while seeding each tube with two distinct colors guarantees the mixed-tube constraint without repeated deals. The system deliberately makes no solvability guarantee; generation does not call a search algorithm to verify or filter a deal.

The two-color, capacity-two, odd-filled-tube configuration remains normalized by validation because it cannot satisfy the mixed-tube invariant. The existing minimum of two colors and at least one empty tube remain necessary configuration constraints.

**Alternatives Considered**:
- Generate from a solved state with reversible exchanges: preserves solvability by construction, but produces a narrower set of layouts and is no longer required.
- Generate random arrangements and use BFS to reject unsolvable ones: expensive for larger boards and contrary to the decision not to guarantee solvability.
- Allow partially-filled tubes: rejected because the configured full-tube starting layout remains a requirement.

### 2. Water Distribution Strategy: Configurable Empty Tubes and Full Occupancy
**Decision**: The player configures `emptyTubes` (default 1). Generation creates exactly `numTubes - emptyTubes` full tubes and assigns colors cyclically across them, so a color may occupy multiple full tubes. Validation retains at least one empty tube and at least one full tube per color.

**Rationale**: The original unit-count model could not fill more than one tube per color, so it could not both preserve a small configurable empty-tube count and leave every occupied tube full. Repeating colors across full tubes supports both requirements while preserving a fixed multiset for randomized deals.

**Alternatives Considered**:
- Fixed distribution (e.g., each color appears exactly N times): More predictable but less flexible
- Strictly balanced: Harder to generate, unnecessary constraint
- Leaving empty-tube count entirely to chance or permitting partial starting tubes: simpler, but produces trivially easy puzzles and violates the requested full-tube starting invariant - rejected (see Rationale)

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
| Invalid configurations may not have enough distinct colors to seed every occupied tube | Validate the minimum color count and normalize the incompatible two-color, capacity-two, odd-filled-tube case |
| Some generated puzzles may be unsolvable | This is an intentional trade-off; generation does not run a solver or promise a solution |
| Canvas rendering may be CPU-intensive for frequent redraws | Optimize canvas redraws; only redraw on state change |
| No persistence across sessions | Acceptable for single-level MVP; session storage can be added later if needed |
| Keyboard/accessibility not planned | Native HTML buttons/inputs (see Decision 3) provide keyboard and screen-reader support for free; tube interaction remains mouse/touch only for this iteration |
| Complex puzzles may be frustrating | Good default config values and ability to customize difficulty address this |

## Migration Plan

No migration needed - new feature. Implemented as a static site with no build step: `index.html` loads `app.js` as an ES module (`<script type="module">`), which imports the pure game-logic module `game.js` (also an ES module, shared unchanged with the Node unit test suite). Serving over `http://` (rather than `file://`) is required for ES modules to load in the browser; a minimal static file server (`tests/static-server.js`) provides this for automated E2E testing.

## Open Questions

None - all key design decisions are locked and implementation can proceed.
