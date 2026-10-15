const config = require('./config.json');

const API_URL = (config.KEYAUTH && config.KEYAUTH.API_URL) || 'https://keyauth.win/api/1.3/';
const SELLER_URL = (config.KEYAUTH && config.KEYAUTH.SELLER_URL) || 'https://keyauth.win/api/seller/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

let session = null;

async function request(url, params) {
  let res;
  try {
    res = await fetch(url, {
      method: params ? 'POST' : 'GET',
      headers: {
        'User-Agent': UA,
        ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      body: params || undefined,
    });
  } catch (e) {
    return { ok: false, error: `Could not reach KeyAuth: ${e.message}` };
  }
  const text = await res.text();
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, error: `Unexpected response from KeyAuth (HTTP ${res.status}): ${text.slice(0, 200)}` };
  }
}

/**
 * Initialises an app session with your KeyAuth app credentials
 * (KEYAUTH.NAME / OWNERID / VERSION). Done once at startup.
 */
async function init() {
  const ka = config.KEYAUTH || {};
  if (!ka.NAME || !ka.OWNERID) return { ok: false, error: 'KeyAuth app name/ownerid are not set in config.json.' };
  const body = new URLSearchParams({
    type: 'init',
    ver: ka.VERSION || '1.0',
    name: ka.NAME,
    ownerid: ka.OWNERID,
  }).toString();
  const r = await request(API_URL, body);
  if (!r.ok) return r;
  if (!r.data || !r.data.success) return { ok: false, error: `KeyAuth init failed: ${(r.data && r.data.message) || 'unknown error'}` };
  session = { id: r.data.sessionid, at: Date.now(), appInfo: r.data.appinfo || null };
  return { ok: true, data: r.data, session };
}

function getSession() {
  return session;
}

/**
 * Calls the KeyAuth Seller API (needs KEYAUTH.SELLER_KEY - seller subscription).
 * Docs: https://docs.keyauth.cc/sellerapi
 */
async function seller(type, params = {}) {
  if (!config.KEYAUTH || !config.KEYAUTH.SELLER_KEY) {
    return {
      ok: false,
      error:
        'KeyAuth Seller key is missing. Creating users / resetting HWIDs needs KEYAUTH.SELLER_KEY in config.json (keyauth.cc app \u2192 App Settings \u2192 Seller). App name/ownerid/secret alone cannot do this.',
    };
  }
  const body = new URLSearchParams({ sellerkey: config.KEYAUTH.SELLER_KEY, type });
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    body.set(k, String(v));
  }
  return request(SELLER_URL, body.toString());
}

/** Creates a new KeyAuth user with a license (Seller API: adduser). */
function createUser({ username, password, subscription, expiryDays, email }) {
  return seller('adduser', {
    user: username,
    pass: password,
    sub: subscription || (config.KEYAUTH && config.KEYAUTH.DEFAULT_SUBSCRIPTION) || 'default',
    expiry: expiryDays != null ? expiryDays : ((config.KEYAUTH && config.KEYAUTH.DEFAULT_EXPIRY_DAYS) || 30),
    email,
    hwidAffected: 0,
  });
}

/** Resets a user's HWID lock (Seller API: resetuser). */
function resetHwid(username) {
  return seller('resetuser', { user: username });
}

module.exports = { init, getSession, createUser, resetHwid, seller };