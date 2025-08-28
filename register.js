import fs from "fs";
import path from "path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
let config = {};
try {
	config = JSON.parse(
		fs.readFileSync(path.resolve(__dirname, "config.json"), "utf8"),
	);
} catch (e) {
	process.exit(1);
}

const { clientId, token } = config;

const url = `https://discord.com/api/v10/applications/${clientId}/role-connections/metadata`;

const body = [
	{
		key: "is_staff",
		name: "staff",
		name_localizations: { tr: "yetkili" },
		description: "A role for staff members.",
		description_localizations: { tr: "Yetkililer için bir rol." },
		type: 7,
	},
];

try {
	const response = await fetch(url, {
		method: "PUT",
		headers: {
			Authorization: `Bot ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});

	try {
		await response.json();
	} catch (e) {
		await response.text();
	}

	if (response.ok)
		console.log("Successfully registered role connections metadata.");
	if (!response.ok) process.exitCode = 1;
} catch (e) {
	process.exitCode = 1;
}

async function safeGet(url, token) {
	try {
		const r = await fetch(url, {
			headers: { Authorization: `Bot ${token}` },
		});
		try {
			return { ok: r.ok, status: r.status, data: await r.json() };
		} catch (e) {
			return { ok: r.ok, status: r.status, data: await r.text() };
		}
	} catch (err) {
		return { ok: false, error: err };
	}
}

const getMetadataUrl = `https://discord.com/api/v10/applications/${clientId}/role-connections/metadata`;
await safeGet(getMetadataUrl, token);

const appMeUrl = `https://discord.com/api/v10/oauth2/applications/@me`;
await safeGet(appMeUrl, token);
