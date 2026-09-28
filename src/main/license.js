// Lemon Squeezy License API: https://docs.lemonsqueezy.com/api/license-api
// These endpoints are public and need no API secret, so they are safe to call from the app.
const os = require('os');
const config = require('./config');

const API = 'https://api.lemonsqueezy.com/v1/licenses';

async function call(endpoint, params) {
  const res = await fetch(`${API}/${endpoint}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function productMatches(data) {
  const expected = config.lemonSqueezy.productId;
  return !expected || String(data?.meta?.product_id) === String(expected);
}

async function activate(key) {
  key = String(key || '').trim();
  if (!key) return { ok: false, error: 'Enter your license key.' };
  let result;
  try {
    result = await call('activate', { license_key: key, instance_name: `${os.hostname()} (${process.platform})` });
  } catch {
    return { ok: false, error: 'Could not reach the license server. Check your internet connection.' };
  }
  const { data } = result;
  if (!data.activated) {
    // The API's own wording for an unknown key is "license_key not found."; say it in plain words.
    const unknown = !data.error || /not found/i.test(data.error);
    return { ok: false, error: unknown ? 'We could not find this license key. Check it against your receipt email.' : data.error };
  }
  if (!productMatches(data)) return { ok: false, error: 'This key belongs to a different product.' };
  return { ok: true, instanceId: data.instance?.id || null };
}

// Returns { valid: true|false } or { valid: null } when the server is unreachable.
async function validate(key, instanceId) {
  try {
    const params = { license_key: key };
    if (instanceId) params.instance_id = instanceId;
    const { status, data } = await call('validate', params);
    if (status >= 500) return { valid: null };
    const status_ = data?.license_key?.status;
    return { valid: Boolean(data.valid) && status_ !== 'disabled' && status_ !== 'expired' && productMatches(data) };
  } catch {
    return { valid: null };
  }
}

async function deactivate(key, instanceId) {
  if (!instanceId) return { ok: true };
  try {
    const { data } = await call('deactivate', { license_key: key, instance_id: instanceId });
    return { ok: Boolean(data.deactivated), error: data.error };
  } catch {
    return { ok: false, error: 'Could not reach the license server.' };
  }
}

module.exports = { activate, validate, deactivate };
