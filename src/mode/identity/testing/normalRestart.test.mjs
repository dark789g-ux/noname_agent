import assert from "node:assert/strict";
import test from "node:test";
import { identityFixture } from "../../../noname/llm/character-selection/identity-fixture.mjs";

test("identity setting restarts the async event and stale controls cannot mutate the next round", async t => {
	const fixture = await identityFixture({ controlSelf: false, pauseManual: true, changeIdentity: true });
	t.after(() => fixture.close());
	const pending = fixture.run();
	await fixture.waitForManual();
	const oldRound = fixture.event.selectionRound;
	const setting = fixture.ui.dialog.content.children[1].children.find(child => child.link === "fan");
	assert.ok(setting, "the actual settings panel exposes the requested identity");
	setting.click();
	await pending;
	assert.equal(oldRound.outcome, "restart");
	assert.equal(oldRound.current(), false);
	assert.equal(fixture.game.me.identity, "fan");
	assert.ok(fixture.game.players.every(player => player.initCalls === 1));
	assert.equal(fixture.game.zhu.maxHp, 5);
	const identities = fixture.game.players.map(player => player.identity);
	const requests = fixture.requests.length;
	setting.click();
	assert.deepEqual(
		fixture.game.players.map(player => player.identity),
		identities
	);
	assert.equal(fixture.requests.length, requests);
	assert.equal(fixture.event.selectionRound, undefined);
});

test("cancelling a pending human round never initializes players or starts later seats", async t => {
	const fixture = await identityFixture({ controlSelf: false, pauseManual: true });
	t.after(() => fixture.close());
	const pending = fixture.run();
	await fixture.waitForManual();
	const controller = fixture.event.llmOpening;
	fixture.event.selectionRound.cancel();
	await pending;
	assert.ok(fixture.game.players.every(player => player.initCalls === 0));
	assert.equal(fixture.requests.length, 0);
	assert.equal(controller.state.valid, false);
	assert.equal(fixture.event.selectionRound, undefined);
});

for (const options of [{ connect: true }, { brawl: {} }, { mode: "zhong" }, { mode: "stratagem" }]) {
	test(`non-ordinary branch keeps its legacy event array: ${JSON.stringify(options)}`, async t => {
		const fixture = await identityFixture(options);
		t.after(() => fixture.close());
		assert.equal(Array.isArray(fixture.event.contents), true);
		assert.equal(fixture.event.contents.length, 3);
	});
}

test("retained legacy reselect control observes candidate counts changed by the identity setting", async t => {
	const fixture = await identityFixture({ brawl: {}, controlSelf: false, changeIdentity: true });
	t.after(() => fixture.close());
	const { ui, game, event, settings, status } = fixture;
	settings.choice_fan = 5;
	ui.create.control = (_label, callback) => ({ callback });
	const createDiv = ui.create.div;
	ui.create.div = (...args) => Object.assign(createDiv(...args), { addTempClass() {} });
	ui.create.buttons = (list, _type, parentNode) => list.map(link => ({ link, parentNode }));
	const createDialog = ui.create.dialog;
	ui.create.dialog = (...args) => {
		const dialog = createDialog(...args);
		const parentNode = { remove() {} };
		for (const button of dialog.buttons) button.parentNode = parentNode;
		dialog.content.insertBefore = () => {};
		return dialog;
	};
	game.check = game.uncheck = () => {};
	const { prepareSelection } = await fixture.runtime.import("mode/identity/choose/prepare.ts");
	const context = await prepareSelection(event);
	ui.create.cheat();
	const oldControl = ui.cheat;
	assert.equal(ui.dialog.buttons.length, 5);
	assert.equal(context.num, 3);
	status.event = { parent: event, dialog: ui.dialog };
	const setting = ui.dialog.content.children[1].children.find(child => child.link === "fan");
	setting.click();
	assert.equal(context.num, 5);
	status.event = { parent: event, dialog: ui.dialog };
	oldControl.callback();
	assert.equal(ui.cheat, oldControl);
	assert.equal(ui.dialog.buttons.length, 7, "original control uses two monarchs plus the updated five candidates");
	assert.equal(fixture.requests.length, 0);
});
