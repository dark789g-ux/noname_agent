import assert from "node:assert/strict";
import test from "node:test";
import { createRetryingDatabaseResolver, llmLogDatabaseName, openMainDatabase } from "./database-schema.js";

test("LLM logs use a database separate from the main configuration database", () => {
	assert.equal(llmLogDatabaseName("noname_data"), "noname_data_llm_logs");
});

test("main database opens without requesting a version upgrade", async () => {
	let openArguments: unknown[] = [];
	const request: any = { result: {} };
	const factory = {
		open(...args: unknown[]) {
			openArguments = args;
			queueMicrotask(() => request.onsuccess());
			return request;
		},
	} as unknown as IDBFactory;
	await openMainDatabase(factory, "noname_data");
	assert.deepEqual(openArguments, ["noname_data"]);
});

test("database resolver coalesces opens and retries after a transient failure", async () => {
	let attempts = 0;
	const resolver = createRetryingDatabaseResolver(async () => {
		attempts++;
		if (attempts === 1) throw new Error("temporary failure");
		return { name: "llm" };
	});
	await assert.rejects(Promise.all([resolver(), resolver()]), /temporary failure/);
	assert.equal(attempts, 1);
	assert.deepEqual(await resolver(), { name: "llm" });
	assert.equal(attempts, 2);
	assert.deepEqual(await resolver(), { name: "llm" });
	assert.equal(attempts, 2);
});
