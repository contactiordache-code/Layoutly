# Product

<!-- impeccable:product-schema 1 -->

## Platform

web (Electron desktop app for macOS and Windows, plus a static marketing site in `website/`)

## Users

People who build UI with AI tools: developers, indie makers and vibe coders who see a component or a whole look on a live website and want to recreate it quickly in ChatGPT, Claude, Cursor, v0, Lovable or a similar tool.

## Product Purpose

Layoutly turns "I like that" on any website into something an AI can rebuild. Press one key in the built-in browser, click an element, and get its clean code (HTML plus only the CSS that matters), a screenshot, and the site's colors and fonts, formatted as an AI prompt, HTML, CSS or a standalone file. A second mode extracts a site's whole design style (colors, fonts, type scale, radii, shadows) as CSS variables, a Tailwind config or an AI prompt. Success is a paste-ready result in seconds, without DevTools.

## Positioning

It reads the real computed styles of the live page (deduplicated, with hover states and pseudo-elements) and formats them for an LLM and the user's chosen stack, instead of dumping a stylesheet or a DOM tree.

## Operating Context

- The user browses arbitrary third-party sites inside the app's `<webview>`; the inspected page is the main content and the app chrome frames it.
- The inspect hotkey (default Alt+Shift+S, user-configurable in onboarding) is active only while the app is focused.
- Output is copied to the clipboard and pasted into an AI chat or editor; "Copy & open" launches the user's chosen AI.
- Onboarding asks for the hotkey, the user's stack and their AI.

## Capabilities and Constraints

- Two builds: an official edition with a daily free allowance (2 components + 2 styles per day) and a $10 one-time lifetime license (Lemon Squeezy), and an open-source build with no limits.
- Everything runs locally; no account, no tracking; the only network call is license validation.
- The renderer runs under a strict CSP (`default-src 'self'`): fonts and images must be bundled locally.
- `website/shared/` holds copies of the app's inspector and formatters (`npm run sync:website`); a test enforces they stay identical.
- The app is Layoutly end to end: package name, `appId` (`app.layoutly.desktop`), userData folder, `layoutly.json` store, `window.layoutly` / `window.Layoutly*` globals, installers (`Layoutly-<os>-<arch>`) and the public repo `contactiordache-code/Layoutly`. The old name "Seiton" is retired; renaming anything user-facing again would need a settings/license migration once real installs exist.

## Brand Commitments

- Name: Layoutly, everywhere.
- The marketing site in `website/` is the reference for the brand's look; the app follows it.
- Voice: short, concrete, second person ("Press one key", "Just the part you like"); no hype.
