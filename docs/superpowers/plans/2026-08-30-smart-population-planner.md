# Smart Population Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将人口配置改造成目标驱动的智能规划器，支持月明/速刷超转生路线、资源安全阈值、新工种触发和既有手工配置兼容。

**Architecture:** 新增独立的 `SmartPopulationPlanner` fragment，负责读取游戏状态、计算工种目标、比较人口快照并提供执行计划；基础脚本的人口任务只负责页面导航与按钮执行。智能模式关闭时继续使用原人口配置，建筑/研究最低目标继续由已有 smart-build planner 负责。

**Tech Stack:** 原生 JavaScript userscript、PowerShell fragment merge、Node `--check`；测试使用可抽取的纯函数 fixture 与 Node 脚本，不引入新依赖。

---

## 文件结构与职责

- Create: `automation-src/fragments/smart-build-population-planner.js` — 智能人口数据表、状态适配、阈值规划、快照触发和公开接口。
- Modify: `automation-src/fragments/smart-build-options.js` — 增加智能人口开关和路线桩配置默认值。
- Modify: `automation-src/fragments/smart-build-planner/00-data-tables.js` — 增加 `fastNgPlus` 的实际月明路线语义和 `titanThenFastNgPlus` 的空扩展桩；加入工人之家/市政厅最低建筑目标与纪念碑研究策略所需数据。
- Modify: `automation-src/build.ps1` — 将人口规划 fragment 注入 base，并保持生成顺序在 smart-build planner 定义之后、人口任务可调用之前。
- Modify: `automation-src/base/Theresmore-Automation_4.14.4.base.user.js` — 接入人口规划器；修复人口任务入口、新坑位触发、智能分配执行及普通房屋农民门槛。
- Create: `tools/test-smart-population-planner.js` — 用最小 mock 状态覆盖规划器纯逻辑和触发条件。
- Modify: `README-smart-build-planner.md` — 记录智能人口开关、资源阈值、路线和当前泰坦桩边界。

### Task 1: 建立可测试的规划器数据与纯逻辑

**Files:**
- Create: `automation-src/fragments/smart-build-population-planner.js`
- Create: `tools/test-smart-population-planner.js`

- [ ] **Step 1: 写失败测试 fixture**

在测试脚本中构造 `{ goal, resources, jobs, population, previousSnapshot }`，断言以下公开函数结果：基础阈值为 `food/wood/stone/copper/iron/tools > 1`、`cow/horse > 0`；`building_material/crystal/supplies` 属于高优先级；资源安全时排序为 `carpenter`、`professor`、`supplier`；新工种出现时 `shouldRebalance` 即使 `unassigned === 0` 也为真。

- [ ] **Step 2: 运行失败测试**

Run: `node tools/test-smart-population-planner.js`

Expected: FAIL，因为 `smartPopulationPlanner` 尚未存在或公开函数尚未实现。

- [ ] **Step 3: 实现最小纯逻辑与数据表**

在 fragment 中提供以下稳定接口：

```js
const smartPopulationPlanner = (() => {
  const resourceRules = {
    food: { minimum: 1, priority: 100 },
    wood: { minimum: 1, priority: 90 },
    stone: { minimum: 1, priority: 90 },
    copper: { minimum: 1, priority: 90 },
    iron: { minimum: 1, priority: 90 },
    tools: { minimum: 1, priority: 90 },
    cow: { minimum: 0, priority: 70 },
    horse: { minimum: 0, priority: 70 },
    building_material: { minimum: 1, priority: 120 },
    crystal: { minimum: 1, priority: 120 },
    supplies: { minimum: 1, priority: 120 }
  };
  const getResourceRules = () => ({ ...resourceRules });
  const shouldRebalance = (snapshot, previous) => /* pure comparison */;
  const planJobs = (state) => /* ordered safe job plan */;
  return { getResourceRules, shouldRebalance, planJobs };
})();
```

`planJobs` 必须先处理高优先级资源缺口，再处理基础资源保底，最后在阈值安全时按 `carpenter -> professor -> supplier` 排序；候选分配用预测速率检查，不能将阈值资源降到最低值以下。`fastNgPlus` 使用同一月明策略；`titanThenFastNgPlus` 返回空泰坦动作但保留路线标识。

- [ ] **Step 4: 运行测试确认通过**

Run: `node tools/test-smart-population-planner.js`

Expected: PASS，覆盖资源阈值、路线排序和新工种触发。

- [ ] **Step 5: Commit**

```bash
git add automation-src/fragments/smart-build-population-planner.js tools/test-smart-population-planner.js
git commit -m "feat: add smart population planning core"
```

### Task 2: 接入智能人口配置与触发入口

**Files:**
- Modify: `automation-src/fragments/smart-build-options.js`
- Modify: `automation-src/build.ps1`
- Modify: `automation-src/base/Theresmore-Automation_4.14.4.base.user.js`（人口任务区域约 47600-47900 行）

- [ ] **Step 1: 增加配置默认值和 fragment 注入**

增加 `smartPopulation.enabled` 默认值，以及 `titanThenFastNgPlus` 的开关值；build 脚本读取并替换 `@@SMART_POPULATION_PLANNER@@` marker。fragment 必须在调用它的 base 代码之前定义。

- [ ] **Step 2: 将入口条件改为状态驱动**

在人口任务中新增 `getSmartPopulationState()` 与 `getPopulationSnapshot()`，使用页面工种坑位、当前分配、未分配人数和资源速率生成快照。`Population.enabled` 在智能人口开启时允许以下任一条件触发：新工种/坑位扩容、未分配人口、人口建筑完成后的状态变化、资源速率变化；保留 `popAdjust` 和原手工 `shouldRebalance()` 作为兼容触发。

- [ ] **Step 3: 实现“新工种无空闲人口也触发”**

快照以工种 id 到 `maxAvailable` 的映射为核心；新增 id 或上限增大都视为事件，不要求 `unassigned > 0`。没有空闲人口时只生成待满足目标并记录调试日志，不执行无效点击。

- [ ] **Step 4: 接入执行器并保留手工 fallback**

智能模式下从 `smartPopulationPlanner.planJobs(state)` 获取顺序，复用现有 DOM `button.btn-green` 点击和预测生产安全检查；智能模式关闭或 planner 返回空计划时走原 `getAllJobs()`、手工 max/prio 和原 rebalance 流程。不得把智能目标永久写回 `state.options.pages.population.options`。

- [ ] **Step 5: 修复 21 个未分配人口卡住场景**

不要只依赖导航栏 `span`。人口页内优先读取人口摘要，并对每轮点击后重新读取 DOM；当 `unassigned > 0` 且存在可点击目标时继续循环，按钮失效或页面离开时安全退出并等待下一轮。

- [ ] **Step 6: 运行语法检查**

Run: `powershell -ExecutionPolicy Bypass -File automation-src/build.ps1`; then `node --check Theresmore-Automation_4.14.4_smart-build-planner.user.js`

Expected: build succeeds with no unresolved marker; Node exits 0。

- [ ] **Step 7: Commit**

```bash
git add automation-src/base/Theresmore-Automation_4.14.4.base.user.js automation-src/build.ps1 automation-src/fragments/smart-build-options.js
git commit -m "feat: connect smart population triggers and execution"
```

### Task 3: 修复普通房屋判断并接入路线最低目标

**Files:**
- Modify: `automation-src/base/Theresmore-Automation_4.14.4.base.user.js`（建筑任务约 47370-47500 行）
- Modify: `automation-src/fragments/smart-build-planner/00-data-tables.js`
- Modify: `automation-src/fragments/smart-build-planner/20-goal-routes.js`
- Modify: `automation-src/fragments/smart-build-planner/40-path-output.js`

- [ ] **Step 1: 为最低建筑目标增加失败断言**

扩展 Node 测试 fixture，断言在 `moonlightNight` 和 `fastNgPlus` 下 `house_workers >= 12`、`city_hall >= 2`；泰坦桩只改变路线标识，不产生军队/泰坦动作。

- [ ] **Step 2: 接入最低目标**

将最低目标作为通用目标约束合并到 route/path target 计算；仅当建筑已存在于游戏数据且前置条件可解析时生成目标，未解锁项由现有前置链处理，不绕过资源条件。

- [ ] **Step 3: 接入工人之家与纪念碑研究**

研究目标生成器对 `house_of_workers` 可研究状态返回正优先级；纪念碑研究按已出现在 `tech` 且可研究的项目全部返回正优先级，不以单一纪念碑 id 写死。

- [ ] **Step 4: 移除普通房屋农场可见性门槛**

删除或改写 `shouldBuildMoonlightCommonHouse` 中“看不到农场就限制普通房屋”的分支。普通房屋目标只由智能目标、资源安全和通用建筑条件决定；农民数量仅参与人口资源预测。

- [ ] **Step 5: 运行测试、构建和语法检查**

Run: `node tools/test-smart-population-planner.js`; `powershell -ExecutionPolicy Bypass -File automation-src/build.ps1`; `node --check Theresmore-Automation_4.14.4_smart-build-planner.user.js`

Expected: all assertions pass, build succeeds, generated userscript syntax valid。

- [ ] **Step 6: Commit**

```bash
git add automation-src/base/Theresmore-Automation_4.14.4.base.user.js automation-src/fragments/smart-build-planner
git commit -m "feat: enforce moonlight population and building minimums"
```

### Task 4: 文档、回归检查与交付

**Files:**
- Modify: `README-smart-build-planner.md`
- Test: `tools/test-smart-population-planner.js`

- [ ] **Step 1: 添加文档**

说明智能人口开关、资源阈值、木匠→教授→供应商顺序、无空闲人口的新坑位触发、工人之家 12、市政厅 2、纪念碑研究，以及 `titanThenFastNgPlus` 仅为未实现切换桩。

- [ ] **Step 2: 执行完整回归**

Run: `node tools/test-smart-population-planner.js`; `node --check automation-src/base/Theresmore-Automation_4.14.4.base.user.js`; `powershell -ExecutionPolicy Bypass -File automation-src/build.ps1`; `node --check Theresmore-Automation_4.14.4_smart-build-planner.user.js`; `git diff --check`

Expected: all commands exit 0，且生成文件由 build 产生，不手工编辑。

- [ ] **Step 3: 检查工作区并提交文档**

确认不包含用户已有未跟踪文件，只提交本计划涉及文件。

```bash
git add README-smart-build-planner.md tools/test-smart-population-planner.js
git commit -m "docs: document smart population planner"
```

## 计划自检

- Spec 覆盖：人口规划分层由 Task 1-2 覆盖；资源阈值和路线由 Task 1 覆盖；新坑位与 21 人卡住由 Task 2 覆盖；普通房屋和最低建筑/研究由 Task 3 覆盖；泰坦空桩与手工兼容由 Task 1-2、4 覆盖；构建校验由每个接入任务和 Task 4 覆盖。
- 占位符检查：泰坦路线是产品明确要求的空桩，因此计划中只保留“空动作/路线标识”，没有未定义的实现步骤。
- 接口一致性：`smartPopulationPlanner.getResourceRules`、`shouldRebalance`、`planJobs` 在 Task 1 定义并由 Task 2 调用；配置名统一为 `smartPopulation.enabled`；路线名统一为 `titanThenFastNgPlus`。
