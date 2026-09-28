// The landing page's interactive demo runs the app's real inspector and formatters. GitHub Pages only
// publishes website/, so it ships copies of them; this keeps the copies identical to the app's source.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const COPIES = [
  ['src/inspector/webview-preload.js', 'website/shared/inspector.js'],
  ['src/renderer/formats.js', 'website/shared/formats.js'],
];

for (const [source, copy] of COPIES) {
  test(`${copy} matches ${source}`, () => {
    const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
    assert.equal(read(copy), read(source), 'Out of date: run `npm run sync:website`.');
  });
}
