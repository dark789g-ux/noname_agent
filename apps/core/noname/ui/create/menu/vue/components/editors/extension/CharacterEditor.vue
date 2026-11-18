<template>
	<div class="menu-buttons character-editor">
		<div class="config more margin-bottom" @click="$emit('back')">
			<div style="transform:none;margin-right:3px">&larr;</div>返回
		</div>

		<!-- 已有武将按钮（直挂 .menu-buttons，保持菜单流与卡片排版） -->
		<div
			v-for="item in charButtons"
			:key="item.id"
			v-char-bg:character="item.customBg ? undefined : item.id"
			class="button character noclick"
			:style="item.customBg ? { backgroundImage: `url(${item.customBg})`, backgroundSize: 'cover' } : { backgroundSize: 'cover' }"
			@click="onCharacterButtonClick(item, $event)"
		>
			<div class="name" style="top:8px" v-html="get.verticalStr(packData.translate[item.id] || item.id)"></div>
		</div>

		<div class="config more" :class="{ on: showForm }" @click="showForm = !showForm">
			{{ formHeaderText }} <div>&gt;</div>
		</div>

		<div v-show="showForm" class="new_character">
			<div class="avatar" :class="{ inited: fakemeInited }" :style="fakemeStyle">
				<input
					ref="avatarInput"
					type="file"
					accept="image/*"
					class="fileinput"
					@change="onAvatarChange"
				/>
				<div class="select_avatar">选择头像</div>
			</div>

			<div class="indent" style="padding-top:8px">
				姓名：<input v-model="charName" type="text" @blur="updateButton" />
			</div>
			<div class="indent" style="padding-top:8px">
				介绍：<input v-model="charDes" type="text" />
			</div>
			<div class="indent" style="padding-top:8px">
				体力：<input v-model="charHp" type="text" placeholder="体/限/甲" />
			</div>
			<div class="indent" style="padding-top:8px">
				性别：<select v-model="charSex">
					<option value="male">男</option>
					<option value="female">女</option>
					<option value="double">双性</option>
					<option value="none">无</option>
				</select>
			</div>
			<div class="indent" style="padding-top:8px">
				势力：<select v-model="charGroup">
					<option v-for="g in groupList" :key="g[0]" :value="g[0]">{{ g[1] }}</option>
				</select>
			</div>
			<div class="indent" style="padding-top:8px">
				<label>阵亡配音:</label>
				<input
					v-show="!dieAudioPreview"
					ref="dieAudioInput"
					type="file"
					accept="audio/*"
					style="width:calc(100% - 100px)"
					@change="onDieAudioChange"
				/>
				<button v-if="dieAudioPreview" @click="playDieAudio">播放</button>
				<button v-if="dieAudioPreview" @click="cancelDieAudio">取消</button>
			</div>

			<div class="add_skill options" style="padding-top:8px">
				<span>主公<input v-model="isZhu" type="checkbox" name="zhu" /></span>
				<span>BOSS<input v-model="isBoss" type="checkbox" name="boss" /></span>
				<span>仅点将可用<input v-model="isForbidAi" type="checkbox" name="forbidai" /></span>
				<br />
				<span>隐匿技<input v-model="isHiddenSkill" type="checkbox" name="hiddenSkill" /></span>
				<br />
			</div>

			<div class="add_skill" style="padding-top:8px">
				添加技能<br />
				<select v-model="skillSourceSelect" style="max-width:85px" @change="onSkillSourceChange">
					<option v-for="item in skillSourceList" :key="item[0]" :value="item[0]">{{ item[1] }}</option>
				</select>
				<select v-model="skillSelect" style="max-width:60px">
					<option v-for="item in skillTargetList" :key="item[0]" :value="item[0]">{{ item[1] }}</option>
				</select>
				<button @click="onAddSkill">添加</button>
				<button @click="$emit('create-skill')">创建</button>
			</div>

			<!-- 已添加技能列表：按钮置入第一个子 div，命中 menu.css 直接子代规则 -->
			<div class="skill_list">
				<div>
					<button
						v-for="(skillId, idx) in addedSkills"
						:key="`${skillId}-${idx}`"
						@click="addedSkills.splice(idx, 1)"
					>
						{{ skillDisplayLabel(skillId) }}
					</button>
				</div>
				<div></div>
			</div>

			<div class="menubutton large" :class="{ disabled: editDisabled }" @click="onCreateCharacter">
				{{ editButtonText }}
			</div>
			<div class="menubutton large" style="margin-left:13px" @click="onDeleteCharacter">
				{{ deleteButtonText }}
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import { game, get, lib } from "noname";
import { getCharactersWithSkillsOptions, type OptionPair } from "../shared/entityOptions.js";
import { vCharBg } from "../shared/vCharBg.js";
import { extractCharacterSnapshot, parseHpInput, resolveDieAudioBuffer, writeCharacterRecord } from "./characterModel.js";
import { hasEntityIdConflict, parseEntityName, readFileAsArrayBuffer, readImageAsDataUrlAndBuffer } from "./makerShared.js";

interface CharButtonItem {
	id: string;
	customBg?: string;
}

defineProps<{ extName: string; isNew: boolean }>();
defineEmits(["back", "create-skill"]);

const charName = ref("");
const charDes = ref("");
const charHp = ref("");
const charSex = ref("male");
const charGroup = ref("wei");
const isZhu = ref(false);
const isBoss = ref(false);
const isForbidAi = ref(false);
const isHiddenSkill = ref(false);
const showForm = ref(false);
const fakemeInited = ref(false);
const editDisabled = ref(true);
const fakemeStyle = reactive<Record<string, string>>({});
const editingId = ref<string | null>(null);
const charButtons = ref<CharButtonItem[]>([]);
const addedSkills = ref<string[]>([]);
const skillRefreshTick = ref(0);

let fakemeImage64: string | undefined;
let fakemeImage: ArrayBuffer | undefined;

const dieAudioInput = ref<HTMLInputElement | null>(null);
const dieAudioPreview = ref(false);
let dieAudioFile: File | undefined;
let dieAudioArrayBuffer: ArrayBuffer | undefined;
let dieAudioBlob: Blob | undefined;
let dieAudioUrl: string | undefined;

const avatarInput = ref<HTMLInputElement | null>(null);
const skillSourceSelect = ref("current_extension");
const skillSelect = ref("");
const skillSourceList = ref<OptionPair[]>([]);
const skillTargetList = ref<OptionPair[]>([]);

const packData = reactive({
	character: {} as Record<string, any>,
	translate: {} as Record<string, string>,
});
const imageData: Record<string, any> = {};
const audioData: Record<string, ArrayBuffer> = {};
const imagePromises: Promise<any>[] = [];

const groupList = computed(() => lib.group.map((g: string) => [g, get.translation(g)]));
const editButtonText = computed(() => (editingId.value ? "编辑武将" : "创建武将"));
const deleteButtonText = computed(() => (editingId.value ? "删除" : "取消"));
const formHeaderText = computed(() => (editingId.value ? "编辑武将" : "创建武将"));

function buildSkillSourceList() {
	skillSourceList.value = [
		["current_extension", "此扩展"],
		...getCharactersWithSkillsOptions({ ensureFallbackSunce: true }),
	];
}

function onSkillSourceChange() {
	const val = skillSourceSelect.value;
	const newTargets: OptionPair[] = [];
	if (val === "current_extension") {
		for (const i in packData.character) {
			newTargets.push([i, packData.translate[i]]);
		}
	} else {
		let skills = (lib.character[val]?.[3] || []).slice();
		for (const skill of skills) {
			const derivation = lib.skill[skill]?.derivation;
			if (derivation) {
				skills = Array.isArray(derivation) ? [...skills, ...derivation] : [...skills, derivation];
			}
		}
		for (const s of skills) {
			if (lib.skill[s] && !lib.skill[s].sub && lib.translate[s]) {
				newTargets.push([s, lib.translate[s]]);
			}
		}
	}
	skillTargetList.value = newTargets;
	if (newTargets.length) skillSelect.value = newTargets[0][0];
}

function skillDisplayLabel(skillId: string): string {
	void skillRefreshTick.value;
	return packData.translate[skillId] || lib.translate[skillId] || skillId;
}

async function onAvatarChange() {
	const file = avatarInput.value?.files?.[0];
	if (!file) return;
	const { dataUrl, buffer } = await readImageAsDataUrlAndBuffer(file);
	fakemeImage64 = dataUrl;
	fakemeStyle.backgroundImage = `url(${dataUrl})`;
	fakemeInited.value = true;
	fakemeImage = buffer;
	updateButton();
}

async function onDieAudioChange() {
	const file = dieAudioInput.value?.files?.[0];
	if (!file) return;
	dieAudioFile = file;
	dieAudioArrayBuffer = await readFileAsArrayBuffer(file);
	dieAudioBlob = new Blob([dieAudioArrayBuffer]);
	if (dieAudioUrl) URL.revokeObjectURL(dieAudioUrl);
	dieAudioUrl = URL.createObjectURL(dieAudioBlob);
	dieAudioPreview.value = true;
}

function playDieAudio() {
	if (!dieAudioBlob || !dieAudioUrl) return;
	const audio = new Audio(dieAudioUrl);
	audio.play().catch(() => alert("您使用的客户端不支持预览此音频！"));
}

function cancelDieAudio() {
	dieAudioPreview.value = false;
	if (dieAudioUrl) {
		URL.revokeObjectURL(dieAudioUrl);
		dieAudioUrl = undefined;
	}
	dieAudioFile = undefined;
	dieAudioArrayBuffer = undefined;
	dieAudioBlob = undefined;
	if (dieAudioInput.value) dieAudioInput.value.value = "";
}

function updateButton() {
	const parsed = parseEntityName(charName.value);
	if (!parsed) {
		editDisabled.value = true;
		return;
	}
	if (hasEntityIdConflict(parsed.id, editingId.value, lib.character, packData.character)) {
		editDisabled.value = true;
		return;
	}
	editDisabled.value = !fakemeImage && !imageData[`${parsed.id}.jpg`];
}

async function onCharacterButtonClick(item: CharButtonItem, event: MouseEvent) {
	if (editingId.value === item.id) {
		resetEditor();
		return;
	}
	resetEditor();
	editingId.value = item.id;
	showForm.value = true;
	const targetEl = event.currentTarget as HTMLElement | null;
	fakemeInited.value = true;
	fakemeStyle.backgroundImage = item.customBg ? `url(${item.customBg})` : targetEl?.style.backgroundImage || "";

	const snapshot = extractCharacterSnapshot(item.id, packData.character[item.id], packData.translate[item.id]);
	charName.value = snapshot.charName;
	charDes.value = snapshot.charDes;
	charHp.value = snapshot.charHp;
	charSex.value = snapshot.charSex;
	charGroup.value = snapshot.charGroup;
	isZhu.value = snapshot.isZhu;
	isBoss.value = snapshot.isBoss;
	isForbidAi.value = snapshot.isForbidAi;
	isHiddenSkill.value = snapshot.isHiddenSkill;
	addedSkills.value = snapshot.skills;

	for (const dieAudio of snapshot.dieAudios) {
		const loaded = await resolveDieAudioBuffer(dieAudio, audioData);
		if (loaded) {
			dieAudioFile = { name: loaded.fileName } as unknown as File;
			dieAudioArrayBuffer = loaded.buffer;
			dieAudioBlob = new Blob([loaded.buffer]);
			if (dieAudioUrl) URL.revokeObjectURL(dieAudioUrl);
			dieAudioUrl = URL.createObjectURL(dieAudioBlob);
			dieAudioPreview.value = true;
		}
	}
	editDisabled.value = false;
}

function onAddSkill() {
	if (addedSkills.value.includes(skillSelect.value)) {
		alert(skillSourceSelect.value === "current_extension" ? "此扩展还未添加技能" : "此武将没有技能可添加");
		return;
	}
	if (!skillSelect.value) return;
	addedSkills.value.push(skillSelect.value);
}

function onCreateCharacter() {
	const parsed = parseEntityName(charName.value);
	if (!parsed) {
		alert("请填写武将名\n提示：武将名格式为id+|+中文名，其中id必须惟一");
		return;
	}
	const { id, translate } = parsed;
	const oldId = editingId.value;
	if (hasEntityIdConflict(id, oldId, lib.character, packData.character)) {
		alert("武将名与现有武将重复，请更改");
		return;
	}
	if (oldId !== null && oldId !== id) {
		if (imageData[`${oldId}.jpg`]) {
			imageData[`${id}.jpg`] = imageData[`${oldId}.jpg`];
			delete imageData[`${oldId}.jpg`];
		}
		delete packData.character[oldId];
		delete packData.translate[oldId];
	}
	if (fakemeImage) {
		imageData[`${id}.jpg`] = fakemeImage;
	} else if (!imageData[`${id}.jpg`]) {
		alert("请选择武将头像");
		return;
	}

	let dieAudioTag: string | undefined;
	if (dieAudioFile && dieAudioArrayBuffer) {
		const audioname = id + dieAudioFile.name.slice(dieAudioFile.name.indexOf("."));
		dieAudioTag = `${typeof game.readFile === "function" ? "ext" : "db"}:audio/die/${audioname}`;
		audioData[audioname] = dieAudioArrayBuffer;
	}

	packData.translate[id] = translate;
	writeCharacterRecord(packData.character, {
		id,
		sex: charSex.value,
		group: charGroup.value,
		hp: parseHpInput(charHp.value),
		des: charDes.value,
		isZhu: isZhu.value,
		isBoss: isBoss.value,
		isForbidAi: isForbidAi.value,
		isHiddenSkill: isHiddenSkill.value,
		skills: addedSkills.value,
		dieAudioTag,
	});

	if (oldId !== null) {
		const btn = charButtons.value.find(b => b.id === oldId);
		if (btn) {
			btn.id = id;
			if (fakemeImage64) btn.customBg = fakemeImage64;
		}
	} else {
		charButtons.value.unshift({ id, customBg: fakemeImage64 });
	}
	resetEditor();
}

function onDeleteCharacter() {
	if (editingId.value) {
		const id = editingId.value;
		const idx = charButtons.value.findIndex(b => b.id === id);
		if (idx >= 0) charButtons.value.splice(idx, 1);
		delete packData.character[id];
		delete packData.translate[id];
		delete imageData[`${id}.jpg`];
		for (const key in audioData) {
			if (key.startsWith(`${id}.`)) delete audioData[key];
		}
	}
	resetEditor();
}

function resetEditor() {
	editingId.value = null;
	charName.value = "";
	charDes.value = "";
	charHp.value = "";
	charSex.value = "male";
	charGroup.value = "wei";
	isZhu.value = false;
	isBoss.value = false;
	isForbidAi.value = false;
	isHiddenSkill.value = false;
	fakemeInited.value = false;
	fakemeImage64 = undefined;
	fakemeImage = undefined;
	fakemeStyle.backgroundImage = "";
	showForm.value = false;
	editDisabled.value = true;
	cancelDieAudio();
	addedSkills.value = [];
}

function reset(name?: string) {
	resetEditor();
	imagePromises.length = 0;
	charButtons.value = [];
	for (const key in imageData) delete imageData[key];
	for (const key in audioData) delete audioData[key];

	if (name && lib.extensionPack[name]) {
		const pack = lib.extensionPack[name].character || { character: {}, translate: {} };
		packData.character = get.copy(pack.character);
		packData.translate = get.copy(pack.translate);
		for (const id in packData.character) {
			charButtons.value.unshift({ id });
			const file = `${id}.jpg`;
			const url = `${lib.assetURL}extension/${name}/${file}`;
			imagePromises.push(
				game.promises
					.readFile(url)
					.then((result: any) => {
						imageData[file] = result;
					})
					.catch((e: any) => console.error(e))
			);
		}
	} else {
		packData.character = {};
		packData.translate = {};
		showForm.value = true;
	}
}

function updateSkill() {
	skillRefreshTick.value++;
}

onMounted(() => {
	buildSkillSourceList();
});

onUnmounted(() => {
	if (dieAudioUrl) URL.revokeObjectURL(dieAudioUrl);
});

defineExpose({
	packData,
	imageData,
	audioData,
	imagePromises,
	reset,
	updateSkill,
	skillSourceSelect,
	skillTargetList,
	skillSelect,
});
</script>
