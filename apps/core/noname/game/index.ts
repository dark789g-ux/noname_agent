import "./contracts/gameContract.js";

import { lib } from "noname";
import { DynamicStyle } from "./dynamic-style/index.js";
import { GameBroadcast } from "./GameBroadcast.js";
import { GamePromises } from "./promises.js";
import { Check } from "./check.js";
import { installGameMethods } from "./installGameMethods.js";

import { GlobalEventHandlers, globalEventAndInitMethods } from "./lifecycle/globalEventHandlers.js";
import { loopAndTimingMethods } from "./lifecycle/loopAndTiming.js";
import { overMethods } from "./lifecycle/over.js";
import { modeAndStartMethods } from "./lifecycle/modeAndStart.js";
import { chooseCharacterDoubleMethods } from "./lifecycle/chooseCharacterDouble.js";
import { arenaFinishMethods } from "./lifecycle/arenaFinish.js";
import { rulesAndNatureMethods } from "./card/rulesAndNature.js";
import { pileAndZonesMethods } from "./card/pileAndZones.js";
import { cardMoveProducersMethods } from "./card/cardMoveProducers.js";
import { checkAndConfirmMethods } from "./player/checkAndConfirm.js";
import { seatAndSwapMethods } from "./player/seatAndSwap.js";
import { playerLifecycleMethods } from "./player/playerLifecycle.js";
import { playerAndSkillQueryMethods } from "./player/playerAndSkillQuery.js";
import { broadcastAndSyncMethods } from "./network/broadcastAndSync.js";
import { skillSyncMethods } from "./network/skillSync.js";
import { onlinePlayersMethods } from "./network/onlinePlayers.js";
import { createVideoContent } from "./video/videoContent.js";
import { videoControlMethods } from "./video/videoControl.js";
import { createElementGotoAnimData, elementSwapMethods } from "./animation/elementSwap.js";
import { elementGotoMethods } from "./animation/elementGoto.js";
import { createGameAnimate, dialogAndAnimateMethods } from "./animation/dialogAndAnimate.js";
import { createJianqiLineAnim, lineAndTrajectoryMethods } from "./animation/lineAndTrajectory.js";
import { zsLineAnimationMethods } from "./animation/zsLineAnimation.js";
import { soundEffectsMethods } from "./audio/soundEffects.js";
import { backgroundMusicMethods } from "./audio/backgroundMusic.js";
import { contentRegistrationMethods } from "./extension/contentRegistration.js";
import { modeAndExtensionManageMethods } from "./extension/modeAndExtensionManage.js";
import { extensionLoaderMethods } from "./extension/extensionLoader.js";
import { platformFileIOMethods } from "./storage/platformFileIO.js";
import { globalHistoryMethods } from "./storage/globalHistory.js";
import { battleLogMethods } from "./storage/battleLog.js";
import { databaseMethods } from "./storage/database.js";
import { configAndChangelogMethods } from "./storage/configAndChangelog.js";

export type * from "./contracts/gameContract.js";

export class Game extends GameBroadcast {
	documentZoom!: number;
	online = false;
	onlineID: string | null = null;
	onlineKey: string | null = null;
	players: Player[] = [];
	dead: Player[] = [];
	imported: any[] = [];
	playerMap: { [key: string]: Player } = {};
	/**
	 * 当主机返回结果时，客机应该根据此Map的数据寻找回调函数喵
	 */
	dataRequestMap: { [key: string]: Function } = {};
	phaseNumber = 0;
	roundNumber = 0;
	shuffleNumber = 0;
	promises = new GamePromises();
	layout!: string;
	me: Player | null | undefined;
	chess!: boolean;
	zhu!: Player;
	globalEventHandlers = new GlobalEventHandlers();
	$elementGotoAnimData = createElementGotoAnimData();
	dynamicStyle = new DynamicStyle();
	/**
	 * 失败结果常量表喵
	 */
	SKILL_SYNC_RESULTS = Object.freeze({
		INVALID_ARGUMENT: "参数不符合要求喵",
		MISSING_SKILL: "技能没有找到喵",
		SKILL_NOT_GRANTED: "请求的技能不被许可喵",
		MISSING_SKILL_SYNC: "请求的sync函数没有找到喵",
		TOO_MANY_REQUESTS: "请求过于频繁了喵",
		TOO_MANY_CALLS: "调用请求次数过于频繁喵",
		REQUEST_TIMEOUT: "请求超时喵",
	});
	/**
	 * 下载文件
	 */
	download: undefined | ((url: string, folder: string, onsuccess?: () => void, onerror?: (error?: Error | string | { code: number }) => void, dev?: "nodev" | null, onprogress?: (loaded: number, total?: number) => void) => void);
	/**
	 * 检查指定的路径是否是一个文件
	 */
	checkFile: undefined | ((fileName: string, callback?: (result: -1 | 0 | 1) => void, onerror?: (err: Error) => void) => void);
	/**
	 * 检查指定的路径是否是一个目录
	 */
	checkDir: undefined | ((dir: string, callback?: (result: -1 | 0 | 1) => void, onerror?: (err: Error) => void) => void);
	/**
	 * 读取文件为arraybuffer
	 */
	readFile: undefined | ((filename: string, callback?: (data: Buffer | ArrayBuffer) => void, onerror?: (error?: Error | string | { code: number }) => void) => void);
	/**
	 * 读取文件为文本
	 */
	readFileAsText: undefined | ((filename: string, callback?: (data: string) => any, onerror?: (e: Error) => void) => void);
	/**
	 * 将数据写入文件
	 */
	writeFile: undefined | ((data: File | ArrayBuffer, path: string, name: string, callback?: (e: Error) => void) => void);
	/**
	 * 移除文件
	 */
	removeFile: undefined | ((filename: string, callback?: (error?: Error | string | { code: number } | null) => void) => void);
	/**
	 * 获取文件列表
	 */
	getFileList: undefined | ((dir: string, success: (folders: string[], files: string[]) => any, failure?: (e: Error) => void) => void);
	/**
	 * 按路径依次创建文件夹
	 */
	ensureDirectory: undefined | ((list: string | string[], callback: Function, file?: boolean) => void);
	/**
	 * 创建文件夹
	 */
	createDir: undefined | ((directory: string, successCallback?: Function, errorCallback?: Function) => void);
	/**
	 * 删除文件夹
	 */
	removeDir: undefined | ((directory: string, successCallback?: Function, errorCallback?: Function) => void);
	checkForUpdate!: (forcecheck?: boolean | null, dev?: boolean) => Promise<any>;
	checkForAssetUpdate!: () => Promise<any>;
	exit!: () => void;
	open!: (url: string) => void;
	export!: (data: any, name?: string) => void;
	videoContent = createVideoContent();
	animate = createGameAnimate();
	jianqiLineAnim = createJianqiLineAnim();
	Check = new Check();
}

installGameMethods(Game.prototype, [
	globalEventAndInitMethods,
	loopAndTimingMethods,
	overMethods,
	modeAndStartMethods,
	chooseCharacterDoubleMethods,
	arenaFinishMethods,
	rulesAndNatureMethods,
	pileAndZonesMethods,
	cardMoveProducersMethods,
	checkAndConfirmMethods,
	seatAndSwapMethods,
	playerLifecycleMethods,
	playerAndSkillQueryMethods,
	broadcastAndSyncMethods,
	skillSyncMethods,
	onlinePlayersMethods,
	videoControlMethods,
	elementSwapMethods,
	elementGotoMethods,
	dialogAndAnimateMethods,
	lineAndTrajectoryMethods,
	zsLineAnimationMethods,
	soundEffectsMethods,
	backgroundMusicMethods,
	contentRegistrationMethods,
	modeAndExtensionManageMethods,
	extensionLoaderMethods,
	platformFileIOMethods,
	globalHistoryMethods,
	battleLogMethods,
	databaseMethods,
	configAndChangelogMethods,
]);

export let game = new Game();

export let setGame = (instance?: InstanceType<typeof Game>) => {
	game = instance || new Game();
	if (lib.config.dev) {
		window.game = game;
	}
};
