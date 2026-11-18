# Library 模块职责与验证

公开入口仍是 `apps/core/noname/library/index.js`，导出 `Library`、可替换的 `lib` 和 `setLibrary`。类留在入口中，保持既有模块类型扩充路径。字段按原顺序初始化，入口委托方法仍是原型方法。具体实现优先使用 TypeScript；`registries/card.js`、`registries/status.js` 和 `runtime/element.js` 保留 JavaScript，使原先开放对象的类型扩展行为继续兼容，避免引入宽泛类型断言。

## 模块职责

以下路径相对于 `apps/core/noname/library/`：

| 目录 | 职责 |
| --- | --- |
| `contracts/` | 兼容类型、Node 生命周期能力、菜单回调接收者和名称前缀 |
| `configuration/options/` | 通用、外观、显示、音频、LLM 等菜单；保留公开键 `appearence` |
| `configuration/modes/` | 各模式配置，大模式继续按联机、规则、选将拆分 |
| `configuration/extensions.ts` | 扩展菜单与 Boss/剑阁导入流程 |
| `registries/` | 武将、卡牌、翻译、技能 Proxy，以及前缀、自然属性等注册数据 |
| `rules/` | 筛选、排序、应变、谋攻强化和共通区域 |
| `network/server/` | 握手、房间与玩家消息处理 |
| `network/client/` | 连接、大厅、重连和对局控制；`reconnect.ts` 保留完整重连函数 |
| `runtime/` | Node 能力守卫、竞技场就绪回调、元素注册和原型初始化 |
| `ui/` | 提示、弹窗、悬浮、滚动、画布和视频辅助 |
| `debug/` | 配置、卡牌、玩家和对局调试命令 |
| `testing/` | 真实模块装载、结构基线、行为契约及物理行数检查 |

已有 `element/`、`init/`、内置技能和战法模块继续承担原有职责。

## 创建和修改规则

- 创建函数每次返回原先属于实例的新对象。技能表的底层内置定义继续共享，不能统一改成共享常量或深拷贝。
- 运行时访问六个引擎单例时，从 `noname` 导入实时绑定；不要在模块顶层读取尚未初始化的单例，也不要捕获随后会被替换的对象。
- `ZhanfaManager` 仍在卡牌、翻译、技能和武将注册表之后构造；它会修改这些表。
- 菜单组合与 Map 条目必须保持原顺序。需要 getter 的对象保留属性描述符。
- 消息回调不能被统一绑定。广播函数仍需要能序列化，所需数据通过参数传入。
- 保留的 `var` 和 `arguments` 属于原实现的函数作用域与调用协议。对应文件仅豁免这两项风格规则，避免在拆分时改变作用域或可序列化函数体；类型检查不作整体豁免。

## 验证命令

在仓库根目录执行：

```powershell
pnpm -F noname test:library-modules
pnpm -F noname test:selection
pnpm -F noname test:llm-config
pnpm -F noname lint
pnpm -F noname exec tsc --noEmit -p tsconfig.json
pnpm -F noname build:types
pnpm -F noname build
```

`test:selection` 首先运行 `test:library-modules`。迁移后的行为测试加载真实入口与拆分模块，仅替换 DOM、平台装载等环境边界；使用 Node 的 `--experimental-vm-modules` 开关。

`testing/shapeSnapshot.json` 记录拆分前各实例字段的结构摘要，包含数据、键顺序、函数参数个数及描述符，不执行运行时 getter。修改公开数据时应审查对应摘要变化，不能为绕过测试而直接重新生成。

行数检查覆盖新目录、公开入口及本次修改的测试，计入空行和注释，不扫描依赖或无关历史模块。每个文件最多 500 个物理行，通常应预留维护空间。超限时应按职责拆分，不能靠压缩排版绕过限制。

本次拆分的检查结果与平台覆盖见 [Library 拆分验收记录](library-modules-validation.md)。
