# Player DOM 结构

玩家框（Player）的 DOM 子节点构造，以及身份相关方法。

> Player DOM 是**所有模式共用**的，身份场不修改这些节点本身，只通过 `dataset.color` 等属性驱动样式。
> 身份牌的具体渲染/颜色/猜测交互见 [identity-card.md](identity-card.md)。
> 布局与座位排布见 [css-layout.md](css-layout.md)。

## 1. buildNode()：DOM 子节点表

`Player.prototype.buildNode()` 定义在 `apps/core/noname/library/element/player.js:38-86`。

| 子节点 | DOM class | 创建行号 | 功能 |
|--------|-----------|---------|------|
| `node.avatar` | `.avatar` | L42 | 头像区 |
| `node.avatar2` | `.avatar2` | L43 | 双将第二头像 |
| `node.turnedover` | `.turned` | L44 | 翻面标记 |
| `node.framebg` | `.framebg` | L45 | 边框背景 |
| `node.intro` | `.intro` | L46 | 角色信息（点击展开） |
| **`node.identity`** | **`.identity`** | **L47** | **身份牌**（详见 identity-card.md） |
| `node.hp` | `.hp` | L48 | 体力槽 |
| `node.name` | `.name` | L49 | 名字 |
| `node.name2` | `.name.name2` | L50 | 双将第二名字 |
| `node.nameol` | `.nameol` | L51 | OL 名字（在线模式） |
| `node.count` | `.count` | L52 | 手牌数 |
| `node.equips` | `.equips` | L53 | 装备区 |
| `node.judges` | `.judges` | L54 | 判定区 |
| `node.marks` | `.marks` | L55 | 标记区 |
| `node.chain` | `.chain` | L56 | 铁索连环 |
| `node.handcards1` | `.handcards` | L57 | 手牌 1（双将） |
| `node.handcards2` | `.handcards` | L58 | 手牌 2（双将） |
| `node.expansions` | `.expansions` | L59 | 扩展区（如"识"等专属区域） |
| `node.action` | `.action` | L86 | 动作指示器（加于 avatar） |

`buildNode()` 内还包含以下初始化逻辑：

- L61-62：`handcards1`/`handcards2` 挂载 `ChildNodesWatcher`。
- L63-81：`equips` 挂载 `MutationObserver`，监听子节点变动以触发 `$handleEquipChange()`。
- L81-85：`expansions` 初始 `display:none`；`chain` 内按 `game.layout` 生成 64（default）或 40 个 `.cardbg` 子节点。

## 2. buildExtra()：identity 内层与 link 标记

`Player.prototype.buildExtra()` 定义在 `apps/core/noname/library/element/player.js:88-99`。

关键内层创建：

| 行号 | 操作 | 说明 |
|------|------|------|
| L91-93 | `player.mark(" ", ...)` → `node.link` | 铁索标记节点，通过 `player.mark()` 创建（非 `ui.create.div()` 直接创建） |
| L95-97 | `setBackgroundImage("image/card/tiesuo_mark.png")` | 设置 link 标记的背景图 |
| L98 | `ui.create.div(node.identity)` | 在 identity 节点内创建内层 div（用于显示身份文字） |

`setIdentity()` 写入的是 L98 创建的这个内层 div 的 `innerHTML`（即 `node.identity.firstChild`）。

## 3. 身份相关 Player 方法

### setIdentity(identity, nature)

| 项目 | 内容 |
|------|------|
| 定义 | `apps/core/noname/library/element/player.js:5728-5739` |
| 行为 | 设置身份文字到 `node.identity.firstChild.innerHTML`；同时设置 `node.identity.dataset.color = nature \|\| identity` 驱动 CSS 颜色 |
| 特殊 | `if (get.is.jun(this))` 时 innerHTML 写入 `"君"` 字（国战君主） |

### showIdentity()

> **重要修正**：`showIdentity()` 的 prototype **不在** `player.js` 中。实际存在两处：

| 位置 | 定义 | 说明 |
|------|------|------|
| `apps/core/noname/game/index.js:4063-4070` | `game.showIdentity(player, identity)` | 主入口：取出 player.identity 后调用 `player.showIdentity(identity)` |
| `apps/core/mode/identity.js:791-804` | `Player.prototype.showIdentity(me)` | player prototype 方法，由 mode 加载时 mixin 注入 |

行为：公开玩家身份，移除 `.guessing` class，调用 `player.setIdentity(player.identity)` 显示真实身份；标记 `identityShown = true` 和 `ai.shown = 1`；若身份为 `"zhu"` 则置 `isZhu = true`。

### game.showIdentity(me)

| 项目 | 内容 |
|------|------|
| 定义 | `apps/core/noname/game/index.js:4063-4070` |
| 使用场景 | 游戏结束时、双人模式公开身份（详见 `mode/identity.js` 中调用） |

### autoIdentityMark() —— 不存在

此函数在 codebase 中**完全不存在**。相关功能实际由 `auto_mark_identity` 配置项驱动（详见 [css-layout.md](css-layout.md)）。

## 4. 通用性：哪些是身份场专属？

| 元素 | 是否身份场专属 | 说明 |
|------|--------------|------|
| `node.identity` 节点 | 否（通用） | 所有模式都有身份节点（国战/BOSS 也用） |
| 身份颜色（dataset.color） | 是（身份场语义最丰富） | 详见 identity-card.md |
| `node.hp` 体力槽 | 否（通用） | 所有模式共用 |
| 距离/位置数字 | 否（通用） | 所有模式共用 |
| `node.equips` / `node.judges` / `node.marks` | 否（通用） | 所有模式共用 |

**结论**：身份场的"UI 专属"实际只体现在 `dataset.color` 的取值集合（zhu/zhong/fan/nei 等）和身份猜测交互上，DOM 结构本身完全复用通用 Player。

## 修改指引

- **加新 Player 子节点**：编辑 `apps/core/noname/library/element/player.js:38-86` 的 `buildNode()`，在对应位置 `node.xxx = ui.create.div(...)`；同时考虑 `buildExtra()`（L88+）。
- **调整身份标记样式**：编辑 `setIdentity()`（L5728-5739），改 `dataset.color` 或 `innerHTML` 逻辑；同步 CSS `.identity[data-color="..."]`（详见 identity-card.md）。
- **新增身份公开逻辑**：在 `mode/identity.js` 中通过 mode mixin 扩展 `Player.prototype.showIdentity`，而非修改 player.js。

## 相关文档

- [identity-card.md](identity-card.md)（身份牌渲染、颜色、猜测交互、子模式差异）
- [css-layout.md](css-layout.md)（布局、座位、配置项）
- [../lib-skill-format.md](../lib-skill-format.md)（理解 `player.mark()` 创建标记的机制）
