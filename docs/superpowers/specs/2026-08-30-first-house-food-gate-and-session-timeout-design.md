# 首个普通房屋饥荒闸门与 Session 超时规避设计

## 背景

速刷超转生路径在首个普通房屋前会受到游戏原版 `food: -1` 安全检查影响。当前智能规划器只有在首房已经进入建造候选列表时才执行首农场资源兜底；如果首房先被判为阻塞，木材/食物不会被补齐，流程会永久停在首房。

同时，项目协作过程中存在长时间无反馈导致 session 出现 `Reconnecting...` 和 `Request timed out` 的风险，需要将规避方式固化为项目约束。

## 目标

- 在 `moonlightNight` 与 `fastNgPlus` 路径下，首个 `common_house` 不再依赖普通的负食物产出安全阀；只有木材严格大于 24、食物严格大于首房黄金成本所需的安全储备（基础为 57.5）时才放行。
- 首房资源准备逻辑不依赖首房按钮已先进入候选列表；发现首房和首农场仍未完成时，应优先补齐资源，然后让首房进入建造流程。
- 保留普通房屋建成后的食物安全规则：后续房屋仍由农场存在等条件约束，不改变非智能模式。
- 将 session 操作拆成短步骤：长操作前先反馈，单次命令控制在可观察时长内，长任务分段执行并持续汇报，避免无反馈触发重连。

## 设计

### 首房安全闸门

在现有 `getFoodSecurityBlockReason` 中增加首房分支。仅当目标启用且 `common_house` 当前数量为 0 时，读取 `wood` 与 `food` 当前值；资源值必须满足 `wood.current > 24` 且 `food.current > firstHouseFoodReserve`。首房食物储备继续由 `10 / getFirstHouseGoldSpeed() * 1.15` 得出，基础黄金产速 0.2 时为 57.5。

首房未满足阈值时返回可解释的 `first-house-materials` 阻塞原因；满足阈值时返回 `null`，使路径输出将其加入建造候选。资源不足时，`secureFirstFarmMaterials` 负责点击食物和木材按钮补齐。

为避免重复实现，首房储备计算和资源读取放在智能建造执行侧可复用的辅助函数中；规划器侧只消费当前资源阈值结果。若当前页面无法读取资源，保持阻塞，不冒险触发会导致饥荒的首房建造。

### Session 操作约束

在项目 `AGENTS.md` 的本地工作流中新增明确规则：

1. 每个 session 开始先发送简短状态/下一步反馈，再执行检查或修改。
2. 单个命令优先控制在 30 秒内；可能耗时的构建、测试、搜索拆成独立命令。
3. 任何可能超过 30 秒的任务先说明，并在 60 秒内至少发送一次进度更新。
4. 不使用无界等待；遇到超时先保留当前结果，改用更小范围的命令继续。

## 影响范围

- 修改 `automation-src/fragments/smart-build-planner/10-game-state-adapter.js`：提供首房阈值判断与阻塞原因。
- 修改 `automation-src/fragments/smart-build-planner/30-path-engine.js`：首房路径解析消费新的首房闸门。
- 修改 `automation-src/fragments/smart-build-planner/40-path-output.js`：确保首房资源准备在按钮筛选前触发，并保留后续房屋安全门。
- 修改 `AGENTS.md`：加入 session 超时规避约束。
- 修改/新增 `tools/test-food-security-gate.js`：覆盖资源不足阻塞和阈值满足放行。

## 验证

- Node 测试覆盖基础 57.5 储备、木材/食物任一不足时阻塞、两个阈值严格满足时放行，以及首房之后仍要求农场。
- 执行 `automation-src/build.ps1` 合并源片段。
- 执行 `node --check Theresmore-Automation_4.14.4_smart-build-planner.user.js`。
