# Security Policy

## Scope

**Mouse Pointer Settings** is a local Windows desktop application. Its security surface is deliberately narrow:

| Area | Detail |
|------|--------|
| Network access | **None** — the app makes zero network requests |
| External services | **None** — no telemetry, analytics, or cloud sync |
| Permissions | User-scoped only (`HKCU` registry, `%TEMP%` directory) |
| Elevated privileges | **Not required** — runs as the logged-in user |
| Data stored | Only your last cursor theme choice (shape, color, size) in local AppData |

The app uses Electron with the following hardening:
- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- `webSecurity: true`

## Reporting a Vulnerability

If you discover a security vulnerability, **please do not open a public GitHub issue**.

Instead, contact us privately:

**Email:** security@digitaleu.me  
**Subject line:** `[mouse-pointer-settings] Security Vulnerability`

Include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- (Optional) A suggested fix

We will acknowledge your report within **48 hours** and aim to release a fix within **14 days** for confirmed issues.

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest (`main` branch) | Yes |
| Older releases | Best-effort |

## Out of Scope

The following are considered out of scope:

- Issues that require physical access to the user's machine
- Issues in `node_modules/` (report those to the relevant upstream package)
- Social engineering attacks
- Issues already known and documented in upstream Electron security advisories
