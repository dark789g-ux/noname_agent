import type JSZip from "jszip";

import type { Get } from "../Get.js";
declare module "../Get.js" {
	interface Get {
		objectURL(octetStream: string): string;

		connectNickname(): any;

		zip(callback: (zip: JSZip) => any): void;

		url(master?: any): string;

		ip(): string | undefined;

		trimip(str?: any): any;

		skinPath(name: string): string | null;

		relativePath(url: URL, addAssetURL?: boolean): string;

		dataUrlAsync(blob: Blob): Promise<URL>;

		objectUrlAsync(dataUrl: string | URL): Promise<URL>;

		blobFromUrl(url: string | URL): Promise<Blob>;

		checkVersion(require: [majorVersion: number, minorVersion: number, patchVersion: number], current: [majorVersion: number, minorVersion: number, patchVersion: number]): boolean;

		coreInfo(): ["firefox" | "chrome" | "safari" | "other", number, number, number];
	}
}
