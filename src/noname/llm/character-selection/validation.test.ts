import assert from "node:assert/strict";
import test from "node:test";
import { validateCharacterSelection, type CharacterSelectionSnapshot } from "./validation.js";

const snapshot: CharacterSelectionSnapshot = {
	count: 2,
	candidates: [
		{
			ref: "c0",
			source: "a",
			versions: [
				{ name: "a1", groups: ["wei", "shu"] },
				{ name: "a2", groups: [] },
			],
		},
		{ ref: "c1", source: "b", versions: [{ name: "b1", groups: [] }] },
		{ ref: "c2", source: "a", versions: [{ name: "a3", groups: [] }] },
		{ ref: "c3", source: "d", versions: [{ name: "d1", groups: ["wei"] }] },
	],
};

test("校验单双将顺序、具体版本和主将合法势力", () => {
	assert.deepEqual(
		validateCharacterSelection(snapshot, {
			characters: [
				{ ref: "c0", version: "a1" },
				{ ref: "c1", version: "b1" },
			],
			group: "shu",
		}),
		{ characters: ["a1", "b1"], sources: ["a", "b"], group: "shu" }
	);
	assert.deepEqual(
		validateCharacterSelection(
			{ ...snapshot, count: 1 },
			{
				characters: [{ ref: "c0", version: "a2" }],
			}
		),
		{ characters: ["a2"], sources: ["a"] }
	);
});

test("单势力主将自动兜底且无可选势力主将忽略多余势力参数", () => {
	const singleSnapshot: CharacterSelectionSnapshot = { ...snapshot, count: 1 };
	for (const extra of [{}, { group: "wei" }, { group: "wu" }, { group: "" }, { group: null }]) {
		assert.deepEqual(
			validateCharacterSelection(singleSnapshot, {
				characters: [{ ref: "c3", version: "d1" }],
				...extra,
			}),
			{ characters: ["d1"], sources: ["d"], group: "wei" }
		);
	}
	assert.deepEqual(
		validateCharacterSelection(snapshot, {
			characters: [
				{ ref: "c1", version: "b1" },
				{ ref: "c0", version: "a1" },
			],
			group: "wei",
		}),
		{ characters: ["b1", "a1"], sources: ["b", "a"] }
	);
});

test("拒绝越界版本、重复来源、错误数量及多势力主将不合法势力", () => {
	const a = { ref: "c0", version: "a1" };
	const b = { ref: "c1", version: "b1" };
	for (const value of [{ characters: [a], group: "wei" }, { characters: [a, { ref: "c2", version: "a3" }], group: "wei" }, { characters: [a, { ref: "c1", version: "a2" }], group: "wei" }]) {
		assert.throws(() => validateCharacterSelection(snapshot, value));
	}
	for (const value of [{ characters: [a, b], group: "wu" }, { characters: [a, b] }]) {
		assert.throws(() => validateCharacterSelection(snapshot, value), { message: "势力不在合法范围内" });
	}
});
