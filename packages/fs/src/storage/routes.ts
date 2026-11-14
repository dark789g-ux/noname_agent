import type { FastifyInstance } from "fastify";
import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { SqliteStorage, StorageConflict } from "./database";

export function databasePath(staticRoot: string): string {
	let directory = path.resolve(staticRoot);
	while (true) {
		if (existsSync(path.join(directory, "pnpm-workspace.yaml"))) return path.join(directory, "data", "noname.sqlite");
		const parent = path.dirname(directory);
		if (parent === directory) return path.resolve(staticRoot, "..", "data", "noname.sqlite");
		directory = parent;
	}
}

export function isWithin(directory: string, filename: string) {
	const relative = path.relative(directory, filename);
	return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

export function isStoragePath(directory: string, filename: string) {
	const realPath = (target: string): string => {
		try {
			return realpathSync(target);
		} catch {
			const parent = path.dirname(target);
			return parent === target ? target : path.join(realPath(parent), path.basename(target));
		}
	};
	return isWithin(directory, filename) || isWithin(realPath(directory), realPath(filename));
}

export function registerStorage(app: FastifyInstance, filename: string) {
	let storage: SqliteStorage | undefined;
	app.post("/_storage/rpc", { bodyLimit: 10 * 1024 * 1024 * 1024 }, async (request, reply) => {
		// Browser clients may change ports, but arbitrary remote sites must not read local game data.
		const origin = request.headers.origin;
		if (origin) {
			let hostname: string;
			try {
				hostname = new URL(origin).hostname;
			} catch {
				return reply.code(403).send({ error: "无效的来源" });
			}
			if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname)) return reply.code(403).send({ error: "仅允许本机游戏页面访问数据库" });
		}
		try {
			storage ??= new SqliteStorage(filename);
			const body = request.body as { id: string };
			return { result: storage.execute(body?.id, body) };
		} catch (error) {
			request.log.error(error);
			return reply.code(error instanceof StorageConflict ? 409 : 503).send({ error: error instanceof Error ? error.message : String(error) });
		}
	});
	app.addHook("onClose", async () => storage?.close());
}
