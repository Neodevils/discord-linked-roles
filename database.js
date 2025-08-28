import fs from "fs/promises";
import path from "path";

const DB_FILE = path.resolve(new URL(".", import.meta.url).pathname, "db.json");

async function ensureDB() {
	try {
		await fs.access(DB_FILE);
	} catch (e) {
		const initial = { roles: { is_staff: [] } };
		await fs.writeFile(DB_FILE, JSON.stringify(initial, null, 2), "utf8");
	}
}

async function readDB() {
	await ensureDB();
	const raw = await fs.readFile(DB_FILE, "utf8");
	try {
		return JSON.parse(raw);
	} catch (e) {
		const initial = { roles: { is_staff: [] } };
		await fs.writeFile(DB_FILE, JSON.stringify(initial, null, 2), "utf8");
		return initial;
	}
}

async function writeDB(data) {
	await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), "utf8");
}

export async function connectDB() {
	await ensureDB();
}

export async function getRoleMembers(role) {
	const db = await readDB();
	return db.roles && db.roles[role]
		? Array.from(new Set(db.roles[role].map(String)))
		: [];
}

export async function setRoleMembers(role, ids) {
	const db = await readDB();
	db.roles = db.roles || {};
	db.roles[role] = Array.from(new Set((ids || []).map((i) => i.toString())));
	await writeDB(db);
	return db.roles[role];
}

export async function addRoleMember(role, id) {
	const db = await readDB();
	db.roles = db.roles || {};
	db.roles[role] = db.roles[role] || [];
	const sid = id.toString();
	if (!db.roles[role].includes(sid)) db.roles[role].push(sid);
	await writeDB(db);
	return db.roles[role];
}

export async function removeRoleMember(role, id) {
	const db = await readDB();
	db.roles = db.roles || {};
	db.roles[role] = db.roles[role] || [];
	const sid = id.toString();
	db.roles[role] = db.roles[role].filter((u) => u.toString() !== sid);
	await writeDB(db);
	return db.roles[role];
}

export default {
	connectDB,
	getRoleMembers,
	setRoleMembers,
	addRoleMember,
	removeRoleMember,
};
