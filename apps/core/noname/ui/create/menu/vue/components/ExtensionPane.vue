<template>
	<div class="extension-pane">
		<!-- 扩展制作器 -->
		<ExtensionMaker
			v-if="ctx.item.key === 'extension_maker'"
		/>

		<!-- 获取扩展 -->
		<div v-else-if="ctx.item.key === 'extension_get'" class="extension-get">
			<ExtensionGetter />
		</div>

		<!-- 扩展配置（命令式渲染到 container） -->
		<div v-else ref="configContainer" class="extension-config"></div>
	</div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick, h } from "vue";
import { lib, game, get, ui } from "noname";
import type { RightPaneContext } from "../types";
import { togglePack, buildExtensionConfigs } from "../data/extensionMenuData";
import ExtensionMaker from "./editors/extensionMaker/ExtensionMaker.vue";
import ExtensionGetter from "./editors/ExtensionGetter.vue";

interface Props {
	ctx: RightPaneContext;
}

const props = defineProps<Props>();

const configContainer = ref<HTMLElement | null>(null);

/**
 * 渲染扩展配置项到 container
 * 使用 buildExtensionConfigs（数据层）构建配置，本函数只负责命令式渲染
 */
function renderConfigs() {
	if (!configContainer.value) return;
	const container = configContainer.value;

	// 清空已有内容
	container.innerHTML = "";

	const mode = props.ctx.item.key;
	const menu = lib.extensionMenu[mode];
	if (!menu) return;

	const configs = buildExtensionConfigs(mode);
	for (const cfg of configs) {
		// enable 项需要 togglePack + onswitch 回调
		if ((cfg as any)._key === "enable") {
			(cfg as any).onclick = function (result: any) {
				togglePack(mode, result, menu[key].onswitch);
			};
		}

		const cfgnode = ui.create.config(cfg);
		if ((cfg as any).onswitch) {
			(cfgnode as any).onswitch = (cfg as any).onswitch;
		}
		container.appendChild(cfgnode);
	}
}

// 当 item.key 变化时重新渲染
watch(
	() => props.ctx.item.key,
	() => {
		nextTick(() => {
			if (props.ctx.item.key !== "extension_maker" && props.ctx.item.key !== "extension_get") {
				renderConfigs();
			}
		});
	},
	{ immediate: true }
);
</script>
