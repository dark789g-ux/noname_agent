import { lib, get, ui } from "noname";
import type { Create } from "../index.js";

interface SkillSearchCache {
	skillCaching: boolean;
	skillCacheReady: boolean;
	skillMaps: Map<string, Set<string>>;
	skillRegsCache: Map<string, Set<string>>;
}

// 用 WeakMap 按 Create 实例隔离原 #skill* 私有字段，保持实例级私密性与 GC 回收
const skillSearchCacheMap = new WeakMap<Create, SkillSearchCache>();

function getSkillSearchCache(createInstance: Create): SkillSearchCache {
	let cache = skillSearchCacheMap.get(createInstance);
	if (!cache) {
		cache = {
			skillCaching: false,
			skillCacheReady: false,
			skillMaps: new Map(),
			skillRegsCache: new Map(),
		};
		skillSearchCacheMap.set(createInstance, cache);
	}
	return cache;
}

/**
 * 为自由选将对话框创建技能/武将正则搜索条。
 */
export function attachCharacterSkillSearch(createInstance: Create, dialog: Dialog, updatePagination: () => void): void {
	const cache = getSkillSearchCache(createInstance);
	const container = dialog.querySelector(".content-container>.content");
	if (!container) {
		return;
	}
	const Searcher = ui.create.div(".searcher.caption");
	const input = document.createElement("input").css({
		textAlign: "center",
		border: "solid 2px #294510",
		borderRadius: "6px",
		fontWeight: "bold",
		fontSize: "21px",
	});
	input.placeholder = "支持正则搜索和技能搜索";
	// 使用 click 事件搜索，避免按下 a 键时触发自动托管
	const find = ui.create.button(["find", "搜索"], "tdnodes");
	find.style.display = "inline";

	if (!cache.skillCacheReady && !cache.skillCaching) {
		cache.skillCaching = true;
		queueMicrotask(() => {
			for (const skill in lib.skill) {
				const translation = lib.translate[skill];
				if (!translation) {
					continue;
				}
				let set = cache.skillMaps.get(translation);
				if (!set) {
					set = new Set();
					cache.skillMaps.set(translation, set);
				}
				set.add(skill);
			}
			cache.skillCacheReady = true;
		});
	}

	const updateFind = () => {
		const { value } = input;
		const reg = new RegExp(value);
		let skills: Set<string> | undefined;
		if (cache.skillCacheReady) {
			if (cache.skillRegsCache.has(value)) {
				skills = cache.skillRegsCache.get(value);
			} else {
				skills = new Set();
				for (const [desc, skillSet] of cache.skillMaps.entries()) {
					if (reg.test(desc)) {
						for (const skill of skillSet) {
							skills.add(skill);
						}
					}
				}
				cache.skillRegsCache.set(value, skills);
			}
		}
		for (const btn of dialog.buttons) {
			const name = btn.link;
			const character = lib.character[name];
			const nameHit = reg.test(get.translation(name)) || reg.test(get.translation(`${name}_ab`));
			const skillHit = Boolean(value in lib.skill && character?.skills.includes(value));
			const skillTransHit = Boolean(skills && skills.size > 0 && character?.skills.some(skill => skills.has(skill)));
			if (nameHit || skillHit || skillTransHit) {
				btn.classList.remove("nodisplay");
			} else {
				btn.classList.add("nodisplay");
			}
		}
		updatePagination();
	};

	find.addEventListener("click", updateFind);
	input.onkeydown = function (e) {
		e.stopPropagation();
		if (e.key == "Enter") {
			updateFind();
		}
	};
	// 阻止冒泡以防止触发窗口被拖动而无法选中文字
	input.onmousedown = function (e) {
		e.stopPropagation();
	};
	Searcher.append(input, find);
	container.prepend(Searcher);
}
