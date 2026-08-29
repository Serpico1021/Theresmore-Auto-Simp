# moonlightNight 建筑最低数量限制 —— 设计说明

日期：2026-08-29

## 目标

为 `moonlightNight` 目标增加四项建筑最低数量要求：

- `farm`：至少 5 个
- `lumberjack_camp`：至少 5 个
- `quarry`：至少 5 个
- `mine`：至少 5 个

## 设计

沿用现有目标路线的 `supportTargets` 数据结构，在四个条目中增加 `target: 5`。不新增字段、不修改目标引擎逻辑，也不改变其他目标的行为。现有优先级继续负责排序，`target` 负责数量下限。

## 验证

修改片段后运行 `automation-src/build.ps1` 生成 userscript，再运行 `node --check` 校验生成文件语法。实机验证时确认四类建筑分别不足 5 个时会被纳入目标，达到 5 个后该最低数量要求不再触发。
