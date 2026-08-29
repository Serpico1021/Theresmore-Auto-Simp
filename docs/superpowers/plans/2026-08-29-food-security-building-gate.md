# 防止饥荒建造闸门 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 moonlightNight 与 fastNgPlus 目标下，common_house 建成 1 个后必须已有 1 个 Farm 且实际分配至少 1 名 Farmer 才能继续建造。

**Architecture:** 在 Smart Build planner 的运行时适配层读取建筑数量与实际岗位人数，在路径引擎解析 common_house 时生成 food-security 阻塞状态。getTargets 使用阻塞节点的 0 目标抑制建造，path snapshot 保留阻塞原因；不修改 base 模板和手动建造逻辑。

**Tech Stack:** JavaScript userscript fragments, PowerShell build script, Node syntax check.

---

### Task 1: 增加运行时岗位读取和防饥荒判定

**Files:**
- Modify: `automation-src/fragments/smart-build-planner/10-game-state-adapter.js`
- Modify: `automation-src/fragments/smart-build-planner/30-path-engine.js`

- [ ] **Step 1: 增加目标开关与 Farmer 实际人数读取**

在 `10-game-state-adapter.js` 中保留现有 `getCount`，新增：
- `isFoodSecurityGateEnabled(options)`：仅当 `options.goal` 是 `moonlightNight` 或 `fastNgPlus` 时为真；
- `getAssignedJobCount(jobId)`：从 `reactUtil.getGameData()` 的运行时岗位/人口集合中读取岗位当前人数，兼容按 id/key 建索引和数组项两种表示；任何缺失或无效值返回 0；
- `hasAssignedFarmer()`：调用 `getAssignedJobCount('farmer') >= 1`。

- [ ] **Step 2: 在路径引擎中加入 common_house 闸门**

在 `30-path-engine.js` 的 `resolveBuilding` 中，在常规 structural/resource 解析前加入 food-security 检查：
- count 为 0 时不拦截；
- count >= 1 且 farm < 1 时返回 blocked `{ type: 'food-security', resourceId: 'farm' }`；
- farm >= 1 但 Farmer 实际人数 < 1 时返回 blocked `{ type: 'food-security', resourceId: 'farmer' }`；
- 条件满足后继续原有解析。
确保 blocked 节点的 targetValue 保留原目标值，使 snapshot 可解释；getTargets 会把 blocked 节点输出为 0。

### Task 2: 为判定逻辑增加可执行测试/静态验证

**Files:**
- Create: `tools/test-food-security-gate.js`

- [ ] **Step 1: 创建最小隔离测试**

用 Node 的 `vm` 加载两个 planner 片段及数据表，注入最小化的 `buildings`、`tech`、`resources`、`reactUtil`、`state` 环境，验证：
- 两个目标首房不阻塞；
- 1 房 0 Farm 阻塞 farm；
- 1 房 1 Farm 0 Farmer 阻塞 farmer；
- 1 房 1 Farm 1 Farmer 不因闸门阻塞；
- progress 不阻塞；
- 缺失岗位状态按 0 处理。

### Task 3: 构建并验证生成用户脚本

**Files:**
- Modify: `Theresmore-Automation_4.14.4_smart-build-planner.user.js` (generated output)

- [ ] **Step 1: 运行项目规定的合并脚本**

`powershell -ExecutionPolicy Bypass -File C:\Users\240076\Desktop\Code\2026\CODEX\THERESMORE\automation-src\build.ps1`

- [ ] **Step 2: 校验生成脚本语法**

`node --check C:\Users\240076\Desktop\Code\2026\CODEX\THERESMORE\Theresmore-Automation_4.14.4_smart-build-planner.user.js`

- [ ] **Step 3: 运行隔离测试并检查 diff**

`node tools/test-food-security-gate.js`
`git diff --check`

