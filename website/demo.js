// Interactive demo: this very page, loaded in an iframe and inspected with the app's real inspector
// (shared/inspector.js, injected the way the app injects its preload into a <webview>) and its real
// output formatters (shared/formats.js).
(function () {
  const root = document.querySelector('[data-demo]');
  const F = window.LayoutlyFormats;
  if (!root || !F) return;

  const frame = root.querySelector('.demo-frame');

  // The page inside the demo must not load its own demo, or the frames would nest forever.
  if (window.top !== window.self) {
    frame.srcdoc =
      '<p style="margin:0;display:grid;place-items:center;height:100vh;font:14px system-ui,sans-serif;color:#64748b">You are already inspecting this page.</p>';
    return;
  }

  const codeEl = root.querySelector('[data-demo-code]');
  const labelEl = root.querySelector('[data-demo-label]');
  const urlEl = root.querySelector('[data-demo-url]');
  const inspectBtn = root.querySelector('[data-demo-inspect]');
  const formatsEl = root.querySelector('[data-demo-formats]');
  const tabs = root.querySelectorAll('[data-demo-tab]');
  const copyBtn = root.querySelector('[data-demo-copy]');
  const claudeBtn = root.querySelector('[data-demo-claude]');

  const STACK = 'react-tailwind';
  const FORMATS = {
    component: [['prompt', 'AI prompt'], ['html', 'HTML'], ['css', 'CSS']],
    style: [['css', 'CSS variables'], ['tailwind', 'Tailwind'], ['prompt', 'AI prompt']],
  };
  const pageName = location.host + location.pathname.replace(/\/(index\.html)?$/, '');
  const state = { tab: 'component', format: { component: 'prompt', style: 'css' }, component: null, style: null };
  let api = null;
  let inspector = null;

  urlEl.textContent = pageName;

  function output(format = state.format[state.tab]) {
    if (state.tab === 'component') return state.component ? F.componentOutput(state.component, format, STACK) : '';
    return state.style ? F.styleOutput(state.style, format, STACK) : '';
  }

  function render() {
    tabs.forEach((t) => {
      const on = t.dataset.demoTab === state.tab;
      t.classList.toggle('on', on);
      t.setAttribute('aria-selected', String(on));
    });
    formatsEl.replaceChildren(
      ...FORMATS[state.tab].map(([key, name]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = name;
        if (key === state.format[state.tab]) b.className = 'on';
        b.addEventListener('click', () => {
          state.format[state.tab] = key;
          render();
        });
        return b;
      })
    );
    const c = state.component;
    labelEl.textContent =
      state.tab === 'style'
        ? `Site style · ${pageName}`
        : c
          ? `${c.label} · ${Math.round(c.rect.width)} × ${Math.round(c.rect.height)}`
          : 'Hover the page, click any element';
    codeEl.textContent = output();
    codeEl.parentElement.scrollTop = 0;
  }

  function send(channel, payload) {
    if (channel === 'inspector:selected') {
      state.component = payload;
      state.tab = 'component';
      render();
      // The app stops after a pick; the demo keeps inspecting so visitors can try another element.
      inspector.start();
      inspector.hover(frame.contentDocument.querySelector(payload.selector));
    } else if (channel === 'inspector:state') {
      inspectBtn.classList.toggle('on', payload.active);
      inspectBtn.setAttribute('aria-pressed', String(payload.active));
    } else if (channel === 'inspector:error') {
      codeEl.textContent = `Could not extract this element: ${payload.message}`;
    }
  }

  function toggleShortcut(e) {
    if (e.altKey && e.shiftKey && e.code === 'KeyS' && inspector) {
      e.preventDefault();
      inspector.toggle();
    }
  }

  function setup(win) {
    api = win.LayoutlyInspector;
    inspector = api.createInspector(send);
    // Taps don't hover first: point the inspector at the tapped element before it selects.
    win.addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType !== 'mouse') inspector.hover(win.document.elementFromPoint(e.clientX, e.clientY));
      },
      true
    );
    win.addEventListener('keydown', toggleShortcut);
    const first = win.document.querySelector('.hero h1');
    state.component = first ? api.extractComponent(first) : null;
    state.style = null;
    render();
    inspector.start();
    if (first) inspector.hover(first);
  }

  // Runs on every load of the frame, so the inspector comes back if the visitor navigates inside it.
  function attach() {
    let doc;
    try {
      doc = frame.contentDocument;
    } catch {
      return;
    }
    if (!doc || !doc.head || doc.location.href === 'about:blank') return;
    const win = frame.contentWindow;
    if (win.LayoutlyInspector) return setup(win);
    const script = doc.createElement('script');
    script.src = new URL('shared/inspector.js', location.href).href;
    script.onload = () => setup(win);
    doc.head.append(script);
  }

  tabs.forEach((t) =>
    t.addEventListener('click', () => {
      state.tab = t.dataset.demoTab;
      if (state.tab === 'style' && api) state.style = api.extractStyle();
      render();
    })
  );

  inspectBtn.addEventListener('click', () => inspector && inspector.toggle());
  window.addEventListener('keydown', toggleShortcut);
  // Arrow keys (parent / child) and Esc go to the frame while the pointer is over it.
  frame.addEventListener('mouseenter', () => inspector && inspector.isActive() && frame.focus({ preventScroll: true }));

  async function copy(text, button, label) {
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = 'Copied!';
    } catch {
      button.textContent = 'Copy failed';
    }
    setTimeout(() => (button.textContent = label), 1500);
  }

  copyBtn.addEventListener('click', () => copy(output(), copyBtn, 'Copy'));
  claudeBtn.addEventListener('click', () => {
    copy(output('prompt'), claudeBtn, 'Copy & open Claude');
    window.open(F.LLMS.claude.url, '_blank', 'noopener');
  });

  frame.addEventListener('load', attach);
  frame.src = './';
})();
