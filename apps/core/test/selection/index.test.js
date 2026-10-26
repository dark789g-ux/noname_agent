import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { SelectionContext, SelectionSession, SelectionStatus, SelectionStep, SelectionValidator } from "../../noname/library/selection/index.js";

test("headless session accepts a complete card and target selection", () => {
	const cards = [{ id: "c0" }, { id: "c1" }];
	const targets = [{ id: "p0" }, { id: "p1" }];
	const session = new SelectionSession({
		context: new SelectionContext({ event: {}, player: {}, source: "test" }),
		filterOk: view => view.selected.card.length === 1 && view.selected.target.length === 1,
	});
	session.register(new SelectionStep({ id: "cards", type: "card", items: cards, select: 1 }));
	session.register(new SelectionStep({ id: "targets", type: "target", items: targets, select: 1 }));

	assert.equal(session.setSelection("cards", [cards[0]]).status, SelectionStatus.COMPLETE);
	assert.equal(session.setSelection("targets", [targets[1]]).status, SelectionStatus.COMPLETE);
	assert.equal(session.finalize().status, SelectionStatus.COMPLETE);
});

test("dynamic range is recomputed against explicit headless selections", () => {
	const cards = [{ id: "c0" }, { id: "c1" }];
	const session = new SelectionSession({ context: new SelectionContext({ event: {}, player: {} }) });
	session.register(
		new SelectionStep({
			id: "cards",
			type: "card",
			items: cards,
			select: view => (view.selected.card.length ? [0, 1] : [1, 1]),
		})
	);

	assert.equal(session.evaluate("cards", []).status, SelectionStatus.PENDING);
	assert.equal(session.setSelection("cards", [cards[0]]).status, SelectionStatus.COMPLETE);
});

test("duplicate and unavailable values are rejected without DOM state", () => {
	const allowed = { id: "c0" };
	const denied = { id: "c1" };
	const session = new SelectionSession({ context: new SelectionContext({ event: {}, player: {} }) });
	session.register(new SelectionStep({ id: "cards", type: "card", items: [allowed, denied], select: 1, isSelectable: item => item === allowed }));

	assert.equal(session.setSelection("cards", [allowed, allowed]).status, SelectionStatus.INVALID);
	assert.equal(session.setSelection("cards", [denied]).status, SelectionStatus.INVALID);
});

test("final filterOk remains authoritative after every step completed", () => {
	const card = { id: "c0" };
	const session = new SelectionSession({
		context: new SelectionContext({ event: {}, player: {} }),
		filterOk: () => false,
	});
	session.register(new SelectionStep({ id: "cards", type: "card", items: [card], select: 1 }));
	assert.equal(session.setSelection("cards", [card]).status, SelectionStatus.COMPLETE);
	assert.equal(session.finalize().status, SelectionStatus.INVALID);
});

test("zero-card steps complete without needing a synthetic DOM selection", () => {
	const session = new SelectionSession({ context: new SelectionContext({ event: {}, player: {} }) });
	session.register(new SelectionStep({ id: "cards", type: "card", items: [], select: 0 }));
	assert.equal(session.evaluate("cards", []).status, SelectionStatus.COMPLETE);
	assert.equal(session.finalize().status, SelectionStatus.COMPLETE);
});

test("an optional dynamic card step accepts an empty explicit selection", () => {
	const card = { id: "c0" };
	const session = new SelectionSession({ context: new SelectionContext({ event: {}, player: {} }) });
	session.register(new SelectionStep({ id: "card", type: "card", items: [card], select: [0, 1], required: false }));
	assert.equal(session.setSelection("card", []).status, SelectionStatus.COMPLETE);
	assert.equal(session.finalize().status, SelectionStatus.COMPLETE);
});

test("forced selection only accepts an empty result when no legal item exists", () => {
	const none = SelectionValidator.evaluate({ type: "card", items: [], selected: [], range: [1, 1], forced: true, required: false });
	const available = SelectionValidator.evaluate({ type: "card", items: ["c0"], selected: [], range: [1, 1], forced: true, required: false });
	assert.equal(none.status, SelectionStatus.COMPLETE);
	assert.equal(available.status, SelectionStatus.PENDING);
});

test("GameEvent backup restores selectionSpec or removes a temporary one", () => {
	const source = readFileSync(new URL("../../noname/library/element/GameEvent/selectionMethods.ts", import.meta.url), "utf8");
	assert.match(source, /selectionSpecExists: Object\.hasOwn\(this, "selectionSpec"\)/);
	assert.match(source, /if \(this\._backup\.selectionSpecExists\) \{\s*this\.selectionSpec = this\._backup\.selectionSpec;\s*\} else \{\s*delete this\.selectionSpec;/s);
});

test("selection context preserves identities and copies string-reference selections", () => {
	const event = {}, player = {};
	const initial = ["c0"];
	const context = new SelectionContext({ event, player, selected: { card: initial } });
	initial.push("outside");
	context.bindInitialSelection("cards", "card");
	const copy = context.getStepSelected("cards");
	copy.push("outside");
	assert.deepEqual(context.getStepSelected("cards"), ["c0"]);
	const view = context.getReadonlyView();
	assert.equal(view.event, event);
	assert.equal(view.player, player);
	assert.deepEqual(view.selected.card, ["c0"]);
	assert.ok(Object.isFrozen(view.selected.card));
	assert.ok(Object.isFrozen(view.steps.cards.items));
});
