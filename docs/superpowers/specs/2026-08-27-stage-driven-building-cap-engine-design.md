# 阶段驱动的建筑数量自动计算引擎 —— 设计 spec

日期：2026-08-27
范围：`automation-src/fragments/smart-build-planner/` 内 Build 子系统（不涉及 Research/Explore/Army/Prayer）

## 背景与问题

用户反馈：选择 `moonlightNight`（月明之夜）goal 时，规划器不按目标规划建筑数量——`common_house`
（普通房屋）在 10 个处停下，同时 `farm`/`lumberjack_camp`/`quarry` 等生产类建筑被造得远超需要。
排查确认是两个独立根因叠加：

1. **`common_house` 卡在 10**：`automation-src/base/Theresmore-Automation_4.14.4.base.user.js`
   约 47434-47438 行有一段**原版脚本自带、非本项目引入**的硬编码安全阀：

   ```js
   } else if (!button.building.isSafe && button.building.requires.length) {
     shouldBuild = !button.building.requires.find(req => !resources.get(req.resource) || resources.get(req.resource)[req.parameter] <= req.minValue);
     if (button.building.key === 'common_house' && (!button.count || button.count < 10)) {
       shouldBuild = true;
     }
   }
   ```

   `common_house` 的 `gen` 里有 `food: -1`（负产出），使其 `isSafe=false`、
   `requires=[{resource:'food', parameter:'speed', minValue:1}]`。含义：**前 10 个房屋无条件放行，
   超过 10 个后必须食物净速率 > 1 才允许继续**。而 `smartBuildRoutes.moonlightNight` 里
   `farm` 的目标只写了 5、priority 只有 5（`00-data-tables.js` 约行 135），远不足以撑住房屋
   涨到 15 个所需的食物盈余，一旦食物速率跟不上，房屋建造就在 10 处被这道硬阀门挡死，跟路线表里
   写的 `target:15` 完全无关。本次修复**不改动**这段 base 模板逻辑（未获用户就永久业务逻辑单独
   确认前不能碰），而是通过让规划器自动把食物产出建筑的数量配平到位，使净速率能自然维持在阈值以上。

2. **生产类建筑无限乱建**：`smartBuildRoutes.moonlightNight` 只显式覆盖了
   `common_house`/`quarry`/`artisan_workshop`/`watchman_outpost`（`buildingTargets`）和
   `guild_of_craftsmen`/`university`/`farm`/`carpenter_workshop`/`grocery`/`stable`
   （`supportTargets`）。像 `lumberjack_camp`/`sawmill`（真实建筑 id，已用 Grep 核实，
   `main.js:1048`/`1100`）完全没进这张表。`40-build-scoring.js` 里
   `getTargets` 通用打分循环对没有路线/`buildingFocus` 目标的建筑，`getPlannedTarget` 返回
   `null`，`Math.min` 链对应项退化成 `Infinity`（`40-build-scoring.js:344`），实际只剩
   `options.maxTarget`（默认 80）和 `getProductionStorageCap`（仓储填满时间阈值，早期资源
   宽裕时经常触发不了）兜底，等于事实上不封顶。

**根本原因**：`smartBuildRoutes`/`smartBuildGoals.buildingFocus` 依赖人工为每个 goal 逐个手写
建筑数量，覆盖面天然不完整，且数字本身缺乏依据（为什么房屋是 15、farm 是 5，没有可解释的计算
基础）。这与项目 `CLAUDE.md` 的既定方向（"尽可能智能化，减少用户手动配置"）相悖，也是这类
bug 会反复出现的结构性原因。

## 目标

1. 用一套**自动计算**的公式替代 `smartBuildRoutes[goal].buildingTargets/supportTargets` 里
   人工手写的 `target:N` 数字，同时**统一覆盖**当前完全没有路线/`buildingFocus` 目标、退化成
   `maxTarget=80` 的"漏网"建筑（如 `lumberjack_camp`/`sawmill`）——不再需要为每个新发现的
   遗漏建筑手工补路线表条目。
2. 计算依据只用**已解锁科技/建筑前置链**这一类信号（游戏本身已有的 `age`/`cap` 字段 +
   现有的 `isBuildingUnlocked` 判断），不引入人口/资源产出规模一类需要额外标定的信号。
3. 让规划器自动配平食物等基础资源产出，减少 `common_house` 之类因食物跟不上而被 base 模板
   安全阀卡死的情况（间接修复，不改动 base 模板本身）。
4. 不改动 `manualOverrides` UI 和逻辑，继续作为兜底 fallback。

## 非目标

- 不改动 base 模板里 `common_house < 10` 的硬编码安全阀（原版脚本自带逻辑，需要单独确认才能碰）。
- 不改动 `smartBuildGoals[goal].buildingFocus` 展开出的**结构性前置数量**（如
  `refugee_district_part` 的 `target:8`，来自 `req.value`，是游戏规则本身要求的组件数量，
  不是"该造多少个"的规划问题）——`getExpandedGoalFocusTargets`/`expandPrerequisiteTargets`
  逻辑不变。
- 不改动 `getProductionStorageCap`（仓储填满时间阈值）、`applyCapBridgeTargets`/
  `applyDangerousBattleBuildingTargets`/`applyTitanOverrides`（存储缺口桥接/危险战斗备战/
  泰坦覆盖）——它们解决的是不同维度的问题，继续按 `Math.max` 强制覆盖的规则独立叠加。
- 不做本轮的 base 模板"建筑优先级/上限"手动面板 UI 重做（已与用户约定拆成下一轮单独的
  brainstorming + spec）。

## 设计

### 核心信号：S（当前阶段）/ T（建筑自身世代）/ gap

已用 Grep 核实游戏数据本身自带的两个字段完全够用，不需要新建里程碑科技表或做科技树遍历：

- 每个建筑都有 `age` 字段（小整数：1/2/3/4/5/13，或哨兵值 100），例如
  `common_house.age=1`、`quarry.age=1`、`sawmill.age=100`。
- 部分建筑（尤其奇观类）有显式 `cap` 字段（如 `city_center: {cap:1, age:1}`），是游戏自带的
  硬性数量上限。

计算规则：

- **S（当前阶段）**：`10-game-state-adapter.js` 新增 `getCurrentStageIndex()`——遍历全部
  `buildings`（不限当前 tab/子页面，这是游戏整体进度，不是分页概念），筛出
  `isBuildingUnlocked(building)` 为真且 `building.age !== 100` 的建筑，取其中 `age` 的最大值；
  没有任何建筑解锁时默认 `S=1`。每次 `getTargets()` 调用时重新计算一次（全量扫描一次全部建筑，
  开销可忽略，不引入缓存）。
- **T（建筑自身世代）**：`T = building.age === 100 ? S : building.age`——`age:100` 视为
  "不在正常世代阶梯上"（不强行套用线性阶梯，避免误判），固定当作跟当前阶段持平。
- **gap = S − T**：gap ≤ 0 表示该建筑跟当前阶段持平或更前沿；gap > 0 表示阶段已经甩开它
  `gap` 个世代。

### 上限公式：几何衰减

`40-build-scoring.js` 新增 `getStageCap(building, options)`：

```js
const STAGE_DECAY_FLOOR = 4;
const getStageCap = (building, options) => {
  const cap = building.cap || Number(options.maxTarget) || smartBuildDefaults.maxTarget;
  const stage = getCurrentStageIndex();
  const tier = building.age === 100 ? stage : building.age;
  const gap = stage - tier;
  if (gap <= 0) return cap;
  return Math.max(STAGE_DECAY_FLOOR, Math.round(cap / Math.pow(2, gap)));
};
```

- `cap`（`building.cap || options.maxTarget`）始终是最终的硬性上限来源，`getStageCap` 只会
  在此基础上按 gap 收紧，不会放大。这一点顺带正确处理了奇观类单体建筑：`city_center` 这类
  `cap:1` 的建筑，不管 gap 怎么算，`Math.min(cap=1, ...)` 里 cap 永远是最紧的一项，不需要
  单独区分"单体 vs 可堆叠建筑"。
- 每多 1 个世代差距，上限对半衰减，`STAGE_DECAY_FLOOR=4` 兜底，不会收紧到 0——旧建筑仍保留
  一点建造空间，不产生"已经造好的还要眼睁睁看着不让加"的观感。
- 已用 Grep 核实：游戏本身对基础资源类建筑设计了后续升级链（`farm→granary/lucky_grove_b`、
  `lumberjack_camp→sawmill`、`quarry→stonemason→mine→titan_work_area`），所以"旧的按 gap
  收紧、新的因为 `age` 更接近当前阶段而获得更大上限"这一套公式对资源类建筑同样成立，不需要
  为它们单独开例外或引入人口/产出比例信号。

### 接入方式：替换而非叠加

`getTargets`（`40-build-scoring.js`）现有 `Math.min` 链：

```js
const max = Math.min(
  cap,
  Number(options.maxTarget) || smartBuildDefaults.maxTarget,
  count + Math.min(Number(options.maxExtra) || smartBuildDefaults.maxExtra, toExtra(score)),
  getProductionStorageCap(building, resourceMap, options),
  plannedTarget !== null ? plannedTarget * GENERAL_SCORE_PLAN_CAP_MULTIPLIER : Infinity  // 删除
);
```

改为：

```js
const max = Math.min(
  cap,
  Number(options.maxTarget) || smartBuildDefaults.maxTarget,
  count + Math.min(Number(options.maxExtra) || smartBuildDefaults.maxExtra, toExtra(score)),
  getProductionStorageCap(building, resourceMap, options),
  getStageCap(building, options)
);
```

`getPlannedTarget`、`GENERAL_SCORE_PLAN_CAP_MULTIPLIER` 整体删除（死代码，被 `getStageCap`
取代，不保留兼容层）——这两者是上一轮为缓解同一类问题引入的临时性补丁，本次有了更根本的机制后
不再需要。

**这条 `max` 计算对通用打分循环里的所有建筑统一生效，不区分是否在路线表/`buildingFocus`
里**——这正是"统一覆盖漏网建筑"的关键：`lumberjack_camp`/`sawmill` 不需要再手工加进任何路线
表，会自动获得基于自身 `age` 和当前 `S` 算出的合理上限。

### `smartBuildRoutes` 数据表精简

`00-data-tables.js` 里 `smartBuildRoutes[goal].buildingTargets/supportTargets` 的每个条目
删除 `target` 字段，只保留 `id`/`priority`/`reason`（定性数据：这个 goal 需要哪些建筑、
多紧急，不再规定具体数量）。例如：

```js
// 之前
{ id: 'common_house', target: 15, priority: 9, reason: 'moonlight whitelist: 15 common houses' }
// 之后
{ id: 'common_house', priority: 9, reason: 'moonlight whitelist' }
```

`applyRouteTargets`（`40-build-scoring.js`）相应简化：不再计算/写入独立的 `routeMax`，只做
**优先级强制**——路线里列出的建筑，`prio` 至少提到 `routeEntry.priority`；具体 `max` 完全交给
通用循环的 `getStageCap` 结果（该建筑已经在通用循环里算过一次 `max` 并写入 `targets`，
`applyRouteTargets` 只 `Math.max` 提升 `prio_${id}`，不再触碰 `targets[id]` 本身）。

需要处理一个边界情况：通用循环里 `if (!prio) return;` 会在打分侧 `toPriority(score)` 判 0 分
时提前跳过，导致该建筑完全不会进入 `targets`（连 `max` 都不会被算出来）。修复：在 `getTargets`
循环开始前，用 `const routeTargetIds = new Set(getExpandedRouteTargets(route).map(entry => entry.id));`
提前算好一次（避免每个建筑都重新展开路线），循环条件改为
`if (!prio && !routeTargetIds.has(building.id)) return;`——路线里显式列出的建筑即使打分侧判
0 分也继续走 `max` 计算，最终优先级由 `applyRouteTargets` 兜底写入。

`smartBuildGoals[goal].buildingFocus` 数组本身不受影响（它一直只是 id 字符串列表，没有数字
字段）；`getExpandedGoalFocusTargets`/`expandPrerequisiteTargets` 展开出的结构性前置数量
（如 `refugee_district_part` 的 `target:8`）也不受影响，那是 `req.value` 决定的游戏规则
硬性数量，不是本次要替代的"该造多少个"规划问题。

## 数据流小结

```
getTargets(subpage, manualOptions)
  └─ getCurrentStageIndex()  // 新增：每次调用扫一次 buildings，算出 S
  └─ 对每个建筑: scoreBuilding → toPriority/toExtra
       └─ prio=0 但在 route 里 → 仍继续（新增例外，避免被提前 return 卡住）
       └─ max = Math.min(cap, maxTarget, count+toExtra步进, getProductionStorageCap, getStageCap)  // 替换 plannedTarget*倍数
  └─ applyCapBridgeTargets              // 不变
  └─ applyDangerousBattleBuildingTargets // 不变
  └─ applyRouteTargets                  // 简化：只强制 prio，不再写 routeMax
  └─ applyTitanOverrides                // 不变
  └─ applyManualOverrides               // 不变，兜底覆盖
```

## 影响文件

- `automation-src/fragments/smart-build-planner/00-data-tables.js`：
  `smartBuildRoutes` 各 goal 的 `buildingTargets`/`supportTargets` 条目删除 `target` 字段。
- `automation-src/fragments/smart-build-planner/10-game-state-adapter.js`：新增
  `getCurrentStageIndex()`。
- `automation-src/fragments/smart-build-planner/40-build-scoring.js`：新增
  `STAGE_DECAY_FLOOR`、`getStageCap`；删除 `getPlannedTarget`、
  `GENERAL_SCORE_PLAN_CAP_MULTIPLIER`；修改 `getTargets`（`max` 计算链、`prio` 早退条件）、
  `applyRouteTargets`（简化为只强制优先级）。
- 完成后需要：`automation-src/build.ps1` 重新构建 → `node --check` 校验 → `codemap regen
  --repo theresmore` → 同步更新 `.codemap-conventions.md`（新增本次文件级改动记录）。

## 测试/验证方式

本项目没有自动化测试，遵循既有模式：构建 + 语法检查后，交由用户实机验证——具体验证点建议：

1. `moonlightNight` goal 下，`lumberjack_camp`/`sawmill` 是否不再无限增长，而是稳定在一个
   随游戏进度变化的合理数量。
2. `common_house` 是否能突破 10 继续朝阶段上限增长（间接验证食物产出配平是否生效——如果
   food 净速率仍然跟不上，房屋会依然卡在 10，这种情况下需要回头检查 `getStageCap` 给
   `farm`/`granary`/`lucky_grove_b` 算出的上限是否确实推动了这些建筑被造出来，而不是本设计
   本身有问题）。
3. 早期阶段（`S` 较小时）`quarry`/`artisan_workshop`/`watchman_outpost` 等路线建筑的上限
   是否仍能达到此前手写数字量级（15/3/5/4）附近，避免出现"新公式反而比手写数字更保守"的
   倒退。
4. 建筑升级链场景（如解锁 `sawmill` 后）：`lumberjack_camp` 的上限是否随 `gap` 增大而收紧，
   `sawmill` 是否因为 `age` 更接近当前 `S` 而拿到更大的上限。

## 开放问题（不阻塞本次实现，后续按需处理）

- `STAGE_DECAY_FLOOR=4`、几何衰减（每差 1 个世代对半）是拍定的初始参数，具体数值合理性需要
  实机跑几个阶段后回头校准，不排除后续需要按建筑类别（如军事类 vs 资源类）微调衰减速度——
  但按用户明确决定，首版不做类别区分。
- `age===100` 的建筑数量不少（预计跨多个 tab 都有），首版统一按"不衰减、跟随当前阶段"处理，
  如果实机验证发现某些 `age:100` 建筑因此长期占据过大上限，需要单独排查这批建筑的共同特征
  （目前抽样看不出明显规律，可能是可选分支科技解锁的建筑，不在主线性阶梯上）。
- base 模板 `common_house < 10` 的硬编码安全阀本身不在本次改动范围内；如果实机验证后发现
  食物配平仍然不足以让房屋突破 10（比如受制于其他资源瓶颈或衰减参数偏保守），需要单独向用户
  确认是否要调整衰减参数，或作为永久业务逻辑改动单独申请修改 base 模板。
