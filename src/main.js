'use strict';

/**
 * DeepSeek Harness — desktop shell.
 *
 * Starts a private `dsh web` server (loopback only, random free port), waits
 * for the authenticated URL it prints, then loads that URL in a Chromium
 * window. The server is a child of this app and is torn down on quit.
 */

const { app, BrowserWindow, Menu, shell, session, ipcMain } = require('electron');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PRODUCT = 'DeepSeek Harness';
const STARTUP_TIMEOUT_MS = 180_000;
const RUNTIME_HINT = '@deepseek-ai/dsh';

app.setName(PRODUCT);
app.setPath(
  'userData',
  process.env.DSH_DESKTOP_USER_DATA
    ? path.resolve(process.env.DSH_DESKTOP_USER_DATA)
    : path.join(app.getPath('appData'), PRODUCT),
);

const isSelfTest = process.argv.includes('--selftest');
let mainWindow = null;
let splashWindow = null;
let server = null;
let serverUrl = null;
let quitting = false;
let shuttingDown = false;

/* ------------------------------------------------------------------ */
/* Logging                                                             */
/* ------------------------------------------------------------------ */

function logDir() {
  const dir = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function serverLogPath() {
  return path.join(logDir(), 'server.log');
}

function log(line) {
  try {
    fs.appendFileSync(serverLogPath(), `[${new Date().toISOString()}] ${line}\n`);
  } catch {
    /* logging must never break startup */
  }
}

/* ------------------------------------------------------------------ */
/* Environment / runtime discovery                                     */
/* ------------------------------------------------------------------ */

/** PATH as a Finder-launched app would see it plus the user's login shell. */
function loginPath() {
  if (loginPath.cached) return loginPath.cached;
  let value = process.env.PATH || '';
  try {
    const out = spawnSync('/bin/zsh', ['-lc', 'printf %s "$PATH"'], {
      encoding: 'utf8',
      timeout: 8000,
      env: process.env,
    });
    if (out.status === 0 && out.stdout && out.stdout.trim()) value = out.stdout.trim();
  } catch {
    /* fall back to inherited PATH */
  }
  const defaults = ['/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'];
  for (const dir of defaults) if (!value.split(':').includes(dir)) value += `:${dir}`;
  loginPath.cached = value;
  return value;
}

function which(command) {
  const dirs = (process.env.DSH_SEARCH_PATH || loginPath()).split(':').filter(Boolean);
  for (const dir of dirs) {
    const candidate = path.join(dir, command);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

function readVersion(pkgJsonPath) {
  try {
    return JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')).version || '0.0.0';
  } catch {
    return null;
  }
}

function compareVersions(a, b) {
  const pa = String(a).split('-')[0].split('.').map(Number);
  const pb = String(b).split('-')[0].split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Every place a `dsh` install may live, best (newest) first. */
function findDshInstall() {
  const home = os.homedir();
  const found = [];
  const consider = (pkgDir) => {
    const bin = path.join(pkgDir, 'lib', 'bin.js');
    const version = readVersion(path.join(pkgDir, 'package.json'));
    if (version && fs.existsSync(bin)) found.push({ bin, version, pkgDir });
  };

  if (process.env.DSH_BIN) {
    const bin = path.resolve(process.env.DSH_BIN);
    const version = readVersion(path.join(path.dirname(path.dirname(bin)), 'package.json'));
    if (fs.existsSync(bin)) found.push({ bin, version: version || '0.0.0', pkgDir: path.dirname(bin) });
  }

  try {
    const npxRoot = path.join(home, '.npm', '_npx');
    for (const entry of fs.readdirSync(npxRoot)) {
      consider(path.join(npxRoot, entry, 'node_modules', '@deepseek-ai', 'dsh'));
    }
  } catch {
    /* no npx cache */
  }

  consider(path.join(home, '.local', 'lib', 'node_modules', '@deepseek-ai', 'dsh'));
  consider('/usr/local/lib/node_modules/@deepseek-ai/dsh');
  consider('/opt/homebrew/lib/node_modules/@deepseek-ai/dsh');
  consider(path.join(app.getPath('userData'), 'runtime', 'node_modules', '@deepseek-ai', 'dsh'));
  consider(path.join(path.dirname(process.execPath), '..', 'runtime', 'node_modules', '@deepseek-ai', 'dsh'));

  found.sort((a, b) => compareVersions(b.version, a.version));
  return found[0] || null;
}

/* ------------------------------------------------------------------ */
/* Server lifecycle                                                    */
/* ------------------------------------------------------------------ */

function stopServer() {
  if (!server) return;
  const child = server;
  server = null;
  log(`stopping server pid=${child.pid}`);
  try {
    if (child.pid) process.kill(-child.pid, 'SIGTERM');
    else child.kill('SIGTERM');
  } catch {
    try { child.kill('SIGTERM'); } catch { /* already gone */ }
  }
  setTimeout(() => {
    try {
      if (child.pid) process.kill(-child.pid, 'SIGKILL');
    } catch {
      /* already gone */
    }
  }, 4000).unref();
}

/**
 * Spawn `dsh web` and resolve with the authenticated URL it prints.
 * @param {(message: string) => void} onStatus progress callback for the splash
 */
function startServer(onStatus) {
  return new Promise((resolve, reject) => {
    const install = findDshInstall();
    const env = {
      ...process.env,
      PATH: loginPath(),
      DSH_WEB_DESKTOP: '1',
      NO_COLOR: process.env.NO_COLOR || '1',
    };
    delete env.ELECTRON_RUN_AS_NODE;

    let command;
    let args;
    let label;
    if (install) {
      const node = process.env.DSH_NODE || which('node');
      if (!node) {
        reject(new Error(
          'Node.js was not found. DeepSeek Harness needs Node.js (v20 or newer).\n' +
          'Install it from https://nodejs.org, then reopen the app.',
        ));
        return;
      }
      command = node;
      args = [install.bin, 'web', '--no-open', '--port', '0'];
      label = `${node} ${install.bin} (dsh ${install.version})`;
    } else {
      command = '/bin/zsh';
      args = ['-lc', `exec npx -y ${RUNTIME_HINT}@0.2.2-rc.1 web --no-open --port 0`];
      label = `npx -y ${RUNTIME_HINT} (first run downloads ~900 MB)`;
    }

    log(`starting: ${label}`);
    onStatus(install ? 'Starting server…' : 'Downloading DeepSeek Harness (first run)…');

    const child = spawn(command, args, {
      cwd: os.homedir(),
      env,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server = child;

    let settled = false;
    let buffered = '';
    const tail = [];

    const remember = (chunk) => {
      for (const line of String(chunk).split('\n')) {
        const clean = line.replace(/\u001b\[[0-9;]*m/g, '').trimEnd();
        if (!clean) continue;
        tail.push(clean);
        if (tail.length > 120) tail.shift();
      }
    };

    const fail = (message) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const detail = tail.slice(-25).join('\n');
      reject(new Error(detail ? `${message}\n\n${detail}` : message));
    };

    const timer = setTimeout(() => {
      fail(`The server did not become ready within ${STARTUP_TIMEOUT_MS / 1000}s.`);
    }, STARTUP_TIMEOUT_MS);

    const onData = (chunk) => {
      buffered += String(chunk);
      log(String(chunk).replace(/\u001b\[[0-9;]*m/g, '').trimEnd());
      remember(chunk);
      const match = buffered.match(/dsh web:\s*(https?:\/\/\S+)/);
      if (match && !settled) {
        settled = true;
        clearTimeout(timer);
        serverUrl = match[1];
        resolve(serverUrl);
      }
      if (buffered.length > 64_000) buffered = buffered.slice(-16_000);
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (error) => fail(`Could not start the server: ${error.message}`));
    child.on('exit', (code, signal) => {
      log(`server exited code=${code} signal=${signal}`);
      if (server === child) server = null;
      if (!settled) {
        fail(`The server exited before it was ready (code ${code ?? signal}).`);
      } else if (!shuttingDown) {
        onServerCrash(tail.slice(-25).join('\n'));
      }
    });

    child.on('spawn', () => onStatus('Waiting for the server to be ready…'));
  });
}

/* ------------------------------------------------------------------ */
/* Windows                                                             */
/* ------------------------------------------------------------------ */

function preloadPath() {
  return path.join(__dirname, 'preload.js');
}

let splashReady = null;
let splashQueue = [];

function sendSplash(channel, payload) {
  if (!splashWindow || splashWindow.isDestroyed()) return;
  if (splashReady) splashWindow.webContents.send(channel, payload);
  else splashQueue.push([channel, payload]);
}

function createSplash() {
  splashReady = null;
  splashQueue = [];
  splashWindow = new BrowserWindow({
    width: 460,
    height: 320,
    resizable: false,
    frame: false,
    transparent: true,
    show: false,
    fullscreenable: false,
    maximizable: false,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  splashReady = new Promise((resolve) => {
    splashWindow.webContents.once('did-finish-load', resolve);
  }).then(() => {
    if (!splashWindow || splashWindow.isDestroyed()) return;
    for (const [channel, payload] of splashQueue) splashWindow.webContents.send(channel, payload);
    splashQueue = [];
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.once('ready-to-show', () => splashWindow && splashWindow.show());
  splashWindow.on('closed', () => { splashWindow = null; splashReady = null; });
  return splashWindow;
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
  splashWindow = null;
}

function showError(message) {
  if (!splashWindow || splashWindow.isDestroyed()) createSplash();
  sendSplash('harness:error', message);
}

function windowStatePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState() {
  const fallback = { width: 1280, height: 860 };
  try {
    const state = JSON.parse(fs.readFileSync(windowStatePath(), 'utf8'));
    if (typeof state.width === 'number' && typeof state.height === 'number') return state;
  } catch {
    /* first run */
  }
  return fallback;
}

function saveWindowState(win) {
  if (!win || win.isDestroyed() || win.isMinimized()) return;
  try {
    const bounds = win.getBounds();
    fs.writeFileSync(windowStatePath(), JSON.stringify(bounds));
  } catch {
    /* best effort */
  }
}

function createMainWindow(url) {
  const state = loadWindowState();
  const win = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 900,
    minHeight: 600,
    title: PRODUCT,
    backgroundColor: '#111318',
    show: false,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });
  mainWindow = win;

  win.once('ready-to-show', () => {
    closeSplash();
    win.show();
  });

  win.on('resize', () => saveWindowState(win));
  win.on('move', () => saveWindowState(win));
  win.on('close', () => saveWindowState(win));
  win.on('closed', () => { if (mainWindow === win) mainWindow = null; });

  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:/i.test(target)) shell.openExternal(target);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, target) => {
    try {
      const next = new URL(target);
      const current = new URL(serverUrl);
      if (next.origin === current.origin) return;
    } catch {
      /* fall through to external */
    }
    event.preventDefault();
    if (/^https?:/i.test(target)) shell.openExternal(target);
  });

  win.webContents.on('did-fail-load', (_event, code, description, validatedURL, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    log(`did-fail-load ${code} ${description} ${validatedURL}`);
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    log(`renderer gone: ${JSON.stringify(details)}`);
  });

  win.loadURL(url);
  return win;
}

function onServerCrash(detail) {
  if (quitting) return;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
    mainWindow = null;
  }
  showError(`The DeepSeek Harness server stopped unexpectedly.\n\n${detail}`);
}

/* ------------------------------------------------------------------ */
/* Menu                                                                */
/* ------------------------------------------------------------------ */

function buildMenu() {
  const template = [
    {
      label: PRODUCT,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Open Web UI in Browser',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => { if (serverUrl) shell.openExternal(serverUrl); },
        },
        {
          label: 'Show Server Log',
          click: () => { shell.showItemInFolder(serverLogPath()); },
        },
        { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'forceReload' },
        { role: 'toggleDevTools' }, { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' }, { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'front' }],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

async function boot() {
  serverUrl = null;
  createSplash();
  try {
    const url = await startServer((message) => sendSplash('harness:status', message));
    log(`server ready at ${url.replace(/\?.*$/, '?<token>')}`);
    createMainWindow(url);
  } catch (error) {
    log(`startup failed: ${error.message}`);
    showError(error.message);
    if (isSelfTest) app.exit(1);
  }
}

function retry() {
  closeSplash();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
  mainWindow = null;
  stopServer();
  boot();
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  stopServer();
  app.exit(code);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    buildMenu();

    ipcMain.on('harness:retry', () => retry());
    ipcMain.on('harness:quit', () => shutdown(0));
    ipcMain.on('harness:open-logs', () => { shell.openPath(serverLogPath()); });

    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
      const allowed = new Set([
        'clipboard-read',
        'clipboard-sanitized-write',
        'notifications',
        'media',
        'fullscreen',
        'pointerLock',
      ]);
      callback(allowed.has(permission));
    });

    boot();
  });

  app.on('before-quit', (event) => {
    if (!shuttingDown) {
      event.preventDefault();
      quitting = true;
      shutdown(0);
    }
  });

  app.on('window-all-closed', () => {
    if (!shuttingDown) shutdown(0);
  });

  app.on('activate', () => {
    if (!mainWindow && !splashWindow) boot();
  });
}

// Test hook: drive a headless-ish verification pass.
if (isSelfTest) {
  app.on('ready', () => {
    // The splash is shown; once the main window loads, capture and exit.
    const deadline = Date.now() + 150_000;
    const tick = setInterval(async () => {
      if (Date.now() > deadline) { clearInterval(tick); shutdown(2); return; }
      if (mainWindow && !mainWindow.isDestroyed()) {
        const win = mainWindow;
        if (!win.webContents.isLoading()) {
          clearInterval(tick);
          await new Promise((r) => setTimeout(r, 4000));
          try {
            const image = await win.webContents.capturePage();
            const outFile = path.join(app.getPath('userData'), 'selftest.png');
            fs.writeFileSync(outFile, image.toPNG());
            log('selftest screenshot: ' + outFile);
          } catch (error) {
            log(`selftest capture failed: ${error.message}`);
          }
          shutdown(0);
        }
      }
    }, 500);
  });
}

process.on('exit', () => {
  if (server && server.pid) {
    try { process.kill(-server.pid, 'SIGKILL'); } catch { /* gone */ }
  }
});

module.exports = {};
