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
**Decision**: Generate puzzles by creating a solved state, then reverse-solving via random valid moves.

**Rationale**: Guarantees solvability without complex constraint satisfaction algorithms. Simple to implement and understand.

**Alternatives Considered**:
- Random initialization + solvability check: Simpler but less reliable; may need many retries
- Constraint-based generation: More sophisticated but complex; overkill for this scope

### 2. Water Distribution Strategy: Flexible Distribution
**Decision**: Distribute colors flexibly across tubes. Each color can occupy 1+ units. Total units = num_colors. Number of empty tubes = num_tubes - ceil(num_colors / tube_capacity).

**Rationale**: Simplifies generation and allows varied puzzle shapes while maintaining solvability.

**Alternatives Considered**:
- Fixed distribution (e.g., each color appears exactly N times): More predictable but less flexible
- Strictly balanced: Harder to generate, unnecessary constraint

### 3. Rendering: Canvas with Vanilla JavaScript
**Decision**: Use HTML5 Canvas for rendering. All UI elements (tubes, water, buttons, config fields) drawn to canvas. Handle interactions via mouse/touch events and canvas-based hit detection.

**Rationale**: Canvas provides direct control over rendering without framework overhead. Vanilla JS keeps dependencies minimal.

**Alternatives Considered**:
- DOM/CSS: Simpler but harder to animate; interactive feedback less immediate
- WebGL: Overkill for simple shapes; added complexity

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
| Reverse-solving may take time for large puzzle sizes | Limit puzzle sizes in defaults; implement backtracking with depth/attempt limits if needed |
| Canvas rendering may be CPU-intensive for frequent redraws | Optimize canvas redraws; only redraw on state change |
| No persistence across sessions | Acceptable for single-level MVP; session storage can be added later if needed |
| Keyboard/accessibility not planned | Can be added in future iterations; mouse/touch sufficient for initial release |
| Complex puzzles may be frustrating | Good default config values and ability to customize difficulty address this |

## Migration Plan

No migration needed - new feature. Single static HTML file with embedded JavaScript.

## Open Questions

None - all key design decisions are locked and implementation can proceed.

