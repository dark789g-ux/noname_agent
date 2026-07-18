# 身份牌渲染与子模式差异

身份牌的创建/颜色/猜测交互，以及 4 子模式（标准/明忠/谋攻/3v3v2）的 UI 差异。

> 身份牌 DOM 节点是通用的（见 [player-dom.md](player-dom.md)），本文档聚焦身份牌专属渲染与颜色。
>
> 配置项驱动见 [css-layout.md](css-layout.md)。

## 1. 身份牌创建：identityCard()

`apps/core/noname/ui/create/index.js:13-31`

```text
identityCard(identity, node)
  ├─ L17: const fileName = `image/card/identity_${identity}.jpg`;
  ├─ L22: card.node.image.setBackgroundImage(fileName);  // 配合 lib.assetURL 前缀
  └─ 返回 card 节点，挂到 node.identity
```

身份牌图片位于 `apps/core/image/card/`，按 identity 值拼接文件名：

| 文件名 | 身份 |
|--------|------|
| `identity_zhu.jpg` | 主公 |
| `identity_zhong.jpg` | 忠臣 |
| `identity_fan.jpg` | 反贼 |
| `identity_nei.jpg` | 内奸 |
| `identity_commoner.jpg` | 平民 |
| `identity_cai.jpg` | 未知/猜 |

其它模式（明忠、谋攻、3v3v2）复用上述图片，阵营差异通过 CSS `data-color` 实现，而非独立图片。

## 2. 旋转身份牌动画

| 函数 | 定义 | 说明 |
|------|------|------|
| `cardSpinning()` | `ui/create/index.js:36-66` | 创建旋转容器，CSS `transform: rotate` 动画 |
| `spinningIdentityCard()` | `ui/create/index.js:70-78` | 对指定玩家的身份牌触发旋转揭示动画 |

使用场景：谋攻模式的 `stratagemInsight`（洞察）技能等需要"揭示身份"动画的场合。

## 3. 身份猜测交互：ui.click.identity

`apps/core/noname/ui/click/index.js:699-836`（`ui.click.identity`）+ L837-850（`identity2`）

触发条件：玩家点击身份牌（身份场特有）。

流程：

1. 检查 `game.getIdentityList()` 是否可用——身份场专属，国战/BOSS 等模式不触发
2. 创建身份选择按钮（zhu/zhong/fan/nei 等）
3. 通过 `_status.clickingidentity` 状态管理交互
4. 选择后调用 `player.setIdentity(guessIdentity)` 显示猜测结果

> 仅身份场有此交互。其它模式（国战/BOSS）点击身份牌无响应。

## 4. 身份颜色：CSS data-color 完整表

CSS 选择器位于 `apps/core/layout/default/layout.css`：
- `.identity` 基础样式：**L2914**
- `.identity.animate` 动画：**L4004-4006**
- `[data-color="..."]` 各身份颜色：**L4004-4194**（部分扩展到 L4260）
- `.damage.dieidentity`（阵亡身份揭示）：**L2575-2581**

### 通用身份

| data-color | 含义 | 行号 |
|-----------|------|------|
| `zhu` | 主公（红色发光） | L4008 |
| `truezhu` | 真主公 | L4009 |
| `zhong` | 忠臣（黄色发光） | L4055 |
| `fan` | 反贼（紫色） | L4159 |
| `nei` | 内奸（青色） | L4125 |
| `commoner` | 平民（绿色） | L4175 |
| `cai` | 未知/猜（灰色） | L4181 |
| `cai2` | 未知变体 | L4037 |
| `mingzhong` | 明忠（橙色发光） | L4033 |
| `kami` | 神将 | L4145 |
| `falsezhu` | 假主公 | L4186 |
| `unknownx` | 未知扩展 | L4260 |

### 3v3v2 阵营（暖/冷）

| data-color | 含义 | 行号 |
|-----------|------|------|
| `rZhu` | 暖色主公 | L4034 区 |
| `rZhong` | 暖色忠臣 | L4034 区 |
| `rNei` | 暖色内奸 | L4034 区 |
| `bZhu` | 冷色主公 | L4034 区 |
| `bZhong` | 冷色忠臣 | L4034 区 |
| `bNei` | 冷色内奸 | L4034 区 |

### 谋攻（敌/友）

| data-color | 含义 | 行号 |
|-----------|------|------|
| `enemy` | 敌方 | L4010 |
| `friend` | 友方 | L4010 区 |
| `friend2` | 友方变体 | L4058 |

### 野心家（3v3v2 / 国战）

| data-color | 含义 | 行号 |
|-----------|------|------|
| `ye` | 野心家 | L4126 |
| `rYe` | 暖色野心家 | L4127 |
| `bYe` | 冷色野心家 | L4128 |

> 行号"区"表示精确行需对照源码（L4004-4194 区间内有多个 `[data-color]` 规则交错排列）。如要精确到单行，可读 `apps/core/layout/default/layout.css:4000-4200` 确认。

## 5. 4 子模式 UI 差异

子模式由 `identity_mode` 配置项控制（详见 [css-layout.md](css-layout.md)）。

### 标准（normal）

| 项目 | 说明 |
|------|------|
| 身份列表 | 动态计算（`get/index.js:487-523` `identityList(n)`） |
| 公式 | 1 主公 + round(n\*3/9) 忠臣 + round(n\*2/9) 内奸 + 其余反贼 |
| 颜色 | `zhu`/`zhong`/`fan`/`nei` |
| 公开性 | 身份隐藏至游戏结束（双人模式由 `game.showIdentity(me)` 公开） |
| 选将 | `chooseCharacter()`（`mode/identity.js:1669`） |

### 明忠（zhong）

| 项目 | 说明 |
|------|------|
| 身份列表 | **硬编码** `["zhu","zhong","mingzhong","nei","fan","fan","fan","fan"]`（`mode/identity.js:1836`，另见 L2533 分支） |
| 颜色 | `zhu`/`zhong`/`mingzhong`/`nei`/`fan`（`mingzhong` 明忠专属橙色） |
| 公开性 | 主公 + 明忠开局公开 |
| 人数 | 8 人固定 |

### 谋攻（stratagem）

| 项目 | 说明 |
|------|------|
| 身份颜色 | `enemy`/`friend`/`friend2`（敌/友） |
| 专属技能 | `stratagemInsight`（洞察，触发旋转身份牌动画）、`stratagemCamouflage`（伪装）、`stratagem_monarchy`、`stratagem_revitalization` 等 |
| 旋转动画 | `spinningIdentityCard()`（`ui/create/index.js:70-78`） |
| 选将 | `chooseCharacterStratagemOL()`（`mode/identity.js:1412`，联机版） |

### 3v3v2（purple）

| 项目 | 说明 |
|------|------|
| 阵营 | 3v3v2 红蓝阵营 + 野心家 |
| 颜色 | `rZhu`/`rZhong`/`rNei`/`bZhu`/`bZhong`/`bNei`（红蓝阵营）+ `ye`/`rYe`/`bYe`（野心家） |
| 选将 | `chooseCharacterPurple()`（`mode/identity.js:1237`）/ `chooseCharacterPurpleOL()`（L1006，联机版） |
| 人数 | 8 人固定（`game.prepareArena(8)`） |
| 胜负判定 | 3v3v2 红蓝阵营互杀 + 野心家独立判定 |

## 6. 身份列表动态计算：get.identityList(n)

`apps/core/noname/get/index.js:487-523`

默认公式（标准模式）：

```
1 主公 + round(n * 3 / 9) 忠臣 + round(n * 2 / 9) 内奸 + 其余反贼
```

- 被标准模式的 `chooseCharacter()` 调用以分配身份
- 明忠模式跳过此函数，使用硬编码列表（`mode/identity.js:1836`）

## 7. 阵亡身份揭示

CSS：`.damage.dieidentity`（`apps/core/layout/default/layout.css:2575-2581`）

触发：玩家阵亡时显示真实身份。由 `mode/identity.js` 中 Step 4 身份展示（L268）+ 玩家死亡事件共同驱动。

## 修改指引

### 新增身份颜色

在 `apps/core/layout/default/layout.css` 的 **L4004-4194** 区间新增 `.identity[data-color="xxx"]` 规则；
同步所有 layout 主题（`mobile`/`long`/`long2`/`nova`/`newlayout`）。

### 新增子模式

需改动 3 处：

1. `mode/identity.js`：start 数组分流 + chooseCharacter 变体 + checkResult 分支
2. `library/index.js`：`identity_mode` 配置项
3. 新身份颜色 CSS（见上条）

### 调整身份猜测

编辑 `ui/click/index.js:699-836`。

## 踩坑契约

### 身份牌 DOM 是通用的

所有模式共用 `node.identity`，不要在身份场里改 DOM 结构，只改 `dataset.color` 取值。

### 颜色 CSS 需多 layout 同步

身份颜色在 `default/layout.css` 定义，但 `mobile`/`long`/`long2`/`nova`/`newlayout` 也有覆盖。
改一处要全部同步，否则该主题下身份牌颜色丢失。

### showIdentity 不在 player.js

主入口是 `game/index.js:4063`，player prototype 在 `mode/identity.js:791` 内联扩展。
详见 [player-dom.md](player-dom.md)。

### 明忠身份列表硬编码

不要试图用 `get.identityList(n)` 推算明忠身份分布——它在 `mode/identity.js:1836` 硬编码为 8 人固定列表。

## 相关文档

- [player-dom.md](player-dom.md)（Player DOM 子节点结构）
- [css-layout.md](css-layout.md)（布局主题、座位、配置项含 `identity_mode`）
- [../skin-guide.md](../skin-guide.md)（头像换肤机制，影响 `node.avatar`）
