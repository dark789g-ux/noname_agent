import { playerTestSource } from "../library/element/Player/testSource.js";
import { field } from "../library/testing/fixtures.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { buildDecisionCandidateSnapshot, resolveAuthoritativeTargetRange } from "./action-candidates.js";

function method(file: string, name: string): string {
	const source: ts.SourceFile = file === "../library/element/player.js" ? playerTestSource() : ts.createSourceFile(file, readFileSync(new URL(file, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
	let found: ts.MethodDeclaration | undefined;
	function visit(node: ts.Node): void {
		if (ts.isMethodDeclaration(node) && node.name.getText(source) === name) found = node;
		ts.forEachChild(node, visit);
	}
	visit(source);
	assert.ok(found, name);
	return `function ${found.getText(source)}`;
}

const chooseToUse = method("../library/element/player.js", "chooseToUse");

function engine() {
	const player = { name: "owner" };
	let mods = 0;
	const game = {
		createEvent: (name: string) => ({
			name,
			setContent() {
				return this;
			},
		}),
		checkMod(_card: any, _player: any, range: [number, number]) {
			mods++;
			if (range[0] === 1 && range[1] === 1) range[1] = 2;
		},
	};
	const get = { card: () => undefined, player: () => player, info: (card: any) => card.info, copy: (value: any) => (Array.isArray(value) ? value.slice() : value), itemtype: (value: any) => (Array.isArray(value) ? "select" : undefined) };
	const selectTarget = field("filter", { get, game }).selectTarget;
	const lib = { filter: { selectTarget } };
	const create = new Function("game", "lib", "get", `return (${chooseToUse});`)(game, lib, get);
	return {
		player,
		selectTarget,
		event: create.call(player),
		modCount: () => mods,
		reset: () => {
			mods = 0;
		},
		runtime: { getCardInfo: get.info, defaultSelectTarget: selectTarget, checkSelectTarget: game.checkMod },
	};
}

test("真实 chooseToUse 默认函数在 UI 未选牌时仍为每张候选牌解析范围，mod 只执行一次", () => {
	const f = engine();
	assert.equal(f.event.selectTarget, f.selectTarget);
	assert.equal(f.event.selectTarget(), undefined, "旧的无参调用可复现日志中的 undefined");
	const card = { name: "sha", info: { selectTarget: 1, filterTarget: () => true } };
	const target = { name: "target" };
	const snapshot = buildDecisionCandidateSnapshot(f.event, f.player, {
		...f.runtime,
		getCandidateSkills: () => [],
		getCandidateCards: () => [{ card, ref: "c0", id: "sha", name: "sha", cardAction: true }],
		getPlayers: () => [f.player, target],
		getTargetId: (_target, index) => String(index),
		getTargetName: target => target.name,
		getSkillInfo: () => undefined,
		autoViewAs: value => value,
	});
	assert.deepEqual(snapshot.actions[0].target.range, [1, 2]);
	assert.equal(f.modCount(), 1);
});

test("默认目标范围与引擎一致：动态函数、自动全选、无目标和区间", () => {
	for (const info of [
		{ selectTarget: 1 },
		{ selectTarget: -1 },
		{ selectTarget: [0, 3] },
		{
			selectTarget: (card: any, player: any) => {
				assert.equal(card.name, "test");
				assert.equal(player.name, "owner");
				return 2;
			},
		},
		{},
		{ filterTarget: () => true },
	]) {
		const f = engine();
		const card = { name: "test", info };
		const expected = f.selectTarget(card, f.player);
		const count = f.modCount();
		f.reset();
		assert.deepEqual(resolveAuthoritativeTargetRange(f.event, card, f.player, f.runtime), expected);
		assert.equal(f.modCount(), count);
	}
});

test("自定义事件范围保留 this、覆盖牌范围并执行一次 mod，不修改原数组", () => {
	const f = engine();
	const raw = [1, 1];
	const event = {
		name: "chooseToUse",
		range: raw,
		selectTarget() {
			return this.range;
		},
	};
	assert.deepEqual(resolveAuthoritativeTargetRange(event, { name: "sha", info: { selectTarget: -1 } }, f.player, f.runtime), [1, 2]);
	assert.equal(f.modCount(), 1);
	assert.deepEqual(raw, [1, 1]);
});

test("非法范围错误包含决策、卡牌、来源、原值类型和函数结果", () => {
	const f = engine();
	assert.throws(
		() => resolveAuthoritativeTargetRange({ name: "chooseToUse", selectTarget: () => undefined }, { name: "sha", info: {} }, f.player, f.runtime),
		(error: any) => {
			assert.equal(error.stage, "translate/action-resolution");
			for (const value of ["decision=chooseToUse", "card=sha", "source=event.selectTarget", "raw=function", "result=undefined"]) assert.ok(error.message.includes(value), value);
			return true;
		}
	);
	assert.equal(f.modCount(), 0);
});

test("非法技能材料范围错误包含技能和步骤来源", () => {
	const f = engine();
	assert.throws(
		() =>
			buildDecisionCandidateSnapshot(f.event, f.player, {
				...f.runtime,
				getCandidateSkills: () => ["broken"],
				getCandidateCards: () => [],
				getPlayers: () => [],
				getTargetId: () => "",
				getTargetName: () => "",
				getSkillInfo: () => ({ selectionSpec: { steps: [{ id: "material", type: "card", select: "bad" }] } }),
				autoViewAs: value => value,
			}),
		(error: any) => error.stage === "translate/action-resolution" && /skill=broken/.test(error.message) && /material.selectCard/.test(error.message) && /string:"bad"/.test(error.message)
	);
});
