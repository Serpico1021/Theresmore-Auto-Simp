# 防止饥荒建造闸门——设计说明

## 目标

为 Smart Build 增加“防止饥荒”建造规则：在 `moonlightNight` 和 `fastNgPlus` 两个目标下，首个 `common_house` 可以直接建造；建好至少 1 个后，只有在已有至少 1 个 `farm` 且当前实际至少分配 1 名 `farmer` 时，才允许继续建造 `common_house`。

## 范围与非目标

- 规则只作用于 Smart Build 的 `moonlightNight` 和 `fastNgPlus` 目标。
- 不修改游戏原始建筑数据，不修改手动建造模式。
- 不把 Farmer 配置目标、可用人口或岗位上限当作已分配 Farmer；必须读取当前实际岗位人数。
- 不自动替代 Population 模块进行岗位分配。Population 模块仍负责按用户配置分配 Farmer。

## 方案

在 Smart Build planner 内增加一个小型运行时状态适配器：

1. 通过现有 `reactUtil.getGameData()` 读取游戏运行时状态。
2. 复用现有 `getCount(building)` 读取建筑数量。
3. 增加 `getAssignedJobCount('farmer')`，读取当前 Farmer 岗位的实际人数；无法可靠读取时返回 0。
4. 增加 `isFoodSecurityGateEnabled(options)`，仅对两个目标返回 true。
5. 在路径引擎解析 `common_house` 时：
   - 当前数量为 0：正常解析，允许目标为至少 1；
   - 当前数量大于等于 1 且 farm 数量小于 1：节点标记为 blocked，原因是缺少 Farm；
   - 当前数量大于等于 1、Farm 足够但 Farmer 实际人数小于 1：节点标记为 blocked，原因是缺少 Farmer；
   - 两个条件满足：正常解析后续房屋目标。

阻塞节点的目标输出为 0，避免建造执行层继续点击；路径快照保留 `blockReason`，供 Goal Path 面板显示。Farm 本身仍由当前路线目标推进，Population 自动化仍按原有逻辑运行。

## 数据流与边界

```text
游戏运行时 MainStore
  ├─ 建筑数量 ──> getCount(common_house/farm)
  └─ 岗位实际人数 ──> getAssignedJobCount(farmer)
                                      │
Smart Build options ─> 目标开关 ──────┤
                                      v
                         resolveBuilding(common_house)
                                      │
                         blocked / queued / met
                                      v
                         getTargets + getPathSnapshot
```

岗位状态读取应隔离在适配函数中，兼容项目当前运行时可能使用的岗位索引/数组表示，但不得回退到配置目标。异常、缺字段或非数字值一律视为 0，保证安全失败。

## 测试与验收

至少覆盖以下纯逻辑场景：

1. 两个目标下，0 个 `common_house` 时不触发闸门。
2. 已有 1 个房屋、0 个 Farm 时，房屋节点阻塞并报告 Farm 原因。
3. 已有 1 个房屋、1 个 Farm、0 个 Farmer 时，房屋节点阻塞并报告 Farmer 原因。
4. 已有 1 个房屋、1 个 Farm、1 个实际 Farmer 时，房屋节点不因该规则阻塞。
5. 其他目标不触发该规则。
6. 岗位状态缺失或无效时按 0 人处理。

构建验证：修改 `automation-src/fragments/` 后运行项目规定的 `build.ps1`，再对生成脚本执行 `node --check`。

