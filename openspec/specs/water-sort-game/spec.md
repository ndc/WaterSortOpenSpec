# water-sort-game Specification

## Purpose

A browser-based puzzle game where players configure and solve randomized water-sorting challenges by pouring colored water between tubes, with full move history. Generated puzzles are not guaranteed to be solvable.

## Requirements

### Requirement: Puzzle Configuration
The system SHALL accept player-configurable parameters for puzzle generation: number of colors, number of tubes, tube capacity, and number of empty tubes. Each parameter MUST have a sensible default value. The empty-tube default MUST be 1. Players SHALL be able to adjust these values before generating a puzzle. The system MUST normalize a configuration that cannot provide two colors in every full tube (two colors, capacity two, and an odd filled-tube count) to an even filled-tube count.

#### Scenario: Player configures puzzle with defaults
- **WHEN** page loads
- **THEN** configuration fields display default values (e.g., 4 colors, 6 tubes, capacity 4, 1 empty tube)

#### Scenario: Player customizes parameters
- **WHEN** player changes a configuration value and clicks "New Game"
- **THEN** system generates a new puzzle with specified parameters

### Requirement: Randomized Puzzle Generation
The system SHALL generate puzzles by randomly distributing the configured color units among the occupied tubes. It MUST preserve the configured color-unit counts, leave exactly the configured number of tubes empty, and keep every other tube full. Every occupied tube MUST contain at least two distinct colors, and the initial board MUST NOT already satisfy the win condition. The system is not required to guarantee that a generated puzzle is solvable and MUST NOT use a solver to reject or retry a puzzle based on solvability.

#### Scenario: Puzzle starts mixed and unsolved
- **WHEN** the system generates a puzzle
- **THEN** every occupied tube is full and contains at least two colors, and the win condition is not already satisfied

#### Scenario: Puzzle honors configured empty-tube count and color totals
- **WHEN** the player selects a number of empty tubes and generates a puzzle
- **THEN** exactly that number of tubes is empty, every other tube is full, and the configured color-unit counts are preserved

#### Scenario: Puzzle generation randomizes initial colors
- **WHEN** the system generates puzzles repeatedly with the same configuration
- **THEN** it may produce different color arrangements while preserving the puzzle-generation constraints

#### Scenario: Puzzle generation does not guarantee solvability
- **WHEN** the system generates a puzzle
- **THEN** it does not run a solver or require that a solution exists

### Requirement: Game Board State
The system SHALL represent the game board as a collection of tubes, each with a fixed capacity and contents. Tubes contain colored water units stacked from bottom to top. Empty tubes are allowed. The top water unit in a tube is the active unit that can be poured.

#### Scenario: Tube representation
- **WHEN** a tube contains colored water
- **THEN** system displays its contents with the "active" (top) water unit accessible for pouring

#### Scenario: Empty tubes exist
- **WHEN** puzzle initializes
- **THEN** exactly the configured number of tubes is empty, every non-empty tube is full, and the same number of empty tubes MAY remain after solving

### Requirement: Pouring Mechanics
Players SHALL pour water from one tube (source) to another (destination). A pour is valid ONLY if: (1) source tube has water, (2) destination tube has room, and (3) the top colors match OR destination is empty. A valid pour transfers all consecutive water units of the top color from source to destination (or until destination is full).

#### Scenario: Valid pour with matching colors
- **WHEN** player pours from tube with red water on top into tube with red water on top
- **THEN** red water transfers from source to destination (up to destination capacity)

#### Scenario: Valid pour into empty tube
- **WHEN** player pours from tube with any color into an empty tube
- **THEN** water transfers from source to destination

#### Scenario: Invalid pour - non-matching colors
- **WHEN** player attempts to pour blue water onto red water
- **THEN** system rejects the move with visual feedback (no state change)

#### Scenario: Invalid pour - destination full
- **WHEN** player attempts to pour into a tube at full capacity
- **THEN** system rejects the move with visual feedback

#### Scenario: Invalid pour - empty source
- **WHEN** player attempts to pour from an empty tube
- **THEN** system rejects the move with visual feedback

### Requirement: Visual Feedback for Invalid Moves
When a player attempts an invalid move, the system SHALL provide immediate visual feedback (visual cue, highlight, or message) indicating the move is invalid. No state change occurs on invalid moves.

#### Scenario: Invalid move visual feedback
- **WHEN** player attempts an invalid pour
- **THEN** system displays visual feedback (e.g., red highlight, shake, or message)

### Requirement: Win Condition
The system SHALL treat a puzzle as won only when all tubes are either: (1) completely full with a single color, OR (2) completely empty. No partially-filled tubes remain in a solved state.

#### Scenario: Puzzle solved with complete tubes
- **WHEN** all remaining tubes are full and monochrome, and empty tubes are allowed
- **THEN** system recognizes win state

#### Scenario: No partial tubes in solution
- **WHEN** any tube is between 1 and (capacity-1) full
- **THEN** puzzle is not yet solved

### Requirement: Undo Functionality
Players SHALL be able to undo any move one at a time, reverting the board to its previous state. The system SHALL maintain a complete move history. Players MAY undo all the way back to the initial puzzle state.

#### Scenario: Undo single move
- **WHEN** player clicks "Undo"
- **THEN** the most recent move is reversed and board returns to previous state

#### Scenario: Undo full history
- **WHEN** player performs multiple moves and clicks "Undo" repeatedly
- **THEN** each undo reverts to the previous state; player can reach the initial puzzle state

### Requirement: Restart Functionality
Players SHALL be able to restart the current puzzle by returning to its initial unsolved state. All move history is cleared, but the same puzzle configuration remains.

#### Scenario: Restart clears move history
- **WHEN** player clicks "Restart"
- **THEN** board returns to initial puzzle state and undo history is cleared

### Requirement: New Game Generation
Players SHALL be able to generate a new puzzle using the same or updated configuration parameters. Clicking "New Game" generates a fresh puzzle with the current configuration values.

#### Scenario: New Game with current config
- **WHEN** player clicks "New Game"
- **THEN** system generates a new randomized puzzle using current configuration parameters

### Requirement: Canvas Rendering
The system SHALL render the game board on an HTML5 Canvas element using vanilla JavaScript. Tubes and their water contents are drawn to canvas. Buttons (New Game, Undo, Restart) and configuration inputs are native HTML elements rendered outside the canvas, not drawn to it. The rendering MUST be responsive and visually clear.

#### Scenario: Board renders to canvas
- **WHEN** game initializes or state changes
- **THEN** tubes and their water contents are drawn to canvas, and buttons/configuration inputs remain visible and interactive as native HTML controls outside the canvas
