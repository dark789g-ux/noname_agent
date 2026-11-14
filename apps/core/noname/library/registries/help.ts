import { lib } from "noname";

export function createHelp() {
	return {
		关于游戏: '<div style="margin:10px">关于无名杀</div><ul style="margin-top:0"><li>无名杀官方发布地址仅有GitHub仓库！<br><a href="https://github.com/libnoname/noname">点击前往Github仓库</a><br><li>无名杀基于GPLv3开源协议。<br><a href="https://www.gnu.org/licenses/gpl-3.0.html">点击查看GPLv3协议</a><br><li>其他所有的所谓“无名杀”社群（包括但不限于绝大多数“官方”QQ群、QQ频道等）均为玩家自发组织，与无名杀官方无关！',
		游戏操作: "<ul><li>长按/鼠标悬停/右键单击显示信息。<li>触屏模式中，双指点击切换暂停；下划显示菜单，上划切换托管。<li>键盘快捷键<br>" + "<table><tr><td>A<td>切换托管<tr><td>W<td>切换不询问无懈<tr><td>空格<td>暂停</table><li>编辑牌堆<br>在卡牌包中修改牌堆后，将自动创建一个临时牌堆，在所有模式中共用，当保存当前牌堆后，临时牌堆被清除。每个模式可设置不同的已保存牌堆，设置的牌堆优先级大于临时牌堆。</ul>",
		游戏命令: '<div style="margin:10px">变量名</div><ul style="margin-top:0"><li>场上角色<br>game.players<li>阵亡角色<br>game.dead' + "<li>玩家<br>game.me<li>玩家的上/下家<br>game.me.previous/next" + "<li>玩家的上/下家（含阵亡）<br>game.me.previousSeat/<br>nextSeat" + "<li>牌堆<br>ui.cardPile<li>弃牌堆<br>ui.discardPile</ul>" + '<div style="margin:10px">角色属性</div><ul style="margin-top:0"><li>体力值<br>player.hp' + '<li>体力上限<br>player.maxHp<li>身份<br>player.identity<li>手牌<br>player.getCards("h")<li>装备牌<br>player.getCards("e")<li>判定牌<br>player.getCards("j")' + "<li>是否存活/横置/翻面<br>player.isAlive()/<br>isLinked()/<br>isTurnedOver()</ul>" + '<div style="margin:10px">角色操作</div><ul style="margin-top:0"><li>受到伤害<br>player.damage(source,<br>num)' + "<li>回复体力<br>player.recover(num)<li>摸牌<br>player.draw(num)<li>获得牌<br>player.gain(cards)<li>弃牌<br>player.discard(cards)" + "<li>使用卡牌<br>player.useCard(card,<br>targets)<li>死亡<br>player.die()<li>复活<br>player.revive(hp)</ul>" + '<div style="margin:10px">游戏操作</div><ul style="margin-top:0"><li>在命令框中输出结果<br>game.print(str)<li>清除命令框中的内容<br>cls<li>上一条/下一条输入的内容<br>up/down<li>游戏结束<br>game.over(bool)' + "<li>角色资料<br>lib.character<li>卡牌资料<br>lib.card</ul>",
		get 游戏名词() {
			return (
				"<ul>" +
				lib.poptip
					.getIdList("rule")
					.map(id => `<strong>${lib.poptip.getName(id)}</strong>：<br>${lib.poptip.getInfo(id)}</li>`)
					.unique()
					.join("<br><br>") +
				"</ul>"
			);
		},
	};
}
