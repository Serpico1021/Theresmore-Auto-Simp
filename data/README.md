# Theresmore 本地知识库

本目录保存从项目资料中生成的本地数据集，供后续“目标导向自动化”使用。

## 来源文件

- `..\Theresmore_V1.1数据合集_修正s1.1.xlsx`
- `..\theresmore主线大致流程图.png`
- `..\月明和德鲁伊和灭世的研究建造白名单.txt`

其中 xlsx 提供建筑、研究、敌人、军队、传承、资源等结构化资料；流程图提供主线阶段和关键门槛；白名单文本补充月明、德鲁伊、灭世三个目标的最低研究/建筑路径。

## 生成文件

- `theresmore_knowledge.sqlite`：主 SQLite 数据库。
- `exports\goal_knowledge.json`：目标导向自动化最容易读取的紧凑 JSON。
- `exports\entities.json`：从 xlsx 结构化出的实体清单。
- `exports\entities.csv`、`exports\requirements.csv`、`exports\effects.csv`：便于人工检查的表格导出。
- `exports\objective_items.csv`：月明/德鲁伊/灭世白名单拆分结果。
- `exports\goal_hits.csv`：按关键词在 xlsx 中命中的关键节点。
- `flowchart-crops\*.png`：从主线流程图切出的高清分段图，便于复核流程图文字。

## 重新生成

资料文件变动后运行：

```powershell
$env:PYTHONUTF8='1'
python C:\Users\240076\Desktop\Code\2026\CODEX\THERESMORE\tools\import_theresmore_dataset.py
```

该脚本会重建 `theresmore_knowledge.sqlite` 并刷新 `exports` 下的 JSON/CSV。

## 关键表

- `entities`：建筑、研究、传承、敌人、军队等实体。
- `entity_requirements`：实体的解锁/购买/建造需求。
- `entity_effects`：实体提供的收益。
- `objective_items`：按目标拆出的白名单项，推荐用 `goal_key` 查询：
  - `moonlight`：月明之夜
  - `druid`：德鲁伊线
  - `annihilator`：灭世终焉
- `flowchart_nodes`：流程图中的阶段节点。
- `flowchart_gates`：流程图中的关键门槛。
- `goal_hits`：用关键词从 xlsx 中自动命中的关键实体。

## 查询示例

```sql
-- 月明白名单前 30 项
SELECT type, name, amount
FROM objective_items
WHERE goal_key = 'moonlight'
LIMIT 30;

-- 灭世相关研究程序 ID
SELECT sheet, name, program_id
FROM goal_hits
WHERE goal = 'annihilator' AND sheet = '研究';

-- 流程图里的关键门槛
SELECT stage, gate_name, requirements_json
FROM flowchart_gates;

-- 查看“月明之夜”的 xlsx 需求
SELECT e.name, e.program_id, r.type, r.name, r.amount
FROM entities e
JOIN entity_requirements r ON r.entity_id = e.entity_id
WHERE e.name = '月明之夜';
```

## 后续接入建议

自动化脚本可以先读取 `exports\goal_knowledge.json`，用其中的 `goals[goal].whitelist_items` 作为目标路径；当需要精确条件、程序 ID、收益或资源需求时，再查询 SQLite 的 `entities` / `entity_requirements` / `entity_effects`。
