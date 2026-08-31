# 灭世（Annihilator）目标 + 独立 Army/Explore/Attack 自动化模块 —— 设计 spec

日期：2026-08-31

## 背景

`smartBuildPlanner` 在 2026-08-28 的重写中把打分驱动系统整体换成依赖图路径引擎（详见
`.codemap-conventions.md` 同日小节），但那次重写**明确把范围收窄到 moonlightNight 一个目标**，
Army/Explore/Prayer 三个子系统被整体删除，`90-export.js` 的 `getUnitTargets`/`getExploreTargets`/
`getPrayerTargets` 固定返回 `null`（退回用户手动配置）。`progress`/`druid`/`gloriousRetirement`/
`annihilator` 四个 goal 的数据同期删除，暂时失效。

本次要恢复其中的 **`annihilator`**（灭世）目标：游戏里一种类似转生的重置机制，通过研究并发射
"灭世终焉"（`research_annhilator`→`create_annhilator`→`launch_annhilator` 科技链）触发，需要先把
游戏进度推进到后期（深渊 age）。用户提供了两份该目标下调试过的自动化脚本 `options` 导出
（`files/自动灭世/` 目录，LZString 压缩 JSON），以及一份游戏数据合集 Excel
（`files/Theresmore_V1.1数据合集_修正s1.1.xlsx`）和一张手绘主线流程图
（`files/theresmore主线大致流程图.png`）。核对这三份材料 + 游戏本体源码
（`files/theresmore/main.js`）后确认：灭世主线上有一段**必须靠军队/探索自动化才能通过的战斗链路**
（连续多个"打赢地图敌人→解锁下一个科技→解锁下一个敌人"的硬前置），这是 Army/Explore 自动化必须
恢复的直接原因。

## 目标

1. 恢复 `annihilator` 为路径引擎认识的一个 goal（Build/Research 侧最小可用：能识别灭世科技链，
   能正确判定"敌人型硬前置"是否已满足）。
2. 新增一套**独立于路径引擎**的 Army/Explore/Attack 自动化模块，消费一张手写的"灭世路线表"，
   产出 Army 招募目标、Explore 探索目标、Attack 页白名单勾选状态，由 `annihilator` goal 触发。
3. 把手写路线表里用到的游戏真实数据（敌人前置科技、真实守军组成、击败奖励等）从 Excel 结构化
   留档，避免未来再靠猜/啃压缩源码。
4. 让 base 模板里本来就存在、但在 2026-08-28 被短路掉的"危险科技闸门"机制对灭世主线重新生效。
5. 提供一个只读可视化面板，展示当前路线进度和危险闸门状态。

## 非目标（本轮明确不做）

- **不做完整的 annihilator Build/Research 路线表**——流程图显示从新手村到"深渊"（abyss）之前
  还有一条很长的建筑/科技主线（远古→封建→中世纪→海岛→深渊，见流程图），本轮只梳理清楚了
  "军队/探索必须介入"的那一段战斗链路 + 灭世终焉本身的科技链种子，**不产出覆盖全流程的
  `buildingFocus`/完整 `targetTechs` 数据**。这是明显更大的一块独立工作，留作后续 spec。
- **不重建任何战斗胜率模拟**——路线表里的 `requiredArmy` 是用户凭经验填的固定安全出兵量，
  不从守军数字机械换算，不引入新的 `canWinBattle` 式黑箱预测。危险科技闸门沿用 base 模板
  **已有**的 `armyCalculator.canWinBattle` 机制，本轮只是不再短路它，不是重新实现它。
- **不做 Diplomacy 页自动化**——灭世终焉的"销毁"分支（`destroy_annhilator`→`mindless_evil`→
  `save_theresmore`）需要 `diplomacy_owned` 类型的外交目标（莫德凯·暗棘男爵/恶孽之手），
  这条是"不重置、保留世界"的另一个结局分支，不是灭世本身需要的，本轮不实现。
- **不重建旧的 `druid` goal**——"德鲁伊"在主线里是一个祈祷事件的二选一分支（接受/放逐），
  不是独立的终局目标，本轮只处理它对灭世路线的影响（导向 `mysterious_robbery` 或
  `fallen_angel` 两条危险科技分支之一），不恢复旧架构里那个已删除的、语义不同的 `druid` goal。
- **不做 Attack 白名单以外的地图/外交内容重做**，不做"游戏源码建 codemap"（用户提过，作为
  独立的后续事项，不在本次 spec 范围）。
- **v1 的 `requiredArmy` 数字不是最终值**——用户明确要求先用固定占位值打通流程
  （详见下方"灭世路线表 v1 内容"），后续按实战经验直接改数据表，不需要重新走一次设计流程。

## 设计

### 1. `annihilator` 接入路径引擎（Build/Research 侧，改动小）

`00-data-tables.js` 新增：

```js
smartBuildGoals.annihilator = {
  dangerousResearchOverrides: [], // 特意留空，见第 7 节"危险科技闸门"
  targetTechs: [
    'activate_signal', 'research_annhilator', 'create_annhilator', 'launch_annhilator',
    ...annihilatorRoute.stages.flatMap(stage => stage.reqFoundTech ? [stage.reqFoundTech] : [])
  ],
  resourceFocus: ['research', 'mana', 'crystal', 'steel', 'natronite', 'lumix'],
  buildingFocus: [] // 本轮不填，见"非目标"
};
smartBuildRoutes.annihilator = { label: 'Annihilator', buildingTargets: [], supportTargets: [] };
```

`annihilatorRoute` 来自新的独立模块（见第 4 节），这里只做数据层面的 `.flatMap()`，不是运行时
函数调用——保持"Army/Explore 独立于路径引擎"这一条用户明确要求的边界。

**必要的功能性修复**：`10-game-state-adapter.js` 的 `isUnlockCompleted` 目前没有
`type === 'enemy'` 分支（等价于永远返回 `false`）。灭世主线的科技前置里大量使用
`{type:'enemy', id, value:1}`（例如 `mankind_darkest` 需要先打赢 `orc_gormiak_citadel`，
`honor_humanity` 需要先打赢 `orc_ogsog_citadel`，`orc_horde` 需要先打赢全部三座城堡），
不修这个分支，这些科技会被路径引擎永久判定为 `blocked`，哪怕游戏里已经打赢了。修复：

```js
const isUnlockCompleted = (type, id) => {
  if (type === 'tech' || type === 'research') return isTechCompleted(id);
  if (type === 'prayer' || type === 'magic') return hasIndexedOrRunItem(id, ['fai_']);
  if (type === 'legacy') return hasIndexedOrRunItem(id, ['leg_']);
  if (type === 'enemy') return hasIndexedOrRunItem(id); // 新增：run.enemies 里存在即视为已击败
  return false;
};
```

`hasIndexedOrRunItem(id)`（不带前缀）本身已经是"通用扫描所有 `idxs`/`run` 分组"的实现，
敌人 id 在 `idxs`/`run.enemies` 里不带前缀存储，直接复用即可，不需要新写扫描逻辑。这个修复
对其他 goal 无副作用（它们的目标科技树里不含 `enemy` 类型前置）。

### 2. 独立 Army/Explore/Attack 模块架构

新增目录 `automation-src/fragments/annihilator-army-planner/`，不挂进路径引擎的图节点体系，
只在 `smartBuild.goal === 'annihilator'` 时产出非 `null` 值（和其余 goal 下 `getUnitTargets`/
`getExploreTargets` 返回 `null` 的降级语义一致）：

- **`00-annihilator-route.js`**——纯数据，见第 4 节。
- **`10-annihilator-state-adapter.js`**——读取"某个 Attack 页敌人是否已击败"
  （复用第 1 节修好的 `isUnlockCompleted('enemy', id)`）、当前已招募兵力
  （复用 `10-game-state-adapter.js` 的 `getUnitCount`）。
- **`20-annihilator-planner.js`**——核心逻辑：
  - `getCurrentStage()`：路线表里第一个"未击败"的 stage；`parallelGroup` 相同的几个 stage
    一起算作"当前阶段"（三座城堡不排硬顺序）。
  - `getAnnihilatorUnitTargets()`：当前阶段 `requiredArmy`（多个并行 stage 取数量最大值，
    避免招兵目标来回跳）。
  - `getAnnihilatorAttackWhitelist()`：路线表里"`reqFound` 已解锁的所有 stage"全部写 `true`
    （只增不减——占领后是永久资源/声望收益，没理由关掉），未解锁维持 `false`。
  - `getAnnihilatorExploreTargets()`：只要路线表里还有未攻克的 stage，就把 `explorersMax`
    维持在较高值（沿用用户原配置的 200 量级），不做"针对具体 stage 精确计算探索量"的精细化。
- **`90-export.js`**（此模块自己的导出，供 `smart-build-planner/90-export.js` 引用）：
  ```js
  return { getAnnihilatorUnitTargets, getAnnihilatorAttackWhitelist, getAnnihilatorExploreTargets };
  ```

`smart-build-planner/90-export.js` 的 `getUnitTargets`/`getExploreTargets` 增加对
`options.goal === 'annihilator'` 的分支调用；`getAttackTargets` 是**新增的导出函数**（当前
base 模板没有这个调用点，见第 8 节"接线改动清单"）。

### 3. 真实数据留档

`docs/game-data/`（新目录，纯参考数据，不参与运行时构建）：

- **`enemies.json`**——源自 `Theresmore_V1.1数据合集_修正s1.1.xlsx` 的"敌人"工作表
  （119 条），字段：`programId`/`name`/`esp`/`level`/`foundRange`/`reqFound`/`army`
  （真实守军组成）/`rewards`（击败奖励）。已抽查 `elder_dragon`（烬火灾主）一条与
  `main.js` 逐字段核对一致。
- **`army-units.json`**——源自"军队"工作表（351 条），每个兵种（含敌方单位）的真实
  攻击/防御/溅射/践踏/训练消耗——不用于战斗模拟，留档备用（换兵种组合时查真实属性，
  不是猜）。
- **`README.md`**——数据来源、抽取方法（xlsx 是标准 zip+XML，`xl/worksheets/sheetN.xml` +
  可选 `xl/sharedStrings.xml`，多行合并单元格按"名称非空即开始新记录"规则归并）、xlsx
  更新后如何重新生成。

### 4. 灭世路线表 v1 内容

`00-annihilator-route.js`：

```js
const annihilatorRoute = {
  stages: [
    { id: 'far_west_island',    reqFoundTech: 'seafaring',           requiredArmy: { heavy_warrior: 1600 } },
    { id: 'orcish_prison_camp', reqFoundTech: 'burned_farms',        requiredArmy: { heavy_warrior: 1600 } },
    { id: 'orc_raiding_party',  reqFoundTech: 'orcish_threat',       requiredArmy: { heavy_warrior: 1600 } },
    { id: 'orc_gormiak_citadel',reqFoundTech: 'orcish_citadel',      requiredArmy: { heavy_warrior: 1600 } },
    { id: 'orc_horith_citadel', reqFoundTech: 'mankind_darkest',     requiredArmy: { heavy_warrior: 1600 }, parallelGroup: 'mankind_darkest_unlocked' },
    { id: 'orc_ogsog_citadel',  reqFoundTech: 'mankind_darkest',     requiredArmy: { heavy_warrior: 1600 }, parallelGroup: 'mankind_darkest_unlocked' },
    { id: 'orc_turgon_citadel', reqFoundTech: 'mankind_darkest',     requiredArmy: { heavy_warrior: 1600 }, parallelGroup: 'mankind_darkest_unlocked' },
    { id: 'lost_valley',        reqFoundTech: 'ancient_artifact',    requiredArmy: { heavy_warrior: 1600 } },
    { id: 'corrupted_lands',    reqFoundTech: 'black_artifact',      requiredArmy: { heavy_warrior: 1600 } },
    { id: 'dark_village',       reqFoundTech: 'explore_sorrounding', requiredArmy: { heavy_warrior: 1600 }, note: '另需 5 座光之信标建筑（Build 侧，本轮未纳入 buildingFocus，见非目标）' }
  ],
  optionalStages: [
    { id: 'mountain_cave',    requiredArmy: { heavy_warrior: 1600 } }, // 无 reqFound
    { id: 'worn_down_crypt',  reqFoundTech: 'guild',                requiredArmy: { heavy_warrior: 1600 } },
    { id: 'huge_cave',        reqFoundTech: 'underground_library',  requiredArmy: { heavy_warrior: 1600 } },
    { id: 'gulud_ugdun',      reqFoundTech: 'path_children',        requiredArmy: { heavy_warrior: 1600 } },
    { id: 'lich_fortress',    reqFoundTech: 'huge_cave_t',          requiredArmy: { heavy_warrior: 1600 } }
  ]
};
```

**顺序依据**（`files/theresmore主线大致流程图.png` + `main.js` 源码交叉核实，非拍脑袋）：
`far_west_island` 在流程图上位于兽人链之前（航海→远西岛→…→定居点大厅→被烧毁的农场→兽人链），
不是旁支。兽人链本身是一条被科技强制串联的硬顺序：
`burned_farms(科技)→orcish_prison_camp(击败)→orcish_threat(科技，硬前置=已击败上一环)→
orc_raiding_party(击败)→orcish_citadel(科技，硬前置=已击败上一环)→orc_gormiak_citadel(击败)→
mankind_darkest(科技，硬前置=已击败上一环)→三座城堡（并行，都要打）`。三座城堡之后依次是
`lost_valley`/`corrupted_lands`/`dark_village`，同样是流程图上的必经点。`optionalStages`
（`mountain_cave`/`worn_down_crypt`/`huge_cave`/`gulud_ugdun`/`lich_fortress`）来自用户原有
两份配置文件的白名单，但不在流程图主线上，标记为旁支资源 farming，不参与"当前阶段"判定。

**`requiredArmy` 数值策略（用户明确指示）**：v1 一律固定 `{ heavy_warrior: 1600 }`，不做任何
基于真实守军数据的动态计算——"先打通，不做动态处理"，后续按实战经验直接改这张表。

**难度联动**：复用已有的 `GOAL_AUTOMATION_PRESETS` 机制（`smart-build-goal-automation-preset.js`，
moonlightNight 已经在用，选中 goal 时自动设 `ancestor`/`path`/`prestige`），给 `annihilator`
新增一条：选中该 goal 时强制 `state.options.difficulty = { enabled: true, selected: 'difficulty_0' }`
（普通难度）。这是硬需求：xlsx 首页备注明确写着"普通以上难度，敌人数量会增多并浮动"，路线表里
的固定兵力数字只在普通难度下有意义。

### 5. 探索联动（`reqFound` 硬前置）

见第 1 节——`smartBuildGoals.annihilator.targetTechs` 在种子科技基础上自动 union 进路线表
每个 stage 的 `reqFoundTech`，纯数据层面的 `.flatMap()`，不是运行时函数调用，路径引擎的
Research 自动化会自然把这些探索解锁科技一起排进优先级。Explore 页数量目标见第 2 节
`getAnnihilatorExploreTargets`，v1 不做精细化。

### 6. Army/Attack 产出逻辑

见第 2 节 `20-annihilator-planner.js` 的三个函数。关键设计原则：**Attack 白名单只增不减**——
占领地点是永久资源/声望收益，没有理由关掉已经打赢的地点；**招募目标取当前阶段并行 stage 的
最大值**，避免招兵目标在多个并行 stage 之间来回跳变。

### 7. 危险科技闸门修复（不是新机制，是去掉一处短路）

流程图确认灭世主线上有 **4 个"研究后立即同步结算防御战"的科技**（base 模板自带的
`dangerousFightsMapping`，`automation-src/base/...user.js:48137`）：

按主线时间顺序排列（`dragon_assault` → 德鲁伊二选一 → 远航 → 兽人链 → `orc_horde`）：

| 科技 | 触发的防御战 | 在主线上的位置 |
|---|---|---|
| `dragon_assault`（"巨龙来袭"） | `army_of_dragon` | 主线必经，位于德鲁伊二选一之前，也在 `far_west_island`/远航之前 |
| `mysterious_robbery`（"德鲁伊"分支：接受） | `fallen_angel_army_1` | 二选一，紧跟 `dragon_assault` 之后、远航之前；早期祈祷事件"孤独的德鲁伊"决定走哪一支 |
| `fallen_angel`（"德鲁伊"分支：放逐→"堕天使出现"） | `fallen_angel_army_2` | 同上二选一，同样在远航之前 |
| `orc_horde`（"兽人部落"） | `orc_horde_boss` | 主线上位置最晚，三座城堡（`orc_horith`/`orc_ogsog`/`orc_turgon_citadel`）全部打赢之后才能研究 |

即 `dragon_assault` 和德鲁伊二选一（`mysterious_robbery`/`fallen_angel`）两组危险闸门都发生在
路线表第一个 stage（`far_west_island`）之前，`orc_horde` 则发生在路线表兽人城堡三连之后——
这几个危险科技本身不是 Attack 页目标，不占路线表的 stage 位置，这里只是标注它们相对路线表的
时间先后，方便面板展示"当前应该关注哪个闸门"。

这几个科技会被本次新增的 `targetTechs` union 机制自然覆盖到（因为它们是主线必经科技的
`reqFound`/前置链上的节点，或本身就在种子列表附近）。base 模板自带的
`armyCalculator.canWinBattle`+`dangerousFightsMapping`+`state.stopAttacks` 机制
（`46805`/`48137`/`48202` 附近）本来就是为这类场景设计的：点危险科技前先模拟"召回全部部队
能不能赢"，赢不了就把 `state.stopAttacks` 置 `true` 暂停出击，直到部队回家、赢面够了才继续。
但 2026-08-28 那次重写把消费方 `shouldGateDangerousResearch`（`30-path-engine.js`）硬编码成
恒 `false`（当时 moonlightNight 目标科技树里没有危险科技，短路无所谓）。

**修复**：

```js
const shouldGateDangerousResearch = researchKey => !!dangerousFightsMapping[researchKey];
```

不再恒为 `false`，改成老实检查候选科技是否在 base 模板已有的 `dangerousFightsMapping` 里。
`isDangerousResearchOverridden` 保持现状（`annihilator.dangerousResearchOverrides` 留空，
见第 1 节），即这几个危险科技**不做安全豁免**，闸门对灭世目标真实生效。这一行改动对
moonlightNight 等其他 goal 无副作用——它们的目标科技树本来就不包含这 4 个危险科技，
`dangerousFightsMapping[researchKey]` 恒为 `undefined`，行为不变。

用户给出的参考数字（"巨龙/德鲁伊-堕天使填 600"）低于路线表默认的 1600 攻击兵力，说明第 4 节
默认配置的招募量对通过这几个危险闸门是足够的，不需要额外的驻防底线设计。

### 8. 可视化面板（Annihilator Route，只读）

设计稿：https://claude.ai/code/artifact/5e4cd8d2-96f4-42bb-8ae1-cd5c394d766b （已经过
`frontend-design` 一轮视觉稿确认，用户已批准）。

布局要点：
- 顶部"当前前线"速报卡——当前阶段的敌人名 + `requiredArmy` 大号数字 + `reqFound` 科技状态，
  这是用户最关心的信息，必须最醒目。
- 主线路线：横向"行军线"，8 个必经目标（三座城堡合并成一张聚簇卡展示"3/3 解锁、x/3 攻克"），
  已攻克/当前前线/未解锁三种视觉状态。
- 旁支目标：`optionalStages` 弱化展示，不参与"当前阶段"判定。
- 研究危险闸门：列出第 7 节表格里的 4 项，展示是否已研究/`state.stopAttacks` 是否被其触发——
  纯展示已有机制的状态，不是新的计算。
- **明确只读**：不提供任何编辑/强制覆盖交互（区别于 Goal Path 面板的 `forcedTargets` 编辑），
  用户要改配置就去 Army/Research/Attack 原生页面。

视觉延续 Goal Path 面板的深色基调（`#171d26` 系），但用独立的暗红/琥珀"战役"主色调
（区别于 Goal Path 的青绿"成长"色调）区分两个 tab。

新增 tab 挂载方式和 base 模板 marker 插入方式，沿用 Goal Path 面板已验证过的模式
（`smart-build-goal-path-panel.template.html`/`.js` 的写法），实现阶段照抄这个先例即可。

## 接线改动清单

| 文件 | 改动 |
|---|---|
| `automation-src/fragments/smart-build-planner/00-data-tables.js` | 新增 `smartBuildGoals.annihilator`、`smartBuildRoutes.annihilator` |
| `automation-src/fragments/smart-build-planner/10-game-state-adapter.js` | `isUnlockCompleted` 新增 `type === 'enemy'` 分支 |
| `automation-src/fragments/smart-build-planner/30-path-engine.js` | `shouldGateDangerousResearch` 去掉硬编码 `false`，改查 `dangerousFightsMapping` |
| `automation-src/fragments/smart-build-planner/90-export.js` | `getUnitTargets`/`getExploreTargets` 增加 `goal === 'annihilator'` 分支；新增 `getAttackTargets` 导出 |
| `automation-src/fragments/annihilator-army-planner/00-annihilator-route.js`（新） | 路线表数据 |
| `automation-src/fragments/annihilator-army-planner/10-annihilator-state-adapter.js`（新） | 敌人击败状态、已招募兵力读取 |
| `automation-src/fragments/annihilator-army-planner/20-annihilator-planner.js`（新） | 当前阶段判定、三个 `getAnnihilatorXTargets` |
| `automation-src/fragments/annihilator-army-planner/90-export.js`（新） | 模块自身导出 |
| `automation-src/fragments/smart-build-goal-automation-preset.js` | `GOAL_AUTOMATION_PRESETS` 新增 `annihilator` 条目（`difficulty: difficulty_0`） |
| `automation-src/fragments/smart-build-goal-path-panel.template.html`/`.js` 同级新增 `smart-build-annihilator-route-panel.template.html`/`.js`（新） | 第 8 节面板 |
| base 模板 `automation-src/base/Theresmore-Automation_4.14.4.base.user.js` | 新增 Attack 页调用点（消费 `getAttackTargets`）+ 新 tab 的 3 个 marker（照抄 Goal Path 面板先例）——**需要用户逐项确认**，本轮不算"新增一行"级别的默认许可范围 |
| `docs/game-data/enemies.json`/`army-units.json`/`README.md`（新） | 第 3 节数据留档 |
| `.codemap-conventions.md` | 收尾时补一节记录本次改动，供未来排查参考 |
| `automation-src/build.ps1` | 同步新增 `annihilator-army-planner/` 目录清单 + 新面板 fragment 的读取/`.Replace(...)` |

## 开放问题 / 后续事项（本轮不处理，留给用户后续决定）

1. 完整的 annihilator Build/Research 路线表（新手村到深渊全流程的 `buildingFocus`）。
2. `requiredArmy` 数值需要用户后续按实战经验校正（v1 是占位值，不是最终值）。
3. `dark_village` 额外要求的"5 座光之信标"建筑目标未纳入 `buildingFocus`。
4. Diplomacy 页自动化 + `destroy_annhilator`/"拯救世界"分支（本轮排除）。
5. 用户提到的"游戏源码建 codemap"独立事项，不在本次 spec 范围。
6. 面板挂载需要的 base 模板 marker 改动，需要用户在实现阶段逐项确认（沿用"新增一行/一个 tab
   级别改动需要用户确认"的既有约定）。
