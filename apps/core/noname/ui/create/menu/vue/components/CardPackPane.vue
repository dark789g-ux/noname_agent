<template>
	<div class="menu-buttons leftbutton">
		<!-- cardpile 模式：牌堆管理 -->
		<template v-if="mode === 'cardpile'">
			<CardPileManager />
		</template>

		<!-- 常规卡牌包模式 -->
		<template v-else>
			<!-- 包开关 -->
			<div
				v-if="showToggle"
				class="config toggle"
				:class="{ on: packEnabled }"
				@click="onTogglePack"
			>
				<span>开启</span>
				<NonameToggle />
			</div>

			<!-- 包信息文本（旧版 insertAdjacentHTML 的 <p>，直挂 .menu-buttons） -->
			<p
				v-if="modeInfoText"
				style="padding-left: 2em;"
				v-html="modeInfoText"
			></p>

			<!-- 卡牌按钮网格（命令式渲染到 container；menu.css 中 display: contents 消除包裹层盒子） -->
			<div ref="buttonsContainer" class="card-pack-buttons"></div>

			<!-- 隐藏卡牌包（仅非联机） -->
			<div
				v-if="showHideButton"
				class="config pointerspan"
				@click="onHidePack"
			>
				<span>{{ hiddenText }}</span>
			</div>

			<!-- 牌堆编辑器（非 mode_ 开头或 closeable 且有 cardPile） -->
			<CardPileEditor
				v-if="showPileEditor"
				:mode="mode"
			/>
		</template>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from "vue";
import { lib, game, get, _status, ui } from "noname";
import type { RightPaneContext } from "../types";
import CardPileEditor from "./editors/card-pile/CardPileEditor.vue";
import CardPileManager from "./editors/card-pile/CardPileManager.vue";
import NonameToggle from "./NonameToggle.vue";

interface Props {
	ctx: RightPaneContext;
}

const props = defineProps<Props>();

const connectMenu = computed(() => props.ctx.connectMenu);
const mode = computed(() => props.ctx.item.key);

/** DOM refs */
const buttonsContainer = ref<HTMLDivElement>();

// ---------------------------------------------------------------------------
// 包开关逻辑
// 对应旧版 togglePack（117-146）
// ---------------------------------------------------------------------------

/** 是否显示包开关 */
const showToggle = computed(() => {
	const m = mode.value;
	// mode_banned 始终不显示
	if (m === "mode_banned") return false;
	// 非 mode_ 开头的包，或 closeable 的 mode_ 包，显示开关
	// @ts-expect-error lib.cardPackInfo 是运行时对象
	const cardPack = lib.cardPackInfo[m];
	if (!m.startsWith("mode_") || (cardPack && cardPack.closeable)) {
		return true;
	}
	return false;
});

/** 包是否启用（对应旧版 createModeConfig 中的 init） */
const packEnabled = computed(() => {
	const m = mode.value;
	// 扩展卡牌包
	if (m.startsWith("mode_extension")) {
		const extName = m.slice(15);
		// @ts-expect-error hasExtension / hasExtensionLoaded 是运行时全局函数
		if (!game.hasExtension(extName) || !game.hasExtensionLoaded(extName)) {
			return false;
		}
		const key = `extension_${extName}_cards_enable`;
		// @ts-expect-error 扩展配置项是运行时动态属性
		if (lib.config[key] === undefined) {
			game.saveExtensionConfig(extName, "cards_enable", true);
		}
		// @ts-expect-error 扩展配置项是运行时动态属性
		return lib.config[key] === true;
	}
	// 普通包
	if (connectMenu.value) {
		// @ts-expect-error connect_cards 是 Set 类型扩展
		return !lib.config.connect_cards.includes(m);
	}
	return lib.config.cards.includes(m);
});

/** 切换包开关状态 */
function onTogglePack() {
	const m = mode.value;
	const isOn = packEnabled.value;

	// 扩展卡牌包
	if (m.startsWith("mode_extension")) {
		const extName = m.slice(15);
		// @ts-expect-error hasExtension / hasExtensionLoaded 是运行时全局函数
		if (!game.hasExtension(extName) || !game.hasExtensionLoaded(extName)) {
			return;
		}
		game.saveExtensionConfig(extName, "cards_enable", !isOn);
	} else {
		// 普通包
		if (connectMenu.value) {
			if (isOn) {
				// 当前开启 → 关闭（加入 connect_cards）
				// @ts-expect-error connect_cards 是 Set 类型扩展
				lib.config.connect_cards.add(m);
			} else {
				// 当前关闭 → 开启（移除 connect_cards）
				// @ts-expect-error connect_cards 是 Set 类型扩展
				lib.config.connect_cards.remove(m);
			}
			game.saveConfig("connect_cards", lib.config.connect_cards);
		} else {
			if (isOn) {
				// 当前开启 → 关闭（从 cards 移除）
				// @ts-expect-error cards 是 Set 类型扩展
				lib.config.cards.remove(m);
			} else {
				// 当前关闭 → 开启（加入 cards）
				// @ts-expect-error cards 是 Set 类型扩展
				lib.config.cards.add(m);
			}
			game.saveConfig("cards", lib.config.cards);
		}
	}
}

// ---------------------------------------------------------------------------
// 包信息文本
// 对应旧版 261-264
// ---------------------------------------------------------------------------

const modeInfoText = computed(() => {
	const m = mode.value;
	// @ts-expect-error translate 动态属性
	const info = lib.translate[m + "_cardsInfo"];
	if (!info) return "";
	// 注意：v-html 只在可信内容上使用。lib.translate 内容来自扩展数据，
	// 与旧版 insertAdjacentHTML 一致。
	return info;
});

// ---------------------------------------------------------------------------
// 卡牌按钮网格
// 对应旧版 173-304（_initLink 中的按钮渲染 + banCard + updateBanned）
// ---------------------------------------------------------------------------

// 注意：使用 ui.create.buttons 命令式创建，与旧版一致。
// 这是因为按钮渲染依赖引擎的 vcard UI 机制，不适合 Vue 声明式。

/**
 * sortCard —— 按卡牌类型排序。
 * 对应旧版 182-221。
 */
function sortCard(card: string[]): number {
	// @ts-expect-error lib.card 是运行时全局对象
	const cardData = lib.card[card[2]];
	if (!cardData) return 6;
	const type = cardData.type;
	const subtype = cardData.subtype;
	// @ts-expect-error lib.cardType 是运行时全局对象
	if (lib.cardType[subtype]) {
		// @ts-expect-error lib.cardType 是运行时全局对象
		return lib.cardType[subtype];
	}
	// @ts-expect-error lib.cardType 是运行时全局对象
	if (lib.cardType[type]) {
		// @ts-expect-error lib.cardType 是运行时全局对象
		return lib.cardType[type];
	}
	switch (type) {
		case "basic":
			return 0;
		case "chess":
			return 1.5;
		case "trick":
			return 2;
		case "delay":
			return 3;
		case "equip": {
			const st = cardData.subtype;
			switch (st) {
				case "equip1":
					return 4.1;
				case "equip2":
					return 4.2;
				case "equip3":
					return 4.3;
				case "equip4":
					return 4.4;
				case "equip5":
					return 4.5;
				default:
					return 4;
			}
		}
		case "zhenfa":
			return 5;
		default:
			return 6;
	}
}

/**
 * banCard —— 点击卡牌的封禁/查看回调。
 * 对应旧版 265-278。
 */
function banCard(this: HTMLElement, e: Event) {
	if (_status.clicked) {
		_status.clicked = false;
		return;
	}
	const m = mode.value;
	if (m.startsWith("mode_") && !m.startsWith("mode_extension_") && m !== "mode_banned") {
		return;
	}
	ui.click.touchpop();
	// @ts-expect-error _banning 是运行时挂在节点上的自定义属性
	this._banning = connectMenu.value ? "online" : "offline";
	// @ts-expect-error ui.click.intro 是运行时方法
	ui.click.intro.call(this, e);
	_status.clicked = false;
	// @ts-expect-error _banning 是运行时挂在节点上的自定义属性
	delete this._banning;
}

/**
 * updateBanned —— 根据封禁列表更新 .banned class。
 * 对应旧版 279-294。
 */
function updateBanned(this: HTMLElement) {
	let list;
	// 联机分支旧版依赖 menux.pages DOM 读取当前模式的 connect_<mode>_bannedcards，
	// 该 DOM 已随旧版菜单移除，此分支待重新设计为数据驱动版本
	if (!connectMenu.value) {
		// @ts-expect-error get.mode() + _bannedcards 是运行时属性
		list = lib.config[get.mode() + "_bannedcards"];
	}
	// @ts-expect-error this.link 是运行时挂在按钮节点上的属性
	if (list && list.includes(this.link[2])) {
		this.classList.add("banned");
	} else {
		this.classList.remove("banned");
	}
}

/**
 * 渲染卡牌按钮网格到 container。
 * 对应旧版 175-304。
 */
function renderButtons() {
	const container = buttonsContainer.value;
	if (!container) return;

	const m = mode.value;
	// @ts-expect-error lib.cardPack 是运行时对象
	const info = lib.cardPack[m];
	if (!info) return;

	// 确保 cardPile 存在
	// @ts-expect-error lib.cardPackInfo 是运行时对象
	const cardPack = lib.cardPackInfo[m];
	// @ts-expect-error lib.cardPile 是运行时对象
	if (!lib.cardPile[m] && cardPack && cardPack.list && Array.isArray(cardPack.list)) {
		// @ts-expect-error lib.cardPile 是运行时对象
		lib.cardPile[m] = cardPack.list;
	}

	container.innerHTML = "";
	const list: string[][] = [];
	for (let i = 0; i < info.length; i++) {
		if (!lib.card[info[i]]) {
			continue;
		}
		list.push([
			get.translation(get.type(info[i], "trick")),
			"",
			info[i],
		]);
	}

	list.sort(function (a, b) {
		const sort1 = sortCard(a);
		const sort2 = sortCard(b);
		if (sort1 === sort2) {
			return b[2] < a[2] ? 1 : -1;
		} else if (sort1 > sort2) {
			return 1;
		} else {
			return -1;
		}
	});

	const buttons = ui.create.buttons(list, "vcard", container);
	for (let i = 0; i < buttons.length; i++) {
		buttons[i].classList.add("noclick");
		// @ts-expect-error listen 是 noname 运行时扩展方法
		buttons[i].listen(banCard);
		if (m !== "mode_banned") {
			buttons[i].updateBanned = updateBanned;
		}
	}

	// 首次渲染后调用 updateBanned 初始化封禁状态
	for (let i = 0; i < buttons.length; i++) {
		if (buttons[i].updateBanned) {
			buttons[i].updateBanned.call(buttons[i]);
		}
	}
}

// 监听 mode 变化重新渲染按钮
watch(mode, () => {
	nextTick(() => {
		renderButtons();
	});
});

// ---------------------------------------------------------------------------
// 隐藏卡牌包
// 对应旧版 305-320
// ---------------------------------------------------------------------------

const showHideButton = computed(() => {
	const m = mode.value;
	if (connectMenu.value) return false;
	if (!lib.config.all.sgscards) return false;
	if (lib.config.all.sgscards.includes(m)) return false;
	if (m.startsWith("mode_")) return false;
	return true;
});

const hiddenText = ref("隐藏卡牌包");

function onHidePack() {
	const m = mode.value;
	if (hiddenText.value === "隐藏卡牌包") {
		hiddenText.value = "卡牌包将在重启后隐藏";
		// @ts-expect-error hiddenCardPack 是 Set 类型扩展
		lib.config.hiddenCardPack.add(m);
		if (!lib.config.prompt_hidepack) {
			alert("隐藏的扩展包可通过选项-其它-重置隐藏内容恢复");
			game.saveConfig("prompt_hidepack", true);
		}
	} else {
		hiddenText.value = "隐藏卡牌包";
		// @ts-expect-error hiddenCardPack 是 Set 类型扩展
		lib.config.hiddenCardPack.remove(m);
	}
	game.saveConfig("hiddenCardPack", lib.config.hiddenCardPack);
}

// ---------------------------------------------------------------------------
// 牌堆编辑器显示控制
// 对应旧版 321
// ---------------------------------------------------------------------------

const showPileEditor = computed(() => {
	const m = mode.value;
	// @ts-expect-error lib.cardPackInfo 是运行时对象
	const cardPack = lib.cardPackInfo[m];
	// @ts-expect-error lib.cardPile 是运行时对象
	if ((!m.startsWith("mode_") || (cardPack && cardPack.closeable)) && lib.cardPile[m]) {
		return true;
	}
	return false;
});

// ---------------------------------------------------------------------------
// mounted：首次渲染按钮
// ---------------------------------------------------------------------------

onMounted(() => {
	nextTick(() => {
		renderButtons();
	});
});
</script>
