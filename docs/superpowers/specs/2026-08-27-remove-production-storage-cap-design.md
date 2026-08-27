# 移除"仓储填满保护"（`getProductionStorageCap`）—— 设计 spec

日期：2026-08-27
范围：`automation-src/fragments/smart-build-planner/40-build-scoring.js`（Build 子系统）
关系：部分废弃 `docs/superpowers/specs/2026-08-26-storage-driven-building-cap-design.md` 的"①
生产类建筑数量上限——边际填满时间阈值法"一节；该 spec 的其余部分（泰坦覆盖、存储缺口候选建筑
过滤、手动配置兜底）不受影响。

## 背景与问题

2026-08-26 引入的 `getProductionStorageCap`：对某建筑产出的资源，若"再多建一个后仓库预计在
90 秒内填满"，就把该建筑目标数量钉死在当前已建数量，用意是防止产出建筑无脑叠加导致资源溢出
浪费。

2026-08-27 实机验证结构性下限修复（`common_house` 卡在10、需要到15才能解锁
`municipal_administration`/`end_ancient_era`）时发现：这套机制会跟"结构性硬性数量下限"
冲突——`common_house` 带有很小的金币/研究副产出，一旦这两种资源仓库接近填满，
`getProductionStorageCap` 就会把目标钉在10，压过游戏规则要求的15。当时通过让
`structuralFloor` 越过这一项软节流完成了修复（见 `.codemap-conventions.md` "第四次实机反馈"
条目）。

用户随后明确反馈（原话）："不需要溢出保护，当前就是有很多种类的资源会溢出，我们需要的是一开
始就根据当前情况计算出它应该要的上限"；追问"具体是哪些资源溢出"时用户进一步澄清："这就是常
见的正常情况，不应该因为这个额外处理，这个游戏里的情况只有上限够不够，够了之后你的产出效率是
否足够你短时间内达到目标，不存在溢出浪费导致的问题，这里溢出就是正常情况不要纠缠"。

结论：**"资源快溢出"在这个游戏里根本不构成一个需要规划器专门处理的问题**。`getProductionStorageCap`
整个存在前提（"溢出=浪费，需要提前刹车"）不成立，不是调参能解决的，需要整体移除，而不是保留
并修修补补。

## 目标

1. 从 `getTargets` 的 `max` 计算链里彻底移除 `getProductionStorageCap` 这一项。
2. 删除 `getProductionStorageCap` 函数本身（不再被任何地方调用，避免留死代码）。
3. 建筑数量上限此后完全由已有的结构性/目标驱动信号决定：`building.cap`（奇观类单体硬上限）、
   `options.maxTarget`（用户全局兜底）、每轮打分驱动的递增节流（`count + min(maxExtra,
   toExtra(score))`）、`getStageCap`（阶段衰减引擎）、`structuralFloor`（科技树/目标链硬性
   下限）。

## 非目标

- 不改动 `structuralFloor` 越过软节流生效的 `Math.max(softMax, Math.min(structuralFloor, cap,
  maxTargetOption))` 结构本身——移除 `getProductionStorageCap` 后 `softMax` 少了一项输入，
  这段兜底逻辑在多数场景下不会再被触发，但保留它不产生任何副作用，也不需要为了"理论上用不到了"
  去反向精简，属于合理的防御性冗余。
- 不改动 2026-08-26 spec 里泰坦覆盖（`applyTitanOverrides`）、存储缺口候选建筑过滤
  （`isBuildingUnlocked` 接入 `applyCapBridgeTargets`）、手动配置兜底（`manualOverrides`）
  这三部分，它们跟"防溢出"无关，继续保留。
- 不新增任何"产出效率是否足够短时间达标"的显式计算——用户提到的这一层已经由现有打分机制
  （`getGoalResourceBonus`/`getBottleneckScore`/`getCapPressure` 等对资源速度、仓储压力的
  加分）间接覆盖，本次不重新设计评分公式。

## 设计

`40-build-scoring.js`：

1. 删除 `PRODUCTION_STORAGE_CAP_SECONDS` 常量和 `getProductionStorageCap` 函数整体。
2. `getTargets` 里 `softMax` 的 `Math.min` 链去掉 `getProductionStorageCap(building, resourceMap,
   options)` 这一项，其余四项（`cap`/`maxTargetOption`/递增节流/`getStageCap`）不变：

```js
const softMax = Math.min(
  cap,
  maxTargetOption,
  count + Math.min(Number(options.maxExtra) || smartBuildDefaults.maxExtra, toExtra(score)),
  getStageCap(building, options)
);
const max = Math.max(softMax, Math.min(structuralFloor, cap, maxTargetOption));
```

3. `getTargets` 里此前专门为 `getProductionStorageCap` 准备的 `resourceMap` 局部变量，其余
   调用方（`getGoalResourceBonus`/`scoreBuilding` 内部的评分逻辑）仍在用，不需要跟着删。

## 影响评估

- `granary`（粮仓）此前"卡在1个"就是这条机制的直接后果（`.codemap-conventions.md` "第二次
  实机反馈"条目里已记录为"设计内行为、非bug"），移除后会转为完全由阶段衰减/目标信号决定数量，
  行为随之改变——这正是本次改动想要的效果。
- 所有此前隐性依赖这条"防溢出"节流的产出类建筑（不止 common_house/granary，理论上任何带正向
  `resource` 类型 `gen` 的建筑都受影响）都会转为不再因为"资源快满"而被钉住数量，改由阶段衰减
  和打分节流独立决定增长节奏——不会变成无限乱建，因为 `getStageCap`/递增节流两层依然在。
- `refugee_district`（难民区）之前"卡在0"的那次修复（`Math.min(cap, getCount(building))` →
  `Math.min(cap, Math.max(getCount(building), 1))`）会随函数整体删除一起消失——这正确，因为
  问题的根源函数本身都不存在了，不需要保留一个已经不会被调用的"半修复"。

## 影响文件

- `automation-src/fragments/smart-build-planner/40-build-scoring.js`：删除
  `PRODUCTION_STORAGE_CAP_SECONDS`/`getProductionStorageCap`，修改 `getTargets` 的 `softMax`
  计算链。
- 完成后：`automation-src/build.ps1` 重新构建 → `node --check` 校验 → `codemap regen --repo
  theresmore` → 同步更新 `.codemap-conventions.md`（标注 2026-08-26 spec 的"①"一节已被本次
  spec 废弃）。

## 测试/验证方式

本项目没有自动化测试，构建 + 语法检查后交由用户实机验证，建议验证点：

1. 此前因为副产出资源快满而被钉住的建筑（如 `common_house`）现在是否只由阶段/结构下限决定
   数量，不再受金币/研究等副产出仓储状态影响。
2. `granary` 等此前"卡在1个"的建筑，数量是否能随阶段/目标正常增长。
3. 移除后没有引入无限乱建——`getStageCap` 的阶段衰减和 `maxExtra` 递增节流仍然在生效。
