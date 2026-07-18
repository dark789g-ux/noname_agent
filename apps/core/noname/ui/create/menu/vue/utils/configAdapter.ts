/**
 * DOM 语义适配器：桥接旧版 update 函数对 map[key] 的 DOM 操作。
 * 旧版 map[key] 是 HTMLDivElement（polyfill 注入 .hide()/.show()）；
 * 新版改为响应式数据，适配器将 DOM 操作翻译为 cfg 响应式字段修改。
 * - hide/show → cfg._hidden（v-show）；_link → { config: cfg }；
 * - classList → shim，add/remove("on") 同步 cfg.init（供 skill update）
 * - updatex 做 try/catch 兜底（audio/guozhan 的 updatex 操作 DOM，Vue 下不可用）
 */
export function makeConfigAdapter(cfg: SelectConfigData & { _hidden?: boolean; type?: string; updatex?: Function }) {
	const origUpdatex = cfg.updatex;
	if (typeof origUpdatex === "function") {
		cfg.updatex = function (this: any) {
			try {
				origUpdatex.call(this);
			} catch (e) {
				// DOM 不可用，忽略（旧版 updatex 的 DOM 操作在 Vue 下无等价）
			}
		};
	}
	const classListShim = {
		add(cls: string) {
			if (cls === "on") cfg.init = true;
		},
		remove(cls: string) {
			if (cls === "on") cfg.init = false;
		},
	};
	return {
		hide: () => {
			cfg._hidden = true;
		},
		show: () => {
			cfg._hidden = false;
		},
		_link: { config: cfg },
		classList: classListShim,
	};
}
