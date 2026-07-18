# TODO — LLM AI 操控武将决策（后续待办）

> 第一版已落地（4 个核心决策点 + 配置 + 日志）。本文件记录后续迭代项。
> 优先级标注：🔴 高 / 🟡 中 / 🟢 低

## 一、功能扩展

### 🔴 覆盖剩余 12 处决策点
第一版只做了 4 处核心决策点（chooseToUse / chooseToRespond / chooseToDiscard / chooseBool）。剩余 12 处需要按同一模式（方案 C 前置分支）逐步接入：

- [ ] `chooseButton` — 技能/选项按钮选择
- [ ] `chooseTarget` — 通用目标选择
- [ ] `chooseCard` — 通用选牌
- [ ] `chooseCardTarget` — 同时选卡+目标
- [ ] `chooseButtonTarget` — 选按钮+目标
- [ ] `chooseControl` — 控制选项（如下拉选择）
- [ ] `choosePlayerCard` — 选其他玩家手牌
- [ ] `chooseToCompare` — 拼点
- [ ] 其余分散在 content.ts 中的 `event.result = "ai"` 分支

每处的接入步骤：定位精确插入点 → 加 `tryLLMDecide(event)` 前置分支 → 在 tools.ts 加该决策点的 tools 定义 → 在 apply.ts 加结果翻译 → 验证。

### 🟡 阶段级 agent loop（解读 B）
当前是事件级（解读 A）：每个 choose* 事件独立调一次 LLM，LLM 视野窄。
阶段级方案：在出牌阶段开始时启动 agent loop，LLM 连续做多步决策直到说"结束"。
- 依赖第一版事件级的验证结果（决策质量是否够好）
- 风险：要接管 phaseUse 事件循环，侵入性高
- 详见 `docs/` 或会话历史中的 A/B 方案对比

### 🟢 事件历史喂给 LLM
当前 context.ts 只序列化当前场面快照，不喂事件历史。
- 优点：可提升 LLM 决策质量（知道前面发生了什么）
- 缺点：显著增加 token 成本和延迟
- 待评估：基于日志反馈决定是否值得

## 二、用户体验

### 🟡 apikey 密码遮蔽
当前 `input: true` 渲染的是 contenteditable div，**明文显示 apikey**。
- 需要：扩展 `NonameConfig.vue` 支持 `password?: boolean` 字段，渲染真正的 `<input type="password">`
- 改动范围：`NonameConfig.vue` + `SelectConfigData` 类型（`apps/core/typings/type.d.ts`）+ `library/index.js` 的 llm_apikey 声明

### 🟡 CORS 代理方案（browser 模式可用性）
当前 browser 模式直连 OpenAI 会被 CORS 拦截，仅 Electron 可用（`webSecurity: false`）。
- 选项 1：在配置中加 `proxyUrl` 字段，用户指向自建反向代理
- 选项 2：提供一个官方轻量代理服务（运维成本）
- 选项 3：文档详细指导用户部署 cors-anywhere 等
- 当前状态：仅 intro 文本提示，无代码处理

### 🟢 多供应商支持
当前仅 OpenAI 兼容（`/v1/chat/completions`）。
- Anthropic Claude：不同接口（`/v1/messages`），thinking 用 `thinking.budget_tokens`
- Google Gemini：不同接口和参数语义
- 改动：client.ts 需要按供应商分发，配置加 `provider` 字段

## 三、质量改进

### 🟢 logger.ts flush 并发保护（评审建议）
当前 flush 实现是安全的，但在极端并发场景下可能产生重复记录。
- 加 `_flushing` 标志防止并发调用
- 非阻塞，等真出问题再改

### 🟢 candidates.ts 移除多余 Array.from（评审建议）
`Array.from(game.players)` 对普通数组无意义，可直接用 `game.players`。
- 纯防御性优化，不影响功能

### 🟡 prompt 工程调优（持续）
第一版的 context.ts（场面序列化）和 tools.ts（工具描述）是最小可用版本，需要根据实际 LLM 日志反馈持续调优：
- [ ] 改进场面快照的可读性（身份推断、威胁评估等）
- [ ] tools description 写得更清晰
- [ ] 可能需要加 few-shot 示例（在 system message 里）
- [ ] 评估是否要加入"本地 AI 建议"作为参考（让 LLM 知道贪心算法会怎么选）
- 依赖：用户实际跑起来后的「LLM 日志」详情反馈

## 四、已知限制（第一版接受，非 bug）

这些是第一版**有意接受的限制**，不一定要修，记录在此供参考：

- **chooseToUse 嵌套策略**：LLM 如果选了有 `chooseButton` 或 `precontent` 的技能，decide.ts 只返回 `{bool: true, skill}`，让 content.ts 的 step 2-3 处理子事件 → goto(0) 重入 → 再次触发 LLM。这是设计取舍，非 bug。
- **超时阈值硬编码上限 300 秒**：llm_timeout 的 onblur 校验会把 >300 的值截到 300。
- **日志最多保留 500 条**：logger.ts flush 时 `merged.slice(-500)` 自动裁剪，超出丢弃最旧的。
- **日志只在菜单可见**：战斗进行中无法实时查看日志，需打开菜单 → 其它 → LLM 日志。
- **IndexedDB 单 key 存数组**：复用 `data` store 的 `llm_logs` key，整存整取。如日志量大需改为独立 store（要 bump DB 版本 4→5）。

## 五、验证待办（用户侧）

第一版代码已通过 lint + 只读评审，但以下运行时验证需要用户手动执行：

- [ ] `pnpm dev` 启动，打开「选项」→「AI / LLM」，填入配置后保存，重启验证持久化
- [ ] 开关关：开一局身份局，AI 行为应与原版完全一致（回归零风险）
- [ ] 开关开 + Electron 模式 + 正确配置：AI 决策由 LLM 接管
- [ ] 开关开 + 错误配置/断网：检查菜单「其它」→「LLM 日志」是否记录了 error + 自动回退本地 AI
- [ ] 切换不同决策点（出牌/响应/弃牌/是否）观察 LLM 决策质量
- [ ] 把日志详情反馈给开发者，用于 prompt 调优
