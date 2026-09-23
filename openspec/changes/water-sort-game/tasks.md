# Tasks

## 1. Project Setup

- [ ] 1.1 Create index.html with canvas element, configuration input fields (colors, tubes, capacity), and buttons (New Game, Undo, Restart). Verify file is created and can be opened in a browser with all elements visible.

## 2. Data Structures and State Management

- [ ] 2.1 Implement Tube class with capacity and water content tracking. Verify constructor accepts capacity and getTop(), add(), remove() methods work correctly.
- [ ] 2.2 Implement GameState class to represent board state (tubes array, move history, config). Verify state can be deep-copied for undo functionality.
- [ ] 2.3 Implement color palette and assignment logic. Verify colors are assigned consistently and can be rendered as hex strings.

## 3. Puzzle Generation

- [ ] 3.1 Implement createSolvedState() function that generates a solved board with all tubes complete or empty. Verify function produces valid solved states with correct tube distribution.
- [ ] 3.2 Implement isValidMove() function to check if a pour is legal (source has water, destination has room, colors match or destination is empty). Verify all move scenarios from spec pass.
- [ ] 3.3 Implement getRandomValidMove() to find all valid moves from a state and return one randomly. Verify it only returns legal moves.
- [ ] 3.4 Implement puzzle generation algorithm: create solved state, then reverse-solve by making random valid moves a fixed number of times. Verify generated puzzles are solvable by checking if a solution can be found.

## 4. Game Logic and Rules

- [ ] 4.1 Implement pourWater() function to execute a move from source tube to destination tube. Verify water transfers correctly, respects capacity limits, and maintains tube contents order.
- [ ] 4.2 Implement checkWinCondition() to detect when all tubes are either full monochrome or empty. Verify win condition returns true only when puzzle is solved.
- [ ] 4.3 Implement undo() to revert to previous game state from history. Verify full undo history is maintained and player can undo all the way to initial state.

## 5. Canvas Rendering

- [ ] 5.1 Implement drawTubes() to render all tubes on canvas with their water contents. Verify tubes are visible, properly spaced, and water colors are correct.
- [ ] 5.2 Implement drawButtons() to render UI buttons (New Game, Undo, Restart) on canvas. Verify buttons are clickable and visually distinct.
- [ ] 5.3 Implement drawConfig() to render configuration input fields on canvas or as HTML overlay. Verify all config inputs are accessible and editable.
- [ ] 5.4 Implement render() master function to redraw entire canvas on state changes. Verify canvas updates correctly after each move.

## 6. Event Handling and Interaction

- [ ] 6.1 Implement mouse/touch event handling to detect tube clicks for pouring. Verify clicks on tubes correctly identify source and destination tubes.
- [ ] 6.2 Implement invalid move visual feedback (highlight, shake, or message when move is invalid). Verify invalid moves produce clear feedback and do not change state.
- [ ] 6.3 Implement "New Game" button handler to read config values and generate new puzzle. Verify new puzzle uses current config and is solvable.
- [ ] 6.4 Implement "Undo" button handler to revert one move. Verify move history is reversed and canvas updates.
- [ ] 6.5 Implement "Restart" button handler to return to initial puzzle state with cleared history. Verify puzzle resets and history is empty.

## 7. Configuration and Defaults

- [ ] 7.1 Set reasonable default values for configuration (e.g., 4 colors, 6 tubes, capacity 4). Verify defaults are displayed when page loads.
- [ ] 7.2 Implement configuration validation to ensure colors, tubes, and capacity are positive integers within reasonable bounds. Verify invalid configs are rejected or clamped.

## 8. Integration and Testing

- [ ] 8.1 Test complete game flow: load page, see default config, generate puzzle, make valid moves, receive feedback on invalid moves, undo moves, check win condition, restart, generate new puzzle. Verify all steps work end-to-end.
- [ ] 8.2 Test puzzle generation reliability: generate multiple puzzles with various configs and verify all are solvable (i.e., a solution exists). Verify no unsolvable puzzles are created.
- [ ] 8.3 Test edge cases: single color puzzle, puzzle with all empty tubes at end, maximum capacity tubes, undo all the way to start. Verify all edge cases work correctly.

