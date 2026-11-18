import { get } from "noname";

export function createRespondMap() {
	return {
		sha: ["shan"],
		wanjian: ["shan"],
		qizhengxiangsheng: ["sha", "shan"],
		juedou: ["sha"],
		nanman: ["sha"],
		jiedao: ["sha"],
		//所有锦囊都可以用无懈可击响应
		trick: ["wuxie"],
		//所有伤害牌都可以用草船借箭响应
		damage: ["caochuan"],
		//所有基本牌或普通锦囊牌都可以响应
		all: [],
		//也可以放函数
		khquanjiu: ["jiu", (card, player) => get.number(card, player) == 9],
	};
}
