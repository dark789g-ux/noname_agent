export type logAudio = (...args: any[]) => AudioInfo;

export type AudioInfo = AudioInfo[] | string | number | boolean;

export type SkillInfo = {
	audio?: AudioInfo;
	audioname?: string[];
	audioname2?: { [playerName: string]: AudioInfo };
	logAudio?: logAudio;
	logAudio2?: { [playerName: string]: logAudio };
};

export type FormatedPlayer = {
	name: string | undefined;
	sex: Sex;
	name1?: string;
	name2?: string;
	tempname: string[];
	skin: { name?: string };
};

export type AudioPlayerData = {
	name: string;
	name1?: string;
	name2?: string;
	tempname?: string[];
	skin?: { name?: string; name2?: string };
};

export type TextMap = {
	name: string;
	file: string;
	text: string | undefined;
	type: string;
};
