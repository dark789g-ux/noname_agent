export type RuntimeRowItemOption = Omit<Row_Item_Option, "itemContainerCss"> & {
	itemContainerCss?: Partial<CSSStyleDeclaration>;
	suit?: string;
	color?: string;
};
export type CardInfoTuple = import("@/library/element/card.js").CardInfoTuple;
export type YingbianCard = import("@/get/is.js").YingbianCard;
export type GameEventParentFallback = import("@/library/element/gameEvent.js").GameEventParentFallback;
export type OwnerQueryCard = (Card | VCard | CardBaseUIData) & {
	timeout?: number | boolean;
	destiny?: HTMLDivElement;
	parentNode?: Node | null;
	classList?: {
		contains?: (name: string) => boolean;
	};
	classListContains?: (...names: string[]) => boolean;
};
