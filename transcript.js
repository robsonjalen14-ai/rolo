const fs = require('node:fs');
const path = require('node:path');
const { AttachmentBuilder } = require('discord.js');
const config = require('./config.json');
const { resolvePath } = require('./utils');

const tracked = new Map();

function serialize(m) {
  return {
    id: m.id,
    ts: m.createdTimestamp,
    author: m.author ? m.author.tag : 'Unknown',
    authorId: m.author ? m.author.id : null,
    content: m.content || '',
    attachments: [...m.attachments.values()].map((a) => a.url),
    embeds: m.embeds ? m.embeds.length : 0,
  };
}

/** Keeps a rolling log of messages so transcripts survive restarts. */
function track(msg) {
  if (!msg.guild || !msg.channel) return;
  let arr = tracked.get(msg.channel.id);
  if (!arr) {
    arr = [];
    tracked.set(msg.channel.id, arr);
  }
  if (arr.some((m) => m.id === msg.id)) return;
  arr.push(serialize(msg));
  const max = config.MAX_MESSAGES_TRACKED || 400;
  if (arr.length > max) arr.splice(0, arr.length - max);
}

/** Builds a plain text transcript for a ticket channel. */
async function build(channel, meta = {}) {
  const seen = new Set();
  const msgs = [];

  for (const m of tracked.get(channel.id) || []) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      msgs.push(m);
    }
  }

  try {
    let before;
    for (let page = 0; page < 3; page++) {
      const fetched = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
      if (!fetched || !fetched.size) break;
      fetched.forEach((m) => {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          msgs.push(serialize(m));
        }
      });
      before = fetched.last().id;
      if (fetched.size < 100) break;
    }
  } catch {}

  msgs.sort((a, b) => a.ts - b.ts);

  const line = '='.repeat(64);
  const header = [
    line,
    ` ${config.BOT_NAME} - Ticket Transcript`,
    line,
    ` Guild     : ${channel.guild ? channel.guild.name : 'Unknown'}`,
    ` Channel   : #${channel.name} (${channel.id})`,
    ` Category  : ${meta.category || 'Support'}`,
    ` Opener    : ${meta.openerId ? `${meta.openerId}` : 'Unknown'}`,
    ` Opened    : ${meta.openedAt ? new Date(meta.openedAt).toISOString() : 'Unknown'}`,
    ` Closed by : ${meta.closedBy || 'N/A'}`,
    ` Closed at : ${new Date().toISOString()}`,
    ` Messages  : ${msgs.length}`,
    line,
    '',
  ].join('\n');

  const body =
    msgs
      .map((m) => {
        const t = new Date(m.ts).toISOString();
        const att = m.attachments.length ? `\n      [attachment: ${m.attachments.join(', ')}]` : '';
        const emb = m.embeds ? `\n      [embeds: ${m.embeds}]` : '';
        return `[${t}] ${m.author} (${m.authorId || ''}): ${m.content}${att}${emb}`;
      })
      .join('\n') || '(no messages)';

  return `${header}${body}\n\n${line}\n End of transcript - Made By Rolo .gg/rolo\n${line}\n`;
}

/** Saves the transcript to disk and returns a Discord attachment. */
function save(channel, text) {
  const dir = resolvePath(config.TRANSCRIPT_DIR || './transcripts');
  fs.mkdirSync(dir, { recursive: true });
  const safe = (channel.name || 'ticket').replace(/[^\w-]+/g, '_');
  const name = `${safe}-${Date.now()}.txt`;
  const full = path.join(dir, name);
  fs.writeFileSync(full, text, 'utf8');
  return new AttachmentBuilder(full, { name });
}

module.exports = { track, build, save, tracked };