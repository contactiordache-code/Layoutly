const { app, BrowserWindow, globalShortcut, ipcMain, shell, clipboard, nativeImage, Menu, webContents } = require('electron');
const path = require('path');
const config = require('./config');
const license = require('./license');
const { Store } = require('./store');

// Two editions from the same open-source code:
// - "official": the installers built by our release workflow (it injects `layoutlyEdition` into
//   package.json). A few free copies every day, unlimited with the $10 lifetime license.
// - "community": anything built or run from source. Everything unlocked, no limits, no key.
// `LAYOUTLY_EDITION=official npm start` runs the official flow from source, to test the paywall.
const OFFICIAL =
  require('../../package.json').layoutlyEdition === 'official' ||
  (!app.isPackaged && process.env.LAYOUTLY_EDITION === 'official');
const INSPECTOR_PRELOAD = path.join(__dirname, '../inspector/webview-preload.js');

let store;
let win = null;
let registeredHotkey = null;
let hotkeySuspended = false;

// ---------- State ----------

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Today's free usage. A new local day starts with nothing used.
function dailyUsage() {
  const daily = store.get('daily');
  return daily.day === today() ? daily : { day: today(), components: [], styles: [] };
}

function isLicensed() {
  return !OFFICIAL || Boolean(store.get('license')?.key);
}

function publicState() {
  const used = dailyUsage();
  const lic = store.get('license');
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  return {
    onboarded: store.get('onboarded'),
    hotkey: store.get('hotkey') || config.defaultHotkey,
    stack: store.get('stack') || config.defaultStack,
    llm: store.get('llm') || config.defaultLlm,
    lastUrl: store.get('lastUrl'),
    licensed: isLicensed(),
    licenseKey: lic?.key ? `${lic.key.slice(0, 4)}••••${lic.key.slice(-4)}` : null,
    community: !OFFICIAL,
    free: {
      componentsLeft: Math.max(0, config.freePerDay.components - used.components.length),
      stylesLeft: Math.max(0, config.freePerDay.styles - used.styles.length),
      components: config.freePerDay.components,
      styles: config.freePerDay.styles,
      resetsAt: midnight.getTime(),
    },
    price: config.price,
    checkoutUrl: config.checkoutUrl,
    website: config.website,
    supportEmail: config.supportEmail,
    xUrl: config.xUrl,
    platform: process.platform,
    version: app.getVersion(),
  };
}

// ---------- Hotkey ----------

function registerHotkey() {
  unregisterHotkey();
  if (hotkeySuspended || !store.get('onboarded')) return;
  const accel = store.get('hotkey') || config.defaultHotkey;
  try {
    if (globalShortcut.register(accel, () => win?.webContents.send('hotkey'))) registeredHotkey = accel;
  } catch {
    registeredHotkey = null;
  }
}

function unregisterHotkey() {
  if (registeredHotkey) globalShortcut.unregister(registeredHotkey);
  registeredHotkey = null;
}

function canRegister(accel) {
  if (accel === registeredHotkey) return true;
  try {
    const ok = globalShortcut.register(accel, () => {});
    if (ok) globalShortcut.unregister(accel);
    return ok;
  } catch {
    return false;
  }
}

// ---------- Window ----------

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 620,
    title: config.productName,
    backgroundColor: '#f9fafb',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true,
    },
  });

  win.loadFile(path.join(__dirname, '../renderer/index.html'));
  // The hotkey is only active while Layoutly is focused, so it never hijacks keys in other apps.
  win.on('focus', registerHotkey);
  win.on('blur', unregisterHotkey);
  win.on('closed', () => {
    unregisterHotkey();
    win = null;
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

// Every <webview> gets the inspector preload and a locked-down configuration.
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event, webPreferences, params) => {
    delete webPreferences.preloadURL;
    webPreferences.preload = INSPECTOR_PRELOAD;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    if (params.src && !/^(https?:|about:blank)/.test(params.src)) event.preventDefault();
  });

  if (contents.getType() === 'webview') {
    // Links that would open a new window load in the same view instead.
    contents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//.test(url)) contents.loadURL(url);
      return { action: 'deny' };
    });
  }
});

// ---------- IPC ----------

function registerIpc() {
  ipcMain.handle('state:get', () => publicState());

  ipcMain.handle('settings:save', (_e, patch = {}) => {
    const next = {};
    if (typeof patch.hotkey === 'string') {
      if (!canRegister(patch.hotkey)) return { ok: false, error: 'That shortcut is used by the system or another app. Pick another one.' };
      next.hotkey = patch.hotkey;
    }
    if (typeof patch.stack === 'string') next.stack = patch.stack;
    if (typeof patch.llm === 'string') next.llm = patch.llm;
    if (typeof patch.onboarded === 'boolean') next.onboarded = patch.onboarded;
    if (typeof patch.lastUrl === 'string' && /^https?:\/\//.test(patch.lastUrl)) next.lastUrl = patch.lastUrl;
    store.set(next);
    if ('hotkey' in next || 'onboarded' in next) registerHotkey();
    return { ok: true, state: publicState() };
  });

  ipcMain.handle('hotkey:validate', (_e, accel) => ({ ok: typeof accel === 'string' && canRegister(accel) }));

  ipcMain.handle('hotkey:suspend', (_e, suspended) => {
    hotkeySuspended = Boolean(suspended);
    if (hotkeySuspended) unregisterHotkey();
    else if (win?.isFocused()) registerHotkey();
  });

  // The daily allowance is counted here, not in the UI. `id` identifies the component or the site,
  // so re-opening the same component or re-extracting the same site's style that day is free.
  ipcMain.handle('credits:consume', (_e, kind, id) => {
    if (kind !== 'components' && kind !== 'styles') return { ok: false };
    if (isLicensed()) return { ok: true, state: publicState() };
    const daily = dailyUsage();
    const used = daily[kind];
    if (used.includes(String(id))) return { ok: true, state: publicState() };
    if (used.length >= config.freePerDay[kind]) return { ok: false, state: publicState() };
    store.set({ daily: { ...daily, [kind]: [...used, String(id)] } });
    return { ok: true, state: publicState() };
  });

  ipcMain.handle('license:activate', async (_e, key) => {
    const res = await license.activate(key);
    if (!res.ok) return res;
    store.set({ license: { key: String(key).trim(), instanceId: res.instanceId, activatedAt: Date.now(), lastValidatedAt: Date.now() } });
    return { ok: true, state: publicState() };
  });

  ipcMain.handle('license:deactivate', async () => {
    const lic = store.get('license');
    if (lic) {
      const res = await license.deactivate(lic.key, lic.instanceId);
      if (!res.ok) return { ok: false, error: res.error || 'Could not deactivate this device.' };
    }
    store.set({ license: null });
    return { ok: true, state: publicState() };
  });

  ipcMain.handle('shell:open', (_e, url) => {
    // https links, plus the one mailto: the Contact button in Settings needs.
    if (typeof url === 'string' && (/^https:\/\//.test(url) || url === `mailto:${config.supportEmail}`)) shell.openExternal(url);
  });

  // Screenshot of the selected component, taken from the browsing <webview> hosted by our window.
  ipcMain.handle('capture', async (event, webContentsId, rect) => {
    const target = webContents.fromId(Number(webContentsId));
    if (!target || target.getType() !== 'webview' || target.hostWebContents !== event.sender) return null;
    const r = {
      x: Math.max(0, Math.round(rect?.x || 0)),
      y: Math.max(0, Math.round(rect?.y || 0)),
      width: Math.round(rect?.width || 0),
      height: Math.round(rect?.height || 0),
    };
    if (r.width < 2 || r.height < 2) return null;
    try {
      const image = await target.capturePage(r);
      return image.isEmpty() ? null : image.toDataURL();
    } catch {
      return null;
    }
  });

  ipcMain.handle('clipboard:text', (_e, text) => clipboard.writeText(String(text)));

  ipcMain.handle('clipboard:image', (_e, dataUrl) => {
    const img = nativeImage.createFromDataURL(String(dataUrl));
    if (!img.isEmpty()) clipboard.writeImage(img);
  });
}

async function revalidateLicense() {
  const lic = store.get('license');
  if (!OFFICIAL || !lic?.key) return;
  const { valid } = await license.validate(lic.key, lic.instanceId);
  if (valid === false) {
    store.set({ license: null });
    win?.webContents.send('state:changed', publicState());
  } else if (valid) {
    store.set({ license: { ...lic, lastValidatedAt: Date.now() } });
  }
}

// ---------- Lifecycle ----------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(() => {
    store = new Store(app.getPath('userData'));
    if (process.platform === 'darwin') {
      Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]));
    } else {
      Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'editMenu' }]));
    }
    registerIpc();
    createWindow();
    revalidateLicense();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('will-quit', () => globalShortcut.unregisterAll());
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
