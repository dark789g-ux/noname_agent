import ts from "typescript";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { identityGetVerificationFiles } from "./identityGetFiles.js";

/**
 * Targeted checking/declaration emission for this module graph. Dependencies
 * supply types, but their unrelated diagnostics are not aggregated or hidden by
 * changing compiler strictness. No full-workspace tsc/build is invoked.
 */
const core = fileURLToPath(new URL("../", import.meta.url));
const config = ts.readConfigFile(resolve(core, "tsconfig.json"), ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, core);
const selected = new Set(identityGetVerificationFiles(core).map(file => resolve(file).replaceAll("\\", "/")));
const roots = [...selected, ...parsed.fileNames.filter(file => /[\\/]typings[\\/]/.test(file))];
const emit = process.argv.includes("--emit");
const options: ts.CompilerOptions = {
	...parsed.options,
	rootDir: core,
	noEmit: !emit,
	declaration: true,
	emitDeclarationOnly: true,
	noEmitOnError: false,
	outDir: resolve(core, "dist-types"),
	stripInternal: true,
};
const program = ts.createProgram(roots, options);
const files = program.getSourceFiles().filter(file => selected.has(resolve(file.fileName).replaceAll("\\", "/")) && file.fileName.endsWith(".ts"));
const allDiagnostics = files.flatMap(file => [...program.getSyntacticDiagnostics(file), ...program.getSemanticDiagnostics(file)]);
const buildPath = resolve(core, "scripts/build.ts").replaceAll("\\", "/");
const buildDiagnostics = allDiagnostics.filter(d => d.file?.fileName.replaceAll("\\", "/") === buildPath);
const baselineKeys = new Set<string>();
const diagnosticKey = (d: ts.Diagnostic) => `${d.code}:${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`;
if (buildDiagnostics.length) {
	// build.ts predates this refactor. Confirm legacy toolchain errors against
	// HEAD under the same strict options instead of casting JIT's plugin to any.
	const previous = execFileSync("git", ["show", "HEAD:apps/core/scripts/build.ts"], { cwd: core, encoding: "utf8" });
	const baselineHost = ts.createCompilerHost(options);
	const originalGetSourceFile = baselineHost.getSourceFile.bind(baselineHost);
	baselineHost.getSourceFile = (name, version, onError, shouldCreate) => (resolve(name).replaceAll("\\", "/") === buildPath ? ts.createSourceFile(name, previous, ts.ScriptTarget.Latest, true) : originalGetSourceFile(name, version, onError, shouldCreate));
	const baseline = ts.createProgram([buildPath, ...parsed.fileNames.filter(file => /[\\/]typings[\\/]/.test(file))], options, baselineHost);
	for (const diagnostic of baseline.getSemanticDiagnostics(baseline.getSourceFile(buildPath)!)) baselineKeys.add(diagnosticKey(diagnostic));
}
const diagnostics = allDiagnostics.filter(d => !(d.file?.fileName.replaceAll("\\", "/") === buildPath && baselineKeys.has(diagnosticKey(d))));
const host: ts.FormatDiagnosticsHost = { getCanonicalFileName: name => name, getCurrentDirectory: () => core, getNewLine: () => "\n" };
if (diagnostics.length) {
	console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, host));
	process.exitCode = 1;
} else {
	console.log(`identity/Get: ${files.length} TS files checked, 0 new diagnostics.`);
	const existing = allDiagnostics.length - diagnostics.length;
	if (existing) console.log(`${existing} unchanged build.ts diagnostics confirmed against HEAD (duplicate Vite/JIT plugin types).`);
	if (emit) {
		let count = 0;
		for (const source of program.getSourceFiles()) {
			const path = resolve(source.fileName).replaceAll("\\", "/");
			if (source.isDeclarationFile || !selected.has(path) || /(?:\.test\.|\/testing\/|\/scripts\/)/.test(path)) continue;
			const result = program.emit(source);
			if (result.emitSkipped) throw new Error(`Declaration emission skipped: ${path}`);
			count++;
		}
		console.log(`Emitted declarations for ${count} selected source files to dist-types.`);
	}
}
