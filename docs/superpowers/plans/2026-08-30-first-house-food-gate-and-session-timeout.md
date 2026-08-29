# 首个普通房屋饥荒闸门与 Session 超时规避 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复速刷路径首个普通房屋的资源安全闸门，并把 session 超时规避固化为项目约束。

**Architecture:** 首房判断由 planner 统一计算，使用动态黄金产速得到食物储备阈值，并与木材阈值共同决定路径节点是否阻塞。Build 执行入口在首房候选筛选前执行一次资源兜底；已有房屋继续使用农场安全规则。项目级 AGENTS.md 负责约束长任务的反馈和分段执行。

**Tech Stack:** JavaScript userscript fragments, Node.js syntax/tests, PowerShell merge script.

---

### Task 1: 扩展首房资源安全判定

**Files:**
- Modify: `automation-src/fragments/smart-build-planner/10-game-state-adapter.js`
- Modify: `automation-src/fragments/smart-build-planner/30-path-engine.js`
- Test: `tools/test-food-security-gate.js`

- [ ] **Step 1: 为测试 fixture 增加首房资源场景**

在现有测试中加入首房数量为 0 的场景，分别断言 `{ wood: 24, food: 57.5 }` 阻塞、`{ wood: 25, food: 58 }` 放行，并验证首房数量达到 1 后仍检查农场。

- [ ] **Step 2: 运行测试确认新断言失败**

运行：`node tools/test-food-security-gate.js`

预期：新增首房阈值断言失败，因为当前 adapter 没有首房资源闸门。

- [ ] **Step 3: 实现首房阈值辅助函数和路径闸门**

在 adapter 中新增固定首农场木材阈值 `24`、首房黄金成本 `10`、安全余量 `1.15`，用基础黄金速率和现有运行时 modifier 计算食物阈值；新增首房阻塞判断，要求资源当前值严格大于两个阈值。`30-path-engine.js` 继续通过 `getFoodSecurityBlockReason` 消费结果。

- [ ] **Step 4: 运行测试确认通过**

运行：`node tools/test-food-security-gate.js`

预期：全部通过，并确认非 `moonlightNight`/`fastNgPlus` 目标不受首房闸门影响。

### Task 2: 调整 Build 首房资源准备顺序

**Files:**
- Modify: `automation-src/fragments/smart-build-planner/40-path-output.js`

- [ ] **Step 1: 将首房/首农场资源兜底移到按钮候选依赖之外**

在 `executeAction` 开始处基于当前建筑数量判断首房和首农场，不要求 `getAllButtons()` 已包含首房按钮；仅在智能目标、首房与首农场均未完成、且无自然的赠礼时调用 `secureFirstFarmMaterials()`。

- [ ] **Step 2: 保持资源点击和日志行为**

继续按 `wood`、`food` 顺序补齐，保留现有 10ms 点击间隔和异常日志；资源不可读或按钮不存在时跳过该资源，不抛出中断整个 Build 循环。

- [ ] **Step 3: 运行 Node 语法检查**

运行：`node --check automation-src/fragments/smart-build-planner/40-path-output.js`

预期：命令成功退出。

### Task 3: 固化 Session 超时规避约束

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: 添加可执行的 session 反馈规则**

在 Local Codex Workflow 下加入：session 开始先反馈；命令优先控制在 30 秒内；长任务拆分；60 秒内更新；禁止无界等待并在超时后缩小范围继续。

- [ ] **Step 2: 检查约束文档无冲突**

运行：`Get-Content -Raw AGENTS.md`

预期：新规则与现有中文沟通、PowerShell 兜底和输出行数限制一致。

### Task 4: 合并并验证交付物

**Files:**
- Modify: `Theresmore-Automation_4.14.4_smart-build-planner.user.js` (generated)

- [ ] **Step 1: 执行片段合并**

运行：`powershell -ExecutionPolicy Bypass -File D:\Zarek\Theresmore\automation-src\build.ps1`

- [ ] **Step 2: 校验生成 userscript 语法**

运行：`node --check D:\Zarek\Theresmore\Theresmore-Automation_4.14.4_smart-build-planner.user.js`

预期：命令成功退出。

- [ ] **Step 3: 查看变更并提交**

运行：`git diff --check; git status --short`

预期：无空白错误；变更只包含本任务源文件、约束、测试、设计/计划和生成脚本。
