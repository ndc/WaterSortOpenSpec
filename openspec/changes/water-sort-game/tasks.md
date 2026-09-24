# Tasks

## 1. Project Setup

- [x] 1.1 Create index.html with canvas element, configuration input fields (colors, tubes, capacity), and buttons (New Game, Undo, Restart). Verify file is created and can be opened in a browser with all elements visible.

## 2. Data Structures and State Management

- [x] 2.1 Implement Tube class with capacity and water content tracking. Verify constructor accepts capacity and getTop(), add(), remove() methods work correctly.
- [x] 2.2 Implement GameState class to represent board state (tubes array, move history, config). Verify state can be deep-copied for undo functionality.
- [x] 2.3 Implement color palette and assignment logic. Verify colors are assigned consistently and can be rendered as hex strings.

## 3. Puzzle Generation

- [x] 3.1 Implement createSolvedState() function that generates a solved board with all tubes complete or empty. Verify function produces valid solved states with correct tube distribution.
- [x] 3.2 Implement isValidMove() function to check if a pour is legal (source has water, destination has room, colors match or destination is empty). Verify all move scenarios from spec pass.
- [x] 3.3 Implement getRandomValidMove() to find all valid moves from a state and return one randomly. Verify it only returns legal moves.
- [x] 3.4 Implement puzzle generation algorithm: create a solved state, then apply a fixed number of random "shuffle moves" that are reversible by construction (not ordinary valid pours - see design.md Decision 1). Verify generated puzzles are solvable and never already satisfy the win condition, with at least one genuinely mixed (multi-color) tube.
- [x] 3.5 Fix puzzle generation to target a specific occupied-tube count instead of leaving it to an unbiased shuffle: add spread moves (peel exactly 1 unit onto an empty tube) and guard shuffle moves so they never destroy more spread potential than can be recovered before reaching the target (see design.md Decisions 1-2). Verify occupied-tube count reliably reaches the target across configs, including configs where numTubes is much larger than numColors.
- [x] 3.6 Make empty-tube count a configurable puzzle parameter (default 1), and replace partial-tube spread generation with reversible full-tube exchanges through an empty buffer. Verify generated boards contain exactly the requested number of empty tubes and every other tube is full.
- [x] 3.7 Ensure every full tube contains at least two colors at game start. Verify this invariant holds alongside exact empty-tube counts, full occupancy, and solvability.
- [x] 3.8 Use deterministic full-tube exchanges to mix every occupied tube, and normalize the mathematically incompatible two-color/capacity-two/odd-filled-tube configuration.

## 4. Game Logic and Rules

- [x] 4.1 Implement pourWater() function to execute a move from source tube to destination tube. Verify water transfers correctly, respects capacity limits, and maintains tube contents order.
- [x] 4.2 Implement checkWinCondition() to detect when all tubes are either full monochrome or empty. Verify win condition returns true only when puzzle is solved.
- [x] 4.3 Implement undo() to revert to previous game state from history. Verify full undo history is maintained and player can undo all the way to initial state.

## 5. Canvas Rendering

- [x] 5.1 Implement drawTubes() to render all tubes on canvas with their water contents. Verify tubes are visible, properly spaced, and water colors are correct.
- [x] 5.2 Wire up native HTML buttons (New Game, Undo, Restart), positioned outside the canvas, with click handlers, keeping Undo's disabled state in sync with whether undo history exists. Verify buttons are clickable, visually distinct, and Undo is disabled when there is nothing to undo.
- [x] 5.3 Implement drawConfig() to render configuration input fields on canvas or as HTML overlay. Verify all config inputs are accessible and editable.
- [x] 5.4 Implement render() master function to redraw entire canvas on state changes. Verify canvas updates correctly after each move.

## 6. Event Handling and Interaction

- [x] 6.1 Implement mouse/touch event handling to detect tube clicks for pouring. Verify clicks on tubes correctly identify source and destination tubes.
- [x] 6.2 Implement invalid move visual feedback (highlight, shake, or message when move is invalid). Verify invalid moves produce clear feedback and do not change state.
- [x] 6.3 Implement "New Game" button handler to read config values and generate new puzzle. Verify new puzzle uses current config and is solvable.
- [x] 6.4 Implement "Undo" button handler to revert one move. Verify move history is reversed and canvas updates.
- [x] 6.5 Implement "Restart" button handler to return to initial puzzle state with cleared history. Verify puzzle resets and history is empty.

## 7. Configuration and Defaults

- [x] 7.1 Set reasonable default values for configuration (e.g., 4 colors, 6 tubes, capacity 4). Verify defaults are displayed when page loads.
- [x] 7.2 Implement configuration validation to ensure colors, tubes, and capacity are positive integers within reasonable bounds. Verify invalid configs are rejected or clamped.

## 8. Integration and Testing

- [x] 8.1 Test complete game flow: load page, see default config, generate puzzle, make valid moves, receive feedback on invalid moves, undo moves, check win condition, restart, generate new puzzle. Verify all steps work end-to-end.
- [x] 8.2 Test puzzle generation reliability: generate multiple puzzles with various configs and verify all are solvable (i.e., a solution exists). Verify no unsolvable puzzles are created.
- [x] 8.3 Test edge cases: single color puzzle, puzzle with all empty tubes at end, maximum capacity tubes, undo all the way to start. Verify all edge cases work correctly.
