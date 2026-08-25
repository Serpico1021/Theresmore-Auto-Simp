# THERESMORE — 项目约束

约束范围：本文件覆盖 Skills 白名单、Bash 输出规则、代码探索（codemap/Explore）、
维护工作流、项目目标、会话语言共六项，前三项参照 `C:\Users\240076\Desktop\Code\2026\EECToolKit`
的项目约束改写，后三项为本项目自身约定。

## 会话语言

本项目会话一律使用中文回复用户（代码、注释、commit message 等不受此约束，按各自既有惯例）。

## 项目目标：尽可能智能化

本项目的方向是让自动化脚本**尽可能自主决策，减少用户手动配置**。这条原则应指导所有新子系统的
默认设计：

- **默认开、不默认关**：新的目标驱动能力上线后，默认值应直接生效（`enabled: true`），
  而不是做成一个需要用户手动打开的可选项。`smartBuild.enabled` 已经从 `false` 改为
  `true`（`automation-src/fragments/smart-build-options.js`），这是既定方向，不是待定问题。
- 手动配置项（逐建筑/逐科技的优先级列表等）定位为**兜底 fallback + 少量强制覆盖入口**
  （`manualOverrides`），不是日常操作面，UI 上应逐步收进"高级/手动覆盖"折叠区，而不是继续
  作为主操作面板铺开。
- 后续给 Army 探索/攻击、科技研究、声望/传承时机等子系统做目标驱动设计时，同样默认全自动，
  只在用户显式要求"手动兜底"时才读取手动配置。

## 维护工作流：模块拆分 + 自动合并

本项目通过 `automation-src/fragments/*.js` + `automation-src/build.ps1` 维护，**避免直接
读取/编辑 5 万+ 行的单体生成脚本**。完整规则见 `AGENTS.md`，此处只强调与探索/codemap相关的部分：

- 改动一律发生在 `automation-src/fragments/` 下的小文件里；`automation-src/base/*.base.user.js`
  只是构建用的外壳模板，禁止手改（`AGENTS.md` 已明确）。
- 改完 fragments 后必须依次执行：`automation-src/build.ps1` 重新生成 → `node --check` 校验
  生成产物语法 → `codemap regen --repo theresmore` 刷新索引（见下节）。三步都不能省。
- 需要理解 base 巨型脚本里某段现有逻辑时，优先复用已经验证过的行号锚点（见
  `.codemap-conventions.md` 里的"已确认的关键锚点"），而不是重新大范围搜索。

## Superpowers 技能白名单约束

**本项目 superpowers 系列技能只允许使用 `brainstorming`，其余技能一律禁止调用**
（包括但不限于 `writing-plans`、`subagent-driven-development`、`using-git-worktrees`、
`requesting-code-review`、`finishing-a-development-branch`、`test-driven-development`、
`frontend-design`）。

- 设计阶段用 `brainstorming` 与用户澄清需求、产出 spec（例如目标驱动规划器的各子系统改造设计）。
- spec 确认后，实现计划、任务拆解、执行、代码评审等后续环节一律采用**直接工程实践**
  （Read/Edit/Write/Bash，必要时用 `Agent` 工具做子任务分派），不通过 Skill 工具调用上述技能。
- 已写成的计划/spec 文档本身不受影响，只是后续不再用这些技能名义驱动。

## Bash 输出规则（强制）

当执行任何 Bash 命令时，必须通过 `| head -20`、`| grep keyword` 或 `--max-count` 限制输出量。
严禁在未加限制的情况下执行 `cat`、`find` 或 `git log`。

## 代码探索约束

> ### ⛔ 禁止直接启动 Explore agent
> **使用 Explore agent 之前，必须先向用户提问并获得明确允许。**
> 提问时必须加粗或用引用块高亮说明"将要使用 Explore agent"，否则视为违反约束。
> 在获得用户同意之前，只能使用 codemap 和 Grep/Read 工具进行探索。

**codemap 优先原则：一切符号定位、文件查找、跨模块探查，首选 codemap，禁止先 grep/Read 再猜结构。**

已注册的 repo slug：

| slug | 路径 | 内容 |
|------|------|------|
| `theresmore` | `C:\Users\240076\Desktop\Code\2026\CODEX\THERESMORE` | 油猴自动化脚本项目 |

**已知局限**：本项目主体（`automation-src/base/*.base.user.js`）是原版打包脚本拆出来的巨型
单文件（5万+ 行），codemap 的符号索引对它覆盖有限。且已确认 `automation-src/fragments/
smart-build-planner.js` 里的核心逻辑整体包在一个 IIFE（`const smartBuildPlanner = (() => {...})()`）
里，函数都缩进了一层，codemap 的提取器只认列宽 0 的顶层声明，导致 `codemap regen` 目前只扫到
6 个文件、7 个符号，且集中在无关的 `NumberParser` 类上——**这是提取器的固有限制，不打算为了
迁就它去改代码缩进结构**。因此本项目里 `codemap find`/`codemap read` 命中失败是预期情况，
**命中失败后直接退回 Grep（带 `head_limit`）+ Read（带 `offset`/`limit` 定点读取），不必反复
重试 codemap 命令**。

为弥补这个盲区，项目根目录维护了 `.codemap-conventions.md`：手工记录 `smart-build-planner.js`
内部各函数的行号，以及 base 巨型脚本里已确认的关键锚点（Build/Army/Research 等子系统的注入点、
手动配置 UI 位置）。**查找 fragments 内部符号或 base 脚本锚点时，先看这份文件，不必重新
grep/read 定位一遍**；改动 fragments 结构（新增/删除/大改函数）后要同步更新这份文件，并跑一次
`codemap regen --repo theresmore`。

### 约束的生效范围

本节规则对"本项目里执行任务的每一个模型实例"生效，不只是主线程：

| 执行者 | 是否受约束 | 落实方式 |
|--------|-----------|---------|
| 主线程（Claude Code 主对话） | ✅ | 直接遵守本节 |
| 临时派发的通用子 agent（`general-purpose` / `claude` 等） | ✅ | 主线程派发时必须把 codemap 优先 + 禁用 Explore 写进 prompt |
| `Explore` agent 本身 | ⛔ | 未经用户明确同意，一律不得启动（含主线程与任何子 agent） |

执行细则：

- **主线程每次用 `Agent` 工具派发子任务时，prompt 里必须显式带上这几句**（可照抄）：
  > 优先使用 codemap（`codemap find <symbol> --repo theresmore` / `codemap read <file> <symbol> --repo theresmore`）
  > 定位符号与文件；本项目主体是巨型单文件脚本，codemap 命中失败是预期情况，失败后直接退回
  > Grep（带 `head_limit`）/ Read（带 `offset`/`limit`），不要反复重试 codemap 命令。
  > 禁止启动 Explore agent。
  > 确需「全仓扫描 / 批量读十个以上文件 / 读单个 500 行以上文件全文」这类高开销探索时，
  > 先停下来在报告里说明要扫什么、为什么现有手段不够用，交回主线程请示用户，未获同意不得自行开跑。
- **子 agent 不得自行升级探索手段**：如果 codemap + Grep/Read 都不够用，应在返回报告里写明
  "建议使用 Explore agent 及理由"，由主线程转达用户决策，**不得自己发起**。
- 该约束管**探索手段的选择**（codemap 优先、禁用 Explore）；是否要派 subagent 去做探索，
  见下方「使用规范」——**不再是"探索类任务一律派 subagent"，而是主线程优先自己用
  codemap/Grep/Read 直接定位，只有规模明显超出主线程可控成本时才派 subagent**（2026-08-25
  用户明确反馈：不要动不动就起一个 subagent 出去调查再生成报告，那样增加往返成本、
  丢失上下文细节，常规的单点定位应该主线程自己直接查）。

### 使用规范

1. **主线程优先自己定位，不要动不动就派 subagent**：常规的"查符号、找文件、看某段逻辑
   写了什么、定位一个 bug 的根因"这类任务，主线程直接用 codemap（先查
   `.codemap-conventions.md`，查不到再 `codemap find <symbol> --repo theresmore` /
   `codemap read <file> <symbol> --repo theresmore`）加 Grep（带 `head_limit`）/ Read（带
   `offset`/`limit`）自己完成，**不要为此专门起一个 subagent 去"调查再生成报告"**。
2. **读具体实现**优先用 `codemap read`；对 `automation-src/fragments/` 下的模块化代码尤其有效；
   对 base 巨型脚本命中失败时退回 `Read` + `offset`/`limit`。
3. 改动较多时执行 `codemap regen --repo theresmore` 更新索引，保持 codemap 与源码同步。
4. **只有 codemap 和 Grep/Read 均无法满足探查需求时**，才可提出使用 Explore agent，并必须先获得用户同意。
5. **仅在探索规模明显超出主线程可控成本时才派 subagent**，例如：需要跨十个以上文件交叉比对、
   需要通读多个大文件的完整调用链、或用户明确要求"帮我梳理一遍整体结构/大范围概览"。
   派发时 prompt 里必须写明"codemap 优先 + 禁用 Explore agent"（见上方"约束的生效范围"）。
   **单点 bug 定位、单个符号/函数查找、读一两个文件确认逻辑，一律不属于这一类，主线程自己做，
   不派 subagent。**
