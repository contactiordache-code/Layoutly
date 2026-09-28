# Layoutly

**Inspect any website, copy any component — and the site's colors and fonts — as LLM-ready code.**
Desktop app for macOS and Windows. **Open source (MIT)** — build it yourself for free, or get the
ready-made app for **$10 lifetime**.

## Two ways to use Layoutly

| | Open source — $0 | Lifetime — $10 |
|---|---|---|
| How | Clone this repo and run it (below) | Download the installer from the website |
| Limits | None, everything unlocked | Free every day: 2 components + 2 site styles. Unlimited after one $10 payment |
| You need | Node.js 22+, a terminal | Nothing — double-click and go |
| Updates | `git pull` | New installers on the website |

Same code either way. The $10 pays for the ready-made installers and supports development.

### Build it yourself

```bash
git clone https://github.com/contactiordache-code/Layoutly.git
cd Layoutly
npm install
npm start          # everything unlocked, no limits, no key
npm run dist:mac   # optional: your own .dmg (or dist:win for an .exe)
```

> The full product plan, launch checklist and roadmap (in Romanian) are in [PLAN.md](PLAN.md).

## How it works

1. **Onboarding (3 steps):** what Layoutly does → choose your inspect key → choose your stack and AI.
2. **Open any website** in Layoutly's built-in browser and **press your key**: a Chrome-style Inspect overlay
   highlights elements (margin / padding / content, tag and size). `↑` / `↓` select the parent / child, `Esc` exits.
3. **Click a component**: a sidebar opens with only that component's code — AI prompt, HTML, CSS or a single
   HTML file — plus a screenshot. "Copy & open ChatGPT / Claude / Gemini" copies it and opens your AI.
4. **Style tab**: the site's colors, fonts, type scale, radii and shadows, exported as CSS variables,
   a Tailwind config or an AI prompt.

## Project structure

| Path | What |
|---|---|
| `src/main/` | Electron main process: window, hotkey, IPC, daily free allowance, license (Lemon Squeezy) |
| `src/main/config.js` | Price, free copies per day, checkout URL — **edit before shipping** |
| `src/preload/preload.js` | Safe bridge between the UI and the main process |
| `src/inspector/webview-preload.js` | Runs in every page: Inspect overlay, component & style extraction |
| `src/renderer/` | App UI: browser toolbar, sidebar, onboarding, paywall, settings |
| `components/ui/` | shadcn-style React components (`default-swapy.tsx` + its Swapy wrappers) |
| `components/style-board/` | The Style board: the Swapy bento layout filled with the inspected site's colors, fonts, sizes, radii and shadows |
| `entries/`, `styles/`, `lib/`, `vite.config.ts` | React + TypeScript + Tailwind v4 bundle built into `src/renderer/ui/` (`npm run build:ui`) |
| `website/` | Static landing page with downloads and pricing (`website/config.js` holds the links) |
| `test/` | Inspector tests in real Chromium |
| `.github/workflows/` | Tests on push; `.dmg` + `.exe` published to Releases on `v*` tags; landing page deployed to GitHub Pages |

## Development

```bash
npm install
npm start                 # build the React UI and run the app (open-source edition, no limits)
npm run start:official    # run the official edition from source, to test the daily limit and paywall
npm run typecheck  # TypeScript
npm test           # inspector tests (needs Chromium; set CHROMIUM_PATH if not auto-detected)
npm run website    # serve the landing page locally
```

## Release

```bash
npm run dist:mac   # dist/Layoutly-mac-arm64.dmg, dist/Layoutly-mac-x64.dmg
npm run dist:win   # dist/Layoutly-win-x64.exe
# or let CI do it (builds .dmg + .exe and publishes them to GitHub Releases):
git tag v0.1.0 && git push --tags
```

## Editions and licensing

One codebase, two editions, decided at build time (`src/main/main.js`):

- **Open-source edition** — anything run or built from source. No daily limit, no paywall, no license check.
- **Official edition** — the installers built by `.github/workflows/release.yml`, which passes
  `-c.extraMetadata.layoutlyEdition=official` to electron-builder. 2 free components + 2 free site styles per day
  (reset at local midnight), unlimited with the $10 lifetime key.

The $10 lifetime key is sold through Lemon Squeezy. The app calls the public License API
(`/v1/licenses/activate`, `validate`, `deactivate`) — no secret key ships in the app, so the whole
repo can be public. Set `checkoutUrl` (and optionally `lemonSqueezy.productId`) in `src/main/config.js`.

## License

The code is [MIT](LICENSE): use it, change it, ship it. The name "Layoutly" and its logo are not part of
the MIT grant — if you distribute your own builds, give them a different name and icon.
