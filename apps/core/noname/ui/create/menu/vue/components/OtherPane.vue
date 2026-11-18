<template>
	<div class="other-pane">
		<!-- 更新页 -->
		<InfoPages v-if="ctx.item.key === 'update'" page-key="update" />

		<!-- 控制页（作弊面板） -->
		<CheatPanel
			v-else-if="ctx.item.key === 'control'"
			@cheat-executed="onCheatExecuted"
		/>

		<!-- 命令页（JS 控制台） -->
		<CommandConsole v-else-if="ctx.item.key === 'command'" />

		<!-- 内核页 -->
		<InfoPages v-else-if="ctx.item.key === 'core'" page-key="core" />

		<!-- 战绩页 -->
		<InfoPages v-else-if="ctx.item.key === 'record'" page-key="record" />

		<!-- 录像页 -->
		<VideoManager v-else-if="ctx.item.key === 'video'" />

		<!-- LLM 日志页 -->
		<LLMLogViewer v-else-if="ctx.item.key === 'llm_log'" />

		<!-- 帮助页（key 形如 help_xxx） -->
		<InfoPages
			v-else-if="ctx.item.key?.startsWith('help_') && ctx.item.key !== 'help_toggle'"
			page-key="help"
			:help-name="(ctx.item.attrs as any)?.helpName || ''"
		/>
	</div>
</template>

<script setup lang="ts">
import { inject } from "vue";
import type { RightPaneContext } from "../types";
import InfoPages from "./editors/InfoPages.vue";
import CheatPanel from "./editors/debug/CheatPanel.vue";
import CommandConsole from "./editors/debug/CommandConsole.vue";
import VideoManager from "./editors/VideoManager.vue";
import LLMLogViewer from "./editors/llm/LLMLogViewer.vue";
import { menuBridge } from "../utils/menuBridge";

interface Props {
	ctx: RightPaneContext;
}

defineProps<Props>();

/**
 * 作弊执行后的回调
 * 对应旧版 cheatButton listen 中的 clickContainer 调用：关闭菜单
 */
function onCheatExecuted() {
	menuBridge.closeMenu?.();
}
</script>
