import { getTestText } from "./testing/testSource.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function readSource(path) {
	const url = new URL(path, import.meta.url);
	let text = path === "./index.js" ? getTestText() : readFileSync(url, "utf8");
	if (path.endsWith("/Skill.d.ts")) {
		text = ts
			.preProcessFile(text)
			.referencedFiles.map(reference => readFileSync(new URL(reference.fileName, url), "utf8"))
			.join("\n");
	}
	const scriptKind = path.endsWith(".d.ts") ? ts.ScriptKind.TS : ts.ScriptKind.JS;
	return ts.createSourceFile(path, text, ts.ScriptTarget.ESNext, true, scriptKind);
}

function getName(node) {
	return ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : undefined;
}

function findMethods(sourceFile, name) {
	const methods = [];
	const visit = node => {
		if ((ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) && getName(node) === name) {
			methods.push(node);
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	return methods;
}

function findInterface(sourceFile, name) {
	const declarations = sourceFile.statements.filter(node => ts.isInterfaceDeclaration(node) && node.name.text === name);
	assert.ok(declarations.length, `${name} should exist`);
	return { ...declarations[0], members: declarations.flatMap(declaration => Array.from(declaration.members)) };
}

function findMember(members, name) {
	const member = members.find(member => (ts.isPropertySignature(member) || ts.isMethodSignature(member)) && getName(member) === name);
	assert.ok(member, `${name} should exist`);
	return member;
}

function loadMethod(sourceFile, name, dependencies) {
	return loadMethodDeclaration(findMethods(sourceFile, name)[0], sourceFile, dependencies, name);
}

function loadMethodDeclaration(method, sourceFile, dependencies, name) {
	assert.ok(method?.body, `${name} should have an implementation`);
	const parameters = method.parameters.map(parameter => parameter.getText(sourceFile)).join(", ");
	const javascript = ts.transpileModule(`function ${name}(${parameters}) ${method.body.getText(sourceFile)}`, {
		compilerOptions: { target: ts.ScriptTarget.ESNext },
	}).outputText;
	return Function(...Object.keys(dependencies), `${javascript}; return ${name};`)(...Object.values(dependencies));
}

function findCalls(method, name) {
	const calls = [];
	const visit = node => {
		if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === name) {
			calls.push(node);
		}
		ts.forEachChild(node, visit);
	};
	visit(method);
	return calls;
}

test("连环上下文精确描述 canLink 和四类 effect 回调", () => {
	const declaration = readSource("../../typings/Skill.d.ts");
	const context = findInterface(declaration, "EffectLinkContext");
	assert.deepEqual(context.members.map(getName), ["source", "eff", "num", "odds"]);
	assert.deepEqual(
		context.members.map(member => member.type?.getText(declaration)),
		["Player", "number", "number", "number"]
	);

	const skillAI = findInterface(declaration, "SkillAI");
	const effect = findMember(skillAI.members, "effect");
	assert.ok(effect.type && ts.isTypeLiteralNode(effect.type));
	for (const name of ["player", "target", "player_use", "target_use"]) {
		const callback = findMember(effect.type.members, name);
		assert.ok(ts.isMethodSignature(callback));
		assert.equal(callback.parameters.length, 5, `${name} should receive linking as its fifth argument`);
		assert.equal(callback.parameters[4].type?.getText(declaration), "boolean | EffectLinkContext");
	}
	const result = findMember(skillAI.members, "result");
	assert.equal(result.type?.getText(declaration), "AIResultDefinition");
	const resultDeclaration = readSource("../../typings/AIResult.d.ts");
	const resultConfig = findInterface(resultDeclaration, "AIResultConfig");
	const score = resultDeclaration.statements.find(node => ts.isTypeAliasDeclaration(node) && node.name.text === "AIResultScore");
	assert.ok(score && ts.isFunctionTypeNode(score.type));
	for (const name of ["player", "target", "player_use", "target_use"]) {
		const callback = findMember(resultConfig.members, name);
		assert.ok(callback.type && ts.isUnionTypeNode(callback.type));
		assert.ok(
			callback.type.types.some(type => type.getText(resultDeclaration) === "AIResultScore"),
			`${name} should include a result callback`
		);
		const functionType = score.type;
		assert.equal(functionType.parameters.length, 4, `${name} should receive linking as its fourth argument`);
		assert.deepEqual(
			functionType.parameters.map(parameter => parameter.type?.getText(resultDeclaration)),
			["Player | null | undefined", "Player | undefined", "AIResultItem", "boolean | EffectLinkContext"]
		);
	}
	const canLink = findMember(skillAI.members, "canLink");
	assert.ok(ts.isMethodSignature(canLink));
	assert.deepEqual(
		canLink.parameters.map(parameter => parameter.type?.getText(declaration)),
		["Player", "Player", "string | Card | VCard"]
	);
	assert.equal(canLink.type?.getText(declaration), "boolean | EffectLinkContext");
});

test("内置 canLink 保留布尔和携带赔率的对象结果", () => {
	const standard = readSource("../../card/standard.js");
	const standardCanLink = loadMethod(standard, "canLink", { get: { attitude: () => 1 } });
	const player = {
		hasSkill: name => name === "jiu",
		hasSkillTag: () => false,
	};
	const target = {
		hasSkill: () => false,
		hasSkillTag: () => false,
		hp: 3,
		isLinked: () => true,
		mayHaveShan: () => 0.5,
	};
	assert.deepEqual(standardCanLink(player, target, "sha"), { num: 2, odds: 1 });
	const resultTarget = findMethods(standard, "target").find(method => method.parameters[3]?.name.getText(standard) === "isLink" && method.body?.getText(standard).includes("isLink.eff"));
	const standardResultTarget = loadMethodDeclaration(resultTarget, standard, { get: {} }, "target");
	assert.equal(standardResultTarget({}, {}, {}, { eff: -4, odds: 0.5, num: 1 }), -2);

	const guozhan = readSource("../../card/guozhan.js");
	const guozhanCanLink = loadMethod(guozhan, "canLink", { get: {} });
	assert.equal(guozhanCanLink({ hasSkill: () => false }, { hasSkill: () => false, isLinked: () => false }, {}), false);
	assert.equal(guozhanCanLink({ hasSkill: () => false }, { getCards: () => [], hasSkill: () => false, isLinked: () => true }, {}), true);
});

test("get.effect 与 effect_use 按原顺序传递连环上下文", () => {
	const source = readSource("./index.js");
	for (const name of ["effect", "effect_use"]) {
		const method = findMethods(source, name)[0];
		assert.ok(method, `${name} should exist`);
		assert.match(method.getFullText(source), /@param \{ boolean \| EffectLinkContext \} \[linking\]/);
		const callbacks = name === "effect" ? ["player", "target"] : ["player", "target", "player_use", "target_use"];
		for (const callback of callbacks) {
			const calls = findCalls(method, callback).filter(call => call.arguments.length === 5);
			assert.ok(calls.length > 0, `${name} should call ${callback}`);
			for (const call of calls) {
				assert.equal(call.arguments[0].getText(source), "card");
				assert.equal(call.arguments[1].getText(source), "player");
				assert.equal(call.arguments[2].getText(source), "target");
				assert.equal(call.arguments[4].getText(source), "linking");
			}
		}
		const canLinkCalls = findCalls(method, "canLink");
		assert.ok(canLinkCalls.length > 0, `${name} should consult canLink`);
		for (const call of canLinkCalls) {
			assert.deepEqual(
				call.arguments.map(argument => argument.getText(source)),
				["player", "target", "card"]
			);
		}
		for (const resultVariable of ["result1", "result2"]) {
			const calls = [];
			const visit = node => {
				if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === resultVariable) {
					calls.push(node);
				}
				ts.forEachChild(node, visit);
			};
			visit(method);
			assert.ok(
				calls.some(call => call.arguments.map(argument => argument.getText(source)).join(",") === "player,target,card,linking"),
				`${name} should forward linking to ${resultVariable}`
			);
		}
	}
});

test("get.effect 将字符串和 autoViewAs 后的虚拟牌原样传给 canLink", () => {
	const source = readSource("./index.js");
	const seenCards = [];
	const vcard = { name: "sha", virtual: true };
	const get = {
		autoViewAs: () => vcard,
		card: () => undefined,
		info: () => ({
			ai: {
				canLink(player, target, card) {
					seenCards.push(card);
					return false;
				},
			},
		}),
		result: () => ({}),
		tag: (card, tag) => tag === "natureDamage",
	};
	const effect = loadMethod(source, "effect", {
		CacheContext: { requireCacheContext: () => ({ get: { attitude: () => 0 } }) },
		_status: { event: {} },
		game: { expandSkills() {}, players: [] },
		get,
		lib: { skill: { global: [] } },
	});
	const player = {
		getSkills: () => [],
		hasSkillTag: () => false,
	};
	const target = {
		countCards: () => 3,
		getSkills: () => [],
		hp: 3,
		isLinked: () => true,
	};
	effect(target, "sha", player, player);
	effect(target, { name: "sha" }, player, player);
	assert.deepEqual(seenCards, ["sha", vcard]);
});
