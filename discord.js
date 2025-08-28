import crypto from "crypto";
import fs from "fs";
import path from "path";
import * as storage from "./storage.js";

let config = {};
try {
	const cfgPath = path.resolve(
		path.dirname(new URL(import.meta.url).pathname),
		"config.json",
	);
	config = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
} catch (e) {
	config = {};
}

export function getOAuthUrl() {
	const state = crypto.randomUUID();
	const url = new URL("https://discord.com/api/oauth2/authorize");
	url.searchParams.set(
		"client_id",
		process.env.CLIENT_ID || config.clientId || config.client_id,
	);
	url.searchParams.set(
		"redirect_uri",
		process.env.REDIRECT_URI || config.redirectUri || config.redirect_uri,
	);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("state", state);
	url.searchParams.set("scope", "role_connections.write identify");
	url.searchParams.set("prompt", "consent");
	return { state, url: url.toString() };
}

export async function getOAuthTokens(code) {
	const url = "https://discord.com/api/v10/oauth2/token";
	const body = new URLSearchParams({
		client_id: process.env.CLIENT_ID || config.clientId || config.client_id,
		client_secret:
			process.env.CLIENT_SECRET ||
			config.clientSecret ||
			config.client_secret,
		grant_type: "authorization_code",
		code,
		redirect_uri:
			process.env.REDIRECT_URI ||
			config.redirectUri ||
			config.redirect_uri,
	});

	const response = await fetch(url, {
		method: "POST",
		body,
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
	});

	if (response.ok) return await response.json();
	const errorText = await response.text();
	throw new Error(
		`Error fetching OAuth tokens: [${response.status}] ${errorText}`,
	);
}

export async function getAccessToken(userId, tokens) {
	if (Date.now() > tokens.expires_at) {
		const url = "https://discord.com/api/v10/oauth2/token";
		const body = new URLSearchParams({
			client_id:
				process.env.CLIENT_ID || config.clientId || config.client_id,
			client_secret:
				process.env.CLIENT_SECRET ||
				config.clientSecret ||
				config.client_secret,
			grant_type: "refresh_token",
			refresh_token: tokens.refresh_token,
		});

		const response = await fetch(url, {
			method: "POST",
			body,
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
		});

		if (response.ok) {
			const newTokens = await response.json();
			newTokens.expires_at = Date.now() + newTokens.expires_in * 1000;
			await storage.storeDiscordTokens(userId, newTokens);
			return newTokens.access_token;
		}
		const errorText = await response.text();
		throw new Error(
			`Error refreshing access token: [${response.status}] ${errorText}`,
		);
	}
	return tokens.access_token;
}

export async function getUserData(tokensOrUserId, botToken = null) {
	let url, headers;
	if (botToken) {
		url = `https://discord.com/api/v10/users/${tokensOrUserId}`;
		headers = { Authorization: `Bot ${botToken}` };
	} else {
		url = "https://discord.com/api/v10/oauth2/@me";
		headers = { Authorization: `Bearer ${tokensOrUserId.access_token}` };
	}

	const response = await fetch(url, { headers });
	const contentType = response.headers.get("content-type");
	if (!contentType || !contentType.includes("application/json")) {
		const errorText = await response.text();
		throw new Error(
			`Invalid response type: ${contentType}. Error: ${errorText}`,
		);
	}

	if (response.ok) {
		try {
			const data = await response.json();
			const user = botToken ? data : data.user;
			if (!user || !user.id || !user.username)
				throw new Error(
					"Invalid user data structure received from Discord API",
				);
			return user;
		} catch (error) {
			throw new Error(`JSON parse error: ${error.message}`);
		}
	}
	const errorText = await response.text();
	throw new Error(
		`Error fetching user data: [${response.status}] ${errorText}`,
	);
}

export async function pushMetadata(userId, tokens, metadata) {
	const userData = await getUserData(tokens);
	const username = userData.username;
	const url = `https://discord.com/api/v10/users/@me/applications/${
		process.env.CLIENT_ID || config.clientId || config.client_id
	}/role-connection`;
	const accessToken = await getAccessToken(userId, tokens);

	const body = {
		platform_name: "BlitzForge Studios",
		platform_username: "@" + username,
		metadata,
	};

	const response = await fetch(url, {
		method: "PUT",
		body: JSON.stringify(body),
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
		},
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(
			`Error pushing metadata: [${response.status}] ${errorText}`,
		);
	}
}

export async function getMetadata(userId, tokens) {
	const url = `https://discord.com/api/v10/users/@me/applications/${
		process.env.CLIENT_ID || config.clientId || config.client_id
	}/role-connection`;
	const accessToken = await getAccessToken(userId, tokens);

	const response = await fetch(url, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});
	if (response.ok) return await response.json();
	const errorText = await response.text();
	throw new Error(
		`Error getting metadata: [${response.status}] ${errorText}`,
	);
}
