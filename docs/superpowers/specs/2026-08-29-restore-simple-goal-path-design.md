# 恢复简单目标路径计算设计

## 目标

将自动建筑规划恢复到 2026-08-29 下午约 17 点版本的简单模式：优先解析目标建筑、科技及其结构依赖，先打通路径，再由后续迭代逐步增加计算策略。重点解决转生后路径重算耗时过长，以及资源 cap 桥接把建筑目标异常推高的问题。

## 范围

- 将 `automation-src/fragments/smart-build-planner/30-path-engine.js` 恢复到 `e779e4b` 基线逻辑。
- 将 `automation-src/fragments/smart-build-planner/00-data-tables.js` 恢复到 `e779e4b` 基线目标与路线数据。
- 保留当前 Goal Path 面板、手动强制目标及其它外围功能，包括面板当前的多原因显示改动。
- 重新生成根目录用户脚本并执行 Node 语法检查。

## 明确移除的行为

- 资源 cap 自动桥接。
- projected resource caps 容量投影。
- cap provider 偏好选择与资源生产类型扩展。
- 月明之夜食物覆盖的额外建筑目标计算。
- 为上述优化增加的 post-goal boundary、allowed bridge 等复杂路径筛选。

## 保留的行为

- 基础目标科技和目标建筑解析。
- 建筑/科技结构依赖解析。
- 资源容量不足时标记为阻塞。
- 简单的资源生产者启动依赖。
- 路径缓存与 Goal Path 输出。
- Goal Path 面板和手动强制目标入口。

## 验证标准

1. 核心路径引擎不再包含 `resourceCapBridge`、`projectedResourceCaps` 或月明之夜食物覆盖逻辑。
2. 构建后的用户脚本通过 `node --check`。
3. `git diff --check` 无空白错误。
4. 生成文件与源片段一致，且不修改无关的现有工作区文件。
