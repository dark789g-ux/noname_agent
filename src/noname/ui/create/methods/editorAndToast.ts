import { lib, game, get, _status, ai, ui } from "noname";

export const editorAndToastMethods = {
	/**
	 * 创建 codemirror6 编辑器
	 */
	async editor(config: { value?: string; language?: string; saveInput?: (code: string) => any } = {}) {
		const { value = "", language = "javascript", saveInput = () => {} } = config;

		const container = ui.create.div(".popup-container.editor2");
		ui.window.appendChild(container);
		ui.window.classList.add("shortcutpaused");
		ui.window.classList.add("systempaused");

		const callback = function (view: import("@codemirror/view").EditorView) {
			const code = view.state.doc.toString();
			try {
				saveInput(code);
			} catch (e) {
				const tip = lib.getErrorTip(e) || "";
				alert("代码语法有错误，请仔细检查（" + e + "）" + tip);
				window.focus();
				view.dom.focus();
				return;
			}
			ui.window.classList.remove("shortcutpaused");
			ui.window.classList.remove("systempaused");
			container.delete();
			delete window.saveNonameInput;
		};

		const { basicSetup } = await import("codemirror");
		const { EditorView } = await import("@codemirror/view");
		const { linter, lintGutter } = await import("@codemirror/lint");
		const { search, highlightSelectionMatches, openSearchPanel } = await import("@codemirror/search");

		const editorpage = ui.create.div(container);
		editorpage.addEventListener("keydown", function (e) {
			e.stopPropagation();
		});
		editorpage.addEventListener("keyup", function (e) {
			e.stopPropagation();
		});

		ui.create.div(".editbutton", "取消", editorpage, () => {
			ui.window.classList.remove("shortcutpaused");
			ui.window.classList.remove("systempaused");
			container.delete();
			delete window.saveNonameInput;
		});

		ui.create.div(".editbutton", "保存", editorpage, () => {
			callback(view);
		});
		window.saveNonameInput = () => callback(view);

		ui.create.div(".editbutton", "字号", editorpage, () => {
			game.promises.prompt(`###请输入字号###${lib.config.codeMirror_fontSize || "16px"}`).then((size: any) => {
				if (size === false) {
					return;
				}
				container.style.fontSize = Number(size.slice(0, -2)) / game.documentZoom + "px";
				game.saveConfig("codeMirror_fontSize", size);
			});
		});

		container.style.fontSize = Number((lib.config.codeMirror_fontSize || "16px").slice(0, -2)) / game.documentZoom + "px";

		ui.create.div(".editbutton", "搜索", editorpage, () => {
			openSearchPanel(view);
		});

		const editor = ui.create.div(editorpage);

		const extensions: any[] = [
			basicSetup,
			lintGutter(), // 显示 lint 信息的 gutter
			search({ top: true }), // 启用搜索面板
			highlightSelectionMatches(), // 高亮匹配的选择项
		];

		if (language === "javascript" || language === "typescript") {
			const { javascript, scopeCompletionSource, javascriptLanguage, esLint } = await import("@codemirror/lang-javascript");
			const { security } = await import("@/util/sandbox.js");
			let proxyWindow = Object.assign({}, window, {
				_status: _status,
				lib: lib,
				game: game,
				ui: ui,
				get: get,
				ai: ai,
				player: lib.element.player,
				card: lib.element.card,
				event: lib.element.event,
				dialog: lib.element.dialog,
			});
			if (security.isSandboxRequired()) {
				const { Monitor, AccessAction } = security.importSandbox();
				new Monitor()
					.action(AccessAction.DEFINE)
					.action(AccessAction.WRITE)
					.action(AccessAction.DELETE)
					.require("target", proxyWindow)
					.require("property", "_status", "lib", "game", "ui", "get", "ai", "player", "card", "event", "dialog")
					.then((access, _nameds, control) => {
						if (access.action == AccessAction.DEFINE) {
							control.preventDefault();
							control.stopPropagation();
							control.setReturnValue(false);
							return;
						}
						control.overrideParameter("target", window);
					})
					.start();
			} else {
				const keys = ["_status", "lib", "game", "ui", "get", "ai", "player", "card", "event", "dialog"];

				for (const key of keys) {
					const descriptor = Reflect.getOwnPropertyDescriptor(proxyWindow, key);
					if (!descriptor) {
						continue;
					}
					descriptor.writable = false;
					descriptor.enumerable = true;
					descriptor.configurable = false;
					Reflect.defineProperty(proxyWindow, key, descriptor);
				}

				proxyWindow = new Proxy(proxyWindow, {
					set(target, propertyKey, value, receiver) {
						if (typeof propertyKey == "string" && keys.includes(propertyKey)) {
							return Reflect.set(target, propertyKey, value, receiver);
						}

						return Reflect.set(window, propertyKey, value);
					},
				});
			}

			extensions.push(
				javascript({ typescript: true }),
				javascriptLanguage.data.of({
					autocomplete: scopeCompletionSource(proxyWindow),
				})
			);
			if (language === "javascript") {
				const { Linter } = await import("eslint-linter-browserify");
				extensions.push(
					linter(
						esLint(new Linter(), {
							rules: {
								"no-class-assign": 0,
								"no-console": 0,
								"no-constant-condition": ["error", { checkLoops: false }],
								"no-irregular-whitespace": ["error", { skipStrings: true, skipTemplates: true }],
								"prefer-const": 0,
								"no-redeclare": 0,
								"no-undef": 0,
								"no-empty": ["error", { allowEmptyCatch: true }],
								"no-unused-vars": 1,
								"require-yield": 0,
								"no-fallthrough": ["error", { commentPattern: "\\[falls[\\s\\w]*through\\]" }],
							},
							languageOptions: {
								ecmaVersion: 13,
								sourceType: "module",
							},
						})
					)
				);
			}
		} else if (language === "css") {
			const { css } = await import("@codemirror/lang-css");
			extensions.push(css());
		} else if (language === "json") {
			const { json, jsonParseLinter } = await import("@codemirror/lang-json");
			extensions.push(json(), linter(jsonParseLinter()));
		} else if (language === "html") {
			const { html } = await import("@codemirror/lang-html");
			extensions.push(html());
		} else if (language === "markdown") {
			const { markdown } = await import("@codemirror/lang-markdown");
			extensions.push(markdown());
		} else if (language === "vue") {
			const { vue } = await import("@codemirror/lang-vue");
			extensions.push(vue());
		}

		const view = new EditorView({
			doc: value,
			parent: editor,
			extensions,
		});
		lib.setScroll(view.scrollDOM);
	},
	/**
	 * 弹出提示。
	 */
	toast(message: string) {
		const toastContainer =
			document.querySelector(".toast-container") ||
			(() => {
				const container = document.createElement("div");
				container.classList.add("toast-container");
				document.body.appendChild(container);
				return container;
			})();
		const toast = document.createElement("div");
		toast.innerHTML = message;
		const toShow = () => {
			toast.classList.add("toast");
			toastContainer.appendChild(toast);
			ui.toastQueue.push(toast);
			ui.create.showNextToast();
		};
		if (!ui.toastStyle) {
			ui.toastStyle = lib.init.promises.css(lib.assetURL + "layout/default/toast.css").then(() => toShow());
		} else {
			toShow();
		}
		return toast;
	},
	showNextToast() {
		const toast = ui.toastQueue.shift();
		if (!toast) {
			return;
		}
		toast.style.display = "block";
		toast.addEventListener("animationend", () => {
			toast.remove();
			ui.create.showNextToast();
		});
		return toast;
	},
};
