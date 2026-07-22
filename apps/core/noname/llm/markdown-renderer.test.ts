import assert from "node:assert/strict";
import test from "node:test";
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { createLLMMarkdownRenderer, formatLLMLogValue, sanitizeLLMMarkdownHtml } from "./markdown-renderer.js";

const sanitizer = createDOMPurify(new JSDOM("").window as unknown as Window);
const render = createLLMMarkdownRenderer(sanitizer);

test("renders supported GFM constructs and real line breaks", () => {
	const html = render("# 标题\n一行\n二行\n\n- 项目\n\n> 引用\n\n```js\nconst x = 1;\n```\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n~~删除~~");
	for (const expected of ["<h1>", "<br>", "<ul>", "<blockquote>", "<code", "<table>", "<s>"]) assert.match(html, new RegExp(expected));
	assert.match(render("a\\nb"), /a\\nb/);
});

test("escapes raw HTML and does not decode literal newline escapes", () => {
	const html = render("<script>alert(1)</script><b>文字</b>");
	assert.doesNotMatch(html, /<script|<b>/i);
	assert.match(html, /&lt;script&gt;/);
});

test("only absolute HTTP(S) links are emitted with safe attributes", () => {
	const html = render("[安全](https://example.com/a) [相对](/a) [危险](javascript:alert(1))");
	assert.match(html, /href="https:\/\/example\.com\/a"/);
	assert.match(html, /target="_blank"/);
	assert.match(html, /rel="noopener noreferrer nofollow"/);
	assert.equal((html.match(/<a /g) || []).length, 1);
});

test("replaces images without retaining a source URL", () => {
	const html = render("![危险图片](https://example.com/image.png)");
	assert.match(html, /图片已禁用：危险图片/);
	assert.doesNotMatch(html, /<img|src=|example\.com/i);
});

test("sanitizer allowlist removes direct hostile HTML", () => {
	const html = sanitizeLLMMarkdownHtml('<a href="javascript:alert(1)" onclick="alert(2)">x</a><svg><script>x</script></svg><span class="ok">safe</span>', sanitizer);
	assert.doesNotMatch(html, /javascript:|onclick|svg|script/i);
	assert.match(html, /<span class="ok">safe<\/span>/);
});

test("formats non-Markdown values as readable JSON", () => {
	assert.equal(formatLLMLogValue({ action: ["pass"] }), '{\n  "action": [\n    "pass"\n  ]\n}');
	assert.equal(formatLLMLogValue(null), "null");
	assert.equal(formatLLMLogValue(undefined), "undefined");
});
