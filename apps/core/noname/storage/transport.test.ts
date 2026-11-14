import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { StorageTransport } from "./transport.js";

test("storage failure remains pending, shows retry UI, then resumes the same operation", async t => {
	const dom = new JSDOM("<body></body>");
	const previousDocument = globalThis.document;
	globalThis.document = dom.window.document;
	t.after(() => {
		globalThis.document = previousDocument;
		dom.window.close();
	});
	let available = false;
	let completed = false;
	const bodies: string[] = [];
	const transport = new StorageTransport(async (_url, options) => {
		bodies.push(String(options?.body));
		if (!available) throw new Error("local service disconnected");
		return Response.json({ result: { committed: true } });
	});
	const pending = transport.request({ action: "put", namespace: "main", store: "config" }).then(value => {
		completed = true;
		return value;
	});
	await new Promise(resolve => setImmediate(resolve));
	assert.equal(completed, false);
	assert.match(document.body.textContent || "", /操作尚未确认保存/);
	assert.match(document.body.textContent || "", /local service disconnected/);
	available = true;
	(document.querySelector("button") as HTMLButtonElement).click();
	assert.deepEqual(await pending, { committed: true });
	assert.equal(bodies[0], bodies[1]);
	assert.equal(document.querySelector("[data-storage-error]"), null);
});
