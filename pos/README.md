# آبرنگ POS (Tauri)

Desktop Point of Sale for in-store sales on **Linux / Windows / macOS**.

Uses the existing Go API (`/auth/login`, `/products`, `/invoices`).

## Prerequisites

- Node.js 20+
- [Rust](https://www.rust-lang.org/tools/install) (for `tauri build` / `tauri dev`)
- Linux system deps: see [Tauri Linux prerequisites](https://tauri.app/start/prerequisites/)

## Develop (UI in browser)

```bash
cd pos
npm install
npm run dev
```

Open http://localhost:1420 — login with dashboard credentials.

## Develop (native window)

```bash
cd pos
npm install
npm run tauri:dev
```

## Build installers

```bash
# current OS targets
npm run tauri:build

# platform-specific helpers
npm run tauri:build:linux    # .deb + AppImage
npm run tauri:build:windows  # .msi + NSIS (run on Windows)
npm run tauri:build:macos    # .dmg + .app (run on macOS)
```

Artifacts are written under `pos/src-tauri/target/release/bundle/`.

## Config

On the login screen, open **تنظیمات API** and set the API base URL, e.g.:

`https://ns-xp45-default-accounting-api.bugx.ir/api`

Token and API URL are stored in localStorage inside the app webview.

## Flow

1. Login
2. Search / tap products (variant picker when needed)
3. Adjust cart, payment method, discount
4. **ثبت فاکتور** (or `F12`) → print receipt

Shortcuts: `F2` focus search, `F12` submit invoice.
