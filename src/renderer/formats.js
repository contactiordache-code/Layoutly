// Turns extracted components and site styles into copy-ready outputs (LLM prompts, files, tokens).
(function () {
  'use strict';

  const STACKS = {
    'react-tailwind': 'React + Tailwind CSS',
    nextjs: 'Next.js (App Router) + Tailwind CSS',
    'react-css': 'React + CSS Modules',
    vue: 'Vue 3 single-file component',
    svelte: 'Svelte component',
    html: 'plain HTML + CSS',
  };

  const LLMS = {
    chatgpt: { name: 'ChatGPT', url: 'https://chatgpt.com/' },
    claude: { name: 'Claude', url: 'https://claude.ai/new' },
    gemini: { name: 'Gemini', url: 'https://gemini.google.com/app' },
    other: { name: 'Cursor / other', url: null },
  };

  function stackName(stack) {
    return STACKS[stack] || STACKS['react-tailwind'];
  }

  // ---------- Components ----------

  function componentPrompt(c, stack) {
    const lines = [
      `Recreate the UI component below as a clean, production-ready ${stackName(stack)} component.`,
      '',
      'Requirements:',
      '- Match the visual design exactly: spacing, colors, typography, border radius, shadows and hover states.',
      '- Make it responsive; replace fixed pixel widths with fluid layout where it makes sense.',
      '- Use semantic, accessible markup and give the component a descriptive name.',
      '- Turn repeated content into props or a small data array.',
      '- Return only the code.',
      '',
      `Source: ${c.url}`,
    ];
    if (c.fonts?.length) lines.push(`Fonts: ${c.fonts.join(', ')}`);
    if (c.colors?.length) lines.push(`Colors: ${c.colors.join(', ')}`);
    if (c.truncated) lines.push('Note: the component was large, so its markup was truncated. Complete the pattern sensibly.');
    lines.push('', '```html', c.html, '```', '', '```css', c.css, '```');
    return lines.join('\n');
  }

  function componentFile(c) {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${c.label} — copied with Layoutly</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 40px; }

${c.css.replace(/^/gm, '    ')}
  </style>
</head>
<body>
${c.html.replace(/^/gm, '  ')}
</body>
</html>`;
  }

  function componentOutput(c, format, stack) {
    switch (format) {
      case 'html':
        return c.html;
      case 'css':
        return c.css;
      case 'file':
        return componentFile(c);
      default:
        return componentPrompt(c, stack);
    }
  }

  // ---------- Site style ----------

  function rgb(hex) {
    const h = hex.replace('#', '');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  }

  // Chroma (0–1): how far a color is from gray. Dark slates stay neutrals, brand colors become accents.
  function chroma(hex) {
    if (!/^#[0-9a-f]{6}/i.test(hex)) return 0;
    const [r, g, b] = rgb(hex);
    return Math.max(r, g, b) - Math.min(r, g, b);
  }

  function luminance(hex) {
    if (!/^#[0-9a-f]{6}/i.test(hex)) return 0;
    const [r, g, b] = rgb(hex);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'font';
  }

  // Name the palette: background, text, accents (colorful) and neutrals (grays, light → dark).
  function tokens(s) {
    const used = new Set();
    const colors = [];
    const add = (name, value) => {
      if (!value || used.has(value)) return;
      used.add(value);
      colors.push({ name, value });
    };
    add('background', s.background);
    add('text', s.colors.find((c) => c.usage.includes('text'))?.value);
    const rest = s.colors.filter((c) => !used.has(c.value));
    rest
      .filter((c) => chroma(c.value) > 0.18)
      .slice(0, 6)
      .forEach((c, i) => add(i === 0 ? 'primary' : `accent-${i}`, c.value));
    rest
      .filter((c) => chroma(c.value) <= 0.18)
      .sort((a, b) => luminance(b.value) - luminance(a.value))
      .slice(0, 8)
      .forEach((c, i) => add(`neutral-${(i + 1) * 100}`, c.value));

    const fonts = s.fonts.map((f, i) => ({ name: i === 0 ? 'sans' : i === 1 ? 'display' : slug(f.family), stack: f.stack, family: f.family }));
    const sizes = s.fontSizes.map((f) => f.size);
    const radii = s.radii.map((r) => r.value);
    const shadows = s.shadows.map((r) => r.value);
    return { colors, fonts, sizes, radii, shadows };
  }

  function styleCss(s) {
    const t = tokens(s);
    const lines = [':root {', '  /* Colors */'];
    t.colors.forEach((c) => lines.push(`  --color-${c.name}: ${c.value};`));
    if (t.fonts.length) lines.push('', '  /* Typography */');
    t.fonts.forEach((f) => lines.push(`  --font-${f.name}: ${f.stack};`));
    t.sizes.forEach((size, i) => lines.push(`  --text-${i + 1}: ${size};`));
    if (t.radii.length) lines.push('', '  /* Radius */');
    t.radii.forEach((r, i) => lines.push(`  --radius-${i + 1}: ${r};`));
    if (t.shadows.length) lines.push('', '  /* Shadows */');
    t.shadows.forEach((sh, i) => lines.push(`  --shadow-${i + 1}: ${sh};`));
    lines.push('}');
    if (s.variables.length) {
      lines.push('', `/* Original CSS variables from ${s.host} */`, ':root {');
      s.variables.forEach((v) => lines.push(`  ${v.name}: ${v.value};`));
      lines.push('}');
    }
    return lines.join('\n');
  }

  function styleTailwind(s) {
    const t = tokens(s);
    const obj = (entries) => entries.map(([k, v]) => `        '${k}': ${JSON.stringify(v)},`).join('\n');
    return `// tailwind.config.js — design tokens from ${s.host}
module.exports = {
  theme: {
    extend: {
      colors: {
${obj(t.colors.map((c) => [c.name, c.value]))}
      },
      fontFamily: {
${obj(t.fonts.map((f) => [f.name, f.stack.split(',').map((x) => x.trim().replace(/^["']|["']$/g, ''))]))}
      },
      borderRadius: {
${obj(t.radii.map((r, i) => [`site-${i + 1}`, r]))}
      },
      boxShadow: {
${obj(t.shadows.map((sh, i) => [`site-${i + 1}`, sh]))}
      },
    },
  },
};`;
  }

  function stylePrompt(s, stack) {
    const t = tokens(s);
    const lines = [
      `Use the design system below (extracted from ${s.host}) for everything you build in ${stackName(stack)}.`,
      'Apply these exact colors, fonts, type scale, radii and shadows so the result feels like the same brand.',
      '',
      'Colors:',
      ...t.colors.map((c) => `- ${c.name}: ${c.value}`),
      '',
      'Fonts:',
      ...s.fonts.map((f) => `- ${f.family} (weights ${f.weights.join(', ')}) — stack: ${f.stack}`),
      '',
      `Type scale: ${t.sizes.join(', ')}`,
    ];
    if (t.radii.length) lines.push(`Border radius: ${t.radii.join(', ')}`);
    if (t.shadows.length) lines.push('Shadows:', ...t.shadows.map((sh) => `- ${sh}`));
    lines.push('', 'CSS variables:', '```css', styleCss(s), '```');
    return lines.join('\n');
  }

  function styleOutput(s, format, stack) {
    switch (format) {
      case 'tailwind':
        return styleTailwind(s);
      case 'prompt':
        return stylePrompt(s, stack);
      default:
        return styleCss(s);
    }
  }

  // ---------- Hotkeys ----------

  const MAC_SYMBOLS = { Command: '⌘', CommandOrControl: '⌘', Control: '⌃', Alt: '⌥', Option: '⌥', Shift: '⇧', Super: '⌘' };
  const WIN_NAMES = { Command: 'Win', Super: 'Win', CommandOrControl: 'Ctrl', Control: 'Ctrl', Alt: 'Alt', Shift: 'Shift' };
  const CODE_KEYS = {
    Space: 'Space', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\',
    Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', ArrowUp: 'Up', ArrowDown: 'Down',
    ArrowLeft: 'Left', ArrowRight: 'Right', Insert: 'Insert', Delete: 'Delete', Home: 'Home', End: 'End',
    PageUp: 'PageUp', PageDown: 'PageDown',
  };

  function prettyHotkey(accel, platform) {
    if (!accel) return '';
    const parts = accel.split('+');
    if (platform === 'darwin') return parts.map((p) => MAC_SYMBOLS[p] || p).join('');
    return parts.map((p) => WIN_NAMES[p] || p).join('+');
  }

  // KeyboardEvent -> Electron accelerator. Returns { accel } or { error } or null while only modifiers are held.
  function eventToAccelerator(e, platform) {
    const mods = [];
    if (e.metaKey) mods.push(platform === 'darwin' ? 'Command' : 'Super');
    if (e.ctrlKey) mods.push('Control');
    if (e.altKey) mods.push('Alt');
    if (e.shiftKey) mods.push('Shift');
    const code = e.code || '';
    let key = null;
    if (/^Key[A-Z]$/.test(code)) key = code.slice(3);
    else if (/^Digit\d$/.test(code)) key = code.slice(5);
    else if (/^F([1-9]|1\d|2[0-4])$/.test(code)) key = code;
    else if (CODE_KEYS[code]) key = CODE_KEYS[code];
    if (!key) return null;
    const isFn = /^F\d+$/.test(key);
    if (!mods.length && !isFn) return { error: 'Add a modifier (⌥ Alt, ⌃ Ctrl, ⇧ Shift, ⌘ Cmd) or use an F-key.' };
    if (mods.length === 1 && mods[0] === 'Shift' && !isFn) return { error: 'Shift alone would block typing. Add another modifier.' };
    return { accel: [...mods, key].join('+') };
  }

  window.LayoutlyFormats = {
    STACKS,
    LLMS,
    componentOutput,
    styleOutput,
    tokens,
    prettyHotkey,
    eventToAccelerator,
  };
})();
