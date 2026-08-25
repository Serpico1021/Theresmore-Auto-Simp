# Smart Build 路线资料优化记录

本次优化把本地资料库中的月明、德鲁伊、灭世路线门槛接入到 `Smart build planner`。

## 修改范围

- 维护片段：
  - `automation-src\fragments\smart-build-planner.js`
  - `automation-src\fragments\smart-build-panel.template.html`
- 生成脚本：
  - `Theresmore-Automation_4.14.4_smart-build-planner.user.js`

## 新增目标

界面 `Options -> Cheats -> Smart build planner -> Goal` 增加：

- `Druid Route`

## 主要行为变化

规划器现在不再只依赖资源评分和少量目标科技，而是额外使用“路线门槛表”。

### Moonlight Night / 月明

会优先拉起：

- `common_house` 普通房屋：15
- `quarry` 采石场：3
- `artisan_workshop` 工匠作坊：5
- `watchman_outpost` 守望者前哨：4

并保留工匠公会或大学/农场/木匠工坊/食品杂货店/马厩这类辅助路线的较低优先级目标。

### Druid Route / 德鲁伊

会优先拉起：

- 月明与封建结束所需的基础建筑
- `city_center` 市中心
- `academy_of_freethinkers` 自由思想家学院
- `refugee_district` 难民区
- `mana_pit` 法力深井
- `alchemic_laboratory` 炼金实验室
- `temple` 寺庙

目标是服务“月明 -> 结束封建 -> 魔法艺术/龙袭 -> 法力应用 -> 德鲁伊”的路线。

### Launch Annihilator / 灭世

在德鲁伊路线基础上继续拉起：

- `harbor_district` 海湾区
- `island_outpost` 岛屿前哨
- `colony_hall` 定居点大厅：12
- `lumix_plant` 辉烬工厂：1
- `sanctum_healing` 治疗圣所：1
- `containment_cell` 禁锢单元：3
- `beacon_light` 光之信标：5
- `light_square_b` 光耀广场：5
- `signal_machine` 信号机器：1

目标是服务“海岛 -> 深渊 -> 信号机器 -> 制造/发射/销毁灭世终焉”的路线。

## 实现原则

- 路线门槛是硬引导：未达到目标数时，会直接生成对应建筑的临时 max/prio。
- 资源风险仍然有效：负产出建筑仍会受到风险评分影响。
- `Max extra buildings per pass` 仍然有效：路线目标不会一次性把目标数拉满，而是按每轮增量逐步推进。
- 原手动配置仍可覆盖：开启 `Manual values override smart plan` 后，非零手动 max 会覆盖智能规划。

## 验证

已执行：

```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\240076\Desktop\Code\2026\CODEX\THERESMORE\automation-src\build.ps1
node --check C:\Users\240076\Desktop\Code\2026\CODEX\THERESMORE\Theresmore-Automation_4.14.4_smart-build-planner.user.js
```

并额外审计了路线表中的 31 个建筑 id，均能在原脚本建筑数据中找到。
