const http = require('node:http');
const fs = require('node:fs');
const { URL } = require('node:url');
const config = require('./config.json');
const verify = require('./verify');
const { resolvePath } = require('./utils');

const LOG = resolvePath(config.VERIFY_LOG || './verify-log.jsonl');

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  const addr = req.socket.remoteAddress || 'unknown';
  return addr.replace(/^::ffff:/, '');
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function page(title, body, ok = true) {
  const accent = ok ? '#2f6bff' : '#e74c3c';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} - ${esc(config.BOT_NAME)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0d1117; color: #e6edf3; font-family: 'Segoe UI', system-ui, sans-serif; padding: 24px; }
  .card { width: 100%; max-width: 460px; background: #161b22; border: 1px solid #263041; border-radius: 14px; padding: 32px 28px; box-shadow: 0 12px 40px rgba(0,0,0,.45); text-align: center; }
  .bar { height: 4px; width: 64px; background: ${accent}; border-radius: 4px; margin: 0 auto 20px; }
  h1 { font-size: 22px; margin-bottom: 10px; }
  p { color: #9fb0c3; font-size: 14px; line-height: 1.6; margin-bottom: 12px; word-break: break-word; }
  .btn { display: inline-block; margin-top: 8px; padding: 13px 22px; background: ${accent}; color: #fff !important; text-decoration: none; font-weight: 700; font-size: 15px; border-radius: 9px; transition: filter .15s; }
  .btn:hover { filter: brightness(1.12); }
  .consent { background: #101725; border: 1px solid #263041; border-left: 3px solid ${accent}; border-radius: 8px; padding: 12px 14px; font-size: 13px; color: #8ea3bb; text-align: left; margin: 14px 0; }
  code { background: #0d1117; padding: 2px 6px; border-radius: 5px; color: #79c0ff; font-size: 13px; }
  .foot { margin-top: 18px; font-size: 12px; color: #5c6b80; }
</style>
</head>
<body>
<div class="card">
  <div class="bar"></div>
  ${body}
  <div class="foot">Made By Rolo | .gg/rolo</div>
</div>
</body>
</html>`;
}

function logRecord(rec) {
  try {
    fs.appendFileSync(LOG, JSON.stringify(rec) + '\n');
  } catch (e) {
    console.error('[web] log write failed:', e.message);
  }
}

function send(res, code, body, type = 'text/html; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type });
  res.end(body);
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://placeholder');
  const ip = clientIp(req);
  const ua = req.headers['user-agent'] || '';

  if (url.pathname === '/verify') {
    const state = url.searchParams.get('state') || '';
    if (!verify.getState(state)) {
      return send(res, 400, page('Link expired', '<h1>Link expired</h1><p>Go back to Discord and press the <strong>Verify</strong> button again.</p>', false));
    }
    verify.setStateIp(state, ip);
    const body = `
      <h1>\u2705 Verify your Discord</h1>
      <p>Press continue and log in with Discord to receive your <strong>Verified</strong> role in <strong>${esc(config.BOT_NAME)}</strong>.</p>
      <div class="consent"><strong>Before you continue:</strong><br>Your IP address <code>${esc(ip)}</code> and Discord account will be recorded and linked together for anti-fraud purposes (one account per person).</div>
      <a class="btn" href="${esc(verify.authorizeUrl(state))}">Continue with Discord</a>`;
    return send(res, 200, page('Verify', body));
  }

  if (url.pathname === '/callback') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state') || '';
    if (!code) {
      return send(res, 400, page('Verification failed', '<h1>No code returned</h1><p>Discord did not send a login code. Please try again from the button.</p>', false));
    }

    let token;
    try {
      const r = await fetch('https://discord.com/api/v10/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.CLIENT_ID,
          client_secret: (config.WEB && config.WEB.OAUTH_SECRET) || '',
          grant_type: 'authorization_code',
          code,
          redirect_uri: verify.callbackUrl(),
        }),
      });
      token = await r.json();
    } catch (e) {
      return send(res, 502, page('Discord error', `<h1>Could not reach Discord</h1><p>${esc(e.message)}</p>`, false));
    }

    if (!token.access_token) {
      return send(res, 400, page('Verification failed', `<h1>OAuth failed</h1><p>${esc(token.error_description || token.error || 'Unknown error. Check WEB.OAUTH_SECRET and the redirect URI in the Discord portal.')}</p>`, false));
    }

    const me = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bearer ${token.access_token}` } }).then((r) => r.json());

    const entry = verify.consumeState(state);
    const roleRes = await verify.grantRole(me.id);

    logRecord({
      time: new Date().toISOString(),
      discordId: me.id,
      username: me.global_name || me.username,
      ip,
      userAgent: ua,
      stateLinked: !!entry,
      discordReportedIp: null,
      roleGranted: !!roleRes.ok,
      note: roleRes.ok ? undefined : roleRes.reason,
    });

    const body = roleRes.ok
      ? `<h1>Verified \u2705</h1><p><strong>${esc(me.username)}</strong>, the <strong>Verified</strong> role is now on your Discord account.</p><p>You can close this tab and head back to Discord.</p>`
      : `<h1>Account linked</h1><p><strong>${esc(me.username)}</strong> was verified${roleRes.reason ? ` but the role could not be added: <em>${esc(roleRes.reason)}</em>` : ''}.</p><p>You can close this tab.</p>`;
    return send(res, 200, page('Verified', body));
  }

  if (url.pathname === '/') {
    return send(
      res,
      200,
      page('Endpoint', `<h1>${esc(config.BOT_NAME)}</h1><p>Verification endpoint. Use the <strong>Verify</strong> button in Discord to start.</p>`),
    );
  }

  send(res, 404, page('Not found', '<h1>404</h1><p>Page not found.</p>', false));
}

function start() {
  if (!config.WEB || config.WEB.ENABLED === false) return;
  if (!verify.publicUrl()) {
    console.log('[web] WEB.PUBLIC_URL not set - verification web page disabled');
    return;
  }
  const port = (config.WEB && config.WEB.PORT) || 3000;
  const server = http.createServer((req, res) => {
    handle(req, res).catch((e) => {
      console.error('[web]', e);
      try {
        res.writeHead(500);
        res.end('internal error');
      } catch {}
    });
  });
  server.listen(port, () => console.log(`[web] verification server listening on port ${port} (${verify.publicUrl()})`));
}

module.exports = { start };