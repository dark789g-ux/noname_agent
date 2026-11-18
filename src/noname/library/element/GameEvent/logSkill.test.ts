import assert from "node:assert/strict";
import test from "node:test";
import { forwardEventLogSkill, getLogSkillName, type EventLogSkill, type LogSkillInvocation, type LogSkillReceiver } from "./logSkill.js";

class LogSkillRecorder implements LogSkillReceiver {
	calls: Array<{ receiver: LogSkillRecorder; values: LogSkillInvocation }> = [];

	logSkill(...values: LogSkillInvocation): void {
		this.calls.push({ receiver: this, values });
	}
}

test("event logSkill preserves receiver, execution count, and every supported arity", () => {
	const recorder = new LogSkillRecorder();
	const entries: EventLogSkill[] = ["string_skill", false, ["one"], ["two", null], ["three", null, false], ["four", null, false, null], ["five", null, false, null, ["voice", 2]]];
	for (const entry of entries) {
		forwardEventLogSkill(recorder, entry);
	}

	assert.equal(recorder.calls.length, 6);
	for (const call of recorder.calls) {
		assert.equal(call.receiver, recorder);
	}
	assert.deepEqual(
		recorder.calls.map(call => call.values.length),
		[1, 1, 2, 3, 4, 5]
	);
	assert.equal(getLogSkillName({ bool: true }, entries[0]), "string_skill");
	assert.equal(getLogSkillName({ bool: true }, entries[1]), undefined);
	assert.equal(getLogSkillName({ bool: true }, entries[2]), "one");
	assert.equal(getLogSkillName({ bool: true }, entries[6]), "five");
});

test("selected result skill takes priority over the event log fallback", () => {
	assert.equal(getLogSkillName({ skill: "selected_skill" }, ["fallback_skill"]), "selected_skill");
	assert.equal(getLogSkillName("cancelled", ["fallback_skill"]), "fallback_skill");
	assert.equal(getLogSkillName("business_result", false), undefined);
});
