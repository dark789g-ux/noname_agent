<template>
	<div ref="containerRef" class="menu-buttons code-editor">
		<!-- 返回按钮（旧 2287） -->
		<div class="config more margin-bottom" @click="$emit('back')">
			<div style="transform:none;margin-right:3px">&larr;</div>返回
		</div>

		<!-- 代码段编辑按钮（旧 2308-2349） -->
		<div
			v-for="item in codeItems"
			:key="item.link"
			class="menubutton large dashboard"
			@click="onEditCode(item)"
		>
			<div>{{ item.short }}</div>
			<div>{{ item.full }}</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue";
import { lib, game, get, ui } from "noname";
import { security } from "@/util/sandbox";

interface Props {
	extName: string;
	isNew: boolean;
}

const props = defineProps<Props>();
defineEmits(["back"]);

// ---------------------------------------------------------------------------
// 代码内容（旧 2343）
// 对应旧版 dash4.content，供 ExtensionMaker.processExtension 使用
// ---------------------------------------------------------------------------
const content: Record<string, string> = reactive({});

// ---------------------------------------------------------------------------
// 代码段定义（旧 2344-2349）
// ---------------------------------------------------------------------------
const codeItems = reactive([
	{
		short: "辅",
		full: "辅助代码",
		link: "arenaReady",
		defaultCode:
			"function(){\n    \n}\n\n/*\n函数执行时机为游戏界面创建之后\n导出时本段代码中的换行、缩进以及注释将被清除\n*/",
	},
	{
		short: "主",
		full: "主代码",
		link: "content",
		defaultCode:
			"function(config,pack){\n    \n}\n\n/*\n函数执行时机为游戏数据加载之后、界面加载之前\n参数1扩展选项（见选项代码）；参数2为扩展定义的武将、卡牌和技能等（可在此函数中修改）\n导出时本段代码中的换行、缩进以及注释将被清除\n*/",
	},
	{
		short: "预",
		full: "预备代码",
		link: "prepare",
		defaultCode:
			"function(){\n    \n}\n\n/*\n函数执行时机为游戏扩展全部加载之后\n导出时本段代码中的换行、缩进以及注释将被清除\n*/",
	},
	{
		short: "启",
		full: "启动代码",
		link: "precontent",
		defaultCode:
			"function(config){\n    \n}\n\n/*\n函数执行时机为游戏数据加载之前，联机模式亦可加载\n除添加模式外请慎用\n导出时本段代码中的换行、缩进以及注释将被清除\n*/",
	},
	{
		short: "选",
		full: "选项代码",
		link: "config",
		defaultCode:
			'config={\n    \n}\n\n/*\n示例：\nconfig={\n    switcher_example:{\n        name:"示例列表选项",\n        init:"3",\n      \t  item:{"1":"一","2":"二","3":"三"}\n    },\n    toggle_example:{\n        name:"示例开关选项",\n        init:true\n    }\n}\n此例中传入的主代码函数的默认参数为{switcher_example:"3",toggle_example:true}\n导出时本段代码中的换行、缩进以及注释将被清除\n*/',
	},
	{
		short: "帮",
		full: "帮助代码",
		link: "help",
		defaultCode:
			'help={\n    \n}\n\n/*\n示例：\nhelp={\n    "帮助条目":"<ul><li>列表1-条目1<li>列表1-条目2</ul><ol><li>列表2-条目1<li>列表2-条目2</ul>"\n}\n帮助内容将显示在菜单－选项－帮助中\n导出时本段代码中的换行、缩进以及注释将被清除\n*/',
	},
]);

// 初始化默认代码
for (const item of codeItems) {
	content[item.link] = item.defaultCode;
}

// ---------------------------------------------------------------------------
// 编辑代码（旧 2308-2337）
// ---------------------------------------------------------------------------
function onEditCode(item: typeof codeItems[0]) {
	ui.create.editor({
		language: "javascript",
		value: content[item.link] || item.defaultCode,
		saveInput: (result: string) => {
			if (["arenaReady", "content", "prepare", "precontent"].includes(item.link)) {
				var { func } = security.exec2(`func = ${result}`);
				if (typeof func !== "function") {
					throw new Error("代码格式有错误，请对比示例代码仔细检查");
				}
			} else if (item.link === "config") {
				var { config } = security.exec2(result);
				if (config == null || typeof config !== "object") {
					throw new Error("代码格式有错误，请对比示例代码仔细检查");
				}
			} else if (item.link === "help") {
				var { help } = security.exec2(result);
				if (help == null || typeof help !== "object") {
					throw new Error("代码格式有错误，请对比示例代码仔细检查");
				}
			}
			content[item.link] = result;
		},
	});
}

// ---------------------------------------------------------------------------
// reset（旧 2292-2306）
// ---------------------------------------------------------------------------
function reset(name?: string) {
	// 清空所有代码段
	for (const key in content) {
		delete content[key];
	}
	for (const item of codeItems) {
		content[item.link] = item.defaultCode;
	}
	if (name && lib.extensionPack[name]) {
		const extCode = lib.extensionPack[name].code;
		if (extCode) {
			for (const i in extCode) {
				switch (typeof extCode[i]) {
					case "function":
						content[i] = extCode[i].toString();
						break;
					case "object":
						content[i] = i + "=" + get.stringify(extCode[i]);
						break;
				}
			}
		}
	}
}

// ---------------------------------------------------------------------------
// 暴露数据/方法供 ExtensionMaker 使用
// ---------------------------------------------------------------------------
defineExpose({
	content,
	reset,
});
</script>
