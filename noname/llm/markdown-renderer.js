import purify from "../../node_modules/.pnpm/dompurify@3.4.12/node_modules/dompurify/dist/purify.es.js";
import "../../node_modules/.pnpm/markdown-it@14.3.0/node_modules/markdown-it/index.js";
import MarkdownIt from "../../node_modules/.pnpm/markdown-it@14.3.0/node_modules/markdown-it/lib/index.js";
const LLM_MARKDOWN_SANITIZE_CONFIG = {
  ALLOWED_TAGS: ["p", "br", "hr", "strong", "em", "s", "del", "code", "pre", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td", "a", "span"],
  ALLOWED_ATTR: ["href", "target", "rel", "title", "class", "aria-label", "colspan", "rowspan"],
  FORBID_TAGS: ["img", "svg", "math", "iframe", "script", "style", "form", "input"],
  ALLOW_UNKNOWN_PROTOCOLS: false,
  RETURN_TRUSTED_TYPE: false
};
function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
}
function isAllowedHttpUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && /^https?:\/\//i.test(value);
  } catch {
    return false;
  }
}
function createLLMMarkdownRenderer(sanitizer) {
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
  return (source) => sanitizer.sanitize(markdown.render(source), LLM_MARKDOWN_SANITIZE_CONFIG);
}
function sanitizeLLMMarkdownHtml(source, sanitizer = purify) {
  return sanitizer.sanitize(source, LLM_MARKDOWN_SANITIZE_CONFIG);
}
const renderLLMMarkdown = createLLMMarkdownRenderer(purify);
function formatLLMLogValue(value) {
  try {
    const json = JSON.stringify(value, null, 2);
    return json === void 0 ? String(value) : json;
  } catch {
    return String(value);
  }
}
export {
  LLM_MARKDOWN_SANITIZE_CONFIG,
  createLLMMarkdownRenderer,
  formatLLMLogValue,
  renderLLMMarkdown,
  sanitizeLLMMarkdownHtml
};
