/**
 * 启动恢复对话框（三选一）。
 * 原生 DOM 实现，不依赖 Vue/ui，boot 早期可用。
 * 由 lib.init.reset() 调用。
 */

/**
 * 显示恢复对话框。
 * @param {Object} options
 * @param {string} options.context - 'timeout'（可能只是慢）| 'error'（明确报错）
 * @param {string} options.errorSummary - 错误摘要多行文本，可为空
 * @param {boolean} options.hasFailedExtensions - 是否有失败扩展被自动禁用
 * @param {Function} options.onWait - 继续等待回调
 * @param {Function} options.onSkipExtensions - 跳过扩展回调
 * @param {Function} options.onReset - 重置回调
 */
export function showRecoveryDialog(options) {
	var context = options.context || "timeout";
	var isMobile = typeof lib !== "undefined" && lib.device;

	// 移动端优先用 Cordova 原生三按钮对话框
	if (isMobile && typeof navigator !== "undefined" && navigator.notification) {
		showMobileDialog(options);
		return;
	}

	// 桌面端/降级：原生 DOM 模态框
	showDomDialog(options);
}

function showMobileDialog(options) {
	var context = options.context || "timeout";
	var title = context === "error" ? "游戏加载失败" : "游戏加载未完成";

	var message;
	if (context === "error" && options.errorSummary) {
		message = "以下项目加载失败：\n" + options.errorSummary;
	} else {
		message = "游戏加载超过时限未完成，可能是网络较慢或部分资源仍在加载。";
	}

	var buttons = ["继续等待", "重置游戏"];
	if (options.hasFailedExtensions) {
		buttons.splice(1, 0, "跳过扩展");
	}

	navigator.notification.confirm(
		message,
		function (index) {
			// index 从 1 开始
			if (index === 1) {
				options.onWait && options.onWait();
			} else if (index === 2 && options.hasFailedExtensions) {
				options.onSkipExtensions && options.onSkipExtensions();
			} else {
				// 最后一个按钮是重置
				options.onReset && options.onReset();
			}
		},
		title,
		buttons
	);
}

function showDomDialog(options) {
	var context = options.context || "timeout";
	var title = context === "error" ? "游戏加载失败" : "游戏加载未完成";
	var icon = context === "error" ? "⚠" : "⏳";

	// 错误信息文本
	var bodyText;
	if (context === "error" && options.errorSummary) {
		bodyText = document.createElement("div");
		bodyText.style.cssText = "color:#e0e0e0;font-size:14px;line-height:1.6;margin:16px 0;white-space:pre-wrap;word-break:break-all;max-height:200px;overflow-y:auto;";
		bodyText.textContent = options.errorSummary;
	} else {
		bodyText = document.createElement("p");
		bodyText.style.cssText = "color:#e0e0e0;font-size:14px;line-height:1.6;margin:16px 0;";
		bodyText.textContent = "游戏加载超过时限未完成，可能是网络较慢或部分资源仍在加载。建议尝试继续等待。";
	}

	// 遮罩层
	var overlay = document.createElement("div");
	overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;";

	// 对话框容器
	var dialog = document.createElement("div");
	dialog.style.cssText = "background:#1e1e1e;border:1px solid #444;border-radius:12px;padding:24px 28px;max-width:400px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.5);";

	// 标题
	var titleEl = document.createElement("div");
	titleEl.style.cssText = "color:#ffffff;font-size:18px;font-weight:bold;margin-bottom:4px;text-align:center;";
	titleEl.textContent = icon + " " + title;
	dialog.appendChild(titleEl);

	// 正文
	dialog.appendChild(bodyText);

	// 按钮容器
	var btnContainer = document.createElement("div");
	btnContainer.style.cssText = "display:flex;flex-direction:column;gap:10px;margin-top:20px;";
	dialog.appendChild(btnContainer);

	// 继续等待按钮（绿色）
	createButton(btnContainer, {
		text: "继续等待",
		bgColor: "#2e7d32",
		hoverColor: "#388e3c",
		onClick: function () {
			overlay.remove();
			options.onWait && options.onWait();
		},
	});

	// 跳过扩展按钮（橙色，仅在有失败扩展时显示）
	if (options.hasFailedExtensions) {
		createButton(btnContainer, {
			text: "跳过扩展",
			bgColor: "#e65100",
			hoverColor: "#ef6c00",
			onClick: function () {
				overlay.remove();
				options.onSkipExtensions && options.onSkipExtensions();
			},
		});
	}

	// 重置游戏按钮（红色）
	createButton(btnContainer, {
		text: "重置游戏",
		bgColor: "#b71c1c",
		hoverColor: "#c62828",
		onClick: function () {
			overlay.remove();
			options.onReset && options.onReset();
		},
	});

	overlay.appendChild(dialog);
	document.body.appendChild(overlay);
}

function createButton(container, opts) {
	var btn = document.createElement("button");
	btn.textContent = opts.text;
	btn.style.cssText = "display:block;width:100%;padding:10px 16px;border:none;border-radius:6px;color:#ffffff;font-size:15px;font-weight:500;cursor:pointer;transition:background 0.2s;background:" + opts.bgColor + ";";
	btn.addEventListener("mouseenter", function () {
		btn.style.background = opts.hoverColor;
	});
	btn.addEventListener("mouseleave", function () {
		btn.style.background = opts.bgColor;
	});
	btn.addEventListener("click", opts.onClick);
	container.appendChild(btn);
}
