import assert from "node:assert/strict";
import test from "node:test";
import { menuBridge } from "./menuBridge";
import { registerOptionsMenuLifecycle } from "./optionsMenuLifecycle";

test("an old options pane cleanup cannot unregister a newer pane bridge", () => {
	let oldClears = 0;
	let newClears = 0;
	const oldRequest = () => {};
	const newRequest = () => {};
	const disposeOld = registerOptionsMenuLifecycle(oldRequest, () => oldClears++);
	const disposeNew = registerOptionsMenuLifecycle(newRequest, () => newClears++);

	disposeOld();
	assert.equal(menuBridge.requestImportData, newRequest);
	assert.equal(menuBridge.clearOptionsMenuState instanceof Function, true);
	assert.equal(oldClears, 1);
	assert.equal(newClears, 0);

	disposeNew();
	assert.equal(menuBridge.requestImportData, null);
	assert.equal(menuBridge.clearOptionsMenuState, null);
	assert.equal(newClears, 1);
});
