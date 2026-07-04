// E2E launcher — runs INSIDE Electron's main process.
//
// NOT spawned directly: main.js resolves loadFile('index.html') against the
// app root (= directory of the entry script), so run.js writes a tiny shim
// `.e2e-entry.js` into the PROJECT ROOT that requires this file. Spawning
// `electron tests/e2e/launcher.js` directly would load index.html from the
// wrong directory (blank window).
//
// Boots the real app (main.js) with an isolated, throwaway userData directory,
// waits for the window, then hands a driver object to the scenario module.
// Results are printed as a single E2E_RESULT: JSON line and the exit code
// reflects pass/fail — run.js parses both.

const { app, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

const scenarioPath = process.argv[2] && path.resolve(process.argv[2]);
if (!scenarioPath || !fs.existsSync(scenarioPath)) {
    console.error('E2E_RESULT:' + JSON.stringify({ fatal: 'scenario not found: ' + scenarioPath }));
    process.exit(2);
}

// Isolated profile: no single-instance-lock clash with an installed MrxDown,
// no session-restore dialogs from previous runs, no settings bleed.
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mrxdown-e2e-'));
app.setPath('userData', userDataDir);

// main.js parses process.argv for a file to open — without this, it would open
// the scenario path as a document (ghost second tab in every test).
process.argv = process.argv.slice(0, 2);

// Boot the real app
require(path.join(__dirname, '..', '..', 'main.js'));

const WINDOW_TIMEOUT_MS = 15000;
const results = [];
let scenarioName = path.basename(scenarioPath, '.e2e.js');

function record(name, ok, detail) {
    results.push({ name, ok, detail: detail === undefined ? null : detail });
}

async function waitForWindow() {
    const start = Date.now();
    while (Date.now() - start < WINDOW_TIMEOUT_MS) {
        const win = BrowserWindow.getAllWindows()[0];
        if (win && !win.webContents.isLoading()) {
            // Give the renderer's DOMContentLoaded init a moment to finish
            const ready = await win.webContents.executeJavaScript(
                'typeof editor !== "undefined" && !!editor && typeof tabs !== "undefined"'
            ).catch(() => false);
            if (ready) return win;
        }
        await new Promise(r => setTimeout(r, 250));
    }
    throw new Error('window/renderer not ready within ' + WINDOW_TIMEOUT_MS + 'ms');
}

function makeDriver(win) {
    return {
        win,
        app,
        userDataDir,
        // Run JS in the renderer, return the (JSON-serializable) result
        exec: (js) => win.webContents.executeJavaScript(`(async function() { ${js} })()`),
        // Convenience: set editor content through the real editor and wait out the render debounce
        setContent: async (text) => {
            await win.webContents.executeJavaScript(
                `editor.value = ${JSON.stringify(text)}; renderMarkdown();`
            );
            await new Promise(r => setTimeout(r, 800));
        },
        resize: async (width, height) => {
            win.setBounds({ width, height });
            await new Promise(r => setTimeout(r, 400));
        },
        sleep: (ms) => new Promise(r => setTimeout(r, ms)),
        // Assertions — recorded, not thrown, so one failure doesn't hide the rest
        assert: (name, cond, detail) => record(name, !!cond, detail),
        assertEq: (name, actual, expected) => record(
            name,
            JSON.stringify(actual) === JSON.stringify(expected),
            JSON.stringify(actual) === JSON.stringify(expected) ? null : { actual, expected }
        ),
    };
}

app.whenReady().then(async () => {
    let fatal = null;
    try {
        const win = await waitForWindow();
        const scenario = require(scenarioPath);
        if (scenario.name) scenarioName = scenario.name;
        await scenario.run(makeDriver(win));
    } catch (err) {
        fatal = err.stack || String(err);
    }
    const failed = results.filter(r => !r.ok);
    console.log('E2E_RESULT:' + JSON.stringify({
        scenario: scenarioName,
        passed: results.length - failed.length,
        failed: failed.length,
        failures: failed,
        fatal
    }));
    // Clean up the throwaway profile (best effort)
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
    app.exit(fatal || failed.length > 0 ? 1 : 0);
});
