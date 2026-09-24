// tests/game.e2e.js
// End-to-end UI tests driving the real page (canvas rendering + click
// handling, plus native HTML buttons), exercising the full game flow
// described in tasks 8.1-8.3.
import { test, expect } from '@playwright/test';

async function getDebug(page) {
    return page.evaluate(() => {
        const dbg = window.__waterSortTest;
        const state = dbg.getState();
        return {
            state: {
                config: state.config,
                tubes: state.tubes.map((t) => ({ contents: t.contents.slice(), capacity: t.capacity })),
                historyLength: state.history.length
            },
            won: dbg.getUi().won,
            layout: dbg.getLayout()
        };
    });
}

async function clickAt(page, canvasX, canvasY) {
    const canvasEl = page.locator('#gameCanvas');
    const box = await canvasEl.boundingBox();
    const size = await page.evaluate(() => {
        const c = document.getElementById('gameCanvas');
        return { width: c.width, height: c.height };
    });
    const scaleX = box.width / size.width;
    const scaleY = box.height / size.height;
    await page.mouse.click(box.x + canvasX * scaleX, box.y + canvasY * scaleY);
}

async function clickTube(page, index) {
    const dbg = await getDebug(page);
    const rect = dbg.layout.tubeRects[index];
    await clickAt(page, rect.x + rect.width / 2, rect.y + rect.height / 2);
}

async function setConfig(page, numColors, numTubes, capacity) {
    await page.fill('#configColors', String(numColors));
    await page.fill('#configTubes', String(numTubes));
    await page.fill('#configCapacity', String(capacity));
}

// Solves a single-color puzzle (any pour between two tubes is always valid
// for one color, so the color may be spread across more than two tubes -
// see game.js generatePuzzle) by repeatedly pouring the least-full tube into
// the most-full tube with room, until solved or maxPours is reached.
async function solveSingleColor(page, maxPours) {
    let dbg = await getDebug(page);
    let pours = 0;
    while (!dbg.won && pours < maxPours) {
        const contents = dbg.state.tubes.map((t) => t.contents.length);
        const capacities = dbg.state.tubes.map((t) => t.capacity);
        let from = -1, to = -1;
        for (let i = 0; i < contents.length; i++) {
            if (contents[i] === 0) continue;
            if (from === -1 || contents[i] < contents[from]) from = i;
        }
        for (let i = 0; i < contents.length; i++) {
            if (i === from || contents[i] >= capacities[i]) continue;
            if (to === -1 || contents[i] > contents[to]) to = i;
        }
        await clickTube(page, from);
        await clickTube(page, to);
        dbg = await getDebug(page);
        pours++;
    }
    return { dbg, pours };
}

test.describe('Water Sort Puzzle end-to-end (tasks 8.1-8.3)', () => {
    test('1.1/7.1: page loads with canvas, config inputs, buttons, and defaults visible', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#gameCanvas')).toBeVisible();
        await expect(page.locator('#configColors')).toHaveValue('4');
        await expect(page.locator('#configTubes')).toHaveValue('6');
        await expect(page.locator('#configCapacity')).toHaveValue('4');

        // Buttons are native HTML elements outside the canvas, not canvas-drawn.
        await expect(page.locator('#newGameBtn')).toBeVisible();
        await expect(page.locator('#undoBtn')).toBeVisible();
        await expect(page.locator('#restartBtn')).toBeVisible();

        const dbg = await getDebug(page);
        expect(dbg.state.config).toEqual({ numColors: 4, numTubes: 6, capacity: 4 });
        expect(dbg.layout.tubeRects.length).toBe(6);
    });

    test('8.1: full flow - new game, valid pour, win, undo, restart', async ({ page }) => {
        await page.goto('/');
        await setConfig(page, 1, 3, 4);
        await page.click('#newGameBtn');

        let dbg = await getDebug(page);
        expect(dbg.state.config).toEqual({ numColors: 1, numTubes: 3, capacity: 4 });
        expect(dbg.won).toBe(false);

        let result = await solveSingleColor(page, 10);
        dbg = result.dbg;
        expect(dbg.won).toBe(true);
        expect(result.pours).toBeGreaterThan(0);
        expect(dbg.state.historyLength).toBe(result.pours);

        await expect(page.locator('#undoBtn')).toBeEnabled();
        for (let i = 0; i < result.pours; i++) {
            await page.click('#undoBtn');
        }
        dbg = await getDebug(page);
        expect(dbg.won).toBe(false);
        expect(dbg.state.historyLength).toBe(0);
        await expect(page.locator('#undoBtn')).toBeDisabled();

        // Redo the same winning sequence (deterministic from the now-restored
        // initial state), then restart and confirm it returns to the initial
        // unsolved puzzle with history cleared.
        result = await solveSingleColor(page, 10);
        expect(result.dbg.won).toBe(true);

        await page.click('#restartBtn');
        dbg = await getDebug(page);
        expect(dbg.won).toBe(false);
        expect(dbg.state.historyLength).toBe(0);
    });

    test('6.2: invalid move (mismatched colors) produces no state change', async ({ page }) => {
        await page.goto('/');
        await setConfig(page, 4, 6, 4);
        await page.click('#newGameBtn');

        const dbg = await getDebug(page);
        const before = dbg.state.tubes.map((t) => t.contents.join(',')).join('|');
        const tops = dbg.state.tubes.map((t) => t.contents[t.contents.length - 1]);

        let from = -1, to = -1;
        outer:
        for (let i = 0; i < tops.length; i++) {
            for (let j = 0; j < tops.length; j++) {
                if (i !== j && tops[i] && tops[j] && tops[i] !== tops[j]) {
                    from = i; to = j;
                    break outer;
                }
            }
        }
        expect(from).toBeGreaterThanOrEqual(0);

        await clickTube(page, from);
        await clickTube(page, to);

        const after = await getDebug(page);
        const afterKey = after.state.tubes.map((t) => t.contents.join(',')).join('|');
        expect(afterKey).toBe(before);
        expect(after.state.historyLength).toBe(0);
    });

    test('7.2/6.3: out-of-range config is clamped when starting a new game', async ({ page }) => {
        await page.goto('/');
        await setConfig(page, 999, 1, 0);
        await page.click('#newGameBtn');

        await expect(page.locator('#configColors')).toHaveValue('16');
        const dbg = await getDebug(page);
        expect(dbg.state.config.numColors).toBe(16);
        expect(dbg.state.config.capacity).toBeGreaterThanOrEqual(2);
        expect(dbg.state.config.numTubes).toBeGreaterThan(dbg.state.config.numColors);
    });

    test('8.2: puzzle generation stays playable across varied configs', async ({ page }) => {
        await page.goto('/');
        const configs = [[2, 4, 4], [4, 6, 4], [6, 9, 5]];
        for (const [colors, tubes, capacity] of configs) {
            await setConfig(page, colors, tubes, capacity);
            await page.click('#newGameBtn');
            const dbg = await getDebug(page);
            expect(dbg.state.config).toEqual({ numColors: colors, numTubes: tubes, capacity: capacity });
            expect(dbg.state.tubes.length).toBe(tubes);
            expect(dbg.won).toBe(false);
            // Solvability itself is exhaustively verified in tests/logic.test.js;
            // here we confirm the generated puzzle renders and is interactive.
            expect(dbg.layout.tubeRects.length).toBe(tubes);
        }
    });

    test('8.3: edge case - maximum capacity tube pour and undo all the way to start', async ({ page }) => {
        await page.goto('/');
        await setConfig(page, 2, 3, 12);
        await page.click('#newGameBtn');

        let dbg = await getDebug(page);
        expect(dbg.state.config.capacity).toBe(12);

        let movesMade = 0;
        for (let i = 0; i < 30; i++) {
            dbg = await getDebug(page);
            if (dbg.won) break;
            const tops = dbg.state.tubes.map((t) => t.contents[t.contents.length - 1]);
            let from = -1, to = -1;
            findMove:
            for (let a = 0; a < dbg.state.tubes.length; a++) {
                if (dbg.state.tubes[a].contents.length === 0) continue;
                for (let b = 0; b < dbg.state.tubes.length; b++) {
                    if (a === b) continue;
                    const dstTube = dbg.state.tubes[b];
                    if (dstTube.contents.length >= dstTube.capacity) continue;
                    const topA = tops[a];
                    const topB = dstTube.contents.length ? dstTube.contents[dstTube.contents.length - 1] : null;
                    if (topB === null || topB === topA) { from = a; to = b; break findMove; }
                }
            }
            if (from === -1) break;
            await clickTube(page, from);
            await clickTube(page, to);
            movesMade++;
        }
        expect(movesMade).toBeGreaterThan(0);

        for (let i = 0; i < movesMade; i++) {
            await page.click('#undoBtn');
        }
        dbg = await getDebug(page);
        expect(dbg.state.historyLength).toBe(0);
        expect(dbg.won).toBe(false);
    });
});
