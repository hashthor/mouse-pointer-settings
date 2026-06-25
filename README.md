# Mouse Pointer Settings

**Mouse Pointer Settings** is a lightweight Windows system-tray application that lets you fully customize your mouse cursor — pick from built-in presets or design your own with a custom shape, color, and size.

> Made with ❤️ by [OuDigital EU](https://digitaleu.me) — part of our [In House Software](https://digitaleu.me/about/in-house-software) collection.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform: Windows](https://img.shields.io/badge/Platform-Windows%2010%2F11-blue.svg)]()
[![Electron](https://img.shields.io/badge/Built%20with-Electron-47848F.svg)](https://www.electronjs.org/)

---

## Screenshot

> *(Screenshot coming soon — run the app and take one!)*

---

## Features

- **System tray app** — lives quietly in your taskbar notification area
- **6 built-in presets** — Default, Big Green, Blue Star, Red Diamond, Gold Circle, Pink Cross
- **Custom shape picker** — Arrow, Thick Arrow, Star, Circle, Diamond, Cross, Hand
- **Color picker** — full hex color support with a visual color wheel
- **Size slider** — scale cursors from 24 px to 256 px
- **Live preview** — see your cursor design before applying
- **One-click reset** — restore Windows default cursors at any time
- **Remembers your last theme** — restores your settings on next launch
- **Auto-starts with Windows** — registers itself at login so it's always in the tray
- **Fully offline** — no network access, no telemetry, no accounts

---

## Requirements

| Requirement | Version |
|-------------|---------|
| OS | Windows 10 or Windows 11 |
| Node.js | v18 or later (for development) |
| npm | v9 or later |

---

## Installation (Development)

```bash
# Clone the repository
git clone https://github.com/OuDigitalEU/mouse-pointer-settings.git
cd mouse-pointer-settings

# Install dependencies
npm install

# Run the app
npm start
```

To run in developer mode (with DevTools access):

```bash
npm run dev
```

---

## Building a Distributable (.exe)

The project uses [electron-builder](https://www.electron.build/) for packaging.

```bash
# Install electron-builder (already in devDependencies)
npm install

# Build Windows installer
npx electron-builder --win
```

The installer will be output to the `dist/` folder.

> **Note on PowerShell:** This app runs a PowerShell script with `-ExecutionPolicy Bypass` to write cursor paths to the Windows registry (`HKCU\Control Panel\Cursors`). This is intentional and entirely user-scoped — it does not require administrator privileges and does not affect system-wide policy.

---

## How It Works

```
Tray click → popup UI
  → Pick preset or custom (shape + color + size)
  → Apply button
  → Generates 15 .cur files in %TEMP%\MousePointerSettingsCursors\
  → Writes paths to HKCU\Control Panel\Cursors via PowerShell
  → Broadcasts SPI_SETCURSORS to apply immediately
```

The cursor files are generated entirely in memory using [Jimp](https://github.com/jimp-dev/jimp) and written to a temporary directory — nothing is installed permanently.

---

## Project Structure

```
mouse-pointer-settings/
├── main.js              # Electron main process (tray, IPC, PowerShell runner)
├── preload.js           # contextBridge API exposed to the renderer
├── package.json
├── lib/
│   ├── cursor-gen.js    # .cur file generation (pixel art via Jimp)
│   └── apply-cursor.ps1 # Registry write + cursor reload
├── src/
│   ├── index.html       # Popup UI shell
│   ├── renderer.js      # UI logic, presets, IPC calls
│   └── styles.css       # Dark theme styling
└── assets/
    └── tray-icon.png    # Tray icon (optional — falls back to orange square)
```

---

## Security

- `contextIsolation: true` and `nodeIntegration: false` — the renderer has no direct Node.js access
- `sandbox: true` — renderer process runs in a sandboxed environment
- `webSecurity: true` — standard browser security policies enforced
- No network requests — the app is fully local
- Registry writes are scoped to `HKCU` (current user only) — no system-wide changes
- No telemetry, no analytics, no external services

See [SECURITY.md](SECURITY.md) for how to report a vulnerability.

---

## Contributing

Contributions are welcome! To get started:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push the branch: `git push origin feature/my-feature`
5. Open a Pull Request

Please keep PRs focused — one feature or fix per PR.

---

## License

[MIT](LICENSE) © 2026 OuDigital EU
