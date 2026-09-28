const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const path = require('path');

const INSPECTOR = fs.readFileSync(path.join(__dirname, '../src/inspector/webview-preload.js'), 'utf8');
const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures/page.html'), 'utf8');

function findChromium(chromium) {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  try {
    const bundled = chromium?.executablePath();
    if (bundled && fs.existsSync(bundled)) return bundled;
  } catch {
    // Playwright's own browser is not installed.
  }
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!fs.existsSync(root)) return null;
  for (const dir of fs.readdirSync(root).filter((d) => /^chromium-\d+/.test(d))) {
    for (const sub of ['chrome-linux', 'chrome-linux64']) {
      const bin = path.join(root, dir, sub, 'chrome');
      if (fs.existsSync(bin)) return bin;
    }
  }
  return null;
}

let chromium;
try {
  ({ chromium } = require('playwright-core'));
} catch {
  chromium = null;
}
const executablePath = findChromium(chromium);
const skip = !chromium || !executablePath ? 'Chromium not available' : false;

let browser, server, page, baseUrl;

before(async () => {
  if (skip) return;
  server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(FIXTURE);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath });
  page = await browser.newPage();
  await page.addInitScript(INSPECTOR);
  await page.goto(`${baseUrl}/`);
});

after(async () => {
  await browser?.close();
  server?.close();
});

test('toHex normalizes colors', { skip }, async () => {
  const out = await page.evaluate(() => [
    LayoutlyInspector.toHex('rgb(124, 92, 255)'),
    LayoutlyInspector.toHex('rgba(0, 0, 0, 0.5)'),
    LayoutlyInspector.toHex('rgba(0, 0, 0, 0)'),
  ]);
  assert.deepEqual(out, ['#7c5cff', '#00000080', null]);
});

test('extracts a component as clean HTML + minimal CSS', { skip }, async () => {
  const c = await page.evaluate(() => LayoutlyInspector.extractComponent(document.getElementById('card')));
  // HTML: generated classes, no scripts, handlers, data attributes or hidden nodes, absolute URLs.
  assert.match(c.html, /^<div class="div-1">/);
  assert.match(c.html, /<h2 class="h2-1">Ship faster<\/h2>/);
  assert.match(c.html, new RegExp(`href="${baseUrl}/pricing"`));
  assert.match(c.html, new RegExp(`src="${baseUrl}/logo.png"`));
  assert.match(c.html, /<svg[^>]*viewBox="0 0 24 24"/);
  assert.doesNotMatch(c.html, /script|onclick|data-track|secret|id="card"/);

  // CSS: computed values, resolved variables, pseudo-elements and hover.
  assert.match(c.css, /\.div-1 \{[^}]*display: flex;/);
  assert.match(c.css, /\.div-1 \{[^}]*border-radius: 12px;/);
  assert.match(c.css, /\.div-1 \{[^}]*background-color: #1e293b;/);
  assert.match(c.css, /\.div-1 \{[^}]*font-family: Inter, Arial, sans-serif;/);
  assert.match(c.css, /\.div-1 \{[^}]*original size/);
  assert.doesNotMatch(c.css, /\.div-1 \{[^}]*margin-/);
  assert.match(c.css, /\.h2-1 \{[^}]*font-size: 28px;/);
  assert.match(c.css, /\.h2-1 \{[^}]*color: #ffffff;/);
  assert.match(c.css, /\.a-1::before \{\s*content: "→";/);
  assert.match(c.css, /.a-1:hover \{[^}]*background: #7c5cff;[^}]*opacity: 0.9;/);
  // Inherited values equal to the parent's are not repeated.
  assert.doesNotMatch(c.css, /\.strong-1 \{[^}]*font-family/);

  assert.equal(c.truncated, false);
  assert.deepEqual(c.fonts, ['Inter']);
  assert.ok(c.colors.includes('#1e293b'));
  assert.equal(c.label, 'div#card.card');
  assert.match(c.id, /\|section:nth-of-type\(1\) > div#card|\|div#card/);
});

test('extracts the site design style', { skip }, async () => {
  const s = await page.evaluate(() => LayoutlyInspector.extractStyle());
  const colors = s.colors.map((c) => c.value);
  assert.equal(s.background, '#0f172a');
  for (const c of ['#0f172a', '#1e293b', '#ffffff', '#94a3b8', '#7c5cff']) assert.ok(colors.includes(c), `missing ${c}`);
  assert.equal(s.fonts[0].family, 'Inter');
  assert.ok(s.fontSizes.some((f) => f.size === '28px'));
  assert.ok(s.radii.some((r) => r.value === '12px'));
  assert.equal(s.shadows.length, 1);
  assert.deepEqual(s.variables, [
    { name: '--brand', value: '#7c5cff' },
    { name: '--radius', value: '12px' },
  ]);
});

test('overlay highlights, navigates and selects like Chrome Inspect', { skip }, async () => {
  const events = await page.evaluate(async () => {
    const log = [];
    const inspector = LayoutlyInspector.createInspector((channel, payload) => log.push([channel, payload]));
    inspector.start();
    const hasOverlay = Boolean(document.getElementById('layoutly-inspector-overlay'));
    inspector.hover(document.querySelector('.card h2'));
    // ↑ selects the parent, like Chrome's element picker.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    // A page click while inspecting must not reach the page.
    let pageSawClick = false;
    document.querySelector('.btn').addEventListener('click', () => (pageSawClick = true));
    window.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    // The selection is sent two animation frames later; slow CI machines need more than a fixed delay.
    for (let t = 0; t < 2000 && !log.some(([c]) => c === 'inspector:selected'); t += 20) {
      await new Promise((r) => setTimeout(r, 20));
    }
    return {
      hasOverlay,
      overlayGone: !document.getElementById('layoutly-inspector-overlay'),
      pageSawClick,
      channels: log.map(([c]) => c),
      selected: log.find(([c]) => c === 'inspector:selected')?.[1]?.label,
    };
  });
  assert.equal(events.hasOverlay, true);
  assert.equal(events.overlayGone, true);
  assert.equal(events.pageSawClick, false);
  assert.deepEqual(events.channels, ['inspector:state', 'inspector:state', 'inspector:selected']);
  assert.equal(events.selected, 'div#card.card');
});

test('css is compact: shorthands, no noise', { skip }, async () => {
  const c = await page.evaluate(() => LayoutlyInspector.extractComponent(document.getElementById('card')));
  if (process.env.SHOW) console.log(c.html + '\n\n' + c.css);
  assert.match(c.css, /\.div-1 \{[^}]*padding: 24px;[^}]*gap: 16px;/);
  assert.match(c.css, /\.a-1 \{[^}]*padding: 10px 18px;/);
  assert.doesNotMatch(c.css, /min-width: auto|pointer-events|aspect-ratio: auto/);
});
