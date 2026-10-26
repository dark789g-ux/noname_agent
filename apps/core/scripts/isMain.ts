import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Detect a direct script invocation on runtimes with or without import.meta.main. */
export function isMain(meta: { url: string; main?: boolean }, entry = process.argv[1]): boolean {
	if (typeof meta.main === "boolean") {
		return meta.main;
	}
	return typeof entry === "string" && pathToFileURL(resolve(entry)).href === meta.url;
}
