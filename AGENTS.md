# AGENTS.md

ZCode agent 在本仓库工作时的指南。编辑代码前请先阅读本文档。

## 核心规范
**不要假设，不要隐藏困惑，要暴露权衡。**
- 用**中文**思考与回答。
- 明确说出你的假设，不确定就问
- 如果存在多种解读，把它们都列出来，不要悄悄选一个
- 如果有更简单的方案，说出来；在该反驳时要反驳
- 如果有不清楚的地方，停下来，说明哪里困惑，然后提问
- 代码长度不要超过 500 行，必要时拆分成多个文件或函数
- 不要为了压行数把代码强行「写平」。超限的正确做法是拆分成独立文件 / 函数 / 组件。

## Agent 工作模式

### 探索阶段
* **派发 explore**：代码库探索、定位文件、梳理调用关系等调研工作，一律派发 **explore 子 Agent** 执行。
* **主 Agent 只复核**：主 Agent 只对 explore 返回的结论进行复核与追问，**不要亲自大规模阅读代码**，避免上下文被原始代码淹没。
* 仅当需要确认某个具体片段（如精确的行号、函数签名）时，主 Agent 才可直接读取该文件。

## Plan Mode 工作约定

进入 Plan 模式规划任务时，必须严格执行以下契约：

### 1. 视觉输出规范
* **UI 变更**：必须使用 ASCII 字符绘制界面线框图。
* **流程变更**：必须使用 ASCII 字符绘制业务/数据流程图。

### 2. Agent 编排矩阵（严禁漏写“谁来做”）
Plan 必须清晰界定分工，包含：
* **角色与边界**：拆分哪些子 Agent、具体职责、**允许操作的文件边界**。
* **执行拓扑**：各项任务的串行/并行关系与依赖顺序。

### 3. 执行红线与评审闭环
* **主 Agent 禁令**：主 Agent 仅做编排与审查。**全程绝对禁止直接编写/修改代码或编辑文件**，全部派发给子 Agent。
* **只读评审**：编码完成后，主 Agent 必须指派独立的**代码评审子 Agent（只读）**进行审查。
* **修复闭环**：主 Agent 汇总评审结论，**派发子 Agent 进行修复/更新**，主 Agent 不得亲自修改缺陷。
* **派发 Agent 工具时不使用 `isolation: "worktree"`**，agent 直接在当前会话工作目录（主仓库）中运行。

## 🔍 全局代码搜索规范

为了防止 Agent 在执行全局搜索时因 `node_modules` 导致 I/O 卡死，请严格遵守以下指令编写规范：

- ❌ **ANTI-PATTERN**: `grep -rn "keyword" | grep -v "node_modules"` (理由：先污染后治理，依然会遍历黑洞目录)
-  **BEST PRACTICE**: `grep -rn --exclude-dir="node_modules" "keyword"` (理由：从源头跳过目录)

## 项目简介

无名杀（Noname）—— 一个开源的三国杀游戏引擎。GPL-3.0 协议。采用 **pnpm workspaces** 管理的 monorepo。当前引擎版本记录在 `apps/core/package.json` 的 `"version"` 字段中。

## 环境要求

- Node.js `^20.19.0 || >=22.12.0`，**pnpm >=9**
- 浏览器目标：Chromium >=91 或 Safari >=16.4。**不支持 Firefox。**
- 使用 `tsx` 运行构建/开发脚本（`scripts/*.ts`）。

## 常用命令（在仓库根目录执行）

| 任务 | 命令 |
|------|---------|
| 安装依赖 | `pnpm install` |
| 开发服务器 | `pnpm dev`（Vite 占用 :8081，`@noname/fs` 占用 :8089） |
| 全量构建 → `dist/` | `pnpm build` |
| 构建 + 启动服务 | `pnpm start` |
| 离线包/测试包 | `pnpm generateTestPack` |
| Lint（全部工作区） | `pnpm lint`（等价于 `pnpm -r lint`） |
| 联机服务器 | `pnpm -F @noname/server dev`（ws 监听 :8082） |
| 桌面端打包 | `pnpm -F @noname/electron build:win` / `build:mac` / `build:linux` → `output/` |
| 初始化扩展脚手架 | `pnpm init:extension` |

也可对单个包执行 lint/build，例如 `pnpm -F noname lint`、`pnpm -F noname build`。`apps/core`（包名 `noname`）是游戏引擎本体；对其执行 lint 用 `pnpm -F noname lint`。

## 工作区结构

- `apps/core`（`noname`）—— **游戏引擎，项目的核心。** 几乎所有玩法相关的开发都在此处进行。
- `apps/electron`（`@noname/electron`）—— 桌面端封装。
- `apps/mobile` —— 通过 Capacitor 支持 Android。
- `packages/fs`（`@noname/fs`）—— 本地 Fastify 文件服务器，在开发/独立运行时用于读写游戏文件。
- `packages/jit`（`@noname/jit`）—— 用于运行时扩展编译的 JIT 编译器。
- `packages/server`（`@noname/server`）—— WebSocket 联机服务器。
- `packages/extension/` —— 通过脚手架生成的扩展会放在这里（已被 gitignore；默认为空）。

构建产物 `dist/` 和 `output/` 已被 gitignore。

## 核心架构（`apps/core`）

**六个全局单例** 从 `apps/core/noname.js` 导出，是整个引擎的基础：

```js
import { lib, game, get, _status, ui, ai } from "noname";
```

- `lib` —— 大注册表：技能、卡牌、武将、翻译、配置……（`noname/library/`）
- `game` —— 游戏控制 / 事件循环（`noname/game/`）
- `get` —— 纯辅助/工具函数（`noname/get/`）
- `ui` —— DOM 与 UI 创建（`noname/ui/`）
- `ai` —— AI 决策（`noname/ai/`）
- `_status` —— 可变的游戏状态（`noname/status/`）

Vite 别名（见 `apps/core/vite.config.ts`）：`noname` → `/noname.js`，`@` → `/noname`。从 `"noname"` 导入这六个全局对象；不要通过深层路径去引用它们。

**游戏内容**（运行时合并进 `lib` 的纯 JS，在浏览器上下文中执行）：
- `apps/core/character/<pack>/` —— 武将包；`skill.js` 导出一个 `skills` 对象，合并进 `lib.skill`。
- `apps/core/card/*.js` —— 卡牌包，合并进 `lib.card`。
- `apps/core/mode/*.js` —— 游戏模式（身份、国战、斗地主、BOSS……）。

**事件系统**位于 `noname/library/element/GameEvent/`，包含多个编译器：`StepCompiler`、`AsyncCompiler`、`ArrayCompiler`（见 `noname/library/element/gameEvent.ts`）。

**平台初始化**在运行时于 `noname/entry.ts` 中选择：`init/browser.js`、`init/cordova.js`（移动端）或 `init/node.js`（Electron）。不要假设只有浏览器环境。

## 内容编写约定（编辑技能/事件/模式前必读）

- **所有新的技能/事件 content 优先使用 `Async Content`：**
  ```js
  async content(event, trigger, player) { await player.draw(2); }
  ```
  传统的 `Step Content`（字符串 `"step 0"` 标记，动态编译）仍然存在，但 async 是未来的方向。
- `event.goto`/`event.redo` → 改用普通循环（`for`/`while`）；`event.finish()` → 直接 `return`。async content 中**绝不要**返回一个可 `await` 的东西。
- 技能是 `lib.skill` 的键；技能名同时也是默认的翻译键（`lib.translate.<name>`、`lib.translate.<name>_info`）。
- **修改玩法前必读文档：**
  - `docs/lib-skill-format.md` —— `lib.skill` 字段参考（trigger/active/viewAs/mod/ai……）。
  - `docs/async-guide.md` 与 `docs/step-to-async-guide.md` —— content 编写与迁移。
  - `docs/game-event/`（尤其是 `content.md`、`lifecycle.md`、`trigger.md`）—— 事件内部机制。
  - `docs/game-startup-flow.md` —— 启动 → 模式 `start` → `phaseLoop`。
  - `docs/audio-guide.md`、`docs/skin-guide.md` —— 素材约定。

## 代码风格

- **用 Tab 缩进，宽度 4**（`.editorconfig`、`prettier.config.js`）。LF 换行。
- Prettier：`printWidth: Infinity`，加分号，`trailingComma: "es5"`，`arrowParens: "avoid"`，`quoteProps: "as-needed"`。
- `.js` / `.ts` / `.vue` 混用。TypeScript 开启 `strict` 但 `noImplicitAny: false`，`moduleResolution: "Bundler"`，target 为 ESNext。
- ESLint 配置较宽松：`no-unused-vars`、`no-console`、`no-explicit-any` 均**关闭**。真正需要注意的两条规则：
  - `@typescript-eslint/ban-ts-comment` → **error**：用 `@ts-expect-error`，**禁止** `@ts-ignore` / `@ts-nocheck`。
  - `no-fallthrough` → error，但如果注释匹配 `[falls...through]` 则允许穿透。
- 新增武将/技能时，如适用请同步更新对应的翻译条目以及 `perfectPairs`/`rank` 等元数据。

