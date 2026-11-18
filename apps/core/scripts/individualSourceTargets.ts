import { dirname } from "node:path";

/** Both the stable facade and its TS implementation must survive source export. */
export function individualSourceTargets(type: string, index: string, moderned: boolean): { src: string; dest: string }[] {
	const dest = `src/${type}`;
	const targets = [{ src: moderned ? dirname(index) : index, dest }];
	if (index === "mode/identity.js") targets.push({ src: "mode/identity", dest });
	return targets;
}
