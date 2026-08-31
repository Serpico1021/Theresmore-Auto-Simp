# 游戏真实数据留档

来源：`files/Theresmore_V1.1数据合集_修正s1.1.xlsx`（用户提供，社区整理的数据合集）。

## 文件

- `enemies.json` —— "敌人"工作表（119 条），字段：
  - `name`：敌方名称（中文）
  - `esp`：探索点数消耗
  - `level`：敌人等级
  - `foundRange`：`found` 搜索位区间（游戏内部随机命中桶范围，不是地图区域）
  - `reqFound`：`{ type, content, qty }`，该敌人在探索列表中出现所需的前置（通常是某科技）
  - `army`：`[{ unit, qty }]`，真实守军组成（抽查 `elder_dragon`/烬火灾主 一条与 `main.js` 源码逐字段核对一致）
  - `rewards`：`[{ content, attr, value }]`，首次击败的奖励
  - `description`：游戏内描述文案
  - `programId`：游戏内部 id（对应 `main.js` 里 `fights` 表的 `key`/攻击页目标 id）
- `army-units.json` —— "军队"工作表（209 条，含玩家单位与敌方单位），字段：
  - `name`/`type`/`troopType`：名称、大类、兵种细分
  - `attack`/`defense`/`splash`/`trample`/`defaultOrder`：战斗属性
  - `trainingReqs`：`[{ type, content, qty }]`，解锁/训练前置（科技、资源花费）
  - `attackCosts`：`[{ name, value }]`，每次出击消耗
  - `upkeepCosts`：`[{ name, value }]`，持有维护消耗（负值＝持续消耗）
  - `description`/`programId`

两个文件都是**纯参考数据**，不参与运行时构建，也不被 `automation-src/build.ps1` 读取——
仅用于人工查阅真实数值（例如后续校正 `annihilatorRoute` 的 `requiredArmy`），
避免再靠猜/啃压缩源码。

## 抽取方法

xlsx 本质是 zip + XML：

1. 解压：`Expand-Archive`（PowerShell）或 `unzip`（Bash）得到 `xl/worksheets/sheetN.xml` +
   `xl/sharedStrings.xml`（字符串统一去重存放在这里，单元格里存的是索引）。
2. 用正则解析每个 `<row>`/`<c>` 单元格：`t="s"` 走 `sharedStrings` 索引，`t="inlineStr"`/`t="str"`
   直接取内联文本，否则按数字处理。数字/十六进制 XML 实体（`&#25628;`/`&#x...;`）需要额外解码，
   不能只处理具名实体（`&lt;`/`&amp;`等），否则中文会残留成乱码转义序列。
3. 表格里同一条记录跨多行合并单元格（一个敌人可能有 2-3 行军队/奖励明细），按"名称列非空即开始
   新记录，名称列为空的后续行都追加到当前记录"的规则归并——工作表本身就是按这个约定排版的。

## xlsx 更新后如何重新生成

若 `files/Theresmore_V1.1数据合集_修正s1.1.xlsx` 内容更新，需要重新生成这两个 JSON：

1. 解压 xlsx，定位敌人/军队分别在哪个 `sheetN.xml`（当前版本敌人在 `sheet3.xml`，军队在
   `sheet4.xml`——sheet 编号可能随 Excel 另存而变化，以工作表标签名"敌人"/"军队"为准，不要
   硬编码 sheet 序号）。
2. 用一个通用的"XML 单元格 → 二维数组"脚本解析成行数组（每行按列索引对齐，空单元格留 `undefined`）。
3. 按上面"合并单元格"的规则把行数组归并成结构化记录，字段顺序对应表头（第 3 行是列名，第 4 行
   开始才是数据）。
4. 抽查一条已知数据（例如 `elder_dragon`/烬火灾主）与 `files/theresmore/main.js` 源码里的
   `army`/`gen`/`reqFound` 字段逐一核对，确认解析脚本没有错位。
