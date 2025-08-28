# Discord Linked Roles — Template

Lightweight Node.js template to sync Discord Role Connection metadata from a simple JSON-backed data store.

This repository demonstrates a minimal approach to provide Discord Role Connections (role-linked metadata) for users, using:

- Express for a small HTTP server
- A file-backed JSON database (`db.json`) for role lists
- Discord OAuth2 for user authorization (role_connections.write)
- Bot token usage to register role-connection metadata with Discord

This project is intended as a public template you can fork and adapt for your own server.

## Features

- Store role membership lists in `db.json` (e.g., `roles.is_staff: ["12345"]`).
- Exchange Discord OAuth tokens and persist them in-memory (simple token store) for metadata pushes.
- Push Role Connection metadata per-user to Discord so the application can read platform-specific fields.
- Admin endpoints to add/remove users from role lists.
- A small `register.js` helper to register role-connection metadata definitions on the Discord application.

## Quick start

1. Clone the repo and install dependencies

```bash
git clone https://github.com/your-organization/discord-linked-roles.git
cd discord-linked-roles
npm install
```

2. Configure `config.json` (copy from example or create one)

Example `config.json`:

```json
{
	"clientId": "YOUR_DISCORD_APP_CLIENT_ID",
	"clientSecret": "YOUR_DISCORD_APP_CLIENT_SECRET",
	"token": "YOUR_BOT_TOKEN",
	"redirectUri": "http://localhost:3000/discord-oauth-callback",
	"cookieSecret": "a-secure-cookie-secret"
}
```

- `clientId` and `clientSecret` come from the Discord Developer Portal for your application.
- `token` should be a Bot Token (used only in `register.js` to register metadata).
- `redirectUri` must match the OAuth2 Redirect URI configured in the Developer Portal.

3. Register metadata (run locally)

```bash
node register.js
```

If successful, the script prints a single confirmation line.

4. Start the server

```bash
node server.js
```

Open `http://localhost:3000/linked-role` to start the OAuth flow for a user.

## Data model

`db.json` contains role lists only. Example:

```json
{
	"roles": {
		"is_staff": ["285118390031351809"]
	}
}
```

The server checks these lists to compute boolean metadata (e.g., `is_staff: true` for that user) and pushes it to Discord via the Role Connection API.

## Endpoints (brief)

- `GET /` — health / welcome
- `GET /linked-role` — redirect to Discord OAuth2 consent flow
- `GET /discord-oauth-callback` — OAuth2 callback (exchanges token & pushes metadata)
- `POST /update-metadata` — request metadata push for a user (body: `{ userId }`)
- `POST /remove-metadata` — clear metadata and remove stored tokens for a user
- `POST /admin/add-user` — admin helper to add/remove a user from role lists (body: `{ userId, roles: [...] }`)
- `POST /discord/commands/add-role` — internal endpoint for bot-driven role assignment (requires Bot auth header)

## Security notes

- This template stores OAuth tokens in-memory (`storage.js`). In production you should use an encrypted persistent store.
- `config.json` contains sensitive data. Keep it out of public repositories or use environment variables / secrets manager in production.

## Customization ideas

- Persist tokens in a secure database (Postgres, MongoDB, or an encrypted file store).
- Add role-to-metadata mapping so a role can map to multiple metadata fields.
- Add a UI for admins to manage role lists.
- Add unit tests for the metadata push flow and role DB helpers.

## Troubleshooting

- 400/401 during OAuth/token exchange: check `redirectUri` and client credentials in `config.json` and Developer Portal settings.
- Role metadata not updating: ensure the user has completed OAuth consent and the access token is stored; verify `db.json` contains the user's ID in the correct role array.
- `register.js` returns an HTTP error: verify the bot token in `config.json` and that it has the required application permissions.

## License

MIT
