# 目标驱动路径引擎（取代打分系统）+ 优先级/上限面板可视化重构 —— 设计 spec

日期：2026-08-28

## 背景

现有 `smartBuildPlanner`（`automation-src/fragments/smart-build-planner/`）用打分驱动的方式决定
"造不造/研究不研究、给多高优先级"：`scoreBuilding`/`scoreResearch` 及一大批 `*Bonus` 函数每次
`mainLoop`（每秒一次）调用 `getTargets`/`getResearchTargets` 时都会对全部建筑/科技重新跑一遍打分
循环，属于纯函数、无缓存的重复全量计算，是网页脚本卡顿的主要来源。

用户明确了新方向：
1. **计算时机改为事件驱动**——只在"转生/超转生/继承状态"（已选传承列表、各资源因转生/超转生获得的
   产出速度与仓储上限加成）发生变化时才重新计算一次完整路径，其余时间复用缓存结果。
2. **算法从打分改为最短路径**——判定标准只有两类硬门槛：结构性前置（建筑/科技/信仰/传承解锁）
   +资源可获得性（仓储上限够装、且净产出速度为正），暂不考虑资源产出效率/速度优化。效率是下一
   阶段的问题，本阶段目标是"跑通"。
3. **手动优先级/上限表单重构为可视化面板**，用 `frontend-design` 技能设计，只读展示路径+支持单点
   强制覆盖，并可导出数据用于反馈给 Claude 驱动后续脚本迭代。

## 目标

- 用一套确定性的依赖图路径算法取代 moonlightNight 目标下的打分系统，解决"每秒全量重算"的性能
  问题和"分数量纲混乱、经验数字难维护"的设计问题。
- 提供一个可视化面板，展示计算出的路径、每个节点的完成状态，并支持手动强制覆盖单个节点的目标
  数量，同时可导出结构化数据供后续人工调优反馈。

## 非目标（本轮明确不做）

- **不覆盖其余 4 个 goal**（`progress`/`druid`/`gloriousRetirement`/`annihilator`）——这些 goal
  依赖的旧打分体系本轮**整体删除**，这几个 goal 的自动化本轮会暂时失效，后续按需逐个用同一套图算法
  重建，不是本次范围。
- **不覆盖 Army/Explore/Prayer 自动化**——moonlightNight 目标本身不需要外交/军队/魔法参与，
  `50-unit-scoring.js`/`70-explore-scoring.js`/`80-prayer-scoring.js` 本轮直接删除，对应导出函数
  改为固定返回 `null`（退回手动配置语义）。
- **不做资源产出效率优化**——"该建哪个产出建筑效率最高""该造多少个才是最优解"不在本轮范围，
  资源可获得性判定只看"能不能凑够"，不看"多快凑够/性价比"。
- **不做真正的危险战斗闸门**——moonlightNight 的终点科技 `moonlight_night` 本身是"危险科技"，但
  是自触发型（不需要打赢战斗），且路径引擎不会给任何需要打仗的危险科技非零优先级，因此不需要
  `canWinBattle` 模拟机制。但 base 模板有硬编码的函数调用契约（见下），需要保留两个极简桩函数。
- **不改动 base 模板的调用点**（47935 行等）——本轮改动全部在 `automation-src/fragments/` 层，
  base 模板的 `smartBuildPlanner.xxx(...)` 调用点不变，靠新导出对象满足相同的函数签名契约。

## 设计

### 1. 重算触发：指纹缓存

`mainLoop` 调用频率不变（仍是每秒一次进入 `getTargets`/`getResearchTargets`），但函数内部改为
指纹缓存模式：

```js
const getPathFingerprint = () => {
  const legacyIds = legacies.filter(l => isUnlockCompleted('legacy', l.id)).map(l => l.id).sort();
  const resourceSignature = smartBuildResources.map(id => {
    const res = resourceMap[id];
    return res ? `${id}:${res.speed}:${res.max}` : `${id}:-`;
  });
  return [...legacyIds, ...resourceSignature].join('|');
};

let cachedFingerprint = null;
let cachedPath = null;

const getPath = (goal, resourceMap, options) => {
  const fingerprint = getPathFingerprint();
  if (fingerprint === cachedFingerprint && cachedPath) return cachedPath;
  cachedFingerprint = fingerprint;
  cachedPath = computeShortestPath(goal, resourceMap, options);
  return cachedPath;
};
```

- 指纹只依赖"已完成传承列表"+"各资源当前 speed/max"，不依赖建筑/科技完成状态本身——因为
  建筑/科技完成状态变化必然伴随 speed/max 或前置解锁状态变化（前置解锁属于结构门槛，见下），
  该变化会被下一次指纹比对捕获，不需要单独监听。
- 已完成传承列表读取复用现有 `isUnlockCompleted('legacy', id)`（`10-game-state-adapter.js`），
  遍历对象来自 base 模板已有的全局 `legacies` 数组（第 19392 行起）。
- `computeShortestPath` 本身较贵（要做依赖图遍历），但只在指纹变化时执行；指纹比对本身是纯
  字符串拼接+比较，代价可以忽略，从根本上消除"每秒全量重算"的卡顿来源。

### 2. 路径算法：依赖图 + 硬门槛，取代打分

**终点集合**：`smartBuildGoals.moonlightNight.targetTechs` 并集 + 展开
`smartBuildGoals.moonlightNight.buildingFocus` 的硬性前置链。展开逻辑复用现有
`getExpandedGoalFocusTargets`/`expandPrerequisiteTargets`（`20-goal-routes.js`），不重新实现。

**回溯展开依赖图**：从终点集合出发，对每个未达标节点检查两类硬门槛，未通过的门槛对应的前置
本身也成为图里的一个节点（继续递归展开），直到所有叶子节点要么已满足、要么是"当前无解"（记录
阻塞原因，供面板展示）：

- **结构门槛**（`req.type !== 'resource'` 的项）：复用现有 `isBuildingUnlocked`（建筑类前置，
  检查 `getCount(prereq) >= req.value`）/`isUnlockCompleted`（tech/prayer/legacy 类前置）。
  不满足则把该前置节点（连同它自己的门槛）递归拉入图中。
- **资源可获得性门槛**（`req.type === 'resource'` 的项）：
  `resourceMap[req.id].max >= cost && resourceMap[req.id].speed > 0`
  （不接受"当前存量已经够但 speed<=0"作为例外——按用户明确要求，两个条件都要满足）。
  不满足时按卡住原因分两种处理：
  - `max < cost`（仓储上限不够）：本轮不单独处理仓储扩容路径（属于效率范畴，标记为"阻塞：仓储
    上限不足"，展示给用户，暂不自动派生解决节点）。
  - `speed <= 0`（产出跟不上）：反查该资源的"直接产出型"建筑（`gen.type==='resource' &&
    value>0`，复用 `applyProductionBridgeTargets` 已验证过的反查方式），把该建筑作为前置节点
    拉入图中，目标数量 = 当前数量 + 1。由于指纹里已包含每项资源的 `speed`，产出建筑造好、
    speed 转正后下一次指纹比对必然变化，会触发重新计算，逐步逼近可行解，不需要一次性精确
    预测产能。
  - **已知覆盖盲区**：岗位坑位型产出建筑（如 `carpenter_workshop`/`artisan_workshop`，产出来自
    游戏引擎岗位表的百分比加成，没有 `gen.type==='resource'` 字段，本项目拿不到基础产出数值）
    无法被上述反查逻辑自动识别，继续沿用现有 `00-data-tables.js` 路线表里手工写死的目标数量
    （例如 `artisan_workshop: 3`）作为兜底数据，不在本轮解决范围。

**层级与优先级**：依赖图回溯完成后，按"距离终点几跳"给每个节点标记层级（layer），层号从 0
（无未满足前置，可以立刻执行）向上递增。**层号直接决定执行优先级，层号越小优先级越高**，同层内
节点之间不再有连续分数区分先后。

**目标数量来源**（取代原来的 `getStageCap`/`scoreBuilding` 衍生的 `max`）：
- 结构性前置：直接用触发展开的那条 `req.value`（游戏规则写死的数字，如
  `municipal_administration` 要求 `common_house>=15`）。
- goal 自身的 `buildingFocus`/路线表条目：用现有路线表里的显式数字（结构性前置链条目沿用
  `expandPrerequisiteTargets` 展开出的 `target`）。
- 资源产出速率桥接节点：当前数量 + 1（渐进式，见上）。

### 3. 危险科技的最小桩函数（安全约束，不可省略）

base 模板第 47935 行研究点击逻辑对每个候选研究项**无条件调用**
`smartBuildPlanner.isDangerousResearchOverridden(research.key)` 和
`smartBuildPlanner.shouldGateDangerousResearch(research.key)`，这是写死在 base 模板里的调用
契约，与本轮改动无关，但如果新导出对象缺失这两个函数会直接抛异常、拖垮**所有** goal（不只
moonlightNight）的 Research 自动化。因此保留这两个函数的极简实现（不恢复战斗模拟机制）：

```js
const isDangerousResearchOverridden = researchKey => researchKey === 'moonlight_night';
const shouldGateDangerousResearch = () => false;
```

`shouldGateDangerousResearch` 恒为 `false` 是安全的，因为新引擎的路径算法只会给
`smartBuildGoals.moonlightNight.targetTechs` 范围内的科技非零优先级，需要打仗才能安全研究的
危险科技（`dragon_assault` 等）不在这个 goal 的目标范围内，不会被路径引擎标记为待执行，因此不会
被点击，不依赖运行时战斗模拟兜底。

`30-dangerous-fight-gate.js` 其余内容（`canWinBattle`、`dangerousFightCache`、
`getBlockedDangerousFights`、`getNextDangerousFight`）整体删除，上面两个桩函数迁移到新的路径
引擎文件里（具体文件拆分在实现计划阶段确定）。

### 4. 对外接口不变，内部实现整体替换

`getTargets(subpage, configured)`/`getResearchTargets(configured)` 对外签名和返回值形状保持
不变（`{id: {prio, max}}` 与扁平 `{id: priority}`，具体沿用现有形状），供 base 模板执行循环
无缝消费。内部实现：

1. 查指纹缓存，缓存命中直接用缓存路径；未命中重新跑 `computeShortestPath`。
2. 把路径结果映射成 `{id: {prio: layerToPrio(layer), max: targetCount}}`。
3. **对所有不在路径里的建筑/研究项显式写低优先级（0 或等效的"不点击"值），不是省略字段**——
   这是安全要求：如果只省略字段，base 模板可能回退读取用户手动面板里的历史遗留数值，导致意外
   点击不在当前路径里的东西（例如某个危险科技或者已废弃目标的残留手动配置）。必须显式覆盖。
4. `manualOverrides`（用户开手动模式）语义不变：完全跳过路径引擎，走用户手填的原始配置。
5. 新增"单节点强制覆盖"入口（供第 6 节的面板使用），数据结构类似
   `{ forcedTargets: { [buildingId]: number } }`，优先级高于路径引擎算出的目标数量，但仍然
   受 `manualOverrides` 总开关约束（`manualOverrides=true` 时新引擎不跑，强制覆盖也不生效，
   全部读原始手动配置——避免两套覆盖机制同时生效造成混乱）。

### 5. 删除清单

整体删除以下文件（内容整体，不保留任何 fallback 分支）：

- `automation-src/fragments/smart-build-planner/30-dangerous-fight-gate.js`
  （两个桩函数迁移到新文件）
- `automation-src/fragments/smart-build-planner/40-build-scoring.js`
- `automation-src/fragments/smart-build-planner/50-unit-scoring.js`
- `automation-src/fragments/smart-build-planner/60-research-scoring.js`
- `automation-src/fragments/smart-build-planner/70-explore-scoring.js`
- `automation-src/fragments/smart-build-planner/80-prayer-scoring.js`

`90-export.js` 改为：

```js
return {
  getTargets,              // 新路径引擎
  getResearchTargets,      // 新路径引擎
  getUnitTargets: () => null,
  getExploreTargets: () => null,
  getPrayerTargets: () => null,
  isDangerousResearchOverridden,
  shouldGateDangerousResearch,
};
```

`00-data-tables.js` 精简为只保留 `moonlightNight` 需要的数据（`smartBuildGoals.moonlightNight`、
`smartBuildRoutes.moonlightNight`、`smartBuildResources`、`smartBuildDefaults` 等），其余 4 个
goal 的数据表条目一并删除（不保留死数据）。具体文件拆分粒度（是否需要新增
`20-path-engine.js`/`30-hard-gates.js` 等）留到实现计划阶段决定，遵循现有"每个文件职责单一、
列宽 0"的约定。

### 6. 优先级/上限面板可视化重构（frontend-design）

- **数据模型**：只读展示计算出的路径，按层级分组，每个节点展示：
  - 状态：已达标 / 排队中 / 被资源可获得性卡住（附具体资源+原因）/ 被结构前置锁住（附具体
    前置条件）
  - 当前数量 / 目标数量
  - 强制覆盖开关（勾选后可填自定义目标数量，写入 `forcedTargets`）
- **不再有"优先级 0-10"数值输入**——层级由算法算出，用户不能直接调层级，只能强制覆盖目标数量
  或者（后续需要的话）强制把某个节点排除在路径外。
- **导出功能**：导出 JSON，包含：
  1. 完整路径快照（每个节点的 id/层级/目标数量/当前数量/状态/阻塞原因）
  2. 用户当前打开的强制覆盖记录（`forcedTargets`）
  3. 用户手填的一段调整原因说明文本
  用于用户微调后反馈给 Claude，驱动后续路径算法/数据表迭代。
- 视觉设计（信息密度、层级展示方式、强制覆盖交互细节）在实现计划阶段用 `frontend-design`
  技能单独过一轮，本 spec 只锁定数据模型和交互范围，不锁定具体视觉稿。

## 影响文件

- 删除：见"删除清单"。
- 新增：路径引擎相关文件（`automation-src/fragments/smart-build-planner/` 下，具体命名/拆分在
  实现计划阶段定），面板 UI 模板改动（`automation-src/fragments/smart-build-panel.template.html`
  或新建面板模板文件）。
- 修改：`00-data-tables.js`（精简为 moonlightNight-only）、`90-export.js`（导出列表变更）、
  `10-game-state-adapter.js`（如需要补充读取 `legacies` 列表的辅助函数）。
- 不涉及 `automation-src/base/*.base.user.js` 改动。
- 完成后：`automation-src/build.ps1` 重新构建 → `node --check` 校验 → `codemap regen --repo
  theresmore` → 同步更新 `.codemap-conventions.md`（本次是架构级重写，需要较大篇幅更新约定
  文件，替换掉大部分关于旧打分体系的记录）。

## 测试/验证方式

本项目没有自动化测试，构建 + 语法检查后交由用户实机验证：

1. moonlightNight 目标下，路径引擎是否能算出从当前存档状态到 `moonlight_night` 科技的完整
   依赖链，且面板上展示的层级/状态与实际游戏状态一致。
2. 指纹缓存是否真的减少了重复计算——可通过临时的调试日志（验证完删除）确认
   `computeShortestPath` 的调用频率明显低于每秒一次。
3. 资源产出速率卡住时，是否会自动把对应产出建筑纳入路径并逐步递增目标数量。
4. `moonlight_night` 研究是否能被正常点击（验证 `isDangerousResearchOverridden` 桩函数生效），
   且其余真正危险的战斗类科技（如 `dragon_assault`）在 moonlightNight 目标下始终不会被赋予
   非零优先级。
5. 面板强制覆盖功能：手动勾选覆盖某个节点目标数量后，实际执行是否遵循覆盖值；导出 JSON 结构
   是否完整可读。
6. 确认 `progress`/`druid`/`gloriousRetirement`/`annihilator`/Army/Explore/Prayer 相关 UI
   在选择这些模式时不会因为底层函数缺失而报错（应表现为"不生效"而不是"崩溃"）。

## 开放问题（留待后续）

- 仓储上限不足（`max < cost`）目前只标记阻塞、不自动派生扩容路径，用户实机验证后如果这是
  常见卡点，需要单独设计"仓储扩容子路径"。
- 岗位坑位型产出建筑仍依赖手工数据兜底，是否有办法从游戏源码里拿到岗位基础产出速率、从而
  纳入自动反查，留待后续单独调研。
- 其余 4 个 goal 何时用同一套图算法重建，由用户后续决定优先级顺序。
