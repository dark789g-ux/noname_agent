import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { identityGetFiles } from "../../../scripts/identityGetFiles.js";

test("identity/Get facades and extracted source, contracts and fixtures stay within 500 lines", () => {
	const core = fileURLToPath(new URL("../../../", import.meta.url));
	for (const file of identityGetFiles(core)) {
		const source = readFileSync(file, "utf8").replaceAll("\r\n", "\n");
		const lines = source.split("\n").length - Number(source.endsWith("\n"));
		assert.ok(lines <= 500, `${file}: ${lines}`);
	}
});
