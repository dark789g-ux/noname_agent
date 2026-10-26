/** 连环传导效果计算在递归调用间保留的上下文。 */
declare interface EffectLinkContext {
	source?: Player;
	eff?: number;
	num?: number;
	odds?: number;
}
