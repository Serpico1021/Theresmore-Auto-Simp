from __future__ import annotations

import csv
import json
import re
import sqlite3
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
EXPORT_DIR = DATA_DIR / "exports"
DB_PATH = DATA_DIR / "theresmore_knowledge.sqlite"

XLSX_GLOB = "Theresmore_V1.1*.xlsx"
FLOWCHART_GLOB = "theresmore主线大致流程图.png"
WHITELIST_GLOB = "月明和德鲁伊和灭世*.txt"

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REL_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"


SHEET_CONFIG = {
    "建筑": {
        "name_col": 0,
        "id_col": None,
        "base_cols": {"类别": 1, "地点": 2, "时代": 3, "建筑上限": 4},
        "requirement": {"type": 5, "name": 6, "amount": 7, "growth": 8},
        "effect": {"name": 9, "attribute": 10, "value": 11},
    },
    "研究": {
        "name_col": 0,
        "id_col": 8,
        "base_cols": {"描述": 7},
        "requirement": {"type": 1, "name": 2, "amount": 3},
        "effect": {"name": 4, "attribute": 5, "value": 6},
    },
    "传承": {
        "name_col": 0,
        "id_col": 8,
        "base_cols": {"描述": 7},
        "requirement": {"type": 1, "name": 2, "amount": 3},
        "effect": {"name": 4, "attribute": 5, "value": 6},
    },
    "成就": {
        "name_col": 0,
        "id_col": 9,
        "base_cols": {"稀有度": 1, "描述": 8},
        "requirement": {"type": 2, "name": 3, "amount": 4},
        "effect": {"name": 5, "attribute": 6, "value": 7},
    },
    "祈祷与魔法": {
        "name_col": 0,
        "id_col": 9,
        "base_cols": {"类别": 1, "描述": 8},
        "requirement": {"type": 2, "name": 3, "amount": 4},
        "effect": {"name": 5, "attribute": 6, "value": 7},
    },
    "人口": {
        "name_col": 0,
        "id_col": 7,
        "base_cols": {},
        "requirement": {"type": 1, "name": 2, "amount": 3},
        "effect": {"name": 4, "attribute": 5, "value": 6},
    },
    "资源": {
        "name_col": 0,
        "id_col": 7,
        "base_cols": {"基础上限": 1, "可手动": 2, "隐藏": 3},
        "requirement": {"type": 4, "name": 5, "amount": 6},
        "effect": None,
    },
    "军队": {
        "name_col": 0,
        "id_col": None,
        "base_cols": {"类型": 1, "攻击": 2, "防御": 3, "溅射": 4, "践踏": 5, "默认顺序": 6, "兵种": 7},
        "requirement": {"type": 8, "name": 9, "amount": 10},
        "effect": None,
    },
    "敌人": {
        "name_col": 0,
        "id_col": None,
        "base_cols": {"esp": 1, "等级": 2, "搜索位范围": 3},
        "requirement": {"type": 4, "name": 5, "amount": 6},
        "effect": {"name": 9, "attribute": 10, "value": 11},
        "unit": {"name": 7, "amount": 8},
    },
}


GOAL_ALIASES = {
    "moonlight": ["月明", "月明之夜"],
    "druid": ["德鲁伊", "孤独的德鲁伊", "接受德鲁伊"],
    "annihilator": ["灭世", "灭世终焉", "发射灭世终焉", "销毁灭世终焉"],
    "prestige": ["光荣退休", "传承", "转生"],
    "stage_progress": ["结束远古时代", "结束封建时代", "航海", "法力深井"],
}

CHINESE_GOAL_KEYS = {
    "月明": "moonlight",
    "德鲁伊": "druid",
    "灭世": "annihilator",
}


FLOWCHART_STAGES = [
    {
        "stage": "远古时代",
        "nodes": [
            "住房", "农业", "存储", "农场", "储物间", "饲育", "马厩",
            "琢石", "采石场", "采矿", "矿井", "青铜加工", "铁加工",
            "砍伐木材", "伐木工营地", "陶器", "工匠作坊", "写作", "宗教",
            "数学", "货币", "市场", "结束远古时代", "市中心",
        ],
        "gates": [
            {"name": "采矿门槛", "requirements": ["3采石场"]},
            {"name": "饲育门槛", "requirements": ["5农场", "1储物间"]},
            {"name": "远古结束门槛", "requirements": ["15普通房屋", "5工坊", "铁加工", "宗教"]},
        ],
        "focus": ["stage_progress"],
    },
    {
        "stage": "封建时代",
        "nodes": [
            "封建时代", "建筑学", "确定边界", "卡纳瓦先驱", "守望者前哨",
            "月明之夜", "教育学", "公会", "食品保存", "银行业", "金属铸造",
            "锻钢", "骑士精神", "集市和市场", "结束封建时代",
        ],
        "gates": [
            {"name": "月明门槛", "requirements": ["4守望者前哨"]},
            {"name": "市场门槛", "requirements": ["公会", "银行业", "3市场"]},
            {
                "name": "封建结束门槛",
                "requirements": ["3宅邸", "3木匠工坊", "3钢铁厂", "3大学", "3食品杂货店", "集市和市场", "骑士精神", "月明之夜"],
            },
        ],
        "focus": ["moonlight", "stage_progress"],
    },
    {
        "stage": "中世纪 / 德鲁伊线",
        "nodes": [
            "自由思想家学院", "科学理论", "化学", "火药", "灾难", "解决危机",
            "难民区", "龙之骨", "巨龙来袭", "印刷机", "圣职者军团",
            "魔法艺术教学", "法力应用", "法力深井", "法力引擎", "机械化",
            "研究区", "生态学", "与自然沟通", "孤独的德鲁伊", "放逐德鲁伊",
            "德鲁伊之怒", "接受德鲁伊", "城市的奇迹",
        ],
        "gates": [
            {"name": "法力应用门槛", "requirements": ["魔法艺术教学", "巨龙来袭"]},
        ],
        "focus": ["druid", "stage_progress"],
    },
    {
        "stage": "纳红石时代 / 海岛",
        "nodes": [
            "长途探险", "登攀者世界的海岸", "海湾计划", "海湾区", "远大梦想",
            "航海", "远西岛", "小岛前哨", "岛屿前哨", "踏上旅途",
            "定居点大厅", "被烧毁的农场", "兽人集中营", "兽人的威胁",
            "兽人突袭队", "兽人堡垒", "兽人艾米亚克堡垒", "人类的至暗时刻",
        ],
        "gates": [
            {"name": "航海门槛", "requirements": ["海湾区", "远大梦想"]},
            {"name": "海岛推进门槛", "requirements": ["12定居点大厅"]},
        ],
        "focus": ["annihilator", "stage_progress"],
    },
    {
        "stage": "深渊 / 灭世线",
        "nodes": [
            "光之信标", "调查深渊", "俯瞰黑暗", "划定疆界", "奥术研究", "地下房间",
            "勘探周围区域", "黑暗村庄", "黑暗之地", "辉烬", "辉烬工厂",
            "光耀广场", "火箭技术", "无人机", "卫星", "信号", "解密信号",
            "信号机器", "信号机器奇观", "激活信号机器", "制造灭世终焉",
            "发射灭世终焉", "销毁灭世终焉", "灭世转生", "恶孽之手",
            "莫德凯·暗禁男爵", "无智之恶", "登攀者世界的救世主",
        ],
        "gates": [
            {"name": "黑暗之地门槛", "requirements": ["5光之信标", "黑暗村庄"]},
            {"name": "火箭/信号门槛", "requirements": ["5光耀广场"]},
            {"name": "无智之恶门槛", "requirements": ["销毁灭世终焉", "莫德凯·暗禁男爵", "恶孽之手"]},
        ],
        "focus": ["annihilator"],
    },
]


def cell_col_index(cell_ref: str) -> int:
    letters = "".join(ch for ch in cell_ref if ch.isalpha())
    number = 0
    for ch in letters:
        number = number * 26 + ord(ch.upper()) - 64
    return number - 1


def clean(value):
    if value is None:
        return ""
    value = str(value).replace("\r\n", "\n").strip()
    if re.fullmatch(r"-?\d+\.0", value):
        return str(int(float(value)))
    return value


def read_shared_strings(z: ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in z.namelist():
        return []
    root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    return ["".join(t.text or "" for t in si.iter(NS + "t")) for si in root.findall(NS + "si")]


def cell_value(cell, shared_strings: list[str]) -> str:
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        return clean("".join(t.text or "" for t in cell.iter(NS + "t")))
    value_node = cell.find(NS + "v")
    if value_node is None:
        return ""
    text = value_node.text or ""
    if cell_type == "s":
        return clean(shared_strings[int(text)] if text else "")
    return clean(text)


def read_xlsx(path: Path):
    with ZipFile(path) as z:
        shared = read_shared_strings(z)
        workbook = ET.fromstring(z.read("xl/workbook.xml"))
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        relmap = {item.attrib["Id"]: item.attrib["Target"].lstrip("/") for item in rels}
        sheets = []
        for sheet in workbook.find(NS + "sheets"):
            name = sheet.attrib["name"]
            rid = sheet.attrib[REL_NS + "id"]
            xml_path = relmap[rid]
            root = ET.fromstring(z.read(xml_path))
            rows = []
            for row in root.iter(NS + "row"):
                values = []
                for cell in row.findall(NS + "c"):
                    idx = cell_col_index(cell.attrib.get("r", "A1"))
                    while len(values) <= idx:
                        values.append("")
                    values[idx] = cell_value(cell, shared)
                if any(values):
                    rows.append({"row_num": int(row.attrib.get("r", len(rows) + 1)), "values": values})
            sheets.append({"name": name, "xml_path": xml_path, "rows": rows})
        return sheets


def pad(values: list[str], length: int = 16) -> list[str]:
    return values + [""] * max(0, length - len(values))


def parse_entities(sheets):
    entities = []
    requirements = []
    effects = []
    enemy_units = []
    entity_index = 0

    for sheet in sheets:
        config = SHEET_CONFIG.get(sheet["name"])
        if not config:
            continue
        current = None
        for row in sheet["rows"]:
            values = pad(row["values"], 20)
            name = values[config["name_col"]]
            if name in {"建筑名", "研究名称", "传承名称", "成就名", "名称", "岗位", "物资", "单位名称", "敌军名称"}:
                continue
            if name and not any(marker in name for marker in ["基础信息", "建筑数据", "解锁新科技", "包含可招募"]):
                entity_index += 1
                metadata = {k: values[v] for k, v in config.get("base_cols", {}).items() if values[v]}
                program_id = values[config["id_col"]] if config.get("id_col") is not None else ""
                current = {
                    "entity_id": entity_index,
                    "sheet": sheet["name"],
                    "row_num": row["row_num"],
                    "name": name,
                    "program_id": program_id,
                    "metadata": metadata,
                }
                entities.append(current)
            if not current:
                continue

            req_cfg = config.get("requirement")
            if req_cfg:
                req_name = values[req_cfg["name"]]
                req_type = values[req_cfg["type"]]
                req_amount = values[req_cfg["amount"]]
                req_growth = values[req_cfg.get("growth", -1)] if req_cfg.get("growth") is not None and req_cfg.get("growth", -1) >= 0 else ""
                if req_name or req_type or req_amount:
                    requirements.append({
                        "entity_id": current["entity_id"],
                        "sheet": sheet["name"],
                        "row_num": row["row_num"],
                        "type": req_type,
                        "name": req_name,
                        "amount": req_amount,
                        "growth": req_growth,
                    })

            eff_cfg = config.get("effect")
            if eff_cfg:
                eff_name = values[eff_cfg["name"]]
                eff_attr = values[eff_cfg["attribute"]]
                eff_value = values[eff_cfg["value"]]
                if eff_name or eff_attr or eff_value:
                    effects.append({
                        "entity_id": current["entity_id"],
                        "sheet": sheet["name"],
                        "row_num": row["row_num"],
                        "name": eff_name,
                        "attribute": eff_attr,
                        "value": eff_value,
                    })

            unit_cfg = config.get("unit")
            if unit_cfg:
                unit_name = values[unit_cfg["name"]]
                unit_amount = values[unit_cfg["amount"]]
                if unit_name or unit_amount:
                    enemy_units.append({
                        "entity_id": current["entity_id"],
                        "row_num": row["row_num"],
                        "name": unit_name,
                        "amount": unit_amount,
                    })

    return entities, requirements, effects, enemy_units


def split_whitelist_sections(text: str):
    sections = {}
    current = None
    buf = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped in {"月明白名单", "德鲁伊白名单", "灭世白名单"}:
            if current:
                sections[current] = "\n".join(buf).strip()
            current = stripped.replace("白名单", "")
            buf = []
        elif current:
            buf.append(line)
    if current:
        sections[current] = "\n".join(buf).strip()
    return sections


def parse_whitelist_items(text: str):
    sections = split_whitelist_sections(text)
    items = []
    for goal_name, body in sections.items():
        mode = "research"
        for line in body.splitlines():
            stripped = line.strip()
            if not stripped:
                continue
            if re.search(r"\d", stripped) and not any(word in stripped for word in ["研究", "白名单", "祈祷", "解决危机"]):
                mode = "building"
            if stripped.startswith("祈祷"):
                mode = "prayer"
                continue
            if stripped.startswith("最少") or "设置好的automation" in stripped or "产量不足" in stripped:
                items.append({"goal_key": CHINESE_GOAL_KEYS.get(goal_name, goal_name), "goal": goal_name, "type": "note", "name": stripped, "amount": "", "source_line": stripped})
                continue
            pieces = re.split(r"\s+|，|,|、|→|或者|（|）|\(|\)|加上：|上面德鲁伊那些研究加上：", stripped)
            for piece in pieces:
                if piece is None:
                    continue
                piece = piece.strip(" ：:+")
                if not piece:
                    continue
                match = re.match(r"^(\d+)(.+)$", piece)
                amount = match.group(1) if match else ""
                name = match.group(2).strip() if match else piece
                if not name or name in {"上面德鲁伊那些研究", "非必要的"}:
                    continue
                item_type = mode
                if any(token in name for token in ["战士", "人口", "声誉", "传承"]):
                    item_type = "note"
                items.append({"goal_key": CHINESE_GOAL_KEYS.get(goal_name, goal_name), "goal": goal_name, "type": item_type, "name": name, "amount": amount, "source_line": stripped})
    return sections, items


def find_goal_hits(entities):
    hits = []
    for entity in entities:
        blob = json.dumps(entity, ensure_ascii=False)
        for goal, aliases in GOAL_ALIASES.items():
            if any(alias in blob for alias in aliases):
                hits.append({
                    "goal": goal,
                    "entity_id": entity["entity_id"],
                    "sheet": entity["sheet"],
                    "name": entity["name"],
                    "program_id": entity["program_id"],
                    "match_aliases": [alias for alias in aliases if alias in blob],
                })
    return hits


def write_csv(path: Path, rows: list[dict]):
    if not rows:
        return
    keys = sorted({key for row in rows for key in row.keys()})
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=keys)
        writer.writeheader()
        writer.writerows(rows)


def rebuild_database(sheets, entities, requirements, effects, enemy_units, sections, whitelist_items, goal_hits, source_files):
    DATA_DIR.mkdir(exist_ok=True)
    if DB_PATH.exists():
        DB_PATH.unlink()
    con = sqlite3.connect(DB_PATH)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("CREATE TABLE source_files (kind TEXT PRIMARY KEY, path TEXT, size INTEGER, mtime TEXT)")
    con.execute("CREATE TABLE workbook_sheets (sheet TEXT PRIMARY KEY, xml_path TEXT, row_count INTEGER)")
    con.execute("CREATE TABLE workbook_rows (sheet TEXT, row_num INTEGER, values_json TEXT, PRIMARY KEY(sheet, row_num))")
    con.execute("CREATE TABLE entities (entity_id INTEGER PRIMARY KEY, sheet TEXT, row_num INTEGER, name TEXT, program_id TEXT, metadata_json TEXT)")
    con.execute("CREATE TABLE entity_requirements (entity_id INTEGER, sheet TEXT, row_num INTEGER, type TEXT, name TEXT, amount TEXT, growth TEXT)")
    con.execute("CREATE TABLE entity_effects (entity_id INTEGER, sheet TEXT, row_num INTEGER, name TEXT, attribute TEXT, value TEXT)")
    con.execute("CREATE TABLE enemy_units (entity_id INTEGER, row_num INTEGER, name TEXT, amount TEXT)")
    con.execute("CREATE TABLE goal_aliases (goal TEXT, alias TEXT)")
    con.execute("CREATE TABLE goal_hits (goal TEXT, entity_id INTEGER, sheet TEXT, name TEXT, program_id TEXT, match_aliases_json TEXT)")
    con.execute("CREATE TABLE objective_sections (goal_key TEXT, goal TEXT PRIMARY KEY, body TEXT)")
    con.execute("CREATE TABLE objective_items (goal_key TEXT, goal TEXT, type TEXT, name TEXT, amount TEXT, source_line TEXT)")
    con.execute("CREATE TABLE flowchart_stages (stage TEXT PRIMARY KEY, focus_json TEXT)")
    con.execute("CREATE TABLE flowchart_nodes (stage TEXT, node_name TEXT, PRIMARY KEY(stage, node_name))")
    con.execute("CREATE TABLE flowchart_gates (stage TEXT, gate_name TEXT, requirements_json TEXT)")

    con.executemany("INSERT INTO source_files VALUES (:kind, :path, :size, :mtime)", source_files)
    con.executemany(
        "INSERT INTO workbook_sheets VALUES (:name, :xml_path, :row_count)",
        [{"name": s["name"], "xml_path": s["xml_path"], "row_count": len(s["rows"])} for s in sheets],
    )
    con.executemany(
        "INSERT INTO workbook_rows VALUES (:sheet, :row_num, :values_json)",
        [
            {"sheet": s["name"], "row_num": r["row_num"], "values_json": json.dumps(r["values"], ensure_ascii=False)}
            for s in sheets
            for r in s["rows"]
        ],
    )
    con.executemany(
        "INSERT INTO entities VALUES (:entity_id, :sheet, :row_num, :name, :program_id, :metadata_json)",
        [
            {
                **entity,
                "metadata_json": json.dumps(entity["metadata"], ensure_ascii=False),
            }
            for entity in entities
        ],
    )
    con.executemany("INSERT INTO entity_requirements VALUES (:entity_id, :sheet, :row_num, :type, :name, :amount, :growth)", requirements)
    con.executemany("INSERT INTO entity_effects VALUES (:entity_id, :sheet, :row_num, :name, :attribute, :value)", effects)
    con.executemany("INSERT INTO enemy_units VALUES (:entity_id, :row_num, :name, :amount)", enemy_units)
    con.executemany("INSERT INTO goal_aliases VALUES (?, ?)", [(goal, alias) for goal, aliases in GOAL_ALIASES.items() for alias in aliases])
    con.executemany(
        "INSERT INTO goal_hits VALUES (:goal, :entity_id, :sheet, :name, :program_id, :match_aliases_json)",
        [{**hit, "match_aliases_json": json.dumps(hit["match_aliases"], ensure_ascii=False)} for hit in goal_hits],
    )
    con.executemany(
        "INSERT INTO objective_sections VALUES (?, ?, ?)",
        [(CHINESE_GOAL_KEYS.get(goal, goal), goal, body) for goal, body in sections.items()],
    )
    con.executemany("INSERT INTO objective_items VALUES (:goal_key, :goal, :type, :name, :amount, :source_line)", whitelist_items)
    for stage in FLOWCHART_STAGES:
        con.execute("INSERT INTO flowchart_stages VALUES (?, ?)", (stage["stage"], json.dumps(stage["focus"], ensure_ascii=False)))
        con.executemany("INSERT INTO flowchart_nodes VALUES (?, ?)", [(stage["stage"], node) for node in stage["nodes"]])
        con.executemany(
            "INSERT INTO flowchart_gates VALUES (?, ?, ?)",
            [(stage["stage"], gate["name"], json.dumps(gate["requirements"], ensure_ascii=False)) for gate in stage["gates"]],
        )

    con.execute("CREATE INDEX idx_entities_name ON entities(name)")
    con.execute("CREATE INDEX idx_entities_program_id ON entities(program_id)")
    con.execute("CREATE INDEX idx_requirements_name ON entity_requirements(name)")
    con.execute("CREATE INDEX idx_effects_name ON entity_effects(name)")
    con.execute("CREATE INDEX idx_objective_items_goal ON objective_items(goal)")
    con.execute("CREATE INDEX idx_objective_items_goal_key ON objective_items(goal_key)")
    con.execute("CREATE INDEX idx_goal_hits_goal ON goal_hits(goal)")
    con.commit()
    con.close()


def export_json_and_csv(entities, requirements, effects, whitelist_items, goal_hits):
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    compact = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "goals": {
            goal: {
                "aliases": aliases,
                "whitelist_items": [item for item in whitelist_items if item.get("goal_key") == goal],
                "xlsx_hits": [hit for hit in goal_hits if hit["goal"] == goal],
            }
            for goal, aliases in GOAL_ALIASES.items()
        },
        "flowchart_stages": FLOWCHART_STAGES,
    }
    (EXPORT_DIR / "goal_knowledge.json").write_text(json.dumps(compact, ensure_ascii=False, indent=2), encoding="utf-8")
    (EXPORT_DIR / "entities.json").write_text(json.dumps(entities, ensure_ascii=False, indent=2), encoding="utf-8")
    write_csv(EXPORT_DIR / "entities.csv", entities)
    write_csv(EXPORT_DIR / "requirements.csv", requirements)
    write_csv(EXPORT_DIR / "effects.csv", effects)
    write_csv(EXPORT_DIR / "objective_items.csv", whitelist_items)
    write_csv(EXPORT_DIR / "goal_hits.csv", goal_hits)


def main():
    DATA_DIR.mkdir(exist_ok=True)
    xlsx = next(PROJECT_ROOT.glob(XLSX_GLOB))
    flowchart = next(PROJECT_ROOT.glob(FLOWCHART_GLOB))
    whitelist = next(PROJECT_ROOT.glob(WHITELIST_GLOB), None)

    sheets = read_xlsx(xlsx)
    entities, requirements, effects, enemy_units = parse_entities(sheets)
    whitelist_text = whitelist.read_text(encoding="utf-8-sig") if whitelist else ""
    sections, whitelist_items = parse_whitelist_items(whitelist_text)
    goal_hits = find_goal_hits(entities)
    source_files = []
    for kind, path in [("xlsx", xlsx), ("flowchart_png", flowchart), ("whitelist_txt", whitelist)]:
        if path:
            stat = path.stat()
            source_files.append({
                "kind": kind,
                "path": str(path),
                "size": stat.st_size,
                "mtime": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            })

    rebuild_database(sheets, entities, requirements, effects, enemy_units, sections, whitelist_items, goal_hits, source_files)
    export_json_and_csv(entities, requirements, effects, whitelist_items, goal_hits)

    print(f"database={DB_PATH}")
    print(f"sheets={len(sheets)} entities={len(entities)} requirements={len(requirements)} effects={len(effects)} objective_items={len(whitelist_items)} goal_hits={len(goal_hits)}")
    for goal in ["moonlight", "druid", "annihilator"]:
        print(f"{goal}_hits={sum(1 for hit in goal_hits if hit['goal'] == goal)}")


if __name__ == "__main__":
    main()
