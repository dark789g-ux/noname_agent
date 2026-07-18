// 加载错误集中收集器，供恢复对话框读取，纯数据无副作用

export interface LoadError {
	stage: string;
	name?: string;
	error: unknown;
	timestamp: number;
}

const errors: LoadError[] = [];
const disabledExtensions: string[] = [];

export function record(input: Omit<LoadError, "timestamp">): void {
	const entry: LoadError = {
		...input,
		timestamp: Date.now(),
	};
	errors.push(entry);

	const e = input.error;
	const desc = e instanceof Error ? e.stack : String(e);
	const msg =
		"[loadErrors:" +
		input.stage +
		"]" +
		(input.name ? " 「" + input.name + "」" : "") +
		": " +
		desc;
	console.error(msg, e);
}

export function recordDisabledExtension(name: string): void {
	if (!disabledExtensions.includes(name)) {
		disabledExtensions.push(name);
	}
}

export function getAll(): readonly LoadError[] {
	return errors;
}

export function getDisabledExtensions(): readonly string[] {
	return disabledExtensions;
}

export function hasErrors(): boolean {
	return errors.length > 0;
}

export function summarize(): string {
	if (errors.length === 0) return "";

	const lines: string[] = [];
	const count = Math.min(errors.length, 10);

	for (let i = 0; i < count; i++) {
		const err = errors[i];
		let shortDesc: string;

		if (err.error instanceof Error) {
			shortDesc = err.error.message || String(err.error);
		} else {
			shortDesc = String(err.error);
		}

		if (shortDesc.length > 120) {
			shortDesc = shortDesc.slice(0, 120) + "…";
		}

		const namePart = err.name ? " " + err.name + ":" : "";
		lines.push("• [" + err.stage + "]" + namePart + " " + shortDesc);
	}

	if (errors.length > 10) {
		lines.push("... 还有 " + (errors.length - 10) + " 条");
	}

	return lines.join("\n");
}

export function clear(): void {
	errors.length = 0;
	disabledExtensions.length = 0;
}
