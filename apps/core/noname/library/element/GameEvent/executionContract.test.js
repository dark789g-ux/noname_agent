import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const root = fileURLToPath(new URL("../../../../", import.meta.url));

test("generated EventExecution exposes lifecycle state without rule payload fields", () => {
	const fixturePath = resolve(root, "eventExecution.type-test.ts");
	const valid = [
		'import { GameEvent, initializeEvent, type ActiveEventExecution, type EventExecution } from "./dist-types/noname/library/element/gameEvent.js";',
		'import type { EventContentCallback, PublicEventContentCallback } from "./dist-types/noname/library/element/GameEvent/compilers/IContentCompiler.js";',
		'import type { Card, VCard } from "./dist-types/noname/library/element/index.js";',
		'import type { Game } from "./dist-types/noname/game/index.js";',
		'const runtime = new GameEvent("queue");',
		'declare const game: Game; declare const player: Player;',
		'runtime.set([["num", 2]]);',
		'runtime.pushHandler("registered", () => {});',
		"const queued: EventExecution = runtime;",
		"const active: ActiveEventExecution = runtime;",
		"queued.childEvents; queued.next; queued.after; queued.step; queued.waitNext();",
		"const guardedCallback: PublicEventContentCallback = (event, trigger, player) => { event.finish(); if (trigger) trigger.name; if (player) player.getCards(); };",
		"const guardedCardCallback: PublicEventContentCallback = event => { if (event.card) { const card: Card | VCard = event.card; card.name; } };",
		'const initialized = initializeEvent(runtime, { num: 2, cards: [] }); initialized.num.toFixed(); initialized.cards.length;',
		'const requiresCards: EventContentCallback<typeof initialized> = event => { event.cards.length; };',
		'initialized.setContent(requiresCards);',
		'const initializedDraw = initializeEvent(runtime, { player, targets: [], num: 2 }); initializedDraw.setContent("gameDraw");',
		'declare const dynamicContentName: string; runtime.setContent(dynamicContentName);',
		'runtime.insert(dynamicContentName, {}); runtime.insertAfter(dynamicContentName, {});',
		'const copiedInitialized = new GameEvent(initialized); copiedInitialized.name;',
		'type DrawNumber = typeof game.gameDraw extends (...args: never[]) => GameEvent<infer N> ? N : never;',
		'const inferredDomainOnly = new GameEvent<DrawNumber>(); inferredDomainOnly.name;',
		'const functionDomain = new GameEvent<(owner: Player) => number>(); functionDomain.changeToZero();',
	];
	const invalid = [
		"queued.card;",
		"queued.cards;",
		"queued.num;",
		"queued.targets;",
		"queued.player;",
		"queued.skill;",
		"const unguardedTrigger: PublicEventContentCallback = (_event, trigger) => trigger.name;",
		"const unguardedPlayer: PublicEventContentCallback = (_event, _trigger, player) => player.getCards();",
		"const unguardedCard: PublicEventContentCallback = event => event.card.name;",
		'new GameEvent().setContent(requiresCards);',
		'runtime.setContent("gameDraw");',
		'game.createEvent("gameDraw").setContent("gameDraw");',
		'runtime.insert("gameDraw", {});',
		'runtime.insertAfter("gameDraw", {});',
		'const inferredNumber: number = inferredDomainOnly.num;',
		'inferredDomainOnly.card.name;',
		'initializeEvent(runtime, { num: "invalid" });',
		"initializeEvent(runtime, { undeclaredExtensionField: true });",
		'runtime.set([["num", (owner: Player) => 2]]);',
		'runtime.getHandler("registered").push(() => {});',
	];
	const fixture = [...valid, ...invalid].join("\n");
	const options = {
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		baseUrl: root,
		paths: { "@/*": ["./dist-types/noname/*"], noname: ["./dist-types/noname.js"] },
		noEmit: true,
		strict: true,
		target: ts.ScriptTarget.ESNext,
	};
	const host = ts.createCompilerHost(options);
	const originalRead = host.getSourceFile.bind(host);
	const originalExists = host.fileExists.bind(host);
	host.fileExists = path => resolve(path) === fixturePath || originalExists(path);
	host.getSourceFile = (path, version) => resolve(path) === fixturePath ? ts.createSourceFile(path, fixture, version, true) : originalRead(path, version);
	const typings = ts.sys.readDirectory(resolve(root, "typings"), [".d.ts"]);
	const program = ts.createProgram([fixturePath, ...typings], options, host);
	const errors = ts.getPreEmitDiagnostics(program).filter(item => item.file && resolve(item.file.fileName) === fixturePath);
	assert.deepEqual(errors.map(item => item.file.getLineAndCharacterOfPosition(item.start).line), invalid.map((_, index) => valid.length + index), errors.map(item => ts.flattenDiagnosticMessageText(item.messageText, "\n")).join("\n"));
});
