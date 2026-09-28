---
name: Layoutly
description: Copy any website component straight into your AI. Light, sky-washed surfaces with tactile tools.
colors:
  signal-blue: "#155dfc"
  signal-blue-bright: "#3a7bff"
  cobalt: "#1447e6"
  deep-navy: "#001880"
  sky-cyan: "#00bcff"
  ink: "#0f1324"
  slate: "#364153"
  steel: "#6b7280"
  hairline: "#e5e7eb"
  cloud: "#f3f4f6"
  mist: "#f9fafb"
  paper: "#ffffff"
  graphite: "#1a1a1a"
  carbon: "#0a0a0a"
  code-text: "#d6d4e6"
typography:
  display:
    fontFamily: "Stack Sans Headline, Inter, sans-serif"
    fontSize: "60px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.025em"
  display-accent:
    fontFamily: "Stack Sans Notch, Inter, sans-serif"
    fontWeight: 400
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Stack Sans Headline, Inter, sans-serif"
    fontSize: "48px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Stack Sans Headline, Inter, sans-serif"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  body-ui:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "0.12em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, Menlo, monospace"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.65
rounded:
  inner: "7px"
  control: "10px"
  button: "12px"
  tile: "16px"
  stage: "20px"
  panel: "28px"
  pill: "999px"
spacing:
  gutter: "16px"
  gutter-wide: "40px"
  group: "12px"
  stack: "24px"
  section: "80px"
components:
  button-dark:
    backgroundColor: "{colors.carbon}"
    textColor: "{colors.paper}"
    rounded: "{rounded.button}"
    height: "44px"
    padding: "0 16px 0 48px"
  button-light:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.carbon}"
    rounded: "{rounded.button}"
    height: "44px"
    padding: "0 16px 0 48px"
  button-blue:
    backgroundColor: "{colors.signal-blue}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 14px"
  segmented:
    backgroundColor: "{colors.cloud}"
    textColor: "{colors.slate}"
    rounded: "{rounded.control}"
    height: "36px"
  segmented-active:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.inner}"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 12px"
  tile:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tile}"
    padding: "20px"
  tag-label:
    textColor: "{colors.cobalt}"
    typography: "{typography.label}"
  code-block:
    backgroundColor: "{colors.carbon}"
    textColor: "{colors.code-text}"
    typography: "{typography.mono}"
    rounded: "{rounded.button}"
    padding: "14px 16px"
---

# Design System: Layoutly

## Overview

**Creative North Star: "Clear Sky Workbench"**

Layoutly is a workbench set out under a clear sky. The surfaces are light and airy: near-white paper under a cyan wash that fades down from the top of the hero and every "stage" that holds a demonstration. On those surfaces sit tools you can almost pick up: buttons, keycaps and pills cut from three stocks (white, black and signal blue) with a highlight on top and a soft shadow underneath. The product is an inspector, but it refuses the dark DevTools mood; it brings inspection into daylight.

Type does the talking. Headlines are set in Stack Sans Headline in deep navy, with the phrase that matters switched to its sibling, Stack Sans Notch, in cobalt. Everything else is quiet Inter in slate and steel. Code is the only thing that stays dark: code blocks are black slabs, because that is where syntax color reads best.

The same world runs through the marketing site (`website/`) and the desktop app (`src/renderer/`). The site is the reference; the app follows it.

**Key Characteristics:**
- Light surfaces with the sky wash (cyan at 20% fading to transparent) marking "stages".
- Navy Stack Sans headlines with one Notch phrase in cobalt.
- Tactile controls from three stocks: light, dark and blue.
- Hairlines (1px) and small square ticks frame sections.
- Code is dark; everything else is light.

## Colors

One blue family carries the brand, from the deep navy of headlines to the cyan of the sky; everything else is a cool, quiet gray.

### Primary
- **Signal Blue** (#155dfc): the one action color. The pill inside every button, primary buttons in the app, the inspect overlay outline, focus rings, the active rail and progress states. Its brighter top, **Signal Blue Bright** (#3a7bff), only appears as the upper stop of the blue stock gradient and as the toast dot.
- **Cobalt** (#1447e6): the accent voice in type. Notch phrases, uppercase labels, links, the element label in the sidebar.

### Secondary
- **Deep Navy** (#001880): headlines and titles at every size, and the brand name next to the logo.
- **Sky Cyan** (#00bcff): never used solid. It exists as the sky wash, a linear gradient from 20% opacity to transparent, on the hero, stages, boards, modals and the footer.

### Neutral
- **Ink** (#0f1324): body text and control labels.
- **Slate** (#364153): secondary text, lead paragraphs, inactive tabs.
- **Steel** (#6b7280): muted captions, hints, placeholders. Never below it on white.
- **Hairline** (#e5e7eb): 1px dividers, section frames, tile rings.
- **Cloud** (#f3f4f6): the track of segmented controls and tabs.
- **Mist** (#f9fafb): page and chrome background under the sky wash.
- **Paper** (#ffffff): tiles, sidebars, modals, inputs.
- **Graphite → Carbon** (#1a1a1a → #0a0a0a): the dark stock gradient for dark buttons, code blocks and toasts. **Code Text** (#d6d4e6) is the plain text on it.

### Named Rules
**The One Blue Action Rule.** Signal Blue marks what you can do or what is active. Headlines never use it; they use Deep Navy and Cobalt.

**The Sky Is a Wash Rule.** Sky Cyan only ever appears as the fading gradient. A solid cyan fill or a cyan border is off-system.

**The Client's Colors Rule.** Colors extracted from a user's site (style board cards, swatches) are content, shown as-is. They never restyle the chrome around them.

## Typography

**Display Font:** Stack Sans Headline (with Inter)
**Accent Font:** Stack Sans Notch (with Inter)
**Body Font:** Inter (with the system UI stack)
**Mono Font:** JetBrains Mono (with ui-monospace, Menlo)

**Character:** A friendly geometric headline face with a notched twin for emphasis, over a neutral workhorse sans. Weight stays at 400 in headlines; hierarchy comes from size and color, not boldness.

### Hierarchy
- **Display** (400, 48px mobile / 60px desktop, line-height 1): the hero headline only.
- **Headline** (400, 30px mobile / 48px desktop, line-height 1): section headings, the app start screen (52px).
- **Title** (400, 20 to 32px, line-height about 1.1): card and step titles, modal headings, empty states, the style board title.
- **Body** (400, 16px, line-height 1.6): marketing copy and legal pages, measure 62 to 68ch.
- **Body UI** (400 to 500, 13 to 14px, line-height 1.45): app controls, sidebar text, settings.
- **Label** (600, 11 to 12px, letter-spacing 0.12em, uppercase): tags, column headings, section labels. Always Cobalt or Steel.
- **Mono** (500, 11 to 12px, line-height 1.65): code, hex values, sizes, element labels. Never decorative.

### Named Rules
**The One Notch Phrase Rule.** A headline may switch one phrase to Stack Sans Notch in Cobalt ("Copy *any website component*", "One *key.*"). Never more than one per heading.

**The Mono Means Data Rule.** Monospace appears only for code, values and measurements.

## Layout

Marketing sections sit in one framed column: a 1120px band with 1px side rails, a hairline between sections and 7px square ticks where lines meet (`band-frame`). Content inside is inset 16px on mobile and 40px from 768px up. Sections breathe with 80px of vertical padding; section heads use a 12-column split (8 for the heading, 4 for the side note).

Grids step down cleanly: three columns from 960px, two from 640px, one below. The desktop app is a toolbar (56px) over a workspace: the browser on the left, a 420px sidebar on the right, modals centered over a blurred scrim.

Spacing is grouped tight and separated generously: 8 to 12px inside a group, 24px between groups, 80px between sections.

## Elevation & Depth

Depth is tactile, not atmospheric. Surfaces are flat; the objects on them are lifted. A control reads as an object because of its stock: a vertical gradient, a 1px inner highlight at the top, a 1px ring, and a short soft shadow below. Tiles and panels are paper with a hairline ring and at most a faint navy-tinted shadow. Modals are the only surfaces that float high.

### Shadow Vocabulary
- **Light stock** (`inset 0 1px 0 rgba(255,255,255,.9), 0 0 0 1px rgba(0,0,0,.08), 0 2px 6px rgba(0,0,0,.06)`): white buttons, keycaps, chips, icon chips.
- **Dark stock** (`inset 0 1px 0 rgba(255,255,255,.08), 0 4px 12px rgba(0,0,0,.18)`): dark buttons, toasts.
- **Blue stock** (`inset 0 1px 0 rgba(255,255,255,.4), inset 0 -2px 4px rgba(0,0,0,.12), 0 2px 4px rgba(0,0,0,.08)`): the pill and blue buttons.
- **Tile ring** (`0 0 0 1px #e5e7eb`, optionally `0 4px 12px rgba(0,24,128,.06)`): tiles, cards, swatches.
- **Raised segment** (`0 0 0 1px rgba(0,0,0,.06), 0 1px 3px rgba(0,0,0,.08)`): the active tab or segment.
- **Modal** (`0 0 0 1px rgba(15,19,36,.06), 0 30px 80px rgba(0,24,128,.22)`): dialogs only.

### Named Rules
**The Offset Shadow Rule.** Every shadow has a downward offset and a soft blur. No zero-offset colored glows.

## Shapes

Corners are gently rounded and nest concentrically: the pill inside a button (7px) sits in the button (10 to 12px), tiles are 16px, stages 20px, boards and the CTA panel 28px. Pills (999px) are reserved for small chips and plan badges. The one sharp shape is the 7px square tick on section frames and step rails.

## Components

### Buttons
Tactile and confident: each one looks like something you press.
- **Shape:** softly rounded (12px on the site, 10px in the compact app toolbar).
- **Dark with pill** (primary on the site): Carbon stock, white label, a Signal Blue pill on the left holding dotted chevrons. On hover or focus the pill slides across the whole button.
- **Light with pill** (secondary on the site): Paper stock, carbon label, same pill.
- **Blue** (primary in the app): Signal Blue stock, white label, 36px (44px in modals).
- **Light** (secondary in the app): light stock, Ink label that turns Cobalt on hover.
- **Inspect** (app toolbar): the dark button with the pill; while inspecting, the pill fills the button.
- **Pressed:** scale 0.98. **Focus:** 2px Signal Blue outline, 2px offset.

### Chips and Tags
- **Tag label:** uppercase Inter 600 at 0.12em in Cobalt, with dot separators on the hero.
- **Chips** (quick sites, file names): pill-shaped, light stock or Mist with a hairline ring, Slate text.
- **Plan pill:** Paper with a hairline; Cobalt on a 10% blue tint when licensed; blue stock when the daily allowance is spent.

### Cards and Containers
- **Tile:** Paper, 16px corners, hairline ring, 20px padding; title in Stack Sans at Title size.
- **Stage:** 20px corners, a 1px navy-tinted ring and the sky wash over Mist; holds a live demonstration (keys, a picked card, a chat composer).
- **Board / panel:** 28px corners, sky wash, 12px padding around white tiles.

### Inputs and Fields
- **Style:** Paper, hairline ring, 10px corners, 36px tall (44px for the start search).
- **Focus:** ring turns Signal Blue with a 4px soft blue halo (10% alpha).
- **Selects:** same field with a Steel chevron.

### Navigation
- **Site nav:** a dark frosted bar (Carbon at 80 to 90% with 24px backdrop blur), white links, the light "Download" button.
- **App tabs and segmented controls:** Cloud track, 3px inset, the active segment in Paper with the raised shadow.

### Code Block
Dark stock slab, 12px corners, JetBrains Mono 12px at 1.65, Code Text with syntax colors (tags pink, attributes light blue, strings green, keywords amber, comments gray). Themed thin scrollbar.

### Sky Stage (signature)
The hero's gradient reused as a container: `linear-gradient(to bottom, rgba(0,188,255,.2), transparent)` over Mist. It marks the places where something is shown rather than read: the hero, step stages, the style board, empty states, modal tops, the footer.

## Do's and Don'ts

### Do:
- **Do** put new demonstrations on a sky stage and new reading content on paper.
- **Do** build controls from the three stocks (light, dark, blue) with their shadows as listed above.
- **Do** keep headlines at weight 400 in Deep Navy, with at most one Notch phrase in Cobalt.
- **Do** draw icons as SVG (Lucide paths, 1.75 to 2px stroke) inside light-stock chips.
- **Do** keep code blocks dark and everything around them light.
- **Do** theme the browser surfaces: focus rings, selection (Signal Blue at 18%), thin scrollbars.

### Don't:
- **Don't** use Unicode glyphs or emoji as icons.
- **Don't** add dark full-page surfaces; the only dark elements are code, the site nav, dark buttons and toasts.
- **Don't** use purple (#7c5cff) or other off-family accents in the chrome; that was the old identity.
- **Don't** use gradient text, glassmorphism as decoration, or zero-offset colored glows.
- **Don't** use monospace for anything that is not code, a value or a measurement.
