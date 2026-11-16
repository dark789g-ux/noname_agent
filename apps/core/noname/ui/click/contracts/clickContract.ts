import type { Card, Control, Dialog, Player } from "../../../library/element/index.js";
import type {
	AvatarTarget,
	ButtonNameTarget,
	ConfigSwitcher,
	ConnectClientsButton,
	ConnectEventsButton,
	ConnectRoomTarget,
	ControlButton,
	ControlContainer,
	DraggableDialog,
	DraggablePlayer,
	EditorTarget,
	HoverTarget,
	IdentityCircleNode,
	IdentityTarget,
	IntroTarget,
	LogvTarget,
	PoppedTarget,
	ScrollableDiv,
	SwitcherChoice,
	ToggleTarget,
} from "./domTargetsContract.js";

export type * from "./domTargetsContract.js";

declare module "../index.js" {
	interface Click {
		// 动态挂接的扩展 / 模式回调
		moveContainer(x: number, y?: number, scroll?: boolean): void;
		resetround?: (event?: Event) => boolean;
		connectMenu?: () => void;
		extensionTab(name: string): void;

		// methods/connectEvents.ts & connectClientsAndRoom.ts
		connectEvents(this: ConnectEventsButton): void;
		connectClients(this: ConnectClientsButton): void;
		connectroom(this: ConnectRoomTarget, event?: Event): void;

		// methods/windowTouch.ts & windowMouse.ts
		dragtouchdialog(this: DraggableDialog, e: TouchEvent): void;
		windowtouchstart(e: TouchEvent): void;
		windowtouchmove(e: TouchEvent): void;
		windowtouchend(e: TouchEvent): void;
		checkroundtranslate(translate?: number[] | null): void;
		checkdialogtranslate(translate: number[] | null | undefined, dialog: DraggableDialog | (HTMLDivElement & { _dragtransform?: number[] })): void;
		windowmousewheel(e: WheelEvent): void;
		windowmousemove(e: MouseEvent): void;
		windowmousedown(e: MouseEvent): void;
		windowmouseup(e: MouseEvent): void;

		// methods/pointerAndScroll.ts
		touchconfirm(): void;
		cardtouchstart(this: any, e: TouchEvent): void;
		cardtouchmove(this: any, e: TouchEvent): void;
		cardmouseenter(this: any): void;
		cardmouseleave(this: any): void;
		playertouchstart(this: DraggablePlayer, e: TouchEvent): void;
		playertouchmove(this: DraggablePlayer, e: TouchEvent): void;
		mousemove(this: HoverTarget): void;
		mouseenter(this: HoverTarget): void;
		mouseleave(this: HoverTarget): void;
		mousedown(this: HoverTarget): void;
		mouseentercancel(): void;
		hoverplayer(this: HTMLDivElement, e: MouseEvent): Dialog | undefined;
		longpressdown(this: any, e: TouchEvent): void;
		longpresscallback(): void;
		longpresscancel(this: any): void;
		mousewheel(this: ScrollableDiv, evt: WheelEvent & { readonly wheelDelta: number }): void;
		touchStart(this: HTMLDivElement, e: TouchEvent): void;
		dialogtouchStart(this: HTMLDivElement, e: TouchEvent): void;
		touchScroll(this: HTMLDivElement, e: TouchEvent): void;

		// methods/hoverAndIntro.ts
		touchpop(forced?: boolean | Event): void;
		buttonnameenter(this: ButtonNameTarget): void;
		buttonnameleave(this: ButtonNameTarget): void;
		hoverpopped(this: PoppedTarget): void;
		hoverpopped_leave(this: HTMLDivElement & { _poppedalready?: boolean }): void;
		leavehoverpopped(this: Dialog & { _poppedorigin?: HTMLDivElement & { _uiintro?: Dialog } }): void;
		touchintro(this: IntroTarget): void;
		intro(this: IntroTarget, e: Event | Touch | { clientX: number; clientY: number }): Dialog | undefined;
		intro2(this: HTMLElement): void;

		// methods/gameplaySelection.ts
		window(): void;
		button(this: HTMLDivElement): void;
		card(this: Card, mode?: string | Event): void;
		avatar(this: AvatarTarget): void;
		avatar2(this: AvatarTarget): void;
		player(this: Player, e?: Event): void;
		target(this: Player, e?: Event): void;

		// methods/gameplayControls.ts
		control2(this: ControlContainer): void;
		control(this: ControlButton): void;
		dialogcontrol(this: ControlButton): void;
		skill(skill: string): void;
		ok(node?: ControlButton | ChildNode | null): void;
		cancel(node?: ControlButton | ChildNode | null): void;
		auto(mode?: string | Event): void;
		wuxie(this: HTMLDivElement, _event?: Event): void;
		tempnowuxie(this: Control & { _origin?: string | number }): void;
		autoskill(bool: boolean, node: { link: string }): void;
		skillbutton(this: HTMLDivElement): void;
		autoskill2(this: HTMLDivElement, e: Event): void;
		hiddenskill(this: HTMLDivElement, e: Event): void;

		// methods/chatAndAudio.ts
		chat(): Dialog;
		volumn(): Dialog;
		volumn_background(this: HTMLSpanElement & { link: number }, e: Event): void;
		volumn_audio(this: HTMLSpanElement & { link: number }, e: Event): void;

		// methods/identityAndSystem.ts
		identitycircle(this: IdentityCircleNode): void;
		exit(): void;
		shortcut(show?: boolean | Event): void;
		favouriteCharacter(this: HTMLElement & { link?: string }, e: Event): void;
		identity(this: IdentityTarget, e?: Event): void;
		identity2(this: HTMLElement): void;
		roundmenu(): void;
		pausehistory(): Dialog | undefined;
		pauseconfig(): Dialog | undefined;
		cardPileButton(): Dialog;
		commonCardPileButton(): Dialog;
		dierevive(): void;
		dieswap(): void;
		dieswap2(this: HTMLDivElement & { link: Player }): void;
		pause(): void;
		resume(this: HTMLDivElement, e: Event): boolean | void;
		config(): void;
		swap(this: Player): void;

		// methods/widgetsAndSkin.ts & charactercard/index.ts
		autoskin(): void;
		skin(avatar: HTMLElement, name: string, callback?: (bool: boolean) => void): void;
		toggle(this: ToggleTarget): void;
		editor(this: EditorTarget): void;
		switcher(this: ConfigSwitcher): void;
		choice(this: SwitcherChoice): void;
		logv(this: LogvTarget, e: Event): void;
		logvleave(this: LogvTarget): void;
		charactercard(name: string, sourcenode?: any, noedit?: boolean | string | null, resume?: boolean, avatar?: HTMLElement, audioName?: string): void;
		rightplayer(this: PoppedTarget, e: Event): boolean;
		right(e: MouseEvent): boolean | void;
		count(this: HTMLDivElement & { parentNode: Player }, e: MouseEvent): boolean | void;
	}
}
