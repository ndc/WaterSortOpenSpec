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

async function setConfig(page, numColors, numTubes, capacity, emptyTubes = 1) {
    await page.fill('#configColors', String(numColors));
    await page.fill('#configTubes', String(numTubes));
    await page.fill('#configCapacity', String(capacity));
    await page.fill('#configEmptyTubes', String(emptyTubes));
}

test.describe('Water Sort Puzzle end-to-end (tasks 8.1-8.3)', () => {
    test('1.1/7.1: page loads with canvas, config inputs, buttons, and defaults visible', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#gameCanvas')).toBeVisible();
        await expect(page.locator('#configColors')).toHaveValue('4');
        await expect(page.locator('#configTubes')).toHaveValue('6');
        await expect(page.locator('#configCapacity')).toHaveValue('4');
        await expect(page.locator('#configEmptyTubes')).toHaveValue('1');

        // Buttons are native HTML elements outside the canvas, not canvas-drawn.
        await expect(page.locator('#newGameBtn')).toBeVisible();
        await expect(page.locator('#undoBtn')).toBeVisible();
        await expect(page.locator('#restartBtn')).toBeVisible();

        const dbg = await getDebug(page);
        expect(dbg.state.config).toEqual({ numColors: 4, numTubes: 6, capacity: 4, emptyTubes: 1 });
        expect(dbg.layout.tubeRects.length).toBe(6);
    });

    test('8.1: full flow - new game, valid pour, undo, and restart', async ({ page }) => {
        await page.goto('/');
        await setConfig(page, 2, 3, 4);
        await page.click('#newGameBtn');

        const dbg = await getDebug(page);
        expect(dbg.state.config).toEqual({ numColors: 2, numTubes: 3, capacity: 4, emptyTubes: 1 });
        expect(dbg.won).toBe(false);

        const initialKey = dbg.state.tubes.map((tube) => tube.contents.join(',')).join('|');
        await clickTube(page, 0);
        await clickTube(page, 2);
        let afterPour = await getDebug(page);
        expect(afterPour.state.historyLength).toBe(1);
        expect(afterPour.state.tubes.map((tube) => tube.contents.join(',')).join('|')).not.toBe(initialKey);
        await expect(page.locator('#undoBtn')).toBeEnabled();
        await page.click('#undoBtn');
        let restored = await getDebug(page);
        expect(restored.state.tubes.map((tube) => tube.contents.join(',')).join('|')).toBe(initialKey);
        expect(restored.state.historyLength).toBe(0);
        await expect(page.locator('#undoBtn')).toBeDisabled();

        await clickTube(page, 0);
        await clickTube(page, 2);
        await page.click('#restartBtn');
        restored = await getDebug(page);
        expect(restored.won).toBe(false);
        expect(restored.state.historyLength).toBe(0);
        expect(restored.state.tubes.map((tube) => tube.contents.join(',')).join('|')).toBe(initialKey);
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
        await setConfig(page, 999, 1, 0, 999);
        await page.click('#newGameBtn');

        await expect(page.locator('#configColors')).toHaveValue('16');
        const dbg = await getDebug(page);
        expect(dbg.state.config.numColors).toBe(16);
        expect(dbg.state.config.capacity).toBeGreaterThanOrEqual(2);
        expect(dbg.state.config.numTubes).toBeGreaterThan(dbg.state.config.numColors);
        expect(dbg.state.config.emptyTubes).toBe(1);
    });

    test('8.2: puzzle generation stays playable across varied configs', async ({ page }) => {
        await page.goto('/');
        const configs = [[2, 4, 4, 1], [4, 6, 4, 2], [6, 9, 5, 3]];
        for (const [colors, tubes, capacity, emptyTubes] of configs) {
            await setConfig(page, colors, tubes, capacity, emptyTubes);
            await page.click('#newGameBtn');
            const dbg = await getDebug(page);
            expect(dbg.state.config).toEqual({ numColors: colors, numTubes: tubes, capacity: capacity, emptyTubes });
            expect(dbg.state.tubes.length).toBe(tubes);
            expect(dbg.won).toBe(false);
            expect(dbg.state.tubes.filter((tube) => tube.contents.length === 0)).toHaveLength(emptyTubes);
            expect(dbg.state.tubes.every((tube) => tube.contents.length === 0 || tube.contents.length === tube.capacity)).toBe(true);
            expect(dbg.state.tubes.every((tube) => tube.contents.length === 0 || new Set(tube.contents).size >= 2)).toBe(true);
            // Here we confirm the generated puzzle renders and is interactive;
            // solvability is intentionally not guaranteed by the generator.
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
