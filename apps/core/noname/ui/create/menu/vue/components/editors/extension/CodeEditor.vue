<template>
	<div class="menu-buttons code-editor">
		<div class="config more margin-bottom" @click="$emit('back')">
			<div style="transform:none;margin-right:3px">&larr;</div>返回
		</div>

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
import { reactive } from "vue";
import { get, lib } from "noname";
import { security } from "@/util/sandbox";
import { openValidatedCodeEditor, validateNamedObjectCode } from "./makerShared.js";

defineProps<{
	extName: string;
	isNew: boolean;
}>();

defineEmits(["back"]);

const content: Record<string, string> = reactive({});

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

for (const item of codeItems) {
	content[item.link] = item.defaultCode;
}

const FUNCTION_SECTIONS = new Set(["arenaReady", "content", "prepare", "precontent"]);

function onEditCode(item: (typeof codeItems)[0]) {
	openValidatedCodeEditor(
		content[item.link] || item.defaultCode,
		result => {
			if (FUNCTION_SECTIONS.has(item.link)) {
				const { func } = security.exec2(`func = ${result}`);
				if (typeof func !== "function") {
					throw new Error("代码格式有错误，请对比示例代码仔细检查");
				}
			} else {
				validateNamedObjectCode(item.link, result);
			}
		},
		result => {
			content[item.link] = result;
		}
	);
}

function reset(name?: string) {
	for (const key in content) delete content[key];
	for (const item of codeItems) {
		content[item.link] = item.defaultCode;
	}
	if (name && lib.extensionPack[name]?.code) {
		const extCode = lib.extensionPack[name].code;
		for (const i in extCode) {
			if (typeof extCode[i] === "function") {
				content[i] = extCode[i].toString();
			} else if (typeof extCode[i] === "object") {
				content[i] = `${i}=${get.stringify(extCode[i])}`;
			}
		}
	}
}

defineExpose({ content, reset });
</script>
