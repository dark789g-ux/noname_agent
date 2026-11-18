# LLM 技能扩展验证记录

执行日期：2026-11-13。执行开始时工作区已有未提交修改，本次保留这些修改，未创建提交。固定支持范围及技能矩阵见 [技能支持说明](skill-support.md)。

## 结构与行数

| 原入口                              | 拆分前物理行数 | 拆分后物理行数 |
| ----------------------------------- | -------------: | -------------: |
| `noname/library/element/content.ts` |         14,428 |             78 |
| `character/refresh/skill.js`        |         17,988 |             90 |
| `character/extra/skill.js`          |          4,030 |             26 |

事件注册顺序、312 个 refresh 技能和 63 个 extra 技能的键顺序通过基线测试核对。原路径及默认导出保留，技能对象由模块直接组合。

500 行检查扫描 183 个范围内文件，包含入口、实现、类型、测试、检查工具及配套配置；其中部分是已有小文件。最大文件为 `character/refresh/skills/new_reyiji.js`，481 行。空行和注释计入，不以压缩代码满足限制。检查已接入 `test:llm-skills` 和 `test:selection`。

## 自动化检查

| 命令（仓库根目录执行）                              | 结果                                    |
| --------------------------------------------------- | --------------------------------------- |
| `pnpm -F noname test:llm-skills`                    | 76 项通过                               |
| `pnpm -F noname test:selection`                     | Library、技能、选择及事件回归各阶段通过 |
| `pnpm -F noname test:llm-actions`                   | 10 项通过                               |
| `pnpm -F noname test:llm-config`                    | 26 项通过                               |
| `pnpm -F noname test:llm-context`                   | 8 项通过                                |
| `pnpm -F noname test:llm-reason`                    | 11 项通过                               |
| `pnpm -F noname test:llm-logger`                    | 30 项通过                               |
| `pnpm -F noname lint`                               | 通过                                    |
| `pnpm -F noname build`                              | 通过                                    |
| `pnpm -F noname exec tsc --noEmit -p tsconfig.json` | 失败，基线存在类型错误，见下文          |
| `pnpm -F noname build:types`                        | 失败，基线存在声明构建错误，见下文      |

测试使用真实技能、事件、选择器及可重复的模拟模型响应。30 个不同的范围内主动技能 ID 分别验证候选及选择契约；另核对标准包决策节点、觉醒获得关系和已有适配。离间、观星、恂恂、遗计、激将、护驾、鬼才、流离、反间、义绝、攻心、荐言和势斩等另有流程断言。非法响应、过期引用、超轮次、超时和迟到响应验证当前事件回退。

### 类型与声明基线

执行起点快照及原始诊断保存在 `<TEMP>/noname-llm-skills-20261113-022200/`。类型检查原有 89,417 条诊断，完成后为 89,361 条；声明构建原有 3,603 条，完成后为 3,554 条。这两个命令均未通过，不能据此声称全库类型正确。

对比按逻辑文件、诊断代码与消息逐条计数，规范化拆分后的路径、等价 SelectionSpec 类型名及旧 GameEvent 联合类型的显示差异；没有新增诊断。声明基线通过只读 CompilerHost 恢复执行起点源码，不回写工作区。数量减少不作为类型清理成果。

## 浏览器与联机

- 浏览器实际载入启动页、进入身份模式并到达第 1 轮；验证角色初始化、手牌、装备结算和回合推进。启动页在页面内关闭 LLM 和阻断外部模型请求，不保存配置。
- `browser-smoke.html` 使用真实 OpenAI SDK、工具、技能和选择会话，页面内模拟模型服务。制衡经过 2 次请求、离间经过 3 次请求，观星守恒检查通过。未访问外部模型服务。
- 联机自动化使用真实主机选择事件和本机 WebSocket 传递结果，并检查远端恢复不会再次调用模型。这不等于双浏览器完整联机对局或断线重连实测。
- Electron、Android、Safari、双浏览器完整联机和重连未实测。

浏览器证据：`<TEMP>/noname-llm-identity-smoke.png`、`<TEMP>/noname-llm-browser-proof.png`。

## 复查材料

测试日志位于系统临时目录，最终复查使用 `noname-*-delivery.log`；其他独立回归使用 `noname-*-complete.log`。起点快照目录包含 `tracked.patch`、`status.txt`、原始大文件、类型诊断及 `new-type-diagnostics.json`、`new-declaration-diagnostics.json`。最后两份文件为空数组，表示按上述规则对比未新增诊断。
