// playwright.config.js
// Runs end-to-end UI tests against the app served over http:// (required
// since index.html loads app.js as an ES module - Chromium blocks module
// scripts under file://). Playwright starts tests/static-server.js itself
// and waits for it to come up before running any tests.
const PORT = 4173;

export default {
    testDir: './tests',
    testMatch: /.*\.e2e\.js/,
    timeout: 30000,
    reporter: 'list',
    webServer: {
        command: 'node tests/static-server.js',
        port: PORT,
        env: { PORT: String(PORT) },
        reuseExistingServer: !process.env.CI
    },
    use: {
        headless: true,
        baseURL: `http://127.0.0.1:${PORT}`,
        viewport: { width: 1280, height: 1000 }
    }
};
