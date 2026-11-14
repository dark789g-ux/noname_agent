/** Receiver used by the legacy DOM menu and its Vue adapter. */
export type MenuCallbackNode<Clearing = boolean> = HTMLDivElement & {
	firstChild: HTMLElement;
	lastChild: HTMLElement;
	_link: { config: SelectConfigData & { mode: string; item: Record<string, string> }; menu: HTMLDivElement };
	_clearing?: Clearing;
};

export interface NamePrefix {
	color?: string;
	nature?: string;
	name?: string;
	showName?: string;
	getSpan?(prefix: string, name?: string): string;
}
