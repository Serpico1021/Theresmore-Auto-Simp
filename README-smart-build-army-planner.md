# Smart Build 目标战斗与军队规划记录

本模块补上目标导向自动化里的“危险研究战斗”闭环。

## 核心约束

危险战斗只处理当前路线中的“下一个”战斗。

例如选择 `Progress game stages` 时：

- 当前阶段会先看到 `moonlight_night -> army_of_goblin`
- 不会提前把 `dragon_assault`、堕天使、兽人等后续战斗都算进去
- 等月明之夜已完成后，才会根据目标路线继续判断后面的危险战斗
- 只有当该危险研究的非资源门槛满足后，才开始备战；例如月明之夜要等 `watchman_outpost >= 4` 后才补地精战军队

这样可以避免早期资源被无意义的军队维护费拖垮。

## 已接入的危险研究映射

- `moonlight_night` -> `army_of_goblin`
- `dragon_assault` -> `army_of_dragon`
- `mysterious_robbery` -> `fallen_angel_army_1`
- `fallen_angel` -> `fallen_angel_army_2`
- `orc_horde` -> `orc_horde_boss`
- `kobold_nation` -> `king_kobold_nation`
- `barbarian_tribes` -> `barbarian_horde`
- `mindless_evil` -> `mindless_evil_boss`

## 已加入的具体战斗模板

### 月明之夜 / `army_of_goblin`

偏好兵种：

- `spearman`
- `heavy_warrior`
- `phalanx`
- `archer`
- `warrior`
- `light_cavarly`

偏好建筑：

- `watchman_outpost`
- `boot_camp`
- `castrum_militia`
- `recruit_training_center`

### 巨龙来袭 / `army_of_dragon`

偏好兵种：

- `phalanx`
- `knight`
- `cleric`
- `heavy_warrior`
- `crossbowman`
- `paladin`
- `archer`

偏好建筑：

- `boot_camp`
- `recruit_training_center`
- `mercenary_outpost`
- `watchman_outpost`

其他危险战斗暂时使用通用防御评分，不会提前触发；只有当它成为当前目标链的下一个危险战斗时才会进入计算。

## 运行机制

当 `Smart build planner` 启用，且 `Smart army for dangerous research` 启用时：

1. 根据当前 Goal 的 `targetTechs` 顺序扫描危险研究。
2. 找到第一个尚未完成、且非资源门槛已满足的危险研究，作为当前唯一军队目标。
3. 使用原脚本已有的 `armyCalculator.canWinBattle(fightId, true, ...)` 判断防守战是否可胜。
4. 如果不可胜：
   - 临时生成 Army max/prio。
   - 如果有模板，优先按模板兵种和建筑补齐。
   - 如果没有模板，使用通用防御效率评分。
   - 研究模块会自动对该危险研究启用战斗校验，即使原脚本 `Dangerous fights` 没有手动勾选。
5. 如果可胜：
   - 不再生成临时补兵目标。
   - 研究模块可以继续推进。

所有生成的 Army max/prio 都是临时值，不会永久写入手动配置。

## 新增选项

位于：

`Options -> Cheats -> Smart build planner`

新增：

- `Smart army for dangerous research`
- `Max extra units per pass`
- `Max target per unit`

## 维护文件

- `C:\Users\240076\Desktop\Code\2026\CODEX\THERESMORE\automation-src\fragments\smart-build-planner.js`
- `C:\Users\240076\Desktop\Code\2026\CODEX\THERESMORE\automation-src\fragments\smart-build-options.js`
- `C:\Users\240076\Desktop\Code\2026\CODEX\THERESMORE\automation-src\fragments\smart-build-panel.template.html`
- `C:\Users\240076\Desktop\Code\2026\CODEX\THERESMORE\automation-src\base\Theresmore-Automation_4.14.4.base.user.js`

## 验证

已执行：

```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\240076\Desktop\Code\2026\CODEX\THERESMORE\automation-src\build.ps1
node --check C:\Users\240076\Desktop\Code\2026\CODEX\THERESMORE\Theresmore-Automation_4.14.4_smart-build-planner.user.js
```

静态审计结果：

- 22 个目标研究 ID 均存在。
- 8 个危险战斗 ID 均存在。
- 10 个模板单位 ID 均存在。
- 5 个模板建筑 ID 均存在。
