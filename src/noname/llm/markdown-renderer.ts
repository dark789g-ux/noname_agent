import DOMPurify, { type Config } from "dompurify";
import MarkdownIt from "markdown-it";

export interface MarkdownSanitizer {
	sanitize(dirty: string, config?: Config): string;
}

export const LLM_MARKDOWN_SANITIZE_CONFIG: Config = {
	ALLOWED_TAGS: ["p", "br", "hr", "strong", "em", "s", "del", "code", "pre", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td", "a", "span"],
	ALLOWED_ATTR: ["href", "target", "rel", "title", "class", "aria-label", "colspan", "rowspan"],
	FORBID_TAGS: ["img", "svg", "math", "iframe", "script", "style", "form", "input"],
	ALLOW_UNKNOWN_PROTOCOLS: false,
	RETURN_TRUSTED_TYPE: false,
};

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
}

function isAllowedHttpUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return (url.protocol === "http:" || url.protocol === "https:") && /^https?:\/\//i.test(value);
	} catch {
		return false;
	}
}

/** Builds a renderer whose sanitizer can be replaced by a jsdom-backed one in Node tests. */
export function createLLMMarkdownRenderer(sanitizer: MarkdownSanitizer) {
	const markdown = new MarkdownIt({ html: false, breaks: true, linkify: false });
	markdown.validateLink = isAllowedHttpUrl;
	markdown.renderer.rules.image = (tokens, index) => {
		const alt = escapeHtml(tokens[index]?.content || "图片");
		return `<span class="llm-markdown-image-placeholder">图片已禁用：${alt}</span>`;
	};
	markdown.renderer.rules.link_open = (tokens, index, options, environment, self) => {
		const token = tokens[index];
		const href = token.attrGet("href") || "";
		if (!isAllowedHttpUrl(href)) return "";
		token.attrSet("target", "_blank");
		token.attrSet("rel", "noopener noreferrer nofollow");
		return self.renderToken(tokens, index, options, environment);
	};
	markdown.renderer.rules.link_close = (tokens, index, options, environment, self) => self.renderToken(tokens, index, options, environment);

	return (source: string): string => sanitizer.sanitize(markdown.render(source), LLM_MARKDOWN_SANITIZE_CONFIG);
}

/** Sanitizes HTML using the same allowlist as Markdown output; exported for security regression tests. */
export function sanitizeLLMMarkdownHtml(source: string, sanitizer: MarkdownSanitizer = DOMPurify): string {
	return sanitizer.sanitize(source, LLM_MARKDOWN_SANITIZE_CONFIG);
}

export const renderLLMMarkdown = createLLMMarkdownRenderer(DOMPurify);

export function formatLLMLogValue(value: unknown): string {
	try {
		const json = JSON.stringify(value, null, 2);
		return json === undefined ? String(value) : json;
	} catch {
		return String(value);
	}
}
