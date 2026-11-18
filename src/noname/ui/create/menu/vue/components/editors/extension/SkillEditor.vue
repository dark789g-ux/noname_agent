<template>
	<div class="menu-buttons new_skill skill-editor">
		<div class="config more margin-bottom" @click="$emit('back')">
			<div style="transform:none;margin-right:3px">&larr;</div>返回
		</div>

		<!-- 已有技能按钮（直挂 .menu-buttons.new_skill，命中 menu.css 直接子代规则） -->
		<div
			v-for="id in skillButtonIds"
			:key="id"
			class="menubutton"
			@click="onSkillButtonClick(id)"
		>
			{{ packData.translate[id] || id }}
		</div>

		<div class="config more" :class="{ on: showForm }" @click="showForm = !showForm">
			{{ formHeaderText }} <div>&gt;</div>
		</div>

		<div v-show="showForm" class="new_character new_skill">
			<div class="config">
				名称：<input v-model="skillName" type="text" style="width:120px" @blur="updateButton" />
			</div>
			<div class="config">
				描述：<input v-model="skillDescription" type="text" style="width:120px" />
			</div>
			<div class="config">
				<button v-show="!showCitePanel" @click="onEditCode">编辑代码</button>
				<button v-show="!showCitePanel" @click="showCitePanel = true">引用代码</button>
				<select
					v-show="showCitePanel"
					v-model="citeSourceSelect"
					style="max-width:80px"
					@change="onCiteSourceChange"
				>
					<option v-for="item in skillSourceList" :key="item[0]" :value="item[0]">{{ item[1] }}</option>
				</select>
				<select
					v-show="showCitePanel"
					v-model="citeTargetSelect"
					style="max-width:60px"
				>
					<option v-for="item in citeTargetList" :key="item[0]" :value="item[0]">{{ item[1] }}</option>
				</select>
				<button v-show="showCitePanel" @click="onCiteConfirm">引用</button>
				<button v-show="showCitePanel" @click="showCitePanel = false">取消</button>
			</div>

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
import { computed, reactive, ref } from "vue";
import { get, lib } from "noname";
import { getCharactersWithSkillsOptions, type OptionPair } from "../shared/entityOptions.js";
import { hasEntityIdConflict, openValidatedCodeEditor, parseEntityName, serializeSkillToCode, validateNamedObjectCode } from "./makerShared.js";

defineProps<{ extName: string; isNew: boolean }>();
defineEmits(["back"]);

const DEFAULT_CODE =
	'skill={\n    \n}\n\n/*\n示例：\nskill={\n    trigger:{player:"phaseJieshuBegin"},\n    frequent:true,\n    content:function(){\n        player.draw()\n    }\n}\n此例为闭月代码\n导出时本段代码中的换行、缩进以及注释将被清除\n*/';

const skillName = ref("");
const skillDescription = ref("");
const showForm = ref(false);
const editDisabled = ref(true);
const showCitePanel = ref(false);
const citeSourceSelect = ref("");
const citeTargetSelect = ref("");
const editingId = ref<string | null>(null);
const skillButtonIds = ref<string[]>([]);
let code = DEFAULT_CODE;

const skillSourceList: OptionPair[] = [
	...getCharactersWithSkillsOptions({ ensureFallbackSunce: true }),
	["others", "其它"],
];

const otherSkillList: string[] = [];
for (const i in lib.skill) {
	if (i !== "global" && !get.is.empty(lib.skill[i]) && !lib.skilllist.includes(i)) {
		otherSkillList.push(i);
	}
}
otherSkillList.sort();

const citeTargetList = ref<OptionPair[]>([]);
const packData = reactive({
	skill: {} as Record<string, any>,
	translate: {} as Record<string, string>,
});
const audioData: Record<string, ArrayBuffer> = {};

const editButtonText = computed(() => (editingId.value ? "编辑技能" : "创建技能"));
const deleteButtonText = computed(() => (editingId.value ? "删除" : "取消"));
const formHeaderText = computed(() => (editingId.value ? "编辑技能" : "创建技能"));

function updateButton() {
	const parsed = parseEntityName(skillName.value);
	if (!parsed) {
		editDisabled.value = true;
		return;
	}
	editDisabled.value = hasEntityIdConflict(parsed.id, editingId.value, lib.skill, packData.skill);
}

function onCiteSourceChange() {
	const val = citeSourceSelect.value;
	const targets: OptionPair[] =
		val === "others"
			? otherSkillList.map(s => [s, s])
			: (lib.character[val]?.[3] || []).map((s: string) => [s, lib.translate[s] || s]);
	citeTargetList.value = targets;
	citeTargetSelect.value = targets.length ? targets[0][0] : "";
}

if (skillSourceList.length) {
	citeSourceSelect.value = skillSourceList[0][0];
	onCiteSourceChange();
}

function onEditCode() {
	openValidatedCodeEditor(
		code,
		result => validateNamedObjectCode("skill", result),
		result => {
			code = result;
		}
	);
}

function onCiteConfirm() {
	showCitePanel.value = false;
	if (!citeTargetSelect.value || !lib.skill[citeTargetSelect.value]) return;
	code = serializeSkillToCode(lib.skill[citeTargetSelect.value]);
	if (lib.translate[`${citeTargetSelect.value}_info`]) {
		skillDescription.value = lib.translate[`${citeTargetSelect.value}_info`];
	}
}

function onSkillButtonClick(id: string) {
	if (editingId.value === id) {
		resetEditor();
		return;
	}
	resetEditor();
	editingId.value = id;
	showForm.value = true;
	const translate = packData.translate[id];
	skillName.value = translate && translate !== id ? `${id}|${translate}` : id;
	skillDescription.value = packData.translate[`${id}_info`] || "";
	code = serializeSkillToCode(packData.skill[id]);
	editDisabled.value = false;
}

function onCreateSkill() {
	const parsed = parseEntityName(skillName.value);
	if (!parsed) {
		alert("请填写技能名\n提示：技能名格式为id+|+中文名，其中id必须惟一");
		return;
	}
	const { id, translate } = parsed;
	const oldId = editingId.value;
	if (hasEntityIdConflict(id, oldId, lib.skill, packData.skill)) {
		alert("技能名与现有技能重复，请更改");
		return;
	}
	if (oldId !== null && oldId !== id) {
		delete packData.skill[oldId];
		delete packData.translate[oldId];
		delete packData.translate[`${oldId}_info`];
		const idx = skillButtonIds.value.indexOf(oldId);
		if (idx >= 0) skillButtonIds.value[idx] = id;
	}
	packData.translate[id] = translate;
	packData.translate[`${id}_info`] = skillDescription.value;
	try {
		packData.skill[id] = validateNamedObjectCode("skill", code);
	} catch {
		packData.skill[id] = {};
	}
	if (oldId === null) {
		skillButtonIds.value.unshift(id);
	}
	resetEditor();
}

function onDeleteSkill() {
	if (editingId.value) {
		const id = editingId.value;
		const idx = skillButtonIds.value.indexOf(id);
		if (idx >= 0) skillButtonIds.value.splice(idx, 1);
		delete packData.skill[id];
		delete packData.translate[id];
		delete packData.translate[`${id}_info`];
	}
	resetEditor();
}

function resetEditor() {
	editingId.value = null;
	skillName.value = "";
	skillDescription.value = "";
	showForm.value = false;
	editDisabled.value = true;
	showCitePanel.value = false;
	code = DEFAULT_CODE;
}

function reset(name?: string) {
	resetEditor();
	skillButtonIds.value = [];
	for (const key in audioData) delete audioData[key];
	if (name && lib.extensionPack[name]) {
		const pack = lib.extensionPack[name].skill || { skill: {}, translate: {} };
		packData.skill = get.copy(pack.skill);
		packData.translate = get.copy(pack.translate);
		for (const id in packData.skill) {
			skillButtonIds.value.unshift(id);
		}
	} else {
		packData.skill = {};
		packData.translate = {};
		showForm.value = true;
	}
}

defineExpose({
	packData,
	audioData,
	reset,
});
</script>
