<template>
	<div class="banskill-editor-container" style="padding-bottom: 10px">
		<!-- 自动发动折叠 -->
		<div
			class="config more"
			:class="{ on: autoSkillExpanded }"
			@click="autoSkillExpanded = !autoSkillExpanded"
		>
			自动发动 <div>&gt;</div>
		</div>
		<div v-show="autoSkillExpanded">
			<div
				v-for="cfg in autoSkillConfigs"
				:key="cfg._name"
				class="config toggle indent"
				:class="{ on: isAutoSkillOn(cfg._name!) }"
				@click="toggleAutoSkill(cfg._name!)"
			>
				<span>{{ cfg.name }}</span>
			</div>
		</div>

		<!-- 双将禁配折叠 -->
		<div
			class="config more"
			:class="{ on: banSkillExpanded }"
			@click="banSkillExpanded = !banSkillExpanded"
		>
			双将禁配 <div>&gt;</div>
		</div>
		<div v-show="banSkillExpanded">
			<!-- 内置禁配项 -->
			<div
				v-for="cfg in banSkillConfigs"
				:key="cfg._name"
				class="config toggle indent"
				:class="{ on: isBanSkillOn(cfg._name!) }"
				@click="toggleBanSkill(cfg._name!)"
			>
				<span>{{ cfg.name }}</span>
			</div>

			<!-- 自定义禁配项 -->
			<div
				v-for="(item, idx) in customBanSkills"
				:key="'custom-' + idx"
				class="config indent toggle"
				style="display: block"
			>
				<span>{{ getCustomBanSkillName(item) }}</span>
				<span class="cardpiledelete" @click="deleteCustomBanSkill(idx)">删除</span>
			</div>

			<!-- 添加按钮 -->
			<div
				class="config indent"
				style="cursor: pointer"
				@click="showAddPanel = !showAddPanel"
			>
				<span class="pointerdiv">添加...</span>
			</div>

			<!-- 添加面板 -->
			<div v-if="showAddPanel" class="config indent hidden banskilladd" style="display: block">
				<select
					v-model="selectedChar1"
					style="max-width: 85px"
					@change="onChar1Change"
				>
					<option v-for="c in characterList" :key="c[0]" :value="c[0]">
						{{ c[1] }}
					</option>
				</select>
				<select
					v-model="selectedSkill1"
					style="max-width: 85px"
				>
					<option v-for="s in char1Skills" :key="s[0]" :value="s[0]">
						{{ s[1] }}
					</option>
				</select>
				<span>＋</span>
				<br />
				<select
					v-model="selectedChar2"
					style="max-width: 85px"
					@change="onChar2Change"
				>
					<option v-for="c in characterList" :key="c[0]" :value="c[0]">
						{{ c[1] }}
					</option>
				</select>
				<select
					v-model="selectedSkill2"
					style="max-width: 85px"
				>
					<option v-for="s in char2Skills" :key="s[0]" :value="s[0]">
						{{ s[1] }}
					</option>
				</select>
				<button @click="confirmAddBanSkill">确定</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { get, game, lib } from "noname";

// ---------------------------------------------------------------------------
// Props —— 由 OptionsRightPane 传入 skill mode 的 SelectConfigData 列表
// ---------------------------------------------------------------------------

interface Props {
	/** mode="skill" 的所有配置项（含 autoskill/banskill 标记项） */
	skillConfigs: any[];
}

const props = defineProps<Props>();

// ---------------------------------------------------------------------------
// 折叠状态
// 对应旧版 autoskillexpanded / banskillexpanded
// ---------------------------------------------------------------------------

const autoSkillExpanded = ref(false);
const banSkillExpanded = ref(false);
const showAddPanel = ref(false);

// ---------------------------------------------------------------------------
// 从 skillConfigs 中分类 autoskill / banskill 项
// 对应旧版 autoskillNodes / banskillNodes
// ---------------------------------------------------------------------------

const autoSkillConfigs = computed(() => {
	return props.skillConfigs.filter(c => c.type === "autoskill");
});

const banSkillConfigs = computed(() => {
	return props.skillConfigs.filter(c => c.type === "banskill");
});

// ---------------------------------------------------------------------------
// 自定义禁配项列表
// 对应旧版 lib.config.customforbid
// ---------------------------------------------------------------------------

const customBanSkills = ref<string[][]>([]);

onMounted(() => {
	if (lib.config.customforbid) {
		customBanSkills.value = lib.config.customforbid.slice();
	}
});

// ---------------------------------------------------------------------------
// 切换 autoskill 状态
// 对应旧版 clickAutoSkill（39-48）
// ---------------------------------------------------------------------------

function toggleAutoSkill(_name: string) {
	let list = lib.config.autoskilllist;
	if (list.includes(_name)) {
		list.remove(_name);
	} else {
		list.add(_name);
	}
	game.saveConfig("autoskilllist", list);
}

function isAutoSkillOn(_name: string): boolean {
	return lib.config.autoskilllist.includes(_name);
}

// ---------------------------------------------------------------------------
// 切换 banskill 状态
// 对应旧版 clickBanSkill（64-73）
// ---------------------------------------------------------------------------

function toggleBanSkill(_name: string) {
	let list = lib.config.forbidlist;
	if (list.includes(_name)) {
		list.remove(_name);
	} else {
		list.add(_name);
	}
	game.saveConfig("forbidlist", list);
}

function isBanSkillOn(_name: string): boolean {
	return lib.config.forbidlist.includes(_name);
}

// ---------------------------------------------------------------------------
// 自定义禁配 —— 删除
// 对应旧版 deleteCustomBanSkill（180-189）
// ---------------------------------------------------------------------------

function deleteCustomBanSkill(idx: number) {
	let skills = customBanSkills.value[idx];
	for (let i = 0; i < lib.config.customforbid.length; i++) {
		if (matchBanSkill(lib.config.customforbid[i], skills)) {
			lib.config.customforbid.splice(i--, 1);
			break;
		}
	}
	game.saveConfig("customforbid", lib.config.customforbid);
	customBanSkills.value.splice(idx, 1);
}

// ---------------------------------------------------------------------------
// 自定义禁配 —— 添加
// 对应旧版 createCustomBanSkill + confirmbutton.onclick（190-298）
// ---------------------------------------------------------------------------

function getCustomBanSkillName(skills: string[]): string {
	return skills.map(s => get.translation(s)).join("+");
}

function matchBanSkill(skills1: string[], skills2: string[]): boolean {
	if (skills1.length != skills2.length) return false;
	for (let i = 0; i < skills1.length; i++) {
		if (!skills2.includes(skills1[i])) return false;
	}
	return true;
}

// 武将列表（有技能的武将）
// 对应旧版 214-237
const characterList = ref<[string, string][]>([]);

const selectedChar1 = ref("");
const selectedSkill1 = ref("");
const selectedChar2 = ref("");
const selectedSkill2 = ref("");

const char1Skills = ref<[string, string][]>([]);
const char2Skills = ref<[string, string][]>([]);

function getSkillsForChar(charKey: string): [string, string][] {
	let skills = lib.character[charKey]?.[3] || [];
	return skills.map((s: string) => [s, lib.translate[s] || s]);
}

function onChar1Change() {
	char1Skills.value = getSkillsForChar(selectedChar1.value);
	if (char1Skills.value.length) {
		selectedSkill1.value = char1Skills.value[0][0];
	}
}

function onChar2Change() {
	char2Skills.value = getSkillsForChar(selectedChar2.value);
	if (char2Skills.value.length) {
		selectedSkill2.value = char2Skills.value[0][0];
	}
}

function confirmAddBanSkill() {
	let skills = [selectedSkill1.value, selectedSkill2.value];
	if (skills[0] == skills[1]) {
		skills.shift();
	}
	if (!lib.config.customforbid) return;
	for (let i = 0; i < lib.config.customforbid.length; i++) {
		if (matchBanSkill(lib.config.customforbid[i], skills)) return;
	}
	lib.config.customforbid.push(skills);
	game.saveConfig("customforbid", lib.config.customforbid);
	customBanSkills.value.push(skills);
	showAddPanel.value = false;
}

onMounted(() => {
	// 构建武将列表 —— 对应旧版 214-237
	let list: [string, string][] = [];
	for (let i in lib.character) {
		if (lib.character[i][3].length) {
			list.push([i, lib.translate[i]]);
		}
	}
	if (!list.length) return;

	list.sort(function (a, b) {
		let aa = a[0], bb = b[0];
		if (aa.includes("_")) aa = aa.slice(aa.lastIndexOf("_") + 1);
		if (bb.includes("_")) bb = bb.slice(bb.lastIndexOf("_") + 1);
		if (aa != bb) return aa > bb ? 1 : -1;
		return a[0] > b[0] ? 1 : -1;
	});

	characterList.value = list;
	selectedChar1.value = list[0][0];
	selectedChar2.value = list[0][0];
	onChar1Change();
	onChar2Change();
});
</script>
