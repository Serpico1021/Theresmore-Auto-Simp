# 灭世目标月明之夜军队招募时机 —— 设计说明

日期：2026-09-04

## 背景

当前选择 `annihilator` 目标后，灭世 Army 规划器会立即返回固定军队目标：

```js
{ scout: 200, heavy_warrior: 1600 }
```

这会导致流程很早就逐步招募侦察兵和重装战士，持续消耗资源并拖慢前期发展。实际上，月明之夜对应的危险研究战斗应在接近研究该科技时再准备，之后才继续灭世主线的军队需求。

## 目标

调整 `annihilator` 目标下的军队招募时机：

1. `moonlight_night` 尚未完成时，只有当它已经成为当前待推进的危险研究、且 `army_of_goblin` 当前不可胜，才启用月明之夜所需的侦察兵和重装战士目标。
2. 月明之夜战斗已经可胜时，停止为该战斗继续追加固定军队。
3. 月明之夜研究完成后，恢复现有灭世路线规划器行为，由当前灭世 stage 的 `requiredArmy` 接管。
4. 不改变 Attack 白名单、Explore 目标、危险研究闸门和非 `annihilator` 目标行为。

## 方案

在 `automation-src/fragments/annihilator-army-planner/20-annihilator-planner.js` 增加一个月明之夜准备判断，并在 `getAnnihilatorUnitTargets` 入口优先处理：

```text
月明之夜已完成？
  是 → 使用现有灭世 stage 军队规划
  否 → moonlight_night 是否为当前待研究危险科技？
          否 → 返回空军队目标，前期不招固定军队
          是 → army_of_goblin 是否可胜？
                  是 → 返回空军队目标
                  否 → 返回 { scout: 200, heavy_warrior: 1600 }
```

“当前待研究危险科技”应沿用已有危险研究映射和研究/路径状态判断，不额外添加建筑数量或时代硬编码。战斗胜负判断复用现有 `armyCalculator.canWinBattle('army_of_goblin', true, ...)` 能力；若当前运行环境无法完成该判断，则保持保守行为，不提前开启固定招募。

## 数据流与边界

- 现有 `annihilatorRoute.armyTargets` 保留，作为月明之夜准备阶段的目标来源或等价固定目标数据，不改变数值。
- 月明之夜未成为当前危险研究时，`getAnnihilatorUnitTargets` 返回空对象，使 Army 页面不产生 Smart Army 临时招募目标；调用方原有的手动配置兜底语义不变。
- 月明之夜可胜后返回空对象，避免继续堆积侦察兵和重装战士。
- 月明之夜研究完成后，继续执行当前 stage 的 `requiredArmy` 逻辑；因此后续 stage 仍可按现有路线补充重装战士。
- 不修改基础模板中的 Army 执行循环，不新增 UI 开关，不影响用户手动 Army 配置。

## 版本与构建

这是用户可见的行为变更，当前基础模板中的 `@version` 与 `taVersion` 为 `1.0.0.19`，本次递增到 `1.0.0.20`。修改 fragment 后必须运行 `automation-src/build.ps1`，并使用 `node --check` 校验生成 userscript。

## 验证标准

静态验证：

- 月明之夜尚未接近当前危险研究时，函数不返回 `scout`/`heavy_warrior` 固定目标。
- 月明之夜成为当前危险研究且战斗不可胜时，返回侦察兵 200、重装战士 1600 及现有优先级字段。
- 战斗可胜时不继续返回月明之夜固定目标。
- 月明之夜完成后，现有灭世 stage 军队目标仍正常返回。
- `node --check` 通过，且生成文件版本号与基础模板一致。

运行时验收：

- 新开灭世流程，在月明之夜前观察 Army 页面，不再从早期开始缓慢填充侦察兵和重装战士。
- 接近并准备研究月明之夜时，军队自动开始补齐。
- 研究月明之夜后，灭世后续军队流程不回退、不丢失。
