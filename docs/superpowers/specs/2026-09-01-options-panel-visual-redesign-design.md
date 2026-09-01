# Manage Options 面板视觉/信息架构重设计 —— 设计 spec + 完成情况

日期：2026-09-01

## 背景

Manage Options 面板原来用「单行横向 tab」承载 10+ 个顶层页签（Build/Research/Marketplace/
Population/Army/Magic/Diplomacy/Automation/Cosmetics/Cheats，外加 Goal Path、Annihilator
Route 两个通过 marker 注入的 tab），在 1920×1080 下会换行，换行后的第二行正好落在下方展开
内容区域的遮挡范围内，导致 Cosmetics/Cheats 等靠后的 tab 点不到。这是本轮重设计的直接触发点。

用 `frontend-design` skill 做了一轮独立的设计探索（产出物是一个不在本仓库内的原型
`quartermaster-console.html`，深色 ink/brass/parchment/teal 配色，对比了"横向单行 tab"
现状 vs"侧边栏分组导航"提案，附带一版密度优化 demo），确认了两个结论：

1. **横向单行 tab 是结构性错误，不是响应式细节问题**——页签数量会持续增长（Goal Path、
   Annihilator Route 就是后来追加的），横向空间应该让给密集表单网格，而不是导航本身。
2. 逐建筑/逐科技的 Max/Priority 手动覆盖列表，按项目方向（见 `CLAUDE.md`"项目目标：
   尽可能智能化"一节）应该退居"高级/手动覆盖"折叠区，不再占主视图首屏空间。

据此把整个重设计拆成 4 个 Phase 落地，本文档整理每个 Phase 的完成情况，以及原型里"提了但
没做/没完全照做"的部分，供后续继续迭代时参考，不用重新翻会话记录。

## 完成情况

全部改动都发生在 `automation-src/fragments/options-panel-tabs.{template.html,css,js}`
三个 fragment 文件里，通过 `automation-src/build.ps1` 拼进 base 巨型模板，**全程没有新增
base marker**——因为整个 Manage Options 面板本身已经是 fragment 化的，这次纯粹是在已抽出
的结构内部继续演化，不涉及新的 base 接入点。已提交为 commit `9044edf`（Phase 1-4 主体）+
`33209d0`（Phase 4 续：胶囊子页签 + 数量徽章）。

### Phase 1 — 侧边栏分组导航 ✅

顶层 tab 从横向单行改成左侧竖排、按分组折叠（`<details class="taNavGroup">`）：
Economy（Build/Marketplace/Population）、Progression（Research/Magic/Goal Path/
Annihilator Route）、Military（Army/Diplomacy）、System（Automation/Cosmetics/Cheats，
默认收起，呼应"手动配置退居次要"方向）。纵向列表天然可滚动，新增页签不会再触发换行/
遮挡问题。

### Phase 2 — 密度优化 ✅

- 面板顶部新增常驻搜索框 + "仅看已修改"复选框（`#taOptFilterInput`/
  `#taOptFilterOnlyChanged`），逻辑在 `options-panel-tabs.js` 的 `initOptionsPanelFilter()`。
- 原来等宽卡片墙（`grid-cols-fill-240`，Max/Priority 不对齐、找一个特定项目全靠肉眼扫描）
  改成 `.taOptList`/`.taOptRow` 的列对齐网格布局，Name/Max/Priority 三列固定宽度对齐。
- 已修改项（非默认值）加圆点+左边框高亮（`.taOptRow.taOptChanged`）。
- 每个分类（建筑分类、研究分类等）包一层 `<details class="taOptCatToggle" open>`，默认
  展开，可折叠。
- **关键工程教训**：`setAllValues()` 家族的批量按钮（Set all Max/Prio、minus1Medium、
  zeroDisabled、spellsResource/Army Enable/Disable、toggleLevelFights）全部通过 CLASS
  选择器定位外层容器（`div.flex.flex-wrap:not(.unsafe)`/`.spellsResource`/`.spellsArmy`/
  `.taFights.levelN`），只要不改这些 class 本身，套多少层 `<details>` 外壳都不会影响这些
  按钮——这条教训在 Phase 3/4 里被反复复用，是这次能安全大改结构而不破坏功能的核心前提。

### Phase 3 — 手动配置收进"高级：手动覆盖"折叠区 ✅

9 处逐项 Max/Priority/关系覆盖列表（Build 的 City/Colony/Abyss 各一个、Population Hire、
Research 的 Exclusive/Regular/Dangerous 三分类一起、Magic/Prayers 的两分类一起、
Magic/Spells 的 Resource/Army 两分类一起、Army 兵种、Army/Attack、Diplomacy Factions、
Cheats 里的 Legacies）再包一层 `<details class="taOptAdvanced">`，**默认折叠**（比
`taOptCatToggle` 更靠后一级）。

配套 JS：
- 搜索/仅看已修改命中时，沿 `closest('details')` 链一路向上展开所有祖先 `<details>`
  （不管嵌套几层）。
- `expandAdvancedIfManualOverrides()`：勾选 Automation 面板的"Manual values override
  smart plan"（`smartBuild.manualOverrides`）复选框时，自动展开全部 9 处高级区。

**没有收纳的部分**（明确不属于"逐项覆盖"）：Marketplace 的资源勾选列表、Army/Explore 的
min/max 数字设置、各 tab 的全局阈值设置（如"Dangerous fights require enough army"/
"Minimum Food"/"Minimum Mana"）。

用户已实机测试确认：默认折叠状态、两层 `<details>` 联动展开、manualOverrides 联动展开、
全部批量按钮，均正常。

### Phase 4 — 深色 ink/brass 主题 ✅

原型的信息架构部分（Phase 1/2/3）落地时沿用的是游戏原生浅色配色，没跟进原型的视觉配色。
用户在"浅色+brass/teal强调色"vs"完全深色主题"两个选项里选了**完全按原型改**，接受这个
面板与游戏其余浅色 UI 形成视觉反差。

- 模板最外层加 `<div class="taOptionsDark">` 包裹整个面板输出。
- 在这层定义 `--ta-ink-900/800/700/600`、`--ta-brass-300/500/700`、`--ta-parchment`、
  `--ta-slate`、`--ta-teal`、`--ta-danger` 一套 CSS 变量（取值抄自原型），靠继承传给所有
  子选择器——**只替换硬编码颜色值，不动任何 `grid`/`flex`/`position` 布局属性**。
- 重新着色范围：侧边栏（激活态 brass 左边框+brass 文字）、二级子页签（当时只换色，见下方
  Phase 4 续）、搜索栏、分类折叠头（新增 ▸/▾ 前缀图标）、逐项列表行（已修改标记从橙色
  改青色，因为 `.taOptRow` 是 `display:contents` 不渲染盒子，左边框改加在 `.taOptName`
  单元格上）、`taOptAdvanced`（浅橙底改深色虚线卡片）、通用按钮/输入框/下拉框。

**字体做了让步**：原型用 `@import` 加载 Google Fonts（Fraunces/Inter/JetBrains Mono）。
这是注入真实游戏页面的油猴脚本，不是沙盒环境，没有引入这个新的跨域字体请求依赖，改用系统
字体栈模拟同样的角色分工（衬线标题/无衬线正文/等宽数值）。**这是"未完成"清单里的一项**，
见下方。

### Phase 4 续 — 二级子页签胶囊样式 + 分类项目数量徽章 ✅

- 二级子页签（Build/Army/Magic 的 City/Colony/Abyss 等）从贴边长条改成独立圆角胶囊
  （`border-radius:999px`，间距分开，激活态实心 teal 底），贴近原型 `.prop-subtabs`。
  **只改了 `.taTab-label`/`.taTab-content` 的颜色/内边距/圆角/`top` 偏移量，没有动
  `display` 属性**（仍是 `display:block` 配合 `.taTab{float:left}`）——因为
  `.taTabsTop > .taNavGroup > .taTab > .taTab-label` 那组侧边栏专属覆盖规则不会重新声明
  `display`，改了会连带影响侧边栏纵向列表布局。
- `addCategoryCounts()`（`options-panel-tabs.js`）给每个 `taOptCatToggle` 标题追加一个
  **静态**项目数徽章（不随过滤结果变化，过滤后的"已显示/总数"由已有的 `taOptFilterCount`
  承担）。

## 未完成 / 明确不做的部分

| 项目 | 状态 | 原因 |
|------|------|------|
| 真实加载 Google Fonts（Fraunces/Inter/JetBrains Mono） | 未做，用系统字体栈替代 | 会给游戏页面引入新的跨域字体请求依赖（隐私/加载时机），用户没有明确要求像素级还原字体。如果后续想要，需要单独确认是否接受这个依赖。 |
| 侧边栏每个导航项前的状态圆点 | 明确否决，不做 | 会跟已有的"enabled"复选框（本来就在每个 tab label 前面）语义重复，用户评估后不建议加。 |
| 分类数量徽章随搜索/过滤动态更新 | 未做，维持静态总数 | 当前范围内没被当作"未完成"提出，只是设计决定——过滤后的可见数量已经由 `taOptFilterCount`（面板顶部）承担，分类徽章只做"这个分类大概多大"的静态参考。如果后续想要徽章跟着过滤结果联动，需要在 `applyFilter()` 里额外重算每个分类的可见行数并更新徽章文本。 |
| 原型里"横向单行 tab → 侧边栏分组导航"以外的、更大范围的信息架构改动 | 未提出，未评估 | 原型的对比表格本身只讨论了顶层 tab 这一层，没有涉及例如"面板整体是否该从 modal 改成独立页面"之类更大的改动，本文档不代入判断。 |

## 待实机验证（尚未在浏览器里确认）

以下均只跑过 `node --check` + 结构计数校验（`<details>` 配对数、`flex flex-wrap` 选择器
计数、各函数出现次数），**没有做过真实浏览器视觉验证**：

- 深色配色下的整体可读性/对比度。
- 原生 `<select>`/`<input>`/复选框在深色背景上的默认渲染是否突兀（没有做自定义控件样式，
  依赖浏览器默认外观）。
- 二级子页签改胶囊后，`.taTab-content` 的 `top:3.4em` 偏移量是否真的不会跟胶囊行重叠——
  尤其是窗口较窄、胶囊可能换到第二行的情况（当前每组子页签只有 2~3 项，正常宽度下换行
  概率很低，但没有专门处理换行场景）。
- 分类数量徽章的对齐、字号是否协调。
- 侧边栏激活态的实际观感。

## 关键工程教训（供后续继续改这个面板时复用）

1. **多套一层容器不会破坏按钮功能**：`setAllValues()` 家族的批量按钮全部用 class 选择器
   （`div.flex.flex-wrap`/`.spellsResource`/`.spellsArmy`/`.taFights.levelN`）定位外层
   容器，只要不改这些 class 本身，在外面加多少层 `<details>`/`<div>` 包装都不影响其命中。
   这条教训在 Phase 2→3→4 里被复用了三次。
2. **改共享 CSS 选择器的 `display` 属性要格外小心级联覆盖顺序**：`.taTab-label` 同时被
   顶层侧边栏（有更具体的 `.taTabsTop > .taNavGroup > .taTab > .taTab-label` 覆盖规则）
   和二级子页签（直接用基础规则）共用。改基础规则的 `display` 值，若侧边栏覆盖规则没有
   重新声明 `display`，会连带影响侧边栏布局——这次改胶囊样式时特意避开了这个坑，只改了
   颜色/内边距/圆角，没碰 `display`。
3. **`display: contents` 的元素不能直接加边框/背景**：`.taOptRow` 用
   `display: contents` 让子元素（名称/Max/Priority）直接参与父级 `.taOptList` 的
   `grid` 布局，代价是 `.taOptRow` 本身不渲染盒子，无法给"整行"加左边框高亮，只能退而
   求其次加在某个子元素（`.taOptName`）上。
4. **CSS 自定义属性（变量）靠继承传递，不需要给每条规则都加作用域前缀**：`.taOptionsDark`
   上定义的 `--ta-*` 变量，靠 CSS 继承自动传给所有后代选择器，改造时只需要把已有规则里
   硬编码的颜色值换成 `var(--ta-xxx)`，不需要重写选择器本身。
