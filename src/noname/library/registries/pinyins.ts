export function createPinyins() {
	return {
		_metadata: {
			shengmu: ["zh", "ch", "sh", "b", "p", "m", "f", "d", "t", "l", "n", "g", "k", "h", "j", "q", "x", "r", "z", "c", "s", "y", "w"],
			special_shengmu: ["j", "q", "x", "y"],
			feijiemu: {
				i: ["ing", "iu", "ie", "in"],
				u: ["ui", "un"],
				ü: ["üe", "ün"],
			},
			zhengtirendu: ["zhi", "chi", "shi", "ri", "zi", "ci", "si"],
			yunjiao: {
				一麻: ["a", "ia", "ua"],
				二波: ["o", "e", "uo"],
				三皆: ["ie", "üe"],
				四开: ["ai", "uai"],
				五微: ["ei", "ui"],
				六豪: ["ao", "iao"],
				七尤: ["ou", "iu"],
				八寒: ["an", "ian", "uan", "üan"],
				九文: ["en", "in", "un", "ün"],
				十唐: ["ang", "iang", "uang"],
				十一庚: ["eng", "ing", "ong", "ung"],
				十二齐: ["i", "er", "ü"],
				十三支: ["-i"],
				十四姑: ["u"],
			},
		},
	};
}
