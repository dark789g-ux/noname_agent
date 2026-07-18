<template>
	<div ref="containerRef" class="menu-buttons new_skill skill-editor">
		<!-- 返回按钮（旧 1903） -->
		<div class="config more margin-bottom" @click="onBack">
			<div style="transform:none;margin-right:3px">&larr;</div>返回
		</div>

		<!-- 已有技能按钮区域（命令式渲染） -->
		<div ref="buttonsRef"></div>

		<!-- 创建/编辑技能表单（旧 2010-2250） -->
		<div v-show="showForm" class="new_character new_skill">
			<!-- 名称（旧 2012） -->
			<div class="config">
				名称：<input v-model="skillName" type="text" style="width:120px" @blur="updateButton" />
			</div>
			<!-- 描述（旧 2013） -->
			<div class="config">
				描述：<input v-model="skillDescription" type="text" style="width:120px" />
			</div>
			<!-- 编辑/引用代码（旧 2016-2187） -->
			<div class="config">
				<button v-show="!showCitePanel" @click="onEditCode">编辑代码</button>
				<button v-show="!showCitePanel" @click="showCitePanel = true">引用代码</button>
				<select
					v-show="showCitePanel"
					v-model="citeSourceSelect"
					style="display:none;max-width:80px"
					@change="onCiteSourceChange"
				>
					<option v-for="item in skillSourceList" :key="item[0]" :value="item[0]">{{ item[1] }}</option>
				</select>
				<select
					v-show="showCitePanel"
					v-model="citeTargetSelect"
					style="display:none;max-width:60px"
				>
					<option v-for="item in citeTargetList" :key="item[0]" :value="item[0]">{{ item[1] }}</option>
				</select>
				<button v-show="showCitePanel" @click="onCiteConfirm">引用</button>
				<button v-show="showCitePanel" @click="showCitePanel = false">取消</button>
			</div>
			<!-- 创建/编辑/取消按钮（旧 2189-2274） -->
			<div class="menubutton large new_skill" :class="{ disabled: editDisabled }" @click="onCreateSkill">
				{{ editButtonText }}
			</div>
			<div class="menubutton large new_card_delete" @click="onDeleteSkill">
				{{ deleteButtonText }}
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from "vue";
import { lib, game, get, ui } from "noname";
import { security } from "@/util/sandbox";
import { Character } from "@/library/element/index";

interface Props {
	extName: string;
	isNew: boolean;
}

const props = defineProps<Props>();

// ---------------------------------------------------------------------------
// 响应式表单状态
// ---------------------------------------------------------------------------
const skillName = ref("");
const skillDescription = ref("");
const showForm = ref(false);
const editDisabled = ref(true);
const showCitePanel = ref(false);
const citeSourceSelect = ref("");
const citeTargetSelect = ref("");
const editButtonText = ref("创建技能");
const deleteButtonText = ref("取消");

// ---------------------------------------------------------------------------
// 代码内容（旧 2033）
// ---------------------------------------------------------------------------
const DEFAULT_CODE = 'skill={\n    \n}\n\n/*\n示例：\nskill={\n    trigger:{player:"phaseJieshuBegin"},\n    frequent:true,\n    content:function(){\n        player.draw()\n    }\n}\n此例为闭月代码\n导出时本段代码中的换行、缩进以及注释将被清除\n*/';
let code = DEFAULT_CODE;

// ---------------------------------------------------------------------------
// 技能源列表（旧 2047-2084）
// ---------------------------------------------------------------------------
const skillSourceList: string[][] = [];
for (const i in lib.character) {
	if (lib.character[i][3].length) {
		skillSourceList.push([i, lib.translate[i]]);
	}
}
if (!skillSourceList.length) {
	if (!lib.character["noname_sunce"]) {
		lib.character["noname_sunce"] = new Character({
			sex: "male",
			group: "wu",
			hp: 4,
			skills: ["jiang"],
			isUnseen: true,
		});
	}
	if (!lib.translate["noname_sunce"]) lib.translate["noname_sunce"] = "孙策";
	skillSourceList.push(["noname_sunce", lib.translate["noname_sunce"]]);
}
skillSourceList.sort((a, b) => {
	let aa = a[0], bb = b[0];
	if (aa.includes("_")) aa = aa.slice(aa.lastIndexOf("_") + 1);
	if (bb.includes("_")) bb = bb.slice(bb.lastIndexOf("_") + 1);
	if (aa !== bb) return aa > bb ? 1 : -1;
	return a[0] > b[0] ? 1 : -1;
});
skillSourceList.push(["others", "其它"]);

// 其它技能列表（旧 2092-2099）
const otherSkillList: string[] = [];
for (const i in lib.skill) {
	if (i !== "global" && !get.is.empty(lib.skill[i]) && !lib.skilllist.includes(i)) {
		otherSkillList.push(i);
	}
}
otherSkillList.sort();

const citeTargetList = ref<string[][]>([]);

// ---------------------------------------------------------------------------
// 容器 ref
// ---------------------------------------------------------------------------
const containerRef = ref<HTMLElement | null>(null);
const buttonsRef = ref<HTMLElement | null>(null);

// ---------------------------------------------------------------------------
// 内容数据（供 ExtensionMaker.processExtension 使用）
// ---------------------------------------------------------------------------
const packData = reactive({
	skill: {} as Record<string, any>,
	translate: {} as Record<string, string>,
});
const audioData: Record<string, ArrayBuffer> = {};

// ---------------------------------------------------------------------------
// updateButton（旧 1842-1864）
// ---------------------------------------------------------------------------
function updateButton() {
	const name = skillName.value;
	if (!name) {
		editDisabled.value = true;
		return;
	}
	const id = name.split("|")[0];
	if (currentButton) {
		// 编辑态：仅当改成已存在的其它 id 时才禁用（旧 1878-1884）
		if ((currentButton as any).link !== id && (lib.skill[id] || packData.skill[id])) {
			editDisabled.value = true;
			return;
		}
	} else if (lib.skill[id] || packData.skill[id]) {
		editDisabled.value = true;
		return;
	}
	editDisabled.value = false;
}

// ---------------------------------------------------------------------------
// 引用技能源切换（旧 2100-2120）
// ---------------------------------------------------------------------------
function onCiteSourceChange() {
	const val = citeSourceSelect.value;
	const newTargets: string[][] = [];
	if (val === "others") {
		for (const s of otherSkillList) {
			newTargets.push([s, s]);
		}
	} else {
		const skills = lib.character[val][3];
		for (const s of skills) {
			newTargets.push([s, lib.translate[s]]);
		}
	}
	citeTargetList.value = newTargets;
	if (newTargets.length) citeTargetSelect.value = newTargets[0][0];
}

// ---------------------------------------------------------------------------
// 编辑代码（旧 2019-2031）
// ---------------------------------------------------------------------------
function onEditCode() {
	ui.create.editor({
		language: "javascript",
		value: code,
		saveInput: (result: string) => {
			const { skill } = security.exec2(result);
			if (skill == null || typeof skill !== "object") {
				throw new Error("代码格式有错误，请对比示例代码仔细检查");
			}
			code = result;
		},
	});
}

// ---------------------------------------------------------------------------
// 技能对象序列化为 code（旧 2039/2133 同款，需处理 getter/setter 与 Symbol）
// ---------------------------------------------------------------------------
function skillToCode(skillInfo: any): string {
	return (
		"skill=" +
		(() => {
			const obj = Object.defineProperty(get.copy(skillInfo), "_priority", {
				enumerable: false,
				writable: true,
				configurable: true,
			});
			let str = "{\n";
			const indent = "    ";
			for (const key in obj) {
				const descriptor = Object.getOwnPropertyDescriptor(obj, key);
				if (descriptor?.get || descriptor?.set) {
					if (descriptor.get) str += indent + get.stringify(descriptor.get, 1) + ",\n";
					if (descriptor.set) str += indent + get.stringify(descriptor.set, 1) + ",\n";
				} else {
					let keyString = (/[^a-zA-Z]/.test(key) ? `"${key}"` : key) + ": ";
					if (get.is.functionMethod(obj, key)) keyString = "";
					str += indent + keyString + get.stringify(obj[key], 1) + ",\n";
				}
			}
			Object.getOwnPropertySymbols(obj).forEach(symbol => {
				str += `${indent}[${String(symbol)}]: ${get.stringify(obj[symbol], 1)},\n`;
			});
			str += "}";
			return str;
		})()
	);
}

// ---------------------------------------------------------------------------
// 引用确认（旧 2130-2175）
// ---------------------------------------------------------------------------
function onCiteConfirm() {
	showCitePanel.value = false;
	code = skillToCode(lib.skill[citeTargetSelect.value]);
	if (lib.translate[citeTargetSelect.value + "_info"]) {
		skillDescription.value = lib.translate[citeTargetSelect.value + "_info"];
	}
}

// ---------------------------------------------------------------------------
// 编辑已有技能（旧 1914-1979 clickButton）：
// 点击已有技能按钮切换编辑模式，加载技能数据到表单；再次点击同一按钮退出编辑
// ---------------------------------------------------------------------------
let currentButton: HTMLElement | null = null;

function onSkillButtonClick(button: HTMLElement) {
	if (currentButton === button) {
		resetEditor();
		return;
	}
	resetEditor();
	currentButton = button;
	showForm.value = true;
	const id = (button as any).link as string;
	const translate = packData.translate[id];
	skillName.value = translate && translate !== id ? `${id}|${translate}` : id;
	skillDescription.value = packData.translate[id + "_info"] || "";
	code = skillToCode(packData.skill[id]);
	editButtonText.value = "编辑技能";
	deleteButtonText.value = "删除";
	editDisabled.value = false;
}

// ---------------------------------------------------------------------------
// 创建/编辑技能（旧 2189-2248）
// ---------------------------------------------------------------------------
function onCreateSkill() {
	let name = skillName.value;
	if (!name) {
		alert("请填写技能名\n提示：技能名格式为id+|+中文名，其中id必须惟一");
		return;
	}
	name = name.split("|");
	const translate = name[1] || name[0];
	const id = name[0];
	if (currentButton) {
		// 编辑态：id 未变走更新路径；改名则校验新 id 并迁移数据（旧 2204-2217）
		const oldId = (currentButton as any).link as string;
		if (oldId !== id) {
			if (lib.skill[id] || packData.skill[id]) {
				alert("技能名与现有技能重复，请更改");
				return;
			}
			delete packData.skill[oldId];
			delete packData.translate[oldId];
			delete packData.translate[oldId + "_info"];
			(currentButton as any).link = id;
		}
	} else if (lib.skill[id] || packData.skill[id]) {
		alert("技能名与现有技能重复，请更改");
		return;
	}
	packData.translate[id] = translate;
	packData.translate[id + "_info"] = skillDescription.value;
	try {
		const { skill } = security.exec2(code);
		if (skill == null || typeof skill !== "object") throw new Error("err");
		packData.skill[id] = skill;
	} catch {
		packData.skill[id] = {};
	}
	if (currentButton) {
		currentButton.innerHTML = translate;
	} else {
		createButton(id);
	}
	resetEditor();
}

// ---------------------------------------------------------------------------
// 删除技能（旧 2251-2274）
// ---------------------------------------------------------------------------
function onDeleteSkill() {
	if (deleteButtonText.value === "删除" && currentButton) {
		const id = (currentButton as any).link as string;
		currentButton.remove();
		delete packData.skill[id];
		delete packData.translate[id];
		delete packData.translate[id + "_info"];
	}
	resetEditor();
}

// ---------------------------------------------------------------------------
// 返回（旧 1903-1912）
// ---------------------------------------------------------------------------
function onBack() {
	// 由 ExtensionMaker 控制返回
}

// ---------------------------------------------------------------------------
// resetEditor（旧 1987-2008）
// ---------------------------------------------------------------------------
function resetEditor() {
	currentButton = null;
	skillName.value = "";
	skillDescription.value = "";
	showForm.value = false;
	editButtonText.value = "创建技能";
	deleteButtonText.value = "取消";
	editDisabled.value = true;
	showCitePanel.value = false;
	code = DEFAULT_CODE;
}

// ---------------------------------------------------------------------------
// 创建技能按钮（旧 1970-1976）
// ---------------------------------------------------------------------------
function createButton(name: string) {
	if (!buttonsRef.value) return;
	const button = ui.create.div(".menubutton");
	(button as any).link = name;
	button.innerHTML = packData.translate[name];
	button.onclick = () => onSkillButtonClick(button as unknown as HTMLElement);
	buttonsRef.value.insertBefore(button, buttonsRef.value.childNodes[0] || null);
}

// ---------------------------------------------------------------------------
// reset（旧 1871-1902）
// ---------------------------------------------------------------------------
function reset(name?: string) {
	resetEditor();
	// 切换/新建扩展时重置音频资源池（旧 1886）
	for (const key in audioData) delete audioData[key];
	if (buttonsRef.value) buttonsRef.value.innerHTML = "";
	if (name && lib.extensionPack[name]) {
		const pack = lib.extensionPack[name].skill || { skill: {}, translate: {} };
		packData.skill = get.copy(pack.skill);
		packData.translate = get.copy(pack.translate);
		for (const i in packData.skill) {
			createButton(i);
		}
	} else {
		packData.skill = {};
		packData.translate = {};
		showForm.value = true;
	}
}

// ---------------------------------------------------------------------------
// 暴露数据/方法供 ExtensionMaker 使用
// ---------------------------------------------------------------------------
defineExpose({
	packData,
	audioData,
	reset,
});
</script>
