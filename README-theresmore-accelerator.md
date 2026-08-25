# Theresmore Accelerator

这是一个 Tampermonkey/Violentmonkey 用户脚本，用于 Theresmore 网页版的本地加速与轻量自动点击。

## 文件

- `theresmore-accelerator.user.js`: 可直接安装的用户脚本。

## 安装

1. 浏览器安装 Tampermonkey 或 Violentmonkey。
2. 打开 `theresmore-accelerator.user.js`。
3. 将文件内容作为新用户脚本保存。
4. 刷新 Theresmore 游戏页面，右下角会出现 `Theresmore 加速` 面板。

## 功能

- 时间倍速：通过虚拟化 `performance.now()`、`Date.now()` 和 `requestAnimationFrame` 时间戳，让依赖时间差的本地游戏循环变快。
- 自动点击：可选扫描当前页面可见按钮，只点击带有采集、建造、研究、探索、训练、升级等关键词的按钮。
- 风险黑名单：默认跳过重置、飞升、转生、新纪元、结束时代、神殿、雕像等关键词按钮。
- 设置保存：倍率、自动点击间隔、面板折叠状态会保存在用户脚本存储中。

## 建议

- 初次使用建议先开 `x2` 或 `x5`，确认存档资源增长正常后再提高倍率。
- 自动点击建议低频使用，比如 `900ms` 或更长；如果页面明显卡顿，把 `每轮最多` 降到 `1-2`。
- 重要存档操作前先导出游戏存档。任何加速脚本都可能放大游戏自身事件顺序或存档写入问题。

## 作用范围

脚本只在以下页面生效：

- `https://www.theresmoregame.com/play/*`
- `https://theresmoregame.g8hh.com/*`
- `https://theresmoregame.g8hh.com.cn/*`
- `https://theresmore.thpatch.net/*`

