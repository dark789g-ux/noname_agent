import assert from "node:assert/strict";
import test from "node:test";
import { buildBackupStepDefinitions, materializeViewAsResult, mergeBackupSelectionSpecs, resolveCardTargetSelect, resolveViewAs } from "./backup-protocol.js";
import { assertActionAllowed, assistantToolMessage, isExplicitMultiTurnRejection, materializeDirectShape, parseActionProposal, plainLogValue, remainingTimeoutSec, selectionRequired, uniqueLegacyMatch } from "./protocol.js";
import { buildTools } from "./tools.js";

test("legacy tool arguments normalize to refs", () => {
	assert.deepEqual(parseActionProposal({ id: "t1", name: "use_card", arguments: { card_id: "sha_spade_7", target_ids: [0, 2] } }), {
		kind: "card", cardRefs: ["sha_spade_7"], targetRefs: ["p0", "p2"],
	});
});

test("forced events reject pass in the apply layer", () => {
	assert.throws(() => assertActionAllowed({ kind: "pass" }, true), /forced event/);
	assert.doesNotThrow(() => assertActionAllowed({ kind: "pass" }, false));
});

test("forced action schemas do not expose pass", () => {
	for (const name of ["chooseToUse", "chooseToRespond", "chooseToDiscard"]) {
		const tools = buildTools(name, { cards: [], skills: [] }, undefined, true);
		assert.equal(tools.some(tool => tool.function.name === "pass"), false);
	}
});

test("selection required follows dynamic minimum while allowing zero", () => {
	assert.equal(selectionRequired([0, 1]), false);
	assert.equal(selectionRequired([1, 2]), true);
	assert.equal(selectionRequired([1, 2], false), false);
});

test("ambiguous legacy card ids are rejected", () => {
	const cards = [{ id: "sha" }, { id: "sha" }];
	assert.throws(() => uniqueLegacyMatch(cards, "sha", card => card.id), /ambiguous/);
});

test("only explicit tool schema or tool-role errors disable multi-turn", () => {
	assert.equal(isExplicitMultiTurnRejection({ httpStatus: 400, message: "role tool is unsupported" }), true);
	assert.equal(isExplicitMultiTurnRejection({ httpStatus: 503, message: "upstream unavailable" }), false);
	assert.equal(isExplicitMultiTurnRejection({ httpStatus: 400, message: "invalid model" }), false);
});

test("deadline is recomputed for retry", () => {
	assert.equal(remainingTimeoutSec(30, 20_000, 5_000), 15);
	assert.throws(() => remainingTimeoutSec(30, 5_000, 5_001), /timed out/);
});

test("assistant history retains tool_call id", () => {
	const message = assistantToolMessage({ id: "call_1", name: "select_cards", arguments: { card_refs: ["c0"] } });
	assert.equal(message.tool_calls[0].id, "call_1");
	assert.equal(message.tool_calls[0].function.arguments, '{"card_refs":["c0"]}');
});

test("direct result shapes match content consumers", () => {
	const card = {};
	const target = {};
	const button = { link: ["sha"] };
	assert.deepEqual(materializeDirectShape("chooseToGive", { cards: [card], targets: [target] }), { bool: true, cards: [card] });
	assert.deepEqual(materializeDirectShape("chooseButtonTarget", { buttons: [button], targets: [target] }), { bool: true, buttons: [button], links: [["sha"]], targets: [target] });
	assert.deepEqual(materializeDirectShape("chooseControl", { control: "a", controls: ["b", "a"] }), { bool: true, control: "a", index: 1 });
	assert.deepEqual(materializeDirectShape("chooseNumbers", { numbers: [1, 2] }), { bool: true, numbers: [1, 2] });
});

test("log values remain structured-cloneable and omit engine objects", () => {
	class Card {}
	const circular: any = { refs: ["c0"], card: new Card() };
	circular.self = circular;
	const plain = plainLogValue(circular);
	assert.deepEqual(structuredClone(plain), { refs: ["c0"], self: "[circular]" });
});

test("reqice full backup chain automatically materializes all N cards", () => {
	const cards = [{ id: "c0" }, { id: "c1" }, { id: "c2" }];
	const replay = replayBackupChain({ sourceSkill: "reqice", kind: "chooseToUse", links: [["锦囊", "", "wuzhong"]], backup: { selectCard: -1, filterCard: true, viewAs: { name: "wuzhong" } }, candidates: cards });
	assert.equal(replay.source.skill, "reqice");
	assert.deepEqual(replay.button.links, [["锦囊", "", "wuzhong"]]);
	assert.deepEqual(replay.selectedCards, cards);
	assert.deepEqual(replay.result, { bool: true, skill: "reqice_backup", card: { name: "wuzhong", cards }, cards, targets: [] });
});

test("xintaoluan full backup chain keeps the default one-card selection", () => {
	const cards = [{ id: "c0" }, { id: "c1" }];
	const replay = replayBackupChain({ sourceSkill: "xintaoluan", kind: "chooseToUse", links: [["锦囊", "", "juedou"]], backup: { filterCard: true, viewAs: { name: "juedou" } }, candidates: cards, chosenCards: [cards[1]] });
	assert.equal(replay.cardStep.select, 1);
	assert.deepEqual(replay.selectedCards, [cards[1]]);
	assert.equal(replay.result.card.name, "juedou");
});

test("mbzhaofu full backup chain confirms a legal zero-card viewAs", () => {
	const replay = replayBackupChain({ sourceSkill: "mbzhaofu", kind: "chooseToUse", links: [["基本", "", "sha"]], backup: { selectCard: -1, filterCard: () => false, viewAs: { name: "sha", isCard: true } }, candidates: [{ id: "c0" }] });
	assert.deepEqual(replay.selectedCards, []);
	assert.deepEqual(replay.result.cards, []);
	assert.equal(replay.result.card.name, "sha");
});

test("viewAs respond backup uses selectionSpec viewAs and returns card plus skill", () => {
	const physical = { id: "c0" };
	const replay = replayBackupChain({ sourceSkill: "response_skill", kind: "chooseToRespond", links: [["基本", "", "shan"]], backup: { selectCard: 1, filterCard: true, viewAs: { name: "sha" } }, spec: { viewAs: { name: "shan" } }, candidates: [physical], chosenCards: [physical] });
	assert.deepEqual(replay.result, { bool: true, skill: "response_skill_backup", card: { name: "shan", cards: [physical] }, cards: [physical], targets: [] });
});

test("reqice notarget backup ignores chooseToUse default target filter", () => {
	const event = { name: "chooseToUse", skill: "reqice_backup", player: {}, selectCard: -1, selectTarget: 1, filterCard: () => true, filterTarget: () => true };
	const info = { viewAs: { name: "wuzhong" }, selectCard: -1 };
	const targetSelect = () => resolveCardTargetSelect(info.viewAs, event.player, () => ({ notarget: true, selectTarget: 1 }));
	const steps = buildBackupStepDefinitions(event, info, {}, { cardFilter: event.filterCard, targetFilter: event.filterTarget, targetSelect });
	assert.deepEqual(targetSelect(), [0, 0]);
	assert.equal(steps.some(step => step.type === "target"), false);
	const dynamic = resolveCardTargetSelect({ name: "sha" }, { extra: 1 }, () => ({ selectTarget: (_card: any, player: any) => [1, player.extra + 1] }));
	assert.deepEqual(dynamic, [1, 2]);
});

function replayBackupChain(options: { sourceSkill: string; kind: "chooseToUse" | "chooseToRespond"; links: any[]; backup: any; spec?: any; candidates: any[]; chosenCards?: any[] }): any {
	const skill = `${options.sourceSkill}_backup`;
	const source = { bool: true, skill: options.sourceSkill, cards: [], targets: [] };
	const button = { bool: true, links: options.links };
	const event = { name: options.kind, skill, player: {}, ...options.backup };
	const spec = mergeBackupSelectionSpecs({}, options.spec);
	const steps = buildBackupStepDefinitions(event, options.backup, spec, { cardFilter: card => options.backup.filterCard === true || options.backup.filterCard?.(card) !== false, targetFilter: () => true, targetSelect: () => [0, 0] });
	const cardStep = steps.find(step => step.type === "card");
	const selectedCards = cardStep.select < 0 ? options.candidates.filter(cardStep.filter) : (options.chosenCards ?? []);
	const { definition } = resolveViewAs(spec, options.backup, selectedCards, event.player);
	const result = materializeViewAsResult(skill, definition, selectedCards, [], (card, cards) => ({ ...card, cards }));
	return { source, button, cardStep, selectedCards, result };
}
