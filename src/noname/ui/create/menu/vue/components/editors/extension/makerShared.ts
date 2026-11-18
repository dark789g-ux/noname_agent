import { get, ui } from "noname";
import { security } from "@/util/sandbox";

export interface ParsedEntityName {
	id: string;
	translate: string;
}

/** 解析 `id|中文名` 格式的扩展实体名称；未含 `|` 时译名回退为 id。 */
export function parseEntityName(raw: string): ParsedEntityName | null {
	if (!raw) return null;
	const parts = raw.split("|");
	const id = parts[0];
	const translate = parts[1] || id;
	return { id, translate };
}

/** 判断编辑/创建实体时的 id 是否与引擎库或当前扩展包发生冲突。 */
export function hasEntityIdConflict(
	id: string,
	editingOldId: string | null,
	globalMap: Record<string, any>,
	packMap: Record<string, any>
): boolean {
	if (editingOldId !== null && editingOldId === id) {
		return false;
	}
	return Boolean(globalMap[id] || packMap[id]);
}

/** 用双 FileReader 同步返回图片 DataURL 与上传用 ArrayBuffer。 */
export function readImageAsDataUrlAndBuffer(file: File): Promise<{ dataUrl: string; buffer: ArrayBuffer }> {
	return new Promise((resolve, reject) => {
		const dataUrlReader = new FileReader();
		dataUrlReader.onerror = reject;
		dataUrlReader.onload = e => {
			const dataUrl = String(e.target?.result || "");
			const bufReader = new FileReader();
			bufReader.onerror = reject;
			bufReader.onload = e2 => {
				resolve({ dataUrl, buffer: e2.target?.result as ArrayBuffer });
			};
			bufReader.readAsArrayBuffer(file);
		};
		dataUrlReader.readAsDataURL(file);
	});
}

/** 读取二进制文件为 ArrayBuffer（如阵亡配音）。 */
export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = reject;
		reader.onload = e => resolve(e.target?.result as ArrayBuffer);
		reader.readAsArrayBuffer(file);
	});
}

/** 通用 JS 代码编辑器弹窗：使用 security.exec2 校验赋值对象后写回。 */
export function openValidatedCodeEditor(
	initialValue: string,
	validate: (result: string) => void,
	onSave: (result: string) => void
): void {
	ui.create.editor({
		language: "javascript",
		value: initialValue,
		saveInput: (result: string) => {
			validate(result);
			onSave(result);
		},
	});
}

export function validateNamedObjectCode(varName: string, result: string): Record<string, any> {
	const parsed = security.exec2(result);
	const target = parsed?.[varName];
	if (target == null || typeof target !== "object") {
		throw new Error("代码格式有错误，请对比示例代码仔细检查");
	}
	return target;
}

/** 技能对象序列化为可编辑代码（处理 getter/setter 与 Symbol 属性）。 */
export function serializeSkillToCode(skillInfo: any): string {
	const obj = Object.defineProperty(get.copy(skillInfo), "_priority", {
		enumerable: false,
		writable: true,
		configurable: true,
	});
	let str = "{\n";
	const indent = "    ";
	for (const key in obj) {
		const descriptor = Object.getOwnPropertyDescriptor(obj, key);
		if (descriptor?.get || descriptor?.set) {
			if (descriptor.get) str += `${indent}${get.stringify(descriptor.get, 1)},\n`;
			if (descriptor.set) str += `${indent}${get.stringify(descriptor.set, 1)},\n`;
		} else {
			let keyString = (/[^a-zA-Z]/.test(key) ? `"${key}"` : key) + ": ";
			if (get.is.functionMethod(obj, key)) keyString = "";
			str += `${indent}${keyString}${get.stringify(obj[key], 1)},\n`;
		}
	}
	for (const symbol of Object.getOwnPropertySymbols(obj)) {
		str += `${indent}[${String(symbol)}]: ${get.stringify(obj[symbol], 1)},\n`;
	}
	str += "}";
	return `skill=${str}`;
}
