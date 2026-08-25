# Theresmore Automation Smart Build Planner

这是基于本地 `Theresmore Automation 4.14.4` 修改的智能建筑规划版。

## 新文件

- `Theresmore-Automation_4.14.4_smart-build-planner.user.js`

## 相比原版新增内容

在 Options 的 Cheats 标签页里新增 `Smart build planner`：

- `Enabled`: 开启动态建筑规划。
- `Goal`: 选择当前自动化目标。
  - `Progress game stages`: 推进游戏阶段。
  - `Moonlight Night`: 以自动月明之夜为导向。
  - `Glorious Retirement`: 以光荣退休/转生为导向。
  - `Launch Annihilator`: 以发射灭世终焉为导向。
- `Fallback strategy`: 目标之外的通用偏好。
  - `Balanced`: 均衡挂机。
  - `Research`: 偏向研究和科研产线。
  - `Prestige`: 偏向短期推进和声望节奏。
  - `Military`: 偏向军队/防御相关建设。
- `Risk`: 负产出建筑风险偏好。
  - `Conservative`: 更少碰负产出建筑和奇观。
  - `Normal`: 默认。
  - `Aggressive`: 更愿意为了推进承担短期负产出。
- `Manual values override smart plan`: 开启后，原来手动填过的非零 max 会覆盖智能规划。
- `Max extra buildings per pass`: 每轮最多把某个建筑目标提高多少。
- `Max target per building`: 单个建筑的智能目标上限。
- `Max wait seconds`: 如果某建筑预计等待资源时间超过该值，会降低优先级。

## 工作方式

原版建筑自动化依赖手动配置：

```js
{
  farm: 12,
  prio_farm: 6
}
```

智能版不会永久改写这些配置，而是在 Build 页运行前临时生成类似结构，再交给原脚本现有的建造逻辑执行。

规划器会参考：

- 当前选择的目标。
- 当前资源数量、上限、产速。
- 资源是否快满仓。
- 建筑静态产出、容量、人口效果。
- 负资源产出的风险。
- 当前已建数量。
- 目标科技/事件的建筑前置和资源前置。
- 选择的 fallback 策略和风险偏好。

## 推荐用法

1. 先在原脚本里开启 Build 页以及 City/Colony/Abyss 子页。
2. 到 Cheats 标签页开启 `Smart build planner`。
3. 初次建议：
   - `Goal`: `Progress game stages`
   - `Fallback strategy`: `Balanced`
   - `Risk`: `Normal`
   - `Manual values override smart plan`: 关闭
   - `Max extra buildings per pass`: `2` 或 `3`
4. 观察一轮。如果建造太激进，把 `Risk` 改为 `Conservative`，或把 `Max extra buildings per pass` 降到 `1`。

## 当前边界

- 第一版是启发式规划器，不是完整最优解搜索。
- 目前目标导向只接入了 Build 建筑规划，Research、Army、Prestige 还没有统一被目标编排器接管。
- 互斥建筑、神殿、雕像、奇观仍建议手动选择或保守使用。
- 它不会自动决定何时声望/传承，只改善建筑 max/prio 维护成本。
- 没有删除原版配置；需要回退时，禁用 `Smart build planner` 即可回到原版行为。

## 下一步方向

真正完整的目标导向自动化应该把目标拆成跨模块阶段：

- 推进游戏阶段：Build 关键建筑 -> Research 时代科技 -> Army 处理阻塞战斗 -> 进入下一阶段。
- 月明之夜：准备 `watchman_outpost` 和研究资源 -> 确认防守战可胜 -> 研究 `moonlight_night`。
- 光荣退休：完成 `moonlight_night`、`banking`、`knighthood` -> 准备金币/水晶 -> 触发自动转生。
- 灭世终焉：研究/制造/发射灭世终焉链 -> 准备高阶资源和军队 -> 在确认条件满足后触发 reset research。

当前版本先让建筑规划服务这些目标，后续可以继续把 Research 优先级、Army 阻塞目标、自动声望/传承触发都接到同一个 `Goal`。
