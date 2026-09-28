(function () {
  'use strict';

  const F = window.LayoutlyFormats;
  const api = window.layoutly;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const view = $('#view');
  const ui = {
    url: $('#url'),
    urlForm: $('#url-form'),
    progress: $('#progress'),
    start: $('#start'),
    inspectBtn: $('#inspect-btn'),
    styleBtn: $('#style-btn'),
    planPill: $('#plan-pill'),
    sidebar: $('#sidebar'),
    componentPanel: $('#panel-component'),
    stylePanel: $('#panel-style'),
    toast: $('#toast'),
  };

  let state = null;
  let pageReady = false;
  let inspecting = false;
  let activeTab = 'component';
  let component = null; // last extracted component (+ screenshot)
  let componentFormat = 'prompt';
  let styleFormat = 'css';
  let pendingStyle = false;
  const styles = new Map(); // host -> extracted style
  const unlockedStyles = new Set(); // hosts whose style credit was consumed

  document.body.classList.add(`platform-${api.platform}`);

  // ---------- Small helpers ----------

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) node.append(c.nodeType ? c : String(c));
    return node;
  }

  function append(parent, ...children) {
    parent.append(...children.filter(Boolean));
  }

  let toastTimer = 0;
  function toast(message) {
    ui.toast.textContent = message;
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 2200);
  }

  async function copy(text, message = 'Copied to clipboard') {
    await api.copyText(text);
    toast(message);
  }

  function currentHost() {
    try {
      return new URL(view.getURL()).hostname;
    } catch {
      return '';
    }
  }

  function normalizeUrl(input) {
    const value = input.trim();
    if (!value) return null;
    if (/^https?:\/\//i.test(value)) return value;
    if (/\s/.test(value) || !/\.[a-z]{2,}/i.test(value)) return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
    return `https://${value}`;
  }

  function llm() {
    return F.LLMS[state.llm] || F.LLMS.chatgpt;
  }

  // ---------- State ----------

  function applyState(next) {
    state = next;
    const pretty = F.prettyHotkey(state.hotkey, api.platform);
    $('#hotkey-badge').textContent = pretty;
    $$('.hotkey-label').forEach((n) => (n.textContent = pretty));

    if (state.community) {
      ui.planPill.textContent = 'Open source';
      ui.planPill.className = 'pill pro';
      ui.planPill.title = 'Built from source — everything unlocked';
    } else if (state.licensed) {
      ui.planPill.textContent = 'Lifetime';
      ui.planPill.className = 'pill pro';
      ui.planPill.title = 'Lifetime license active';
    } else {
      const f = state.free;
      ui.planPill.textContent = `Free today · ${f.componentsLeft}/${f.components} components · ${f.stylesLeft}/${f.styles} styles`;
      ui.planPill.className = f.componentsLeft + f.stylesLeft === 0 ? 'pill empty' : 'pill';
      ui.planPill.title = `Resets every day. Unlimited for ${state.price} once.`;
    }
    const last = $('#continue-last');
    if (state.lastUrl) {
      last.hidden = false;
      last.textContent = `Continue on ${state.lastUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')} →`;
    }
  }

  async function refreshState() {
    applyState(await api.getState());
  }

  // "in 5 h" / "in 40 min": when today's free copies come back (local midnight).
  function resetsIn() {
    const min = Math.max(1, Math.round((state.free.resetsAt - Date.now()) / 60000));
    return min >= 60 ? `in ${Math.round(min / 60)} h` : `in ${min} min`;
  }

  // The free copies reset at midnight, so re-read them whenever the window comes back.
  window.addEventListener('focus', refreshState);

  // ---------- Browser ----------

  function navigate(input) {
    const url = normalizeUrl(input);
    if (!url) return;
    ui.start.hidden = true;
    view.loadURL(url).catch(() => {});
  }

  ui.urlForm.addEventListener('submit', (e) => {
    e.preventDefault();
    navigate(ui.url.value);
    view.focus();
  });
  $('#start-form').addEventListener('submit', (e) => {
    e.preventDefault();
    navigate($('#start-url').value);
  });
  $$('#quick-sites button').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.url)));
  $('#continue-last').addEventListener('click', () => navigate(state.lastUrl));
  ui.url.addEventListener('focus', () => ui.url.select());

  $('#back').addEventListener('click', () => view.canGoBack() && view.goBack());
  $('#forward').addEventListener('click', () => view.canGoForward() && view.goForward());
  $('#reload').addEventListener('click', () => pageReady && view.reload());

  function onNavigated(e) {
    if (!e.url || e.url === 'about:blank') return;
    if (document.activeElement !== ui.url) ui.url.value = e.url;
    ui.start.hidden = true;
    api.saveSettings({ lastUrl: e.url });
    $('#back').disabled = !view.canGoBack();
    $('#forward').disabled = !view.canGoForward();
  }

  view.addEventListener('did-navigate', (e) => {
    onNavigated(e);
    setInspecting(false);
    hideBoard();
    if (activeTab === 'style') renderStyle();
  });
  view.addEventListener('did-navigate-in-page', (e) => e.isMainFrame && onNavigated(e));
  view.addEventListener('did-start-loading', () => ui.progress.classList.add('loading'));
  view.addEventListener('did-stop-loading', () => ui.progress.classList.remove('loading'));
  view.addEventListener('dom-ready', () => {
    pageReady = view.getURL() !== 'about:blank';
  });
  view.addEventListener('did-fail-load', (e) => {
    if (e.isMainFrame && e.errorCode !== -3) toast(`Could not open the page (${e.errorDescription || e.errorCode})`);
  });

  // ---------- Inspector ----------

  function requirePage() {
    if (pageReady) return true;
    toast('Open a website first');
    ($('#start-url').offsetParent ? $('#start-url') : ui.url).focus();
    return false;
  }

  function setInspecting(active) {
    inspecting = active;
    ui.inspectBtn.classList.toggle('active', active);
    document.body.classList.toggle('inspecting', active);
    if (active && !component) renderComponent();
  }

  function toggleInspector() {
    if (!requirePage() || !$('#onboarding').hidden) return;
    if (!inspecting) {
      hideBoard();
      openSidebar('component');
      view.focus();
    }
    view.send('inspector:toggle');
  }

  ui.inspectBtn.addEventListener('click', toggleInspector);
  api.onHotkey(toggleInspector);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (inspecting) view.send('inspector:stop');
      closeModals();
    }
  });

  view.addEventListener('ipc-message', async (e) => {
    const [payload] = e.args;
    switch (e.channel) {
      case 'inspector:state':
        setInspecting(Boolean(payload?.active));
        break;
      case 'inspector:selected':
        await onComponent(payload);
        break;
      case 'inspector:style':
        await onStyle(payload);
        break;
      case 'inspector:error':
        pendingStyle = false;
        toast(`Could not read this element: ${payload?.message || 'unknown error'}`);
        break;
    }
  });

  async function onComponent(payload) {
    const res = await api.consume('components', payload.id);
    applyState(res.state);
    if (!res.ok) {
      showPaywall('components');
      return;
    }
    const vp = payload.viewport;
    const r = payload.rect;
    const x = Math.max(0, r.x);
    const y = Math.max(0, r.y);
    const rect = { x, y, width: Math.min(r.width - (x - r.x), vp.width - x), height: Math.min(r.height - (y - r.y), vp.height - y) };
    const screenshot = await api.capture(view.getWebContentsId(), rect).catch(() => null);
    component = { ...payload, screenshot };
    openSidebar('component');
  }

  // ---------- Sidebar ----------

  function openSidebar(tab) {
    ui.sidebar.hidden = false;
    document.body.classList.add('with-sidebar');
    selectTab(tab);
  }

  function closeSidebar() {
    hideBoard();
    ui.sidebar.hidden = true;
    document.body.classList.remove('with-sidebar');
    if (inspecting) view.send('inspector:stop');
  }

  function selectTab(tab) {
    activeTab = tab;
    $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    ui.componentPanel.hidden = tab !== 'component';
    ui.stylePanel.hidden = tab !== 'style';
    if (tab === 'component') renderComponent();
    else renderStyle();
  }

  $$('.tab').forEach((t) => t.addEventListener('click', () => selectTab(t.dataset.tab)));
  $('#close-sidebar').addEventListener('click', closeSidebar);
  ui.styleBtn.addEventListener('click', () => {
    if (!requirePage()) return;
    if (!ui.sidebar.hidden && activeTab === 'style') closeSidebar();
    else openSidebar('style');
  });

  function segmented(options, value, onChange) {
    return el(
      'div',
      { class: 'segmented', role: 'tablist' },
      options.map(([key, label]) =>
        el('button', { class: key === value ? 'active' : '', onclick: () => onChange(key) }, label),
      ),
    );
  }

  function codeBlock(text) {
    return el('pre', { class: 'code' }, el('code', {}, text));
  }

  function copyActions(text, what) {
    const target = llm();
    return el(
      'div',
      { class: 'actions' },
      el('button', { class: 'btn btn-primary', onclick: () => copy(text, `${what} copied`) }, 'Copy'),
      target.url &&
        el(
          'button',
          {
            class: 'btn btn-ghost',
            onclick: async () => {
              await copy(text, `Copied — paste it in ${target.name}`);
              api.openExternal(target.url);
            },
          },
          `Copy & open ${target.name}`,
        ),
    );
  }

  // Lucide paths for the empty states (drawn icons, not glyphs).
  const ICONS = {
    pick: '<path d="M12.034 12.681a.498.498 0 0 1 .647-.647l9 3.5a.5.5 0 0 1-.033.943l-3.444 1.068a1 1 0 0 0-.66.66l-1.067 3.443a.5.5 0 0 1-.943.033z"/><path d="M5 3a2 2 0 0 0-2 2"/><path d="M19 3a2 2 0 0 1 2 2"/><path d="M5 21a2 2 0 0 1-2-2"/><path d="M9 3h1"/><path d="M9 21h2"/><path d="M14 3h1"/><path d="M3 9v1"/><path d="M21 9v2"/><path d="M3 14v1"/>',
    palette: '<path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/>',
  };

  function svgIcon(name) {
    const t = document.createElement('template');
    t.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
    return t.content.firstChild;
  }

  function emptyState(icon, title, text, action) {
    return el('div', { class: 'empty' }, el('div', { class: 'empty-icon' }, svgIcon(icon)), el('h3', {}, title), el('p', {}, text), action || null);
  }

  function renderComponent() {
    const panel = ui.componentPanel;
    panel.replaceChildren();

    if (!component) {
      panel.append(
        emptyState(
          'pick',
          inspecting ? 'Hover any element' : 'Pick a component',
          inspecting
            ? 'Click to copy it. Use ↑ / ↓ to select the parent or child, Esc to exit.'
            : `Press ${F.prettyHotkey(state.hotkey, api.platform)} on any page, then click the part you want.`,
          inspecting ? null : el('button', { class: 'btn btn-primary', onclick: toggleInspector }, 'Start inspecting'),
        ),
      );
      return;
    }

    const c = component;
    const output = F.componentOutput(c, componentFormat, state.stack);
    append(panel,
      el(
        'div',
        { class: 'result-head' },
        el('div', {}, el('div', { class: 'result-title mono' }, c.label), el('div', { class: 'muted small' }, `${c.host} · ${c.nodeCount} elements`)),
        el('button', { class: 'btn btn-ghost btn-sm', onclick: toggleInspector }, 'Pick another'),
      ),
      c.truncated ? el('p', { class: 'warning' }, 'Large component: the markup was truncated to the first 400 elements.') : null,
      c.screenshot
        ? el(
            'button',
            {
              class: 'shot',
              title: 'Copy screenshot — attach it to your AI chat for even better results',
              onclick: async () => {
                await api.copyImage(c.screenshot);
                toast('Screenshot copied');
              },
            },
            el('img', { src: c.screenshot, alt: 'Component screenshot' }),
            el('span', {}, 'Copy image'),
          )
        : null,
      segmented(
        [
          ['prompt', 'AI prompt'],
          ['html', 'HTML'],
          ['css', 'CSS'],
          ['file', 'HTML file'],
        ],
        componentFormat,
        (f) => {
          componentFormat = f;
          renderComponent();
        },
      ),
      componentFormat === 'prompt' ? el('p', { class: 'muted small' }, `Prompt tailored for ${F.STACKS[state.stack]}.`) : null,
      codeBlock(output),
      copyActions(output, componentFormat === 'prompt' ? 'Prompt' : 'Code'),
      c.colors.length || c.fonts.length
        ? el(
            'div',
            { class: 'meta' },
            c.fonts.length ? el('div', { class: 'meta-row' }, el('span', { class: 'muted small' }, 'Fonts'), c.fonts.map((f) => el('span', { class: 'tag' }, f))) : null,
            c.colors.length
              ? el(
                  'div',
                  { class: 'meta-row' },
                  el('span', { class: 'muted small' }, 'Colors'),
                  c.colors.map((col) => el('button', { class: 'swatch-sm', title: col, style: { background: col }, onclick: () => copy(col, `${col} copied`) })),
                )
              : null,
          )
        : null,
    );
  }

  // ---------- Style ----------

  const board = $('#style-board');
  const boardRoot = $('#style-board-root');

  function showBoard(s) {
    if (!window.LayoutlyUI || !s) return;
    $('#board-title').textContent = `${s.host} — style`;
    board.hidden = false;
    window.LayoutlyUI.renderStyleBoard(boardRoot, {
      style: s,
      tokens: F.tokens(s),
      onCopy: (value, label) => copy(value, `${label === value ? value : label} copied`),
    });
    syncBoardButton();
  }

  function hideBoard() {
    board.hidden = true;
    syncBoardButton();
  }

  function syncBoardButton() {
    if (activeTab === 'style' && !ui.sidebar.hidden) renderStyle();
  }

  $('#close-board').addEventListener('click', hideBoard);

  function extractStyle() {
    if (!requirePage() || pendingStyle) return;
    pendingStyle = true;
    renderStyle();
    view.send('inspector:extract-style');
  }

  async function onStyle(payload) {
    pendingStyle = false;
    if (!unlockedStyles.has(payload.host)) {
      const res = await api.consume('styles', payload.host);
      applyState(res.state);
      if (!res.ok) {
        renderStyle();
        showPaywall('styles');
        return;
      }
      unlockedStyles.add(payload.host);
    }
    styles.set(payload.host, payload);
    openSidebar('style');
    showBoard(payload);
  }

  function section(title, ...children) {
    return el('section', { class: 'style-section' }, el('h4', {}, title), ...children);
  }

  function renderStyle() {
    const panel = ui.stylePanel;
    panel.replaceChildren();
    const host = currentHost();
    const s = styles.get(host);

    if (!s) {
      const credits = state.community
        ? 'Unlimited in the open-source build.'
        : state.licensed
          ? 'Unlimited with your lifetime license.'
          : `Uses 1 of today's ${state.free.stylesLeft} free style extractions.`;
      panel.append(
        emptyState(
          'palette',
          host ? `Extract ${host}'s style` : 'Open a website',
          host ? `Colors, fonts, type scale, radii and shadows — as CSS variables, Tailwind config or an AI prompt. ${credits}` : 'Then grab its whole design system in one click.',
          host ? el('button', { class: 'btn btn-primary', disabled: pendingStyle, onclick: extractStyle }, pendingStyle ? 'Reading styles…' : 'Extract style') : null,
        ),
      );
      return;
    }

    const t = F.tokens(s);
    const output = F.styleOutput(s, styleFormat, state.stack);
    append(panel,
      el(
        'div',
        { class: 'result-head' },
        el('div', {}, el('div', { class: 'result-title' }, s.host), el('div', { class: 'muted small' }, s.title || 'Design style')),
        el(
          'div',
          { class: 'actions' },
          el('button', { class: 'btn btn-primary btn-sm', onclick: () => (board.hidden ? showBoard(s) : hideBoard()) }, board.hidden ? 'Style board' : 'Hide board'),
          el('button', { class: 'btn btn-ghost btn-sm', onclick: extractStyle }, 'Refresh'),
        ),
      ),
      section(
        'Colors',
        el(
          'div',
          { class: 'swatches' },
          t.colors.map((c) =>
            el(
              'button',
              { class: 'swatch', title: `Copy ${c.value}`, onclick: () => copy(c.value, `${c.value} copied`) },
              el('span', { class: 'chip', style: { background: c.value } }),
              el('span', { class: 'swatch-name' }, c.name),
              el('span', { class: 'swatch-value mono' }, c.value),
            ),
          ),
        ),
      ),
      section(
        'Fonts',
        s.fonts.map((f) =>
          el(
            'button',
            { class: 'font-row', title: 'Copy font stack', onclick: () => copy(f.stack, 'Font stack copied') },
            el('span', { class: 'font-sample', style: { fontFamily: f.stack } }, 'Aa'),
            el('span', { class: 'font-info' }, el('strong', {}, f.family), el('span', { class: 'muted small' }, `Weights ${f.weights.join(' · ')}`)),
          ),
        ),
      ),
      section(
        'Type scale',
        el(
          'div',
          { class: 'scale' },
          s.fontSizes.map((f) => el('div', { class: 'scale-row' }, el('span', { class: 'mono' }, f.size), el('span', { class: 'muted small' }, `line-height ${f.lineHeight} · ${f.weight}`))),
        ),
      ),
      t.radii.length || t.shadows.length
        ? section(
            'Radius & shadows',
            el(
              'div',
              { class: 'shapes' },
              t.radii.map((r) => el('div', { class: 'shape', style: { borderRadius: r }, title: r }, el('span', { class: 'mono' }, r))),
              t.shadows.map((sh, i) => el('div', { class: 'shape shadow', style: { boxShadow: sh }, title: sh }, el('span', { class: 'mono' }, `shadow ${i + 1}`))),
            ),
          )
        : null,
      section(
        'Export',
        segmented(
          [
            ['css', 'CSS variables'],
            ['tailwind', 'Tailwind'],
            ['prompt', 'AI prompt'],
          ],
          styleFormat,
          (f) => {
            styleFormat = f;
            renderStyle();
          },
        ),
        codeBlock(output),
        copyActions(output, 'Style'),
      ),
    );
  }

  // ---------- Modals ----------

  function openModal(id) {
    $(`#${id}`).hidden = false;
  }

  function closeModals() {
    for (const id of ['paywall', 'settings']) $(`#${id}`).hidden = true;
    stopRecording();
  }

  $$('[data-close]').forEach((b) => b.addEventListener('click', closeModals));
  $$('.modal-backdrop').forEach((m) =>
    m.addEventListener('mousedown', (e) => {
      if (e.target === m && m.id !== 'onboarding') closeModals();
    }),
  );

  function showPaywall(reason) {
    const f = state.free;
    const title = $('#paywall-title');
    const text = $('#paywall-text');
    if (reason === 'components') {
      title.textContent = "Today's free components are used";
      text.textContent = `You get ${f.components} free components every day — the next ones arrive ${resetsIn()}. Or unlock unlimited copies for a one-time ${state.price}.`;
    } else if (reason === 'styles') {
      title.textContent = "Today's free style extractions are used";
      text.textContent = `You get ${f.styles} free site styles every day — the next ones arrive ${resetsIn()}. Or unlock unlimited for a one-time ${state.price}.`;
    } else if (state.community) {
      title.textContent = 'Open-source build';
      text.textContent = `You built Layoutly from source, so everything is unlocked — no limits, no key. If it saves you time, a ${state.price} lifetime license supports development.`;
    } else {
      title.textContent = state.licensed ? 'Lifetime license active' : 'Unlock Layoutly forever';
      text.textContent = state.licensed
        ? 'Thank you for supporting Layoutly! Everything is unlocked on this device.'
        : `${f.componentsLeft} of ${f.components} free components and ${f.stylesLeft} of ${f.styles} site styles left today. Pay once for unlimited, forever.`;
    }
    $('#paywall-price').textContent = state.price;
    $('#license-error').hidden = true;
    $('#license-form').hidden = state.licensed;
    $('.price-box').hidden = state.licensed;
    $('#support-btn').hidden = !state.community;
    $('#support-btn').textContent = `Support Layoutly · ${state.price}`;
    openModal('paywall');
  }

  ui.planPill.addEventListener('click', () => showPaywall());
  $('#buy-btn').addEventListener('click', () => api.openExternal(state.checkoutUrl));
  $('#support-btn').addEventListener('click', () => api.openExternal(state.checkoutUrl));

  $('#license-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#activate-btn');
    const err = $('#license-error');
    btn.disabled = true;
    btn.textContent = 'Checking…';
    err.hidden = true;
    const res = await api.activateLicense($('#license-key').value);
    btn.disabled = false;
    btn.textContent = 'Activate';
    if (!res.ok) {
      err.textContent = res.error;
      err.hidden = false;
      return;
    }
    applyState(res.state);
    $('#license-key').value = '';
    closeModals();
    if (!state.onboarded) await finishOnboarding();
    toast('License activated — enjoy unlimited Layoutly!');
  });

  // ---------- Hotkey recording ----------

  let recording = null; // { button, hint, onAccel }

  function startRecording(button, hint, onAccel) {
    stopRecording();
    recording = { button, hint, onAccel };
    button.classList.add('recording');
    button.textContent = 'Press keys…';
    api.suspendHotkey(true);
  }

  function stopRecording() {
    if (!recording) return;
    recording.button.classList.remove('recording');
    recording = null;
    api.suspendHotkey(false);
  }

  window.addEventListener(
    'keydown',
    async (e) => {
      if (!recording) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        const r = recording;
        stopRecording();
        r.onAccel(null);
        return;
      }
      const result = F.eventToAccelerator(e, api.platform);
      if (!result) return;
      const r = recording;
      if (result.error) {
        r.hint.textContent = result.error;
        r.hint.classList.add('error');
        r.hint.hidden = false;
        return;
      }
      stopRecording();
      const { ok } = await api.validateHotkey(result.accel);
      if (!ok) {
        r.hint.textContent = 'That shortcut is taken by your system or another app. Try another one.';
        r.hint.classList.add('error');
        r.hint.hidden = false;
        r.onAccel(null);
        return;
      }
      r.hint.classList.remove('error');
      r.onAccel(result.accel);
    },
    true,
  );

  // ---------- Onboarding ----------

  let step = 0;
  let draft = {};

  function showStep(n) {
    stopRecording();
    step = n;
    $$('#onboarding .step').forEach((s) => (s.hidden = Number(s.dataset.step) !== n));
    $$('#onboarding .steps-dots span').forEach((d, i) => d.classList.toggle('active', i <= n));
  }

  function choiceGrid(container, options, current, onPick) {
    container.replaceChildren(
      ...Object.entries(options).map(([key, label]) => {
        const button = el('button', { class: `choice${key === current ? ' active' : ''}`, type: 'button' }, label);
        button.addEventListener('click', () => {
          onPick(key);
          $$('.choice', container).forEach((c) => c.classList.toggle('active', c === button));
        });
        return button;
      }),
    );
  }

  function renderRecorder() {
    $('#hotkey-recorder').textContent = F.prettyHotkey(draft.hotkey, api.platform);
  }

  function startOnboarding() {
    draft = { hotkey: state.hotkey, stack: state.stack, llm: state.llm };
    renderRecorder();
    $('#hotkey-hint').textContent = 'Click the box, then press your keys.';
    $('#hotkey-hint').classList.remove('error');
    choiceGrid($('#stack-choices'), F.STACKS, draft.stack, (k) => (draft.stack = k));
    choiceGrid(
      $('#llm-choices'),
      Object.fromEntries(Object.entries(F.LLMS).map(([k, v]) => [k, v.name])),
      draft.llm,
      (k) => (draft.llm = k),
    );
    $('#free-title').textContent = state.community ? 'Open-source build' : 'Free every day';
    $('#free-copy').textContent = state.community
      ? 'Everything is unlocked — no limits, no key.'
      : `${state.free.components} components + ${state.free.styles} site styles a day, free. Unlimited for ${state.price} once.`;
    $('#onboarding-price').textContent = `${state.price} lifetime`;
    $('#onboarding-price').hidden = state.community;
    $('#onboarding-finish').textContent = state.licensed ? 'Start using Layoutly' : 'Start for free';
    $('#onboarding-license').hidden = state.licensed;
    showStep(0);
    $('#onboarding').hidden = false;
  }

  async function finishOnboarding() {
    const res = await api.saveSettings({ ...draft, onboarded: true });
    if (!res.ok) {
      showStep(1);
      $('#hotkey-hint').textContent = res.error;
      $('#hotkey-hint').classList.add('error');
      return;
    }
    applyState(res.state);
    $('#onboarding').hidden = true;
    $('#start-url').focus();
  }

  $$('#onboarding [data-next]').forEach((b) => b.addEventListener('click', () => showStep(step + 1)));
  $$('#onboarding [data-prev]').forEach((b) => b.addEventListener('click', () => showStep(step - 1)));
  $('#hotkey-recorder').addEventListener('click', () =>
    startRecording($('#hotkey-recorder'), $('#hotkey-hint'), (accel) => {
      if (accel) {
        draft.hotkey = accel;
        $('#hotkey-hint').textContent = 'Nice! You can change it later in Settings.';
      }
      renderRecorder();
    }),
  );
  $('#onboarding-finish').addEventListener('click', finishOnboarding);
  $('#onboarding-license').addEventListener('click', async () => {
    await api.saveSettings({ hotkey: draft.hotkey, stack: draft.stack, llm: draft.llm });
    showPaywall();
  });

  // ---------- Settings ----------

  function fillSelect(select, options, value) {
    select.replaceChildren(...Object.entries(options).map(([k, label]) => el('option', { value: k, selected: k === value }, label)));
  }

  function renderSettings() {
    $('#settings-hotkey').textContent = F.prettyHotkey(state.hotkey, api.platform);
    $('#settings-hotkey-hint').hidden = true;
    fillSelect($('#settings-stack'), F.STACKS, state.stack);
    fillSelect($('#settings-llm'), Object.fromEntries(Object.entries(F.LLMS).map(([k, v]) => [k, v.name])), state.llm);
    $('#settings-license-text').textContent = state.community
      ? 'Open-source build · no limits'
      : state.licensed
        ? `Lifetime · ${state.licenseKey}`
        : `Free · ${state.free.componentsLeft} components, ${state.free.stylesLeft} styles left today`;
    const btn = $('#settings-license-btn');
    btn.textContent = state.community ? `Support · ${state.price}` : state.licensed ? 'Deactivate device' : `Unlock for ${state.price}`;
    $('#settings-version').textContent = `Layoutly v${state.version}${state.community ? ' · open source' : ''}`;
  }

  $('#settings-btn').addEventListener('click', () => {
    renderSettings();
    openModal('settings');
  });

  $('#settings-hotkey').addEventListener('click', () =>
    startRecording($('#settings-hotkey'), $('#settings-hotkey-hint'), async (accel) => {
      if (accel) {
        const res = await api.saveSettings({ hotkey: accel });
        if (res.ok) {
          applyState(res.state);
          toast(`Inspect key set to ${F.prettyHotkey(accel, api.platform)}`);
        }
      }
      $('#settings-hotkey').textContent = F.prettyHotkey(state.hotkey, api.platform);
    }),
  );

  $('#settings-stack').addEventListener('change', async (e) => applyState((await api.saveSettings({ stack: e.target.value })).state));
  $('#settings-llm').addEventListener('change', async (e) => applyState((await api.saveSettings({ llm: e.target.value })).state));

  $('#settings-license-btn').addEventListener('click', async () => {
    if (state.community) {
      api.openExternal(state.checkoutUrl);
      return;
    }
    if (!state.licensed) {
      closeModals();
      showPaywall();
      return;
    }
    if (!confirm('Deactivate Layoutly on this device? You can activate the same key again later.')) return;
    const res = await api.deactivateLicense();
    if (!res.ok) {
      toast(res.error);
      return;
    }
    applyState(res.state);
    renderSettings();
    toast('Device deactivated');
  });

  $('#contact-email').addEventListener('click', () => api.openExternal(`mailto:${state.supportEmail}`));
  $('#contact-x').addEventListener('click', () => api.openExternal(state.xUrl));

  $('#replay-onboarding').addEventListener('click', () => {
    closeModals();
    startOnboarding();
  });

  api.onStateChanged((next) => {
    applyState(next);
    if (!next.licensed) toast('Your license could not be verified and was removed.');
  });

  // ---------- Boot ----------

  (async function boot() {
    await refreshState();
    renderComponent();
    if (!state.onboarded) startOnboarding();
    else $('#start-url').focus();
  })();
})();
