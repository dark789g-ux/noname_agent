# 布局主题、座位排布与配置项

身份场（以及所有模式）的布局主题切换、座位排布算法、UI 创建工厂、identity 配置块全表。

> 布局/座位/配置项是**所有模式共用**的，身份场不修改这些机制，只通过配置项驱动。
>
> 身份牌颜色见 [identity-card.md](identity-card.md)；Player DOM 见 [player-dom.md](player-dom.md)。

## 1. 布局主题

由 `lib.config.layout` 决定，默认 `"default"`。

| 布局 | CSS 文件路径 | 说明 |
|------|------------|------|
| `default` | `apps/core/layout/mobile/layout.css`（**default 实际映射到 mobile**） | 默认布局（PC 端语义，`ui.arena` 带 `.oldlayout` class） |
| `mobile` | `apps/core/layout/mobile/layout.css` | 移动端布局 |
| `long` | `apps/core/layout/long/layout.css` | 窄屏长条布局 |
| `long2` | `apps/core/layout/long2/layout.css` | 变体长条布局 |
| `nova` | `apps/core/layout/nova/layout.css` | 新版布局 |
| `newlayout` | `apps/core/layout/newlayout/layout.css` | 最新布局 |

`apps/core/layout/mode/` 目录下只有 boss/chess/stone/story/tafang 模式的专用 CSS，**没有 identity.css** —— 身份场不使用任何专属 CSS 文件。

## 2. lib.init.layout()：CSS 切换

定义：`apps/core/noname/library/init/index.js:413-533`

关键逻辑：

- **L419-421**：`if (layout == "default") { layout = "mobile"; }` —— default 映射到 mobile
- 加载对应 `/layout/{name}/layout.css`
- **L434-L508**：根据 layout 类型给 `ui.arena` 添加 class（`mobile`、`long`、`oldlayout`、`slim_player`、`lslim_player`、`uslim_player`、`mslim_player` 等）
- 后续调用 `ui.updatej()`、`ui.updatem()`、`ui.updatePlayerPositions()`、`ui.updatec()` 触发重排

> **注意**：`init/index.js` 全文仅 694 行，不存在 L2336-2363 的 arena class 逻辑；该逻辑实际在 `lib.init.layout()` 内部 L434-L508。

## 3. 座位排布：updatePlayerPositions()

定义：`apps/core/noname/ui/index.js:759-796`

行为：

- **≤8 人**：直接 return，由 CSS grid/absolute 定位处理（内置在 layout CSS 中）
- **>8 人**：动态计算每个玩家位置，使用 `game.dynamicStyle.add()` 注入 CSS

玩家数量由 `game.prepareArena(num)` 决定：

- 标准模式：`game.prepareArena()`（无参数，从 config 取 `player_number`）
- 明忠 / 3v3v2：`game.prepareArena(8)` 固定 8 人（`apps/core/mode/identity.js:65, L67`）

默认座位 `position=0` 在底部（`game.me`），其余玩家 1~N 逆时针排列。

## 4. UI 创建工厂：ui.create.players/me/arena

定义：`apps/core/noname/ui/create/index.js`

| 方法 | 行号 | 功能 |
|------|------|------|
| `ui.arena` 创建 | L2312 | `ui.create.div("#arena.nome", ui.window)` |
| `ui.arena.setNumber(num)` | L2316-2331 | 设置玩家数量，触发 `ui.updatePlayerPositions()` |
| `ui.create.players(numberOfPlayers)` | L3740-3779 | 创建 N 个 Player DOM，循环链接 previous/next/nextSeat/previousSeat |
| `ui.create.me()` | L3780-3811 | 创建底部 `#mebg`/`#me`，绑定 `#handcards1`/`#handcards2`，设 `game.me = game.players[0]` |

## 5. identity 配置块（library/index.js:5773-6676）

定义位置：`apps/core/noname/library/index.js` 的 `lib.mode.identity` 块 **L5773-6676**（约 900 行）。

> **注意**：该配置块实际到 L6676 结束，中间 L6224-6676 含 `change_identity`/`ban_identity`/`ai_strategy`/`difficulty`/`choice_zhu`/`limit_zhu`/`enable_mingcha` 等配置项，约 450 行不可遗漏。

### 模式入口

| 配置项 | 行号 | 说明 |
|--------|------|------|
| `identity_mode` | L6226 | 子模式选择（normal/zhong/stratagem/purple） |
| `player_number` | L6239 | 玩家数量（标准模式用） |

### 选将相关

| 配置项 | 行号 | 说明 |
|--------|------|------|
| `choice_zhu` | L6538 | 主公候选武将数 |
| `limit_zhu` | L6555 | 常备主候选武将数 |
| `free_choose` | （配置块内） | 自由选将开关 |

### 身份相关

| 配置项 | 行号 | 说明 |
|--------|------|------|
| `change_identity` | L6374 | 允许换身份（自由选择身份和座位） |
| `ban_identity` | L6483 | 禁用身份 |
| `auto_mark_identity` | （配置块内） | 自动标记身份开关 |

### AI 相关

| 配置项 | 行号 | 说明 |
|--------|------|------|
| `ai_strategy` | L6516 | 内奸策略 |
| `difficulty` | L6529 | AI 对人类态度 |

### 其他

| 配置项 | 行号 | 说明 |
|--------|------|------|
| `enable_mingcha` | L6668 | 明察机制开关 |

> 完整配置项清单建议直接读 `library/index.js:5773-6676`；上表为高频使用项。

## 6. 动态注入的 CSS

`cssstyles()` 定义在 `apps/core/noname/library/init/index.js:363-411`。

包含身份字体可配置：`#arena .player .identity>div {font-family: ...}`（**L376**），字体来源 `lib.config.identity_font`，默认 `"huangcao"`。

## 修改指引

- **加新配置项**：在 `library/index.js:5773-6676` 的 identity 配置块内新增（参考现有项的 `name`/`init`/`intro`/`item`/`onblur` 字段）；如需运行时映射到 LLMConfig 等结构，同步相应 index.ts
- **加新布局主题**：在 `apps/core/layout/` 下新建目录 + layout.css；同步 `lib.init.layout()`（L413-533）的分支处理
- **改座位排布算法**：编辑 `ui/index.js:759-796` 的 `updatePlayerPositions()`，注意 ≤8 人走 CSS、>8 人走 dynamicStyle 的分流
- **调整 identity 配置块边界**：如新增/删除大段配置，注意更新本文档的 L5773-6676 行号

## 相关文档

- [index.md](index.md)（身份场 UI 总览）
- [identity-card.md](identity-card.md)（身份牌颜色，与 layout CSS 强相关）
- [../menu-dialog.md](../menu-dialog.md)（菜单对话框，配置项 UI 渲染入口）
