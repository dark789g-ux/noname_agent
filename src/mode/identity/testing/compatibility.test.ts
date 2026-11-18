import assert from "node:assert/strict";
import test from "node:test";
import { identityFingerprints } from "./attitudeVectors.js";

test("mode registration and 4500 attitude vectors match the pre-refactor baseline", async () => {
	const { shape, attitudes, createMode } = await identityFingerprints();
	// Recorded from the user's working identity.js before any implementation move.
	assert.equal(shape, "94a1f5f69d10c0b8a2a779542580315495c36a01e43743dbf42f17e76eb1fc06");
	assert.deepEqual(attitudes, {
		normal: "1f7e2f23fc25a6f68647321a515de1a5cb5204d77995d77581823e5b3150964e",
		stratagem: "6e53062e82d65448220885f85a7b589c27f5e9e8e25cceec40a094713db54758",
		purple: "5c40f4651a5406f39c0852e64ab03d71fc886f405c08e2fe45896db8f2dc8efd",
	});
	const first = createMode();
	const second = createMode();
	for (const key of ["game", "get", "skill", "translate", "help", "element", "start"]) assert.notEqual(first[key], second[key], key);
	assert.notEqual(first.skill.sixiang_baihu.subSkill, second.skill.sixiang_baihu.subSkill);
	assert.notEqual(first.game.chooseCharacter, second.game.chooseCharacter);
	assert.notEqual(first.get.realAttitude, second.get.realAttitude);
	assert.throws(() => Reflect.construct(first.game.chooseCharacter, []), TypeError);
});
