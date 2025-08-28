import express from "express";
import cookieParser from "cookie-parser";
import fs from "fs";
import path from "path";
import * as discord from "./discord.js";
import * as storage from "./storage.js";
import {
	connectDB,
	getRoleMembers,
	addRoleMember,
	removeRoleMember,
	setRoleMembers,
} from "./database.js";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
let config = {};
try {
	const cfgPath = path.resolve(__dirname, "config.json");
	config = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
} catch (e) {
	config = {};
}
const app = express();
app.use(
	cookieParser(
		process.env.COOKIE_SECRET || config.cookieSecret || "dev-secret",
	),
);
app.use(express.static("public"));
app.use(express.json());

let allowedIDs = { is_staff: [] };

const _recentPushes = new Map();

async function updateMetadata(userId, source = "internal") {
	const tokens = await storage.getDiscordTokens(userId);
	if (!tokens) return;

	const staffMembers = await getRoleMembers("is_staff");
	const isStaff = staffMembers.map(String).includes(String(userId));
	const metadata = { is_staff: !!isStaff };

	try {
		const key = JSON.stringify(metadata);
		const recent = _recentPushes.get(userId);
		const now = Date.now();
		if (recent && recent.key === key && now - recent.ts < 3000) return;
		_recentPushes.set(userId, { key, ts: now });
	} catch (e) {}

	try {
		await discord.pushMetadata(userId, tokens, metadata);
	} catch (e) {}
}

app.get("/", (req, res) => res.send("👋"));

app.get("/linked-role", async (req, res) => {
	const { url, state } = discord.getOAuthUrl();
	res.cookie("clientState", state, { maxAge: 5 * 60 * 1000, signed: true });
	res.redirect(url);
});

app.get("/discord-oauth-callback", async (req, res) => {
	try {
		const code = req.query["code"];
		const discordState = req.query["state"];
		const { clientState } = req.signedCookies;
		if (clientState !== discordState) return res.sendStatus(403);

		const tokens = await discord.getOAuthTokens(code);
		const userData = await discord.getUserData(tokens);
		if (!userData || !userData.id)
			throw new Error("Discord API'den geçersiz kullanıcı verisi alındı");

		const userId = userData.id;
		await storage.storeDiscordTokens(userId, {
			access_token: tokens.access_token,
			refresh_token: tokens.refresh_token,
			expires_at: Date.now() + tokens.expires_in * 1000,
		});

		await updateMetadata(userId, "oauth-callback");
		res.sendFile(path.resolve(__dirname, "discord-oauth-callback.html"));
	} catch (e) {
		res.sendStatus(500);
	}
});

app.post("/update-metadata", async (req, res) => {
	try {
		const userId = req.body.userId;
		await updateMetadata(userId, "update-endpoint");
		res.sendStatus(204);
	} catch (e) {
		res.sendStatus(500);
	}
});

app.post("/remove-metadata", async (req, res) => {
	try {
		const userId = req.body.userId;
		const tokens = await storage.getDiscordTokens(userId);
		if (!tokens) return res.sendStatus(404);

		const metadata = { is_staff: false };
		await discord.pushMetadata(userId, tokens, metadata);
		await removeRoleMember("is_staff", userId);
		await storage.deleteDiscordTokens(userId);

		await updateAllowedIDs();
		res.sendStatus(204);
	} catch (e) {
		res.sendStatus(500);
	}
});

await connectDB();
await updateAllowedIDs();

async function updateAllowedIDs() {
	const members = await getRoleMembers("is_staff");
	allowedIDs = { is_staff: Array.from(new Set((members || []).map(String))) };
}

app.post("/admin/add-user", async (req, res) => {
	const { userId, username, roles } = req.body;
	if (roles && Array.isArray(roles)) {
		if (roles.includes("staff") || roles.includes("is_staff")) {
			await addRoleMember("is_staff", userId);
		} else {
			await removeRoleMember("is_staff", userId);
		}
	}

	await updateAllowedIDs();
	res.sendStatus(200);
});

app.post("/discord/commands/add-role", async (req, res) => {
	try {
		const { userId, role } = req.body;
		if (!userId || !role)
			return res
				.status(400)
				.json({ error: "userId ve role parametreleri gerekli" });

		const validRoles = ["staff", "is_staff"];
		if (!validRoles.includes(role))
			return res.status(400).json({
				error: `Geçersiz rol. Geçerli roller: ${validRoles.join(", ")}`,
			});

		const auth = req.headers.authorization;
		if (!auth || !auth.startsWith("Bot "))
			return res.status(401).json({ error: "Yetkilendirme gerekli" });

		const botToken = auth.split(" ")[1];
		try {
			const userData = await discord.getUserData(userId, botToken);
			if (!userData || !userData.username)
				return res.status(404).json({
					success: false,
					error: "Discord kullanıcısı bulunamadı veya kullanıcı bilgileri eksik",
				});

			if (role === "staff" || role === "is_staff")
				await addRoleMember("is_staff", userId);
			await updateAllowedIDs();

			return res.status(200).json({
				success: true,
				message: `${userData.username} kullanıcısına ${role} rolü verildi`,
			});
		} catch (e) {
			if (e.message && e.message.includes("Invalid response type"))
				return res.status(502).json({
					success: false,
					error: "Discord API'den geçersiz yanıt alındı",
				});
			return res.status(500).json({
				success: false,
				error: "Sunucu hatası oluştu: " + (e.message || ""),
			});
		}
	} catch (outerError) {
		return res
			.status(500)
			.json({ success: false, error: "Beklenmeyen bir hata oluştu" });
	}
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
	console.log(`Server running on port ${port}`);
});
