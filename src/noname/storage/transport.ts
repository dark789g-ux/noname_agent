export class StorageConflict extends Error {}
type Recovery = (error: Error) => Promise<void>;

let recovery: Promise<void> | undefined;

/** Failed requests remain pending until the player explicitly retries; no success is reported early. */
export async function showStorageFailure(error: Error): Promise<void> {
	if (recovery) return recovery;
	if (typeof document === "undefined") throw error;
	recovery = new Promise<void>(resolve => {
		const overlay = document.createElement("div");
		overlay.dataset.storageError = "true";
		overlay.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#15181ff5;color:white;display:flex;align-items:center;justify-content:center;font:16px/1.7 sans-serif;";
		const panel = document.createElement("div");
		panel.style.cssText = "max-width:600px;padding:32px;white-space:pre-wrap;overflow-wrap:anywhere;";
		const message = document.createElement("p");
		message.textContent = `本地数据库操作失败\n${error.message}\n\n操作尚未确认保存。请检查本地服务与数据库文件，恢复后重试。`;
		const button = document.createElement("button");
		button.textContent = "重试";
		button.style.cssText = "padding:10px 32px;font:inherit;cursor:pointer;";
		button.onclick = () => {
			overlay.remove();
			recovery = undefined;
			resolve();
		};
		panel.append(message, button);
		overlay.append(panel);
		(document.body || document.documentElement).append(overlay);
	});
	return recovery;
}

export class StorageTransport {
	constructor(
		private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
		private readonly recover: Recovery = showStorageFailure
	) {}

	async request<T = any>(input: Record<string, unknown>): Promise<T> {
		const id = crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join("");
		const body = JSON.stringify({ ...input, id });
		while (true) {
			try {
				const controller = new AbortController();
				const timeout = setTimeout(() => controller.abort(), 15000);
				try {
					const response = await this.fetcher("/_storage/rpc", { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: controller.signal });
					const rawText = await response.text();
					let result: any = null;
					if (rawText) {
						try {
							result = JSON.parse(rawText);
						} catch {
							if (response.ok) throw new Error("本地存储服务返回了无效的 JSON 响应");
						}
					}
					if (response.status === 409) throw new StorageConflict(result?.error || "数据版本冲突");
					if (!response.ok || !result || typeof result !== "object" || !Object.hasOwn(result, "result")) {
						throw new Error(result?.error || `本地存储服务返回 HTTP ${response.status}（请确认 @noname/fs 本地服务正在运行）`);
					}
					return result.result;
				} finally {
					clearTimeout(timeout);
				}
			} catch (error) {
				if (error instanceof StorageConflict) throw error;
				await this.recover(error instanceof Error ? error : new Error(String(error)));
			}
		}
	}
}
