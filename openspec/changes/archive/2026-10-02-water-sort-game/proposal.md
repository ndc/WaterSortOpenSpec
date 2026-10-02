# Proposal: Web-Based Water Sort Puzzle Game

## Why

Water-sort puzzles are a popular mobile game genre. Building a web-based version enables browser play without app installation, making it accessible and shareable. The game is simple to learn but challenging to master, with configurable difficulty parameters to support varied skill levels.

## What Changes

- **New gameplay**: Browser-based water-sort puzzle experience with configurable puzzle generation
- **Core features**: 
  - Configurable puzzle parameters (number of colors, tubes, tube capacity)
  - Procedural puzzle generation with randomized initial color arrangements
  - Mixed colors in every occupied tube, without a solvability guarantee
  - Full undo/restart capability
  - Canvas-based rendering with visual feedback
  - Single-player, one-level-at-a-time gameplay

## Capabilities

### New Capabilities

- `water-sort-game`: Web-based water-sort puzzle game where players configure and solve randomized puzzles by pouring colored water between tubes to achieve a sorted state. Includes randomized puzzle generation, move validation, undo history, and restart functionality.

### Modified Capabilities

None.

## Impact

- **Code**: New vanilla JavaScript canvas application with game logic, puzzle generator, and UI controls
- **Infrastructure**: Static HTML/CSS/JS served from web browser (no backend required initially)
- **User Experience**: Single-player browser game with immediate play and configurable difficulty
