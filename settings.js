const fs = require('node:fs');
const path = require('node:path');
const config = require('./config.json');
const { resolvePath } = require('./utils');

const FILE = resolvePath('./data/settings.json');
let cache = null;

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    cache = { automod: !!config.AUTOMOD.DEFAULT_ENABLED };
  }
  return cache;
}

function get(key) {
  return load()[key];
}

function set(key, value) {
  const s = load();
  s[key] = value;
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(s, null, 2));
}

module.exports = { get, set };