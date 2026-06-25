'use strict';

const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const os = require('os');

// electron-store is an ES module in v8+; require the CommonJS-compatible v8
let Store;
try {
  Store = require('electron-store');
} catch {
  Store = null;
}

const { generateCursorSet } = require('./lib/cursor-gen');

// ── Persistent store ──────────────────────────────────────────────────────────
const store = Store ? new Store() : {
  _data: {},
  get(k, d) { return this._data[k] ?? d; },
  set(k, v) { this._data[k] = v; },
};

// ── Globals ───────────────────────────────────────────────────────────────────
let tray = null;
let popupWindow = null;

const CURSOR_OUTPUT_DIR = path.join(os.tmpdir(), 'MousePointerSettingsCursors');
const PS1_PATH = path.join(__dirname, 'lib', 'apply-cursor.ps1');

// ── App setup ─────────────────────────────────────────────────────────────────
app.setAppUserModelId('eu.oudigital.mouse-pointer-settings');

// Auto-start with Windows login (runs silently in the tray, no terminal needed)
app.setLoginItemSettings({ openAtLogin: true });

// Prevent the app from quitting when all windows are closed (tray app)
app.on('window-all-closed', (e) => e.preventDefault());

app.whenReady().then(() => {
  createTray();
});

// ── Tray ──────────────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  let icon;
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
  } else {
    // Fallback: generate a small colored square as the tray icon
    icon = createFallbackTrayIcon();
  }

  tray = new Tray(icon);
  tray.setToolTip('Mouse Pointer Settings – Cursor Theme Changer');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Mouse Pointer Settings',
      click: () => togglePopup(),
    },
    { type: 'separator' },
    {
      label: 'Reset to Windows Default',
      click: () => applyReset(),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.exit(0);
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => togglePopup());
}

function createFallbackTrayIcon() {
  // 16×16 orange square as fallback PNG
  const { nativeImage: ni } = require('electron');
  // Create a tiny bitmap manually: PNG header + IHDR + IDAT + IEND
  // Easier: use a data URL
  const size = 16;
  const pixels = [];
  for (let i = 0; i < size * size; i++) {
    pixels.push(255, 140, 0, 255); // orange RGBA
  }
  return ni.createFromBitmap(Buffer.from(pixels), { width: size, height: size, scaleFactor: 1.0 });
}

// ── Popup window ──────────────────────────────────────────────────────────────
function createPopupWindow() {
  const win = new BrowserWindow({
    width: 420,
    height: 660,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  win.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Hide when focus is lost
  win.on('blur', () => {
    if (!win.webContents.isDevToolsOpened()) {
      win.hide();
    }
  });

  win.on('closed', () => {
    popupWindow = null;
  });

  return win;
}

function togglePopup() {
  if (popupWindow && !popupWindow.isDestroyed()) {
    if (popupWindow.isVisible()) {
      popupWindow.hide();
    } else {
      positionAndShow(popupWindow);
    }
    return;
  }

  popupWindow = createPopupWindow();
  popupWindow.once('ready-to-show', () => {
    positionAndShow(popupWindow);
  });
}

function positionAndShow(win) {
  const trayBounds = tray.getBounds();
  const winBounds = win.getBounds();
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });
  const workArea = display.workArea;

  // Position above the tray icon, centered on it
  let x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2);
  let y = Math.round(trayBounds.y - winBounds.height - 8);

  // Keep on screen
  if (x < workArea.x) x = workArea.x + 4;
  if (x + winBounds.width > workArea.x + workArea.width) {
    x = workArea.x + workArea.width - winBounds.width - 4;
  }
  if (y < workArea.y) {
    y = trayBounds.y + trayBounds.height + 8; // show below if no room above
  }

  win.setPosition(x, y, false);
  win.show();
  win.focus();
}

// ── Cursor application ────────────────────────────────────────────────────────
async function applyCursorTheme(color, size, shape) {
  const filePaths = await generateCursorSet(color, size, CURSOR_OUTPUT_DIR, shape);
  const json = JSON.stringify(filePaths);
  return runPowerShell(json);
}

function applyReset() {
  store.set('lastTheme', null);
  return runPowerShell('{}');
}

function runPowerShell(cursorJson) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy', 'Bypass',
        '-File', PS1_PATH,
        '-CursorJson', cursorJson,
      ],
      { timeout: 15000 },
      (err, stdout, stderr) => {
        if (err) {
          console.error('PowerShell error:', stderr || err.message);
          reject(new Error(stderr || err.message));
        } else {
          resolve(stdout.trim());
        }
      }
    );
  });
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────
ipcMain.handle('apply-cursor', async (_event, { color, size, shape }) => {
  try {
    await applyCursorTheme(color, size, shape || 'arrow');
    store.set('lastTheme', { color, size, shape: shape || 'arrow' });
    if (popupWindow && !popupWindow.isDestroyed()) {
      popupWindow.webContents.send('cursor-status', `Applied: ${color} @ ${size}px`);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('reset-cursor', async () => {
  try {
    await applyReset();
    if (popupWindow && !popupWindow.isDestroyed()) {
      popupWindow.webContents.send('cursor-status', 'Reset to Windows default');
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('get-last-theme', () => {
  return store.get('lastTheme', null);
});
