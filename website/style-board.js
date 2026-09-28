// Site style board: one example brand (acme.com) run through the app's real style formatter
// (shared/formats.js), so the Export tile shows exactly what Layoutly copies.
(function () {
  const board = document.querySelector('[data-board]');
  const F = window.LayoutlyFormats;
  if (!board || !F) return;

  const ACME = {
    host: 'acme.com',
    title: 'Acme',
    background: '#f5f8ff',
    colors: [
      { value: '#0f1324', count: 48, usage: ['text'] },
      { value: '#155dfc', count: 21, usage: ['background', 'border'] },
      { value: '#00bcff', count: 9, usage: ['background'] },
      { value: '#93c5fd', count: 6, usage: ['background'] },
    ],
    fonts: [{ family: 'Instrument Sans', stack: '"Instrument Sans", sans-serif', count: 64, weights: ['400', '500', '600'] }],
    fontSizes: ['56px', '40px', '28px', '18px', '14px'].map((size) => ({ size, count: 1, lineHeight: '1.2', weight: '500' })),
    radii: ['4px', '14px', '32px'].map((value) => ({ value, count: 1 })),
    shadows: ['0 1px 2px rgba(15, 23, 42, 0.12)', '0 8px 20px rgba(15, 23, 42, 0.12)', '0 20px 40px rgba(21, 93, 252, 0.25)'].map((value) => ({ value, count: 1 })),
    variables: [],
  };

  const codeEl = board.querySelector('[data-export-code]');
  const formatBtns = board.querySelectorAll('[data-format]');
  const copyBtn = board.querySelector('[data-export-copy]');
  let format = 'css';

  // One pass over the raw text, so inserted markup is never matched again.
  const TOKEN = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|("[^"\n]*"|'[^'\n]*')|(--[\w-]+)|(#[0-9a-f]{3,8}\b)|(:root\b|module\.exports)/gi;
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  function highlight(code) {
    let out = '';
    let last = 0;
    code.replace(TOKEN, (m, comment, str, prop, hex, keyword, i) => {
      const cls = comment ? 'c' : prop ? 'a' : keyword ? 'p' : 's';
      out += `${esc(code.slice(last, i))}<span class="${cls}">${esc(m)}</span>`;
      last = i + m.length;
      return m;
    });
    return out + esc(code.slice(last));
  }

  const output = () => F.styleOutput(ACME, format, 'react-tailwind');

  function render() {
    formatBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.format === format)));
    codeEl.innerHTML = highlight(output());
    codeEl.parentElement.scrollTop = 0;
  }

  async function copy(text, button) {
    const label = button.querySelector('[data-copy-label]');
    if (!label.dataset.idle) label.dataset.idle = label.textContent;
    clearTimeout(button.copyTimer);
    try {
      await navigator.clipboard.writeText(text);
      label.textContent = 'Copied';
    } catch {
      label.textContent = 'Copy failed';
    }
    button.classList.add('is-copied');
    button.copyTimer = setTimeout(() => {
      label.textContent = label.dataset.idle;
      button.classList.remove('is-copied');
    }, 1400);
  }

  formatBtns.forEach((b) =>
    b.addEventListener('click', () => {
      format = b.dataset.format;
      render();
    })
  );
  copyBtn.addEventListener('click', () => copy(output(), copyBtn));
  board.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => copy(b.dataset.copy, b)));
  render();
})();
