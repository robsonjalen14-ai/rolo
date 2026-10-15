# Rolo External Bot

Support/ticket bot for **Rolo External** - ticket panel with categories, txt transcripts (saved + DM'd), AutoMod, gofile download commands and KeyAuth account tools. Coded in Node.js (discord.js v14).

- Bot name: **Rolo External Bot**
- Presence: **DND** - "Made By Rolo .gg/rolo"
- Staff role (all staff commands): `1560392751583858708`
- Customer role: `1560326513931456532`

## Features

- **Ticket panel** - embed + dropdown, exactly like your reference (Partnership, Enterprise, Customer, Cheat/Bypass Reports, Regular).
- **Blue GUI** - every embed uses the blue `#2f6bff` theme with the "Made By Rolo | .gg/rolo" footer.
- **Ticket buttons** - Close (staff/opener), Claim (staff), Transcript (staff).
- **Transcripts** - `.txt` transcript saved to `/transcripts`, DM'd to the ticket opener, and optionally posted to a log channel.
- **AutoMod** - blocked words, invite links, mass mentions, caps, spam detection, strike/timeout system + log channel. Toggle with `/automod`.
- **Downloads** - `/download` (embed + download button) and `/downloadlink` (raw link, easy to copy). Customer role gated.
- **KeyAuth tools** - `/createaccount` and `/makeaccount` (create a license from KeyAuth, optional DM of credentials), `/resethwid` (reset a user's HWID lock).

## Setup

1. **Install Node.js 18+** then run:
   ```
   npm install
   ```
2. **Create the bot** at https://discord.com/developers/applications
   - Bot tab → enable **Presence Intent**, **Server Members Intent** and **Message Content Intent**.
   - OAuth2 → URL Generator → scopes: `bot`, `applications.commands`.
     Permissions: `Manage Channels`, `Manage Roles`, `View Channels`, `Send Messages`, `Read Message History`, `Attach Files`, `Embed Links`, `Moderate Members` (timeout), `Manage Messages`.
3. **Fill in `config.json`**:
   - `TOKEN`, `CLIENT_ID`, `GUILD_ID`
   - `TICKET_CATEGORY_ID` - category where ticket channels are created (leave `""` to create at root)
   - `TRANSCRIPT_LOG_CHANNEL_ID` - channel that receives a transcript on every close (optional)
   - `AUTOMOD_LOG_CHANNEL_ID` - AutoMod log channel (optional)
   - `DOWNLOAD_LINK` - your gofile link, `DOWNLOAD_PASSWORD` - zip password
   - `KEYAUTH.SELLER_KEY` - from https://keyauth.cc/app/?page=seller-settings (needs the Seller subscription) for `/createaccount` and `/resethwid`
4. **Avatar**: save the Rolo logo as `assets/avatar.png`, then run:
   ```
   npm run avatar
   ```
   (Or set `SET_AVATAR_ON_START: true` to apply it on every boot.)
5. **Start the bot**:
   ```
   npm start
   ```
   Commands register automatically to `GUILD_ID`.
6. In Discord, run **`/ticketpanel`** in your ticket-creation channel.

## Commands

| Command | Who | What it does |
| --- | --- | --- |
| `/ticketpanel` | Staff role | Posts the ticket panel (dropdown) |
| `/download` | Customers | Embed with gofile link + download button |
| `/downloadlink` | Customers | Sends the raw gofile link |
| `/close` | Staff / opener | Closes ticket, saves + DMs transcript, deletes channel |
| `/lock` `/unlock` | Staff role | Locks/unlocks the ticket |
| `/adduser` `/removeuser` | Staff role | Adds/removes a user in the ticket |
| `/transcript` | Staff role | Exports a `.txt` transcript now |
| `/automod` | Staff role | enable / disable / status |
| `/createaccount` `/makeaccount` | Rolo staff role | Creates a KeyAuth license (username, days, sub, optional DM) |
| `/resethwid` | Rolo staff role | Resets a KeyAuth user's HWID |
| `/help` `/ping` | Everyone | Command list / latency |

## Notes

- Staff bypass AutoMod automatically (and anyone with Manage Messages).
- `DELETE_TICKET_ON_CLOSE: false` keeps the channel and just locks it instead of deleting.
- Ticket numbers are stored in `data/ticketCounter.json`, transcripts in `transcripts/`.
- KeyAuth calls use the Seller API (`https://keyauth.cc/api/seller/`, change via `KEYAUTH.SELLER_URL` if your panel uses another domain).