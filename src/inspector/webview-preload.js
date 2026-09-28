/*
 * Layoutly inspector.
 *
 * Loaded as the preload of every page opened in Layoutly's built-in browser. It runs in an isolated
 * world (the page cannot see or call it) but shares the DOM, so it can draw a Chrome-style
 * "Inspect" overlay and read computed styles. Results go back to the app via ipcRenderer.sendToHost.
 *
 * The file is self-contained on purpose: sandboxed preloads cannot require local files. When loaded
 * outside Electron (the tests), it exposes its functions on `globalThis.LayoutlyInspector` instead.
 */
(function () {
  'use strict';

  const OVERLAY_ID = 'layoutly-inspector-overlay';
  const MAX_NODES = 400;
  const MAX_STYLE_SCAN = 4000;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'LINK', 'META', 'BASE', 'HEAD', 'TITLE']);
  const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
  const REPLACED_TAGS = new Set(['IMG', 'VIDEO', 'CANVAS', 'IFRAME', 'INPUT', 'TEXTAREA', 'SELECT', 'svg', 'SVG', 'PROGRESS', 'METER', 'EMBED', 'OBJECT']);
  const KEEP_ATTRS = new Set([
    'href', 'src', 'srcset', 'sizes', 'alt', 'title', 'type', 'name', 'value', 'placeholder', 'for', 'role',
    'target', 'rel', 'width', 'height', 'loading', 'colspan', 'rowspan', 'disabled', 'checked', 'selected',
    'readonly', 'required', 'min', 'max', 'step', 'poster', 'controls', 'muted', 'autoplay', 'loop',
    'playsinline', 'datetime', 'open', 'tabindex', 'media', 'label', 'multiple', 'rows', 'cols', 'maxlength',
  ]);
  const URL_ATTRS = new Set(['href', 'src', 'poster']);

  const PROPS = [
    'display', 'position', 'top', 'right', 'bottom', 'left', 'z-index', 'float', 'clear', 'box-sizing',
    'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'aspect-ratio',
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-content', 'align-self',
    'justify-items', 'justify-self', 'flex-grow', 'flex-shrink', 'flex-basis', 'order', 'row-gap', 'column-gap',
    'grid-template-columns', 'grid-template-rows', 'grid-auto-flow', 'grid-auto-columns', 'grid-auto-rows',
    'grid-column-start', 'grid-column-end', 'grid-row-start', 'grid-row-end',
    'overflow-x', 'overflow-y', 'object-fit', 'object-position',
    'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing',
    'word-spacing', 'text-align', 'text-indent', 'text-transform', 'text-decoration-line',
    'text-decoration-color', 'text-decoration-style', 'text-decoration-thickness', 'text-underline-offset',
    'text-overflow', 'white-space', 'word-break', 'overflow-wrap', 'text-shadow', 'vertical-align',
    'list-style-type', 'list-style-position', '-webkit-line-clamp', '-webkit-box-orient', '-webkit-text-fill-color',
    'background-color', 'background-image', 'background-size', 'background-position', 'background-repeat',
    'background-clip', 'background-attachment',
    'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
    'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
    'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
    'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
    'outline-width', 'outline-style', 'outline-color', 'outline-offset',
    'box-shadow', 'opacity', 'transform', 'transform-origin', 'transition', 'filter', 'backdrop-filter',
    'mix-blend-mode', 'isolation', 'clip-path', 'cursor', 'pointer-events', 'user-select', 'visibility',
    'fill', 'stroke', 'stroke-width',
  ];

  const INHERITED = new Set([
    'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing',
    'word-spacing', 'text-align', 'text-indent', 'text-transform', 'white-space', 'word-break', 'overflow-wrap',
    'text-shadow', 'list-style-type', 'list-style-position', 'cursor', 'pointer-events', 'visibility',
    'fill', 'stroke', 'stroke-width', '-webkit-text-fill-color',
  ]);

  // Properties that default to `currentColor`: only worth emitting when they differ from `color`.
  const CURRENT_COLOR_PROPS = {
    'border-top-color': 'border-top-style',
    'border-right-color': 'border-right-style',
    'border-bottom-color': 'border-bottom-style',
    'border-left-color': 'border-left-style',
    'outline-color': 'outline-style',
    'text-decoration-color': 'text-decoration-line',
    '-webkit-text-fill-color': null,
  };

  const ROOT_SKIP = new Set(['margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'top', 'right', 'bottom', 'left', 'float', 'clear', 'z-index', 'grid-column-start', 'grid-column-end', 'grid-row-start', 'grid-row-end', 'order', 'align-self', 'justify-self', 'flex-grow', 'flex-shrink', 'flex-basis']);

  // ---------- Helpers ----------

  function escapeText(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escapeAttr(s) {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function absUrl(u) {
    try {
      return new URL(u, document.baseURI).href;
    } catch {
      return u;
    }
  }

  function absSrcset(v) {
    return v
      .split(',')
      .map((part) => {
        const [url, ...rest] = part.trim().split(/\s+/);
        return url ? [absUrl(url), ...rest].join(' ') : '';
      })
      .filter(Boolean)
      .join(', ');
  }

  function hex2(n) {
    return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  }

  // "rgb(15, 23, 42)" -> "#0f172a"; alpha < 1 keeps an 8-digit hex; fully transparent -> null.
  function toHex(color) {
    const m = String(color).trim().match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i);
    if (!m) return color;
    let a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    if (a === 0) return null;
    const hex = `#${hex2(+m[1])}${hex2(+m[2])}${hex2(+m[3])}`;
    return a < 1 ? hex + hex2(a * 255) : hex;
  }

  function hexify(value) {
    return value.replace(/rgba?\([^)]*\)/gi, (c) => toHex(c) || 'transparent');
  }

  function firstFamily(fontFamily) {
    return String(fontFamily).split(',')[0].trim().replace(/^["']|["']$/g, '');
  }

  function describe(el) {
    let s = el.tagName.toLowerCase();
    if (el.id) s += `#${el.id}`;
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean) : [];
    if (cls.length) s += `.${cls.slice(0, 3).join('.')}`;
    return s;
  }

  function cssPath(el) {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.documentElement && parts.length < 8) {
      let part = node.tagName.toLowerCase();
      if (node.id) {
        parts.unshift(`${part}#${CSS.escape(node.id)}`);
        break;
      }
      const parent = node.parentElement;
      if (parent) {
        const same = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
      }
      parts.unshift(part);
      node = parent;
    }
    return parts.join(' > ');
  }

  function isVisible(el, cs) {
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  // Default computed styles per tag, read inside an isolated shadow tree whose host resets
  // everything to initial values, so neither page CSS nor inheritance leaks into the baseline.
  function createBaseline() {
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'all:initial;position:fixed;left:-99999px;top:0;width:0;height:0;overflow:hidden';
    const root = host.attachShadow({ mode: 'open' });
    (document.body || document.documentElement).appendChild(host);
    const cache = new Map();

    return {
      get(el) {
        const isSvg = el.namespaceURI === SVG_NS;
        const tag = isSvg ? el.tagName : el.tagName.toLowerCase();
        const key = (isSvg ? 'svg:' : '') + tag;
        if (cache.has(key)) return cache.get(key);
        let probe;
        if (isSvg) {
          const svg = document.createElementNS(SVG_NS, 'svg');
          probe = tag === 'svg' ? svg : svg.appendChild(document.createElementNS(SVG_NS, tag));
          root.appendChild(svg);
        } else {
          probe = document.createElement(tag);
          root.appendChild(probe);
        }
        const cs = getComputedStyle(probe);
        const snapshot = {};
        for (const p of PROPS) snapshot[p] = cs.getPropertyValue(p);
        cache.set(key, snapshot);
        return snapshot;
      },
      dispose() {
        host.remove();
      },
    };
  }

  function computeDecls(el, cs, base, parentCs, isRoot, pseudo) {
    const decls = [];
    const isSvg = el.namespaceURI === SVG_NS;
    const positioned = cs.position !== 'static';
    const hasBgImage = cs.backgroundImage && cs.backgroundImage !== 'none';
    const keepSize = pseudo || REPLACED_TAGS.has(el.tagName) || (el.children.length === 0 && !el.textContent.trim() && cs.display !== 'inline');

    for (const p of PROPS) {
      let v = cs.getPropertyValue(p);
      if (!v) continue;
      if (isRoot && ROOT_SKIP.has(p)) continue;
      if (isRoot && p === 'position' && v !== 'relative') continue;
      if ((p === 'top' || p === 'right' || p === 'bottom' || p === 'left' || p === 'z-index') && !positioned) continue;
      if ((p === 'width' || p === 'height') && !keepSize) continue;
      if (!isSvg && (p === 'fill' || p === 'stroke' || p === 'stroke-width')) continue;
      if (p.startsWith('background-') && p !== 'background-color' && p !== 'background-image' && !hasBgImage) continue;
      if (p === 'transform-origin' && cs.transform === 'none') continue;
      if ((p === 'min-width' || p === 'min-height') && v === 'auto') continue;
      if (p === 'aspect-ratio' && v.startsWith('auto ')) continue;
      if (p in CURRENT_COLOR_PROPS) {
        const styleProp = CURRENT_COLOR_PROPS[p];
        if (styleProp && (cs.getPropertyValue(styleProp) === 'none')) continue;
        if (v === cs.color) continue;
      }
      if (INHERITED.has(p) && !isRoot && !pseudo) {
        if (parentCs && parentCs.getPropertyValue(p) === v) continue;
      } else if (INHERITED.has(p) && pseudo) {
        if (parentCs.getPropertyValue(p) === v) continue;
      } else if (base[p] === v) {
        continue;
      }
      decls.push([p, hexify(v)]);
    }
    return compact(decls, base);
  }

  function sides(values) {
    const [t, r, b, l] = values.map((v) => (v === '0px' ? '0' : v));
    if (t === r && r === b && b === l) return t;
    if (t === b && r === l) return `${t} ${r}`;
    if (r === l) return `${t} ${r} ${b}`;
    return `${t} ${r} ${b} ${l}`;
  }

  const SHORTHANDS = [
    ['margin', ['margin-top', 'margin-right', 'margin-bottom', 'margin-left']],
    ['padding', ['padding-top', 'padding-right', 'padding-bottom', 'padding-left']],
    ['border-width', ['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width']],
    ['border-style', ['border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style']],
    ['border-color', ['border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color']],
    ['border-radius', ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius']],
  ];

  // Fold per-side longhands into shorthands (missing sides take the tag's default value).
  function compact(decls, base) {
    const map = new Map(decls);
    const out = [];
    const folded = new Map();
    for (const [name, longhands] of SHORTHANDS) {
      const present = longhands.filter((p) => map.has(p));
      if (present.length < 2) continue;
      const values = longhands.map((p) => (map.has(p) ? map.get(p) : base[p]));
      if (values.some((v) => !v || v.includes(' '))) continue;
      folded.set(longhands[0], [name, sides(values)]);
      for (const p of longhands) map.delete(p);
    }
    if (map.has('row-gap') && map.has('column-gap')) {
      const r = map.get('row-gap');
      const c = map.get('column-gap');
      folded.set('row-gap', ['gap', r === c ? r : `${r} ${c}`]);
      map.delete('row-gap');
      map.delete('column-gap');
    }
    if (map.has('overflow-x') && map.has('overflow-y')) {
      const x = map.get('overflow-x');
      const y = map.get('overflow-y');
      folded.set('overflow-x', ['overflow', x === y ? x : `${x} ${y}`]);
      map.delete('overflow-x');
      map.delete('overflow-y');
    }
    for (const [p, v] of decls) {
      if (folded.has(p)) out.push(folded.get(p));
      else if (map.has(p)) out.push([p, v]);
    }
    return out;
  }

  // Split a declaration block into [prop, value] pairs, keeping shorthands and var() intact.
  function parseDeclarations(cssText) {
    const out = [];
    let depth = 0;
    let quote = null;
    let start = 0;
    const push = (chunk) => {
      const i = chunk.indexOf(':');
      if (i > 0) out.push([chunk.slice(0, i).trim(), chunk.slice(i + 1).trim()]);
    };
    for (let i = 0; i < cssText.length; i++) {
      const ch = cssText[i];
      if (quote) {
        if (ch === quote && cssText[i - 1] !== '\\') quote = null;
      } else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === ';' && depth === 0) {
        push(cssText.slice(start, i));
        start = i + 1;
      }
    }
    push(cssText.slice(start));
    return out;
  }

  function resolveVars(value, cs) {
    return value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g, (_m, name, fallback) => {
      const v = cs.getPropertyValue(name).trim();
      return v || (fallback ? fallback.trim() : _m);
    });
  }

  // Collect `selector:hover` rules from readable stylesheets that target an extracted element itself.
  function collectHoverRules(entries) {
    const out = new Map();
    let scanned = 0;

    function visit(rules) {
      for (const rule of rules) {
        if (++scanned > 20000) return;
        if (rule.cssRules && !(rule instanceof CSSStyleRule)) {
          if (rule.media && typeof matchMedia === 'function' && !matchMedia(rule.media.mediaText).matches) continue;
          visit(rule.cssRules);
          continue;
        }
        if (!(rule instanceof CSSStyleRule) || !rule.selectorText.includes(':hover')) continue;
        for (const part of rule.selectorText.split(',')) {
          const idx = part.lastIndexOf(':hover');
          if (idx < 0 || /[\s>+~]/.test(part.slice(idx).trim())) continue;
          const baseSel = part.replace(/:hover/g, '').trim();
          if (!baseSel) continue;
          for (const { el, cls, cs } of entries) {
            let matches = false;
            try {
              matches = el.matches(baseSel);
            } catch {
              break;
            }
            if (!matches) continue;
            const decls = out.get(cls) || new Map();
            for (const [prop, value] of parseDeclarations(rule.style.cssText)) {
              decls.set(prop, hexify(resolveVars(value, cs)));
            }
            out.set(cls, decls);
          }
        }
      }
    }

    for (const sheet of Array.from(document.styleSheets)) {
      try {
        visit(sheet.cssRules);
      } catch {
        // Cross-origin stylesheet: rules are not readable.
      }
    }
    return out;
  }

  // ---------- Component extraction ----------

  function extractComponent(root) {
    const baseline = createBaseline();
    const classByDecls = new Map();
    const rules = [];
    const entries = [];
    const tagCounters = {};
    const fonts = new Map();
    const colors = new Map();
    let nodeCount = 0;
    let truncated = false;

    function classFor(tag, decls, pseudoDecls) {
      if (!decls.length && !pseudoDecls.length) return null;
      const key = JSON.stringify([decls, pseudoDecls]);
      if (classByDecls.has(key)) return classByDecls.get(key);
      const prefix = tag.replace(/[^a-z0-9]/gi, '') || 'el';
      tagCounters[prefix] = (tagCounters[prefix] || 0) + 1;
      const cls = `${prefix}-${tagCounters[prefix]}`;
      classByDecls.set(key, cls);
      rules.push({ selector: `.${cls}`, decls });
      for (const [pseudo, pd] of pseudoDecls) rules.push({ selector: `.${cls}${pseudo}`, decls: pd });
      return cls;
    }

    function track(cs) {
      const fam = firstFamily(cs.fontFamily);
      if (fam) fonts.set(fam, (fonts.get(fam) || 0) + 1);
      for (const c of [cs.color, cs.backgroundColor]) {
        const h = toHex(c);
        if (h && h.startsWith('#')) colors.set(h, (colors.get(h) || 0) + 1);
      }
    }

    function serializeAttrs(el, cls, isSvg) {
      const attrs = [];
      if (cls) attrs.push(`class="${cls}"`);
      for (const { name, value } of Array.from(el.attributes)) {
        const lower = name.toLowerCase();
        if (lower === 'class' || lower === 'style' || lower === 'id' || lower.startsWith('on') || lower.startsWith('data-')) continue;
        if (!isSvg && !KEEP_ATTRS.has(lower) && !lower.startsWith('aria-')) continue;
        let v = value;
        if (URL_ATTRS.has(lower) || (isSvg && (lower === 'href' || lower === 'xlink:href') && !v.startsWith('#'))) {
          if (lower === 'src' && el.currentSrc) v = el.currentSrc;
          else if (!v.startsWith('data:') && !v.startsWith('#') && !v.startsWith('javascript:')) v = absUrl(v);
          if (v.startsWith('javascript:')) v = '#';
          if (v.startsWith('data:') && v.length > 4000) v = 'https://placehold.co/600x400';
        } else if (lower === 'srcset') {
          v = absSrcset(v);
        }
        attrs.push(v === '' ? name : `${name}="${escapeAttr(v)}"`);
      }
      return attrs.length ? ' ' + attrs.join(' ') : '';
    }

    function walk(el, parentCs, depth, isRoot, inSvg) {
      if (SKIP_TAGS.has(el.tagName) || el.id === OVERLAY_ID) return '';
      if (nodeCount >= MAX_NODES) {
        truncated = true;
        return '';
      }
      const cs = getComputedStyle(el);
      if (cs.display === 'none') return '';
      nodeCount++;

      const isSvg = el.namespaceURI === SVG_NS;
      const tag = isSvg ? el.tagName : el.tagName.toLowerCase();
      const pad = '  '.repeat(depth);

      if (tag === 'iframe') return `${pad}<!-- iframe: ${escapeText(absUrl(el.getAttribute('src') || ''))} -->\n`;

      let cls = null;
      let extraAttrs = '';
      if (!inSvg || tag === 'svg') {
        const decls = computeDecls(el, cs, baseline.get(el), parentCs, isRoot, false);
        const pseudoDecls = [];
        for (const pseudo of ['::before', '::after']) {
          const pcs = getComputedStyle(el, pseudo);
          if (!pcs.content || pcs.content === 'none' || pcs.content === 'normal') continue;
          const spanBase = baseline.get(document.createElement('span'));
          const pd = computeDecls(el, pcs, spanBase, cs, false, true);
          pd.unshift(['content', pcs.content]);
          pseudoDecls.push([pseudo, pd]);
        }
        if (isRoot) {
          const r = el.getBoundingClientRect();
          decls.unshift(['/* original size */', `${Math.round(r.width)}px × ${Math.round(r.height)}px`]);
        }
        cls = classFor(tag, decls, pseudoDecls);
        if (cls) entries.push({ el, cls, cs });
        track(cs);
      } else if (parentCs) {
        // Inside an SVG, carry CSS-driven paint over as attributes instead of classes.
        if (!el.hasAttribute('fill') && cs.fill !== parentCs.fill) extraAttrs += ` fill="${escapeAttr(hexify(cs.fill))}"`;
        if (!el.hasAttribute('stroke') && cs.stroke !== parentCs.stroke) extraAttrs += ` stroke="${escapeAttr(hexify(cs.stroke))}"`;
      }

      const open = `<${tag}${serializeAttrs(el, cls, isSvg)}${extraAttrs}>`;
      if (!isSvg && VOID_TAGS.has(tag)) return `${pad}${open}\n`;

      // Inline an external <use href="#id"> sprite so the icon survives outside the page.
      if (isSvg && tag === 'use') {
        const ref = el.getAttribute('href') || el.getAttribute('xlink:href') || '';
        const target = ref.startsWith('#') ? document.getElementById(ref.slice(1)) : null;
        if (target) {
          const inner = Array.from(target.childNodes)
            .map((c) => (c.nodeType === 1 ? c.outerHTML : ''))
            .join('');
          return `${pad}<g>${inner}</g>\n`;
        }
      }

      const children = Array.from(el.childNodes);
      const onlyText = children.every((c) => c.nodeType === 3);
      if (onlyText) {
        const text = el.textContent.replace(/\s+/g, ' ').trim();
        return `${pad}${open}${escapeText(text)}</${tag}>\n`;
      }

      let inner = '';
      for (const child of children) {
        if (child.nodeType === 3) {
          const text = child.textContent.replace(/\s+/g, ' ').trim();
          if (text) inner += `${pad}  ${escapeText(text)}\n`;
        } else if (child.nodeType === 1) {
          inner += walk(child, cs, depth + 1, false, isSvg);
        }
      }
      return `${pad}${open}\n${inner}${pad}</${tag}>\n`;
    }

    let html;
    try {
      html = walk(root, root.parentElement ? getComputedStyle(root.parentElement) : null, 0, true, false).trimEnd();
    } finally {
      baseline.dispose();
    }

    const hover = collectHoverRules(entries);
    let css = rules
      .filter((r) => r.decls.length)
      .map((r) => {
        const body = r.decls
          .map(([p, v]) => (p.startsWith('/*') ? `  /* original size: ${v} */` : `  ${p}: ${v};`))
          .join('\n');
        return `${r.selector} {\n${body}\n}`;
      })
      .join('\n\n');
    for (const [cls, decls] of hover) {
      const body = Array.from(decls)
        .map(([p, v]) => `  ${p}: ${v};`)
        .join('\n');
      css += `\n\n.${cls}:hover {\n${body}\n}`;
    }

    const rect = root.getBoundingClientRect();
    const selector = cssPath(root);
    return {
      kind: 'component',
      id: `${location.origin}${location.pathname}|${selector}`,
      url: location.href,
      host: location.hostname,
      title: document.title,
      label: describe(root),
      selector,
      html,
      css,
      nodeCount,
      truncated,
      fonts: Array.from(fonts.entries()).sort((a, b) => b[1] - a[1]).map(([f]) => f).slice(0, 6),
      colors: Array.from(colors.entries()).sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, 12),
      rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      viewport: { width: innerWidth, height: innerHeight },
    };
  }

  // ---------- Site style extraction ----------

  function extractStyle() {
    const colors = new Map();
    const fonts = new Map();
    const sizes = new Map();
    const radii = new Map();
    const shadows = new Map();

    function addColor(value, usage, weight) {
      const hex = toHex(value);
      if (!hex) return;
      const entry = colors.get(hex) || { value: hex, count: 0, usage: new Set() };
      entry.count += weight;
      entry.usage.add(usage);
      colors.set(hex, entry);
    }

    const elements = Array.from(document.body ? document.body.querySelectorAll('*') : []).slice(0, MAX_STYLE_SCAN);
    for (const el of [document.body, ...elements]) {
      if (!el || SKIP_TAGS.has(el.tagName) || el.id === OVERLAY_ID) continue;
      const cs = getComputedStyle(el);
      if (!isVisible(el, cs)) continue;
      const r = el.getBoundingClientRect();
      const area = Math.min(r.width * r.height, 400000);

      const hasOwnText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
      if (hasOwnText) {
        addColor(cs.color, 'text', 1);
        const fam = firstFamily(cs.fontFamily);
        const f = fonts.get(fam) || { family: fam, stack: cs.fontFamily, count: 0, weights: new Set() };
        f.count++;
        f.weights.add(cs.fontWeight);
        fonts.set(fam, f);
        const size = cs.fontSize;
        const s = sizes.get(size) || { size, count: 0, lineHeight: cs.lineHeight, weight: cs.fontWeight };
        s.count++;
        sizes.set(size, s);
      }
      addColor(cs.backgroundColor, 'background', 1 + area / 20000);
      if (cs.borderTopStyle !== 'none' && parseFloat(cs.borderTopWidth) > 0) addColor(cs.borderTopColor, 'border', 1);
      if (cs.borderTopLeftRadius !== '0px') radii.set(cs.borderTopLeftRadius, (radii.get(cs.borderTopLeftRadius) || 0) + 1);
      if (cs.boxShadow && cs.boxShadow !== 'none') shadows.set(cs.boxShadow, (shadows.get(cs.boxShadow) || 0) + 1);
    }

    const variables = [];
    const rootCs = getComputedStyle(document.documentElement);
    const seen = new Set();
    for (const sheet of Array.from(document.styleSheets)) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const rule of Array.from(rules)) {
        if (!(rule instanceof CSSStyleRule) || !/(^|,)\s*(:root|html)\s*(,|$)/.test(rule.selectorText)) continue;
        for (let i = 0; i < rule.style.length && variables.length < 80; i++) {
          const name = rule.style[i];
          if (!name.startsWith('--') || seen.has(name)) continue;
          seen.add(name);
          const value = rootCs.getPropertyValue(name).trim();
          if (value) variables.push({ name, value: hexify(value) });
        }
      }
    }

    const loadedFonts = [];
    try {
      for (const face of document.fonts) {
        if (face.status !== 'loaded') continue;
        const family = face.family.replace(/^["']|["']$/g, '');
        const key = `${family}|${face.weight}|${face.style}`;
        if (!loadedFonts.some((f) => f.key === key)) loadedFonts.push({ key, family, weight: face.weight, style: face.style });
      }
    } catch {
      // document.fonts not available.
    }

    const bodyCs = document.body ? getComputedStyle(document.body) : rootCs;
    const px = (v) => parseFloat(v) || 0;

    return {
      kind: 'style',
      id: location.hostname,
      url: location.href,
      host: location.hostname,
      title: document.title,
      background: toHex(bodyCs.backgroundColor) || toHex(rootCs.backgroundColor) || '#ffffff',
      colors: Array.from(colors.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 18)
        .map((c) => ({ value: c.value, count: Math.round(c.count), usage: Array.from(c.usage) })),
      fonts: Array.from(fonts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
        .map((f) => ({ family: f.family, stack: f.stack, count: f.count, weights: Array.from(f.weights).sort() })),
      fontSizes: Array.from(sizes.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .sort((a, b) => px(b.size) - px(a.size)),
      radii: Array.from(radii.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([value, count]) => ({ value, count })),
      shadows: Array.from(shadows.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([value, count]) => ({ value: hexify(value), count })),
      variables,
      loadedFonts: loadedFonts.slice(0, 12).map(({ family, weight, style }) => ({ family, weight, style })),
    };
  }

  // ---------- Inspect overlay ----------

  const OVERLAY_CSS = `
    :host { all: initial; }
    .layer { position: fixed; pointer-events: none; box-sizing: border-box; }
    .margin { border-style: solid; border-color: rgba(246, 178, 107, 0.55); }
    .padding { border-style: solid; border-color: rgba(147, 196, 125, 0.55); }
    .content { background: rgba(111, 168, 220, 0.55); }
    .outline { outline: 1.5px solid #155dfc; }
    .label {
      position: fixed; pointer-events: none; font: 500 11px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace;
      background: #16151d; color: #f4f3ff; padding: 5px 8px; border-radius: 6px; white-space: nowrap;
      box-shadow: 0 6px 20px rgba(0,0,0,.35); max-width: 60vw; overflow: hidden; text-overflow: ellipsis;
    }
    .label b { color: #b8c8ff; font-weight: 600; }
    .label span { color: #9b99ad; margin-left: 8px; }
    .hint {
      position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); pointer-events: none;
      font: 500 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #f4f3ff;
      background: rgba(22, 21, 29, 0.92); padding: 10px 14px; border-radius: 999px; white-space: nowrap;
      box-shadow: 0 10px 30px rgba(0,0,0,.35); border: 1px solid rgba(255,255,255,.08);
    }
    .hint kbd { font: inherit; background: rgba(255,255,255,.12); padding: 3px 6px; border-radius: 4px; margin: 0 2px; }
    .dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #3a7bff; margin-right: 8px; }
  `;

  function createInspector(send) {
    let active = false;
    let host = null;
    let layers = null;
    let current = null;
    let frame = 0;
    let lastPoint = null;

    function mountOverlay() {
      host = document.createElement('div');
      host.id = OVERLAY_ID;
      host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none';
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = `<style>${OVERLAY_CSS}</style>
        <div class="layer margin"></div><div class="layer padding"></div><div class="layer content"></div>
        <div class="layer outline"></div><div class="label"></div>
        <div class="hint"><span class="dot"></span>Click to copy · <kbd>↑</kbd> parent · <kbd>↓</kbd> child · <kbd>Esc</kbd> exit</div>`;
      layers = {
        margin: shadow.querySelector('.margin'),
        padding: shadow.querySelector('.padding'),
        content: shadow.querySelector('.content'),
        outline: shadow.querySelector('.outline'),
        label: shadow.querySelector('.label'),
      };
      document.documentElement.appendChild(host);
    }

    function place(node, x, y, w, h, borders) {
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      node.style.width = `${Math.max(0, w)}px`;
      node.style.height = `${Math.max(0, h)}px`;
      if (borders) node.style.borderWidth = borders.map((b) => `${Math.max(0, b)}px`).join(' ');
    }

    function draw() {
      if (!layers) return;
      if (!current || !current.isConnected) {
        for (const l of Object.values(layers)) l.style.display = 'none';
        return;
      }
      for (const l of Object.values(layers)) l.style.display = '';
      const r = current.getBoundingClientRect();
      const cs = getComputedStyle(current);
      const n = (p) => parseFloat(cs.getPropertyValue(p)) || 0;
      const m = [n('margin-top'), n('margin-right'), n('margin-bottom'), n('margin-left')].map((v) => Math.max(0, v));
      const b = [n('border-top-width'), n('border-right-width'), n('border-bottom-width'), n('border-left-width')];
      const p = [n('padding-top'), n('padding-right'), n('padding-bottom'), n('padding-left')];

      place(layers.margin, r.left - m[3], r.top - m[0], r.width + m[1] + m[3], r.height + m[0] + m[2], m);
      const px = r.left + b[3];
      const py = r.top + b[0];
      const pw = r.width - b[1] - b[3];
      const ph = r.height - b[0] - b[2];
      place(layers.padding, px, py, pw, ph, p);
      place(layers.content, px + p[3], py + p[0], pw - p[1] - p[3], ph - p[0] - p[2]);
      place(layers.outline, r.left, r.top, r.width, r.height);

      const label = layers.label;
      label.innerHTML = '';
      const name = document.createElement('b');
      name.textContent = describe(current);
      const size = document.createElement('span');
      size.textContent = `${Math.round(r.width)} × ${Math.round(r.height)}`;
      label.append(name, size);
      const below = r.top < 32;
      label.style.left = `${Math.max(4, Math.min(r.left, innerWidth - label.offsetWidth - 4))}px`;
      label.style.top = below ? `${Math.min(innerHeight - 28, r.bottom + 6)}px` : `${r.top - 28}px`;
    }

    function setCurrent(el) {
      if (!el || el === host || el === document.documentElement) return;
      current = el;
      draw();
    }

    function schedule() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (lastPoint) setCurrent(document.elementFromPoint(lastPoint.x, lastPoint.y));
        else draw();
      });
    }

    function block(e) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }

    function onMove(e) {
      lastPoint = { x: e.clientX, y: e.clientY };
      schedule();
    }

    function onClick(e) {
      block(e);
      if (e.type === 'click') select();
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        block(e);
        stop();
      } else if (e.key === 'ArrowUp' && current?.parentElement && current.parentElement !== document.documentElement) {
        block(e);
        lastPoint = null;
        setCurrent(current.parentElement);
      } else if (e.key === 'ArrowDown' && current?.firstElementChild) {
        block(e);
        lastPoint = null;
        setCurrent(current.firstElementChild);
      } else if (e.key === 'Enter') {
        block(e);
        select();
      }
    }

    function onScroll() {
      schedule();
    }

    const pointerEvents = ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'click', 'dblclick', 'auxclick', 'contextmenu'];

    function start() {
      if (active || !document.documentElement) return;
      active = true;
      mountOverlay();
      window.addEventListener('mousemove', onMove, true);
      window.addEventListener('keydown', onKey, true);
      window.addEventListener('scroll', onScroll, true);
      window.addEventListener('resize', onScroll, true);
      for (const t of pointerEvents) window.addEventListener(t, onClick, true);
      send('inspector:state', { active: true });
    }

    function stop() {
      if (!active) return;
      active = false;
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll, true);
      for (const t of pointerEvents) window.removeEventListener(t, onClick, true);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      host?.remove();
      host = null;
      layers = null;
      current = null;
      lastPoint = null;
      send('inspector:state', { active: false });
    }

    function select() {
      const el = current;
      if (!el) return;
      stop();
      let payload;
      try {
        payload = extractComponent(el);
      } catch (err) {
        send('inspector:error', { message: String(err?.message || err) });
        return;
      }
      // Two frames so the overlay is gone from the page before the app screenshots the component.
      requestAnimationFrame(() => requestAnimationFrame(() => send('inspector:selected', payload)));
    }

    return {
      start,
      stop,
      toggle: () => (active ? stop() : start()),
      isActive: () => active,
      hover: setCurrent,
      select,
    };
  }

  const api = { createInspector, extractComponent, extractStyle, toHex };

  if (typeof require === 'function') {
    const { ipcRenderer } = require('electron');
    const send = (channel, payload) => ipcRenderer.sendToHost(channel, payload);
    const inspector = createInspector(send);
    ipcRenderer.on('inspector:start', () => inspector.start());
    ipcRenderer.on('inspector:stop', () => inspector.stop());
    ipcRenderer.on('inspector:toggle', () => inspector.toggle());
    ipcRenderer.on('inspector:extract-style', () => {
      try {
        send('inspector:style', extractStyle());
      } catch (err) {
        send('inspector:error', { message: String(err?.message || err) });
      }
    });
  } else {
    globalThis.LayoutlyInspector = api;
  }
})();
