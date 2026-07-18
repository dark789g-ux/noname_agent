<template>
	<div ref="containerRef" class="menu-buttons character-editor">
		<!-- 返回按钮（旧 865） -->
		<div class="config more margin-bottom" @click="$emit('back')">
			<div style="transform:none;margin-right:3px">&larr;</div>返回
		</div>

		<!-- 已有武将按钮区域（命令式渲染） -->
		<div ref="buttonsRef"></div>

		<!-- 创建/编辑武将表单（旧 879-1299） -->
		<div v-show="showForm" class="new_character">
			<!-- 头像选择（旧 912-939） -->
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

			<!-- 姓名（旧 941） -->
			<div class="indent" style="padding-top:8px">
				姓名：<input v-model="charName" type="text" @blur="updateButton" />
			</div>
			<!-- 介绍（旧 942） -->
			<div class="indent" style="padding-top:8px">
				介绍：<input v-model="charDes" type="text" />
			</div>
			<!-- 体力（旧 943） -->
			<div class="indent" style="padding-top:8px">
				体力：<input v-model="charHp" type="text" placeholder="体/限/甲" />
			</div>
			<!-- 性别（旧 945-954） -->
			<div class="indent" style="padding-top:8px">
				性别：<select v-model="charSex">
					<option value="male">男</option>
					<option value="female">女</option>
					<option value="double">双性</option>
					<option value="none">无</option>
				</select>
			</div>
			<!-- 势力（旧 955-956） -->
			<div class="indent" style="padding-top:8px">
				势力：<select v-model="charGroup">
					<option v-for="g in groupList" :key="g[0]" :value="g[0]">{{ g[1] }}</option>
				</select>
			</div>
			<!-- 阵亡配音（旧 957-1006） -->
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
			<!-- 选项（旧 1007） -->
			<div class="add_skill options" style="padding-top:8px">
				<span>主公<input v-model="isZhu" type="checkbox" name="zhu" /></span>
				<span>BOSS<input v-model="isBoss" type="checkbox" name="boss" /></span>
				<span>仅点将可用<input v-model="isForbidAi" type="checkbox" name="forbidai" /></span>
				<br />
				<span>隐匿技<input v-model="isHiddenSkill" type="checkbox" name="hiddenSkill" /></span>
				<br />
			</div>
			<!-- 添加技能（旧 1008-1133） -->
			<div class="add_skill" style="padding-top:8px">
				添加技能<br />
				<select v-model="skillSourceSelect" style="max-width:85px" @change="onSkillSourceChange">
					<option value="current_extension">此扩展</option>
					<option v-for="item in skillSourceList" :key="item[0]" :value="item[0]">{{ item[1] }}</option>
				</select>
				<select v-model="skillSelect" style="max-width:60px">
					<option v-for="item in skillTargetList" :key="item[0]" :value="item[0]">{{ item[1] }}</option>
				</select>
				<button @click="onAddSkill">添加</button>
				<button @click="onCreateSkill">创建</button>
			</div>
			<!-- 已添加技能列表（旧 1148-1149） -->
			<div class="skill_list">
				<div></div>
				<div ref="skillListRef"></div>
			</div>
			<!-- 创建/编辑/取消按钮（旧 1150-1296） -->
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
import { ref, reactive, computed, onMounted, nextTick } from "vue";
import { lib, game, get, ui } from "noname";
import { Character } from "@/library/element/index";

interface Props {
	extName: string;
	isNew: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits(["back", "create-skill"]);

// ---------------------------------------------------------------------------
// 响应式表单状态
// ---------------------------------------------------------------------------
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

// 头像数据
let fakemeImage64: string | undefined;
let fakemeImage: ArrayBuffer | undefined;

// 阵亡配音
const dieAudioInput = ref<HTMLInputElement | null>(null);
const dieAudioPreview = ref(false);
let dieAudioFile: File | undefined;
let dieAudioArrayBuffer: ArrayBuffer | undefined;
let dieAudioBlob: Blob | undefined;
let dieAudioUrl: string | undefined;

// 技能相关
const skillSourceSelect = ref("current_extension");
const skillSelect = ref("");
const skillSourceList: string[][] = [];
const skillTargetList = ref<string[][]>([]);

// 容器 ref
const containerRef = ref<HTMLElement | null>(null);
const buttonsRef = ref<HTMLElement | null>(null);
const avatarInput = ref<HTMLInputElement | null>(null);
const skillListRef = ref<HTMLElement | null>(null);

// ---------------------------------------------------------------------------
// 内容数据（供 ExtensionMaker.processExtension 使用）
// ---------------------------------------------------------------------------
const packData = reactive({
	character: {} as Record<string, any>,
	translate: {} as Record<string, string>,
});
const imageData: Record<string, string> = {};
const audioData: Record<string, ArrayBuffer> = {};
const imagePromises: Promise<any>[] = [];

// ---------------------------------------------------------------------------
// 计算属性
// ---------------------------------------------------------------------------
const groupList = computed(() => lib.group.map((g: string, i: number) => [lib.group[i], get.translation(lib.group[i])]));

const editButtonText = ref("创建武将");
const deleteButtonText = ref("取消");

// ---------------------------------------------------------------------------
// 构建技能源列表（旧 1010-1059）
// ---------------------------------------------------------------------------
function buildSkillSourceList() {
	const list: string[][] = [];
	for (const i in lib.character) {
		if (lib.character[i][3].length) {
			list.push([i, lib.translate[i]]);
		}
	}
	if (!list.length) {
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
		list.push(["noname_sunce", lib.translate["noname_sunce"]]);
	}
	list.sort((a, b) => {
		let aa = a[0], bb = b[0];
		if (aa.includes("_")) aa = aa.slice(aa.lastIndexOf("_") + 1);
		if (bb.includes("_")) bb = bb.slice(bb.lastIndexOf("_") + 1);
		if (aa !== bb) return aa > bb ? 1 : -1;
		return a[0] > b[0] ? 1 : -1;
	});
	skillSourceList.length = 0;
	skillSourceList.push(["current_extension", "此扩展"], ...list);
}

function onSkillSourceChange() {
	const val = skillSourceSelect.value;
	const newTargets: string[][] = [];
	if (val === "current_extension") {
		for (const i in packData.character) {
			newTargets.push([i, packData.translate[i]]);
		}
	} else {
		let skills = lib.character[val][3].slice();
		for (const skill of skills) {
			if (lib.skill[skill]?.derivation) {
				const d = lib.skill[skill].derivation;
				skills = Array.isArray(d) ? [...skills, ...d] : [...skills, d];
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

// ---------------------------------------------------------------------------
// 头像上传（旧 918-936）
// ---------------------------------------------------------------------------
function onAvatarChange() {
	if (!avatarInput.value?.files?.length) return;
	const file = avatarInput.value.files[0];
	const reader = new FileReader();
	reader.onload = (e: any) => {
		fakemeImage64 = e.target.result;
		fakemeStyle.backgroundImage = `url(${fakemeImage64})`;
		fakemeInited.value = true;
		const reader2 = new FileReader();
		reader2.onload = (e2: any) => {
			fakemeImage = e2.target.result;
			updateButton();
		};
		reader2.readAsArrayBuffer(file, "UTF-8");
	};
	reader.readAsDataURL(file, "UTF-8");
}

// ---------------------------------------------------------------------------
// 阵亡配音（旧 963-1006）
// ---------------------------------------------------------------------------
function onDieAudioChange() {
	if (!dieAudioInput.value?.files?.length) return;
	dieAudioFile = dieAudioInput.value.files[0];
	const reader = new FileReader();
		reader.onload = (e: any) => {
			dieAudioArrayBuffer = e.target.result;
			dieAudioBlob = new Blob([dieAudioArrayBuffer!]);
			dieAudioUrl = URL.createObjectURL(dieAudioBlob);
			dieAudioPreview.value = true;
		};
	reader.readAsArrayBuffer(dieAudioFile!);
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

// ---------------------------------------------------------------------------
// updateButton（旧 642-669）
// ---------------------------------------------------------------------------
function updateButton() {
	const name = charName.value;
	if (!name) {
		editDisabled.value = true;
		return;
	}
	const id = name.split("|")[0];
	if (currentButton) {
		// 编辑态：仅当改成已存在的其它 id 时才禁用（旧 650-656）
		if ((currentButton as any).link !== id && (lib.character[id] || packData.character[id])) {
			editDisabled.value = true;
			return;
		}
	} else if (lib.character[id] || packData.character[id]) {
		editDisabled.value = true;
		return;
	}
	if (!fakemeImage && !imageData[id + ".jpg"]) {
		editDisabled.value = true;
		return;
	}
	editDisabled.value = false;
}

// ---------------------------------------------------------------------------
// 编辑已有武将（旧 671-817 clickButton）：
// 点击已有武将按钮切换编辑模式，加载武将数据到表单；再次点击同一按钮退出编辑
// ---------------------------------------------------------------------------
let currentButton: HTMLElement | null = null;

// 加载阵亡配音（旧 707-750/763-789）：优先取内存 audioData，否则按 ext:/db: 前缀读盘
async function loadDieAudio(dieAudio: string) {
	const fileName = dieAudio.slice(dieAudio.lastIndexOf("/") + 1);
	dieAudioFile = { name: fileName } as unknown as File;
	if (audioData[fileName]) {
		dieAudioArrayBuffer = audioData[fileName];
	} else if (dieAudio.startsWith("ext:") && typeof game.readFile === "function") {
		try {
			dieAudioArrayBuffer = await game.promises.readFile(dieAudio.replace("ext:", "extension/"));
		} catch {
			console.warn(`未找到${dieAudio.replace("ext:", "extension/")}阵亡配音`);
		}
	} else if (dieAudio.startsWith("db:")) {
		try {
			dieAudioArrayBuffer = await game.getDB("image", dieAudio.slice(3));
		} catch {
			console.warn(`未找到${dieAudio}阵亡配音`);
		}
	}
	if (dieAudioArrayBuffer) {
		dieAudioBlob = new Blob([dieAudioArrayBuffer]);
		dieAudioUrl = URL.createObjectURL(dieAudioBlob);
		dieAudioPreview.value = true;
	}
}

async function onCharacterButtonClick(button: HTMLElement) {
	if (currentButton === button) {
		resetEditor();
		return;
	}
	resetEditor();
	currentButton = button;
	showForm.value = true;
	const id = (button as any).link as string;
	const translate = packData.translate[id];
	charName.value = translate && translate !== id ? `${id}|${translate}` : id;
	fakemeInited.value = true;
	fakemeStyle.backgroundImage = button.style.backgroundImage;
	const info = packData.character[id];
	let skills: string[] = [];
	if (Array.isArray(info)) {
		// 旧数组格式 [sex, group, hp, skills, tags]
		charSex.value = info[0];
		charGroup.value = info[1];
		charHp.value = String(info[2]);
		skills = info[3] || [];
		const tags: string[] = Array.isArray(info[4]) ? info[4] : [];
		isZhu.value = tags.includes("zhu");
		isBoss.value = tags.includes("boss");
		isForbidAi.value = tags.includes("forbidai");
		isHiddenSkill.value = tags.includes("hiddenSkill");
		for (const tag of tags) {
			if (tag.startsWith("des:")) charDes.value = tag.slice(4);
			if (tag.startsWith("die:")) await loadDieAudio(tag.slice(4));
		}
	} else {
		charSex.value = info.sex || "male";
		charGroup.value = info.group || "wei";
		charHp.value = info.hujia ? `${info.hp}/${info.maxHp}/${info.hujia}` : info.maxHp != null && info.maxHp !== info.hp ? `${info.hp}/${info.maxHp}` : String(info.hp ?? "");
		skills = info.skills || [];
		isZhu.value = !!info.isZhugong;
		isBoss.value = !!info.isBoss;
		isForbidAi.value = !!info.isAiForbidden;
		isHiddenSkill.value = !!info.hasHiddenSkill;
		const des = (info.trashBin || []).find((tag: string) => tag.startsWith("des:"));
		if (des) charDes.value = des.slice(4);
		for (const dieAudio of info.dieAudios || []) {
			await loadDieAudio(dieAudio);
		}
	}
	for (const skill of skills) {
		addedSkills.push(skill);
		if (skillListRef.value) {
			const btn = document.createElement("button");
			(btn as any).skill = skill;
			btn.innerHTML = packData.translate[skill] || lib.translate[skill] || skill;
			btn.onclick = () => {
				addedSkills.remove(skill);
				btn.remove();
			};
			skillListRef.value.appendChild(btn);
		}
	}
	editButtonText.value = "编辑武将";
	deleteButtonText.value = "删除";
	editDisabled.value = false;
}

// ---------------------------------------------------------------------------
// 技能添加/删除（旧 1101-1121）
// ---------------------------------------------------------------------------
const addedSkills: string[] = [];

function onAddSkill() {
	if (addedSkills.includes(skillSelect.value)) {
		return alert(skillSourceSelect.value === "current_extension" ? "此扩展还未添加技能" : "此武将没有技能可添加");
	}
	if (!skillSelect.value) return;
	addedSkills.push(skillSelect.value);
	const item = skillTargetList.value.find(t => t[0] === skillSelect.value);
	if (item && skillListRef.value) {
		const btn = document.createElement("button");
		btn.innerHTML = item[1];
		btn.onclick = () => {
			addedSkills.remove(skillSelect.value);
			btn.remove();
		};
		skillListRef.value.appendChild(btn);
	}
}

function onCreateSkill() {
	// 跳转到技能编辑器（ExtensionMaker 经 @create-skill 切换 dashboard）
	emit("create-skill");
}

// ---------------------------------------------------------------------------
// 创建/编辑武将（旧 1150-1283）
// ---------------------------------------------------------------------------
function onCreateCharacter() {
	let name = charName.value;
	if (!name) {
		alert("请填写武将名\n提示：武将名格式为id+|+中文名，其中id必须惟一");
		return;
	}
	name = name.split("|");
	const translate = name[1] || name[0];
	const id = name[0];
	if (currentButton) {
		// 编辑态：id 未变走更新路径；改名则校验新 id 并迁移数据（旧 1163-1175）
		const oldId = (currentButton as any).link as string;
		if (oldId !== id) {
			if (lib.character[id] || packData.character[id]) {
				alert("武将名与现有武将重复，请更改");
				return;
			}
			if (imageData[oldId + ".jpg"]) {
				imageData[id + ".jpg"] = imageData[oldId + ".jpg"];
				delete imageData[oldId + ".jpg"];
			}
			delete packData.character[oldId];
			delete packData.translate[oldId];
			(currentButton as any).link = id;
		}
	} else if (lib.character[id] || packData.character[id]) {
		alert("武将名与现有武将重复，请更改");
		return;
	}
	if (fakemeImage) {
		imageData[id + ".jpg"] = fakemeImage as unknown as string;
	} else if (!imageData[id + ".jpg"]) {
		alert("请选择武将头像");
		return;
	}
	let hp = charHp.value;
	if (["Infinity", "\u221e", "无限"].includes(hp)) {
		hp = Infinity;
	} else if (hp.indexOf("/") === -1) {
		hp = parseInt(hp) || 1;
	}
	const tags: string[] = [];
	if (isZhu.value) tags.push("zhu");
	if (isBoss.value) tags.push("boss", "bossallowed");
	if (isForbidAi.value) tags.push("forbidai");
	if (isHiddenSkill.value) tags.push("hiddenSkill");
	if (charDes.value) tags.push(`des:${charDes.value}`);
	if (dieAudioFile && dieAudioArrayBuffer) {
		const audioname = id + dieAudioFile.name.slice(dieAudioFile.name.indexOf("."));
		const dieAudio = `${typeof game.readFile === "function" ? "ext" : "db"}:audio/die/${audioname}`;
		tags.push(`die:${dieAudio}`);
		audioData[audioname] = dieAudioArrayBuffer;
	}
	const newChar: any = {
		sex: charSex.value,
		group: charGroup.value,
		hp: get.infoHp(hp),
		maxHp: get.infoMaxHp(hp),
		hujia: get.infoHujia(hp),
		skills: [...addedSkills],
	};
	if (isZhu.value) newChar.isZhugong = true;
	if (isBoss.value) { newChar.isBoss = true; newChar.isBossAllowed = true; }
	if (isForbidAi.value) newChar.isAiForbidden = true;
	if (isHiddenSkill.value) newChar.hasHiddenSkill = true;
	if (dieAudioFile && dieAudioArrayBuffer) {
		const audioname = id + dieAudioFile.name.slice(dieAudioFile.name.indexOf("."));
		const dieAudio = `${typeof game.readFile === "function" ? "ext" : "db"}:audio/die/${audioname}`;
		newChar.dieAudios = [dieAudio];
	}
	packData.translate[id] = translate;
	// 写回（旧 1243-1256）：新项直接赋值；旧数组格式写回数组；旧对象格式就地清理已取消的标记后合并
	const oldCharacter = packData.character[id];
	if (!oldCharacter) {
		packData.character[id] = newChar;
	} else if (Array.isArray(oldCharacter)) {
		packData.character[id] = [charSex.value, charGroup.value, hp, [...addedSkills], tags];
	} else {
		if (!isZhu.value) delete oldCharacter.isZhugong;
		if (!isBoss.value) {
			delete oldCharacter.isBoss;
			delete oldCharacter.isBossAllowed;
		}
		if (!isForbidAi.value) delete oldCharacter.isAiForbidden;
		if (!isHiddenSkill.value) delete oldCharacter.hasHiddenSkill;
		if (charDes.value) {
			oldCharacter.trashBin = (Array.isArray(oldCharacter.trashBin) ? oldCharacter.trashBin : []).filter((tag: string) => !tag.startsWith("des:"));
			oldCharacter.trashBin.push(`des:${charDes.value}`);
		} else if (Array.isArray(oldCharacter.trashBin)) {
			oldCharacter.trashBin = oldCharacter.trashBin.filter((tag: string) => !tag.startsWith("des:"));
			if (!oldCharacter.trashBin.length) delete oldCharacter.trashBin;
		}
		if (!(dieAudioFile && dieAudioArrayBuffer)) delete oldCharacter.dieAudios;
		Object.assign(oldCharacter, newChar);
	}
	if (currentButton) {
		// 编辑态：更新已有按钮的显示（旧 1260-1266）
		if (fakemeImage64) {
			currentButton.style.backgroundImage = `url(${fakemeImage64})`;
		}
		(currentButton as any).nodename.innerHTML = get.verticalStr(translate);
	} else {
		createButton(id, fakemeImage64 as unknown as string);
	}
	resetEditor();
}

// ---------------------------------------------------------------------------
// 删除武将（旧 1284-1296）
// ---------------------------------------------------------------------------
function onDeleteCharacter() {
	if (deleteButtonText.value === "删除" && currentButton) {
		const id = (currentButton as any).link as string;
		currentButton.remove();
		delete packData.character[id];
		delete packData.translate[id];
		delete imageData[id + ".jpg"];
		for (const key in audioData) {
			if (key.startsWith(id + ".")) delete audioData[key];
		}
	}
	resetEditor();
}

function resetEditor() {
	currentButton = null;
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
	editButtonText.value = "创建武将";
	deleteButtonText.value = "取消";
	editDisabled.value = true;
	cancelDieAudio();
	if (skillListRef.value) skillListRef.value.innerHTML = "";
	addedSkills.length = 0;
}

// 创建武将按钮（旧 806-816）
function createButton(name: string, _image: string) {
	if (!buttonsRef.value) return;
	const button = ui.create.div(".button.character");
	(button as any).link = name;
	(button as any).setBackground = (n: string, t: string) => {
		button.style.backgroundImage = `url(${lib.assetURL}image/character/${n}.jpg)`;
	};
	(button as any).setBackground(name, "character");
	button.style.backgroundSize = "cover";
	button.noclick = true;
	button.classList.add("noclick");
	button.onclick = () => void onCharacterButtonClick(button as unknown as HTMLElement);
	(button as any).nodename = ui.create.div(button, ".name", get.verticalStr(packData.translate[name]));
	(button as any).nodename.style.top = "8px";
	buttonsRef.value.insertBefore(button, buttonsRef.value.childNodes[0] || null);
}

// reset（旧 818-864）
function reset(name?: string) {
	resetEditor();
	imagePromises.length = 0;
	// 切换/新建扩展时重置资源池（旧 838/855-860）：先清空，下方再从扩展目录读图填入
	for (const key in imageData) delete imageData[key];
	for (const key in audioData) delete audioData[key];
	if (buttonsRef.value) buttonsRef.value.innerHTML = "";
	if (name && lib.extensionPack[name]) {
		const pack = lib.extensionPack[name].character || { character: {}, translate: {} };
		packData.character = get.copy(pack.character);
		packData.translate = get.copy(pack.translate);
		for (const id in packData.character) {
			const file = id + ".jpg";
			const url = lib.assetURL + "extension/" + name + "/" + file;
			createButton(id, url);
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

// ---------------------------------------------------------------------------
// updateSkill（旧 1134-1147）
// ---------------------------------------------------------------------------
function updateSkill() {
	if (!skillListRef.value) return;
	for (let i = 0; i < skillListRef.value.childNodes.length; i++) {
		const node = skillListRef.value.childNodes[i] as HTMLElement;
		const skill = (node as any).skill;
		if (packData.translate[skill]) {
			node.innerHTML = packData.translate[skill];
		} else if (lib.skill[skill] && lib.translate[skill]) {
			node.innerHTML = lib.translate[skill];
		}
	}
}

// ---------------------------------------------------------------------------
// 暴露数据/方法供 ExtensionMaker 使用
// ---------------------------------------------------------------------------
defineExpose({ packData, imageData, audioData, imagePromises, reset, updateSkill, skillSourceSelect, skillTargetList, skillSelect });
</script>
