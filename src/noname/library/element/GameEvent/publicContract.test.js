import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

test("generated public event APIs reject uninitialized fields and incompatible content", () => {
	const root = fileURLToPath(new URL("../../../../", import.meta.url));
	const fixturePath = resolve(root, "publicEvent.type-test.ts");
	const valid = ['import { GameEvent, ContentCompiler } from "./dist-types/noname/library/element/gameEvent.js";', 'import { Game } from "./dist-types/noname/game/index.js";', 'import { itemType } from "./dist-types/noname/library/experimental/symbol.js";', 'import { Get } from "./dist-types/noname/get/index.js";', 'import { AI } from "./dist-types/noname/ai/index.js";', "declare const game: Game; declare const player: Player; declare const card: Card; declare const dynamicName: string;", "const empty = new GameEvent();", "const copied = new GameEvent(empty);", 'const namedCopy = new GameEvent(new GameEvent("example", false));', "const dynamic = game.createEvent(dynamicName);", "const name: string = dynamic.name;", 'dynamic.set("num", 2);', 'dynamic.set("addCount", false).set("direct", true).set("visible", false);', 'dynamic.set("addCount", undefined);', 'dynamic.set("nojudge", false);', 'dynamic.set("forceDie", true).set("includeOut", undefined);', 'dynamic.set("nodistance", true); dynamic.noai = true; dynamic.nowuxie = undefined;', "dynamic.forceDirect = true; dynamic._direct = false;", 'dynamic.set("prompt2", "secondary").set("prompt2", undefined);', 'dynamic.set("centerprompt2", true).set("chooseonly", true).set("norestore", false); dynamic.nouse = true;', "const maybeDirect: boolean | undefined = empty.direct;", 'dynamic.set("delay", false).set("targetRequired", true);', 'dynamic.set("delay", undefined).set("targetRequired", undefined);', "delete dynamic.delay; delete dynamic.targetRequired;", "declare const chooseAllControl: Control; dynamic.cardChooseAll = chooseAllControl;", "dynamic.waitingForTransition = 123; delete dynamic.waitingForTransition; delete dynamic.cardChooseAll;", "dynamic.setContent(async event => { event.finish(); });", "ContentCompiler.compile(async event => { event.finish(); });", "const draw = game.gameDraw(player, owner => owner === player ? 2 : 3);", "const count: number | ((owner: Player) => number) = draw.num;", "const numeric = game.gameDraw(player, 2);", "const numericCount: number | ((owner: Player) => number) = numeric.num;", "const initialized = new GameEvent().set('card', card); initialized.card.name;", "new GameEvent(initialized);", "new GameEvent<(owner: Player) => number>(draw);", 'const marked: { [itemType]: "card" } = { [itemType]: "card" };', "const discard = game.cardsDiscard(marked);", "game.cardsGotoOrdering(marked);", "game.cardsGotoPile(marked);", "declare const get: Get; declare const configs: CardBaseUIData[];", "declare const ai: AI; const estimatedPoints: (number | 'unsure' | null | undefined)[] = ai.guessTargetPoints(player).nums;", 'const queriedNumber: number | "unsure" | null | undefined = get.number(configs, false);', "const selectedRange: Select = get.select(() => 2);", 'game.getGlobalHistory("everything").push(draw);', 'game.getGlobalHistory("everything", event => typeof event.num === "function");', 'game.getRoundHistory("everything", () => true, draw);', 'declare const skillInfo: Skill; skillInfo.getIndex?.(draw, player, "gameDraw");'];
	const invalid = ["empty.card.name;", "copied.card.name;", "dynamic.card.name;", 'dynamic.set("num", "invalid");', 'dynamic.set("addCount", "false");', 'dynamic.set("direct", 1);', 'dynamic.set("visible", "true");', 'dynamic.set("nojudge", "true");', 'dynamic.set("forceDie", "true");', 'dynamic.set("includeOut", 1);', "empty.forceDie.valueOf();", "empty.includeOut.valueOf();", 'dynamic.set("nodistance", "true");', "dynamic.noai = 'true';", "dynamic.nowuxie = 1;", "dynamic.forceDirect = 'true';", "dynamic._direct = 1;", "empty.noai.valueOf();", 'dynamic.set("prompt2", false);', 'dynamic.set("prompt2", () => "secondary");', "empty.prompt2.length;", 'dynamic.set("centerprompt2", "true");', 'dynamic.set("chooseonly", 1);', 'dynamic.set("norestore", "false");', "dynamic.nouse = 1;", "empty.chooseonly.valueOf();", "empty.updatePile.valueOf();", "empty.cardChooseAll.close();", "dynamic.waitingForTransition = '123';", "dynamic.cardChooseAll = {};", "empty.direct.valueOf();", 'dynamic.set("delay", 500);', 'dynamic.set("targetRequired", "true");', "empty.delay.valueOf();", "empty.targetRequired.valueOf();", 'dynamic.set("num", (owner: Player) => 2);', 'dynamic.set("undeclaredExtensionField", 1);', "dynamic.undeclaredExtensionField;", "dynamic.setContent(async (event: { card: Card | VCard }) => { event.card.name; });", "dynamic.setContent(async (event: { num: number }) => { event.num.toFixed(); });", "dynamic.setContent(async (event, trigger) => { trigger.name; });", "dynamic.setContent(async (event, trigger, player) => { player.getCards(); });", "ContentCompiler.compile(async (event, trigger) => { trigger.name; });", "ContentCompiler.compile(async (event, trigger, player) => { player.getCards(); });", 'game.createEvent("gameDraw").card.name;', "new GameEvent({ name: 'not_an_instance' });", "game.gameDraw(player, () => 'invalid');", "discard?.cards[0].fix();", "game.cardsDiscard([marked]);", "game.cardsDiscard({ name: 'sha' });", 'game.getGlobalHistory("cardMove").push(draw);', 'game.getGlobalHistory("cardMove")[0].set("num", (owner: Player) => 2);', "const onlyNumericPoints: number[] = ai.guessTargetPoints(player).nums;"];
	valid.push('dynamic.set("nodelay", true).set("nodelayx", true).set("delayx", false).set("isDelay", true);');
	valid.push('const initializedDiscard = dynamic.set("cards", [card]); initializedDiscard.setContent("cardsDiscard");', 'discard?.setContent("cardsDiscard");', 'new GameEvent().set("cards", [marked]).setContent("cardsDiscard");');
	valid.push('import { Is } from "./dist-types/noname/get/is.js";', 'const predicates = new Is(); const virtual: boolean = predicates.virtualCard(card); const methodForm: boolean = predicates.functionMethod({ content() {} }, "content");', "predicates.attackingMount(card, player); predicates.yingbianConditional(card); get.is = predicates;");
	invalid.push("predicates.functionMethod({}, 2);", 'predicates.attackingMount("sha", player);', "predicates.playerNames(player, 2);", "predicates.unknownPredicate();");
	invalid.push('dynamic.set("popup", "skill metadata");', 'dynamic.popup = "skill metadata";');
	valid.push('dynamic.set("animate", false).set("animate", "extension-animation").set("animate", undefined);', 'dynamic.set("animate", (event: GameEvent) => { event.name; return 500; });', 'dynamic.set("animate", async (event: GameEvent) => { event.name; });');
	invalid.push('dynamic.set("animate", 500);', 'dynamic.set("animate", () => "wrong-result");', 'dynamic.set("animate", (text: string) => 500);', 'dynamic.set("animate", null);', "empty.animate.valueOf();", "copied.animate.valueOf();");
	for (const field of ["videoId", "dialogid", "discardid"]) {
		valid.push(`dynamic.set("${field}", 12).set("${field}", undefined);`);
		invalid.push(`dynamic.set("${field}", "12");`, `dynamic.set("${field}", true);`, `dynamic.set("${field}", () => 12);`, `empty.${field}.toFixed();`);
	}
	invalid.push('new GameEvent("cardsDiscard").setContent("cardsDiscard");', 'new GameEvent().setContent("cardsDiscard");', 'new GameEvent(initializedDiscard).setContent("cardsDiscard");');
	invalid.push('dynamic.set("nodelay", 1);', 'dynamic.set("nodelayx", "true");', 'dynamic.set("delayx", 500);', 'dynamic.set("isDelay", () => true);', "empty.nodelay.valueOf();", "empty.nodelayx.valueOf();", "empty.delayx.valueOf();", "empty.isDelay.valueOf();");
	for (const field of ["nopopup", "throw", "noTargetDelay", "targetDelay", "postAi", "all_excluded", "insert_card", "washCard", "_triggeronly", "popup", "compareMeanwhile", "compareMultiple"]) {
		valid.push(`dynamic.set("${field}", false).set("${field}", undefined);`);
		invalid.push(`dynamic.set("${field}", 1);`, `dynamic.set("${field}", () => true);`, `empty.${field}.valueOf();`);
	}
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
	host.getSourceFile = (path, version) => (resolve(path) === fixturePath ? ts.createSourceFile(path, fixture, version, true) : originalRead(path, version));
	const typings = ts.sys.readDirectory(resolve(root, "typings"), [".d.ts"]);
	const program = ts.createProgram([fixturePath, ...typings], options, host);
	const errors = ts.getPreEmitDiagnostics(program).filter(item => item.file && resolve(item.file.fileName) === fixturePath);
	const errorLines = [...new Set(errors.map(item => item.file.getLineAndCharacterOfPosition(item.start).line))];
	assert.deepEqual(
		errorLines,
		invalid.map((_, index) => valid.length + index),
		JSON.stringify({ unexpected: errorLines.filter(line => line < valid.length).map(line => valid[line]), acceptedInvalid: invalid.filter((_, index) => !errorLines.includes(valid.length + index)) }) + "\n" + errors.map(item => ts.flattenDiagnosticMessageText(item.messageText, "\n")).join("\n")
	);
});
