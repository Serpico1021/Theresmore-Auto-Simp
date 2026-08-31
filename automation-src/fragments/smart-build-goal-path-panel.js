// Goal Path panel: renders smartBuildPlanner.getPathSnapshot() as a dependency ladder and
// lets the user force-override a building's target.
//
// Building/tech/resource names always come from the live translate() (this project's base
// template has no English data at all -- its i18n.en values are already the Chinese text
// from the user's localized game files, keyed the same as upstream -- so there is nothing to
// toggle for those). The EN/中文 switch below only affects this panel's own authored chrome
// text (rung labels, reason phrasing, buttons); reqType vocabulary (legacy/prayer/magic) was
// cross-checked against the same localized game files for consistency.
const GOAL_PATH_LANG_STORAGE_KEY = 'smartBuildGoalPathLang';
const GOAL_PATH_REQ_TYPE_LABEL = {
  legacy: { en: 'legacy', zh: '传承' },
  prayer: { en: 'prayer', zh: '祈祷' },
  magic: { en: 'magic', zh: '魔法' }
};

const GOAL_PATH_I18N = {
  en: {
    title: 'Path to',
    emptyState: 'This view needs a Smart Build goal selected (Moonlight Night / Speed NG+ / Annihilator) to show your path.',
    activeOverrides: 'Active overrides',
    noOverrides: '— everything else follows the computed path',
    summit: '☾ Summit',
    summitHint: '— the goal itself',
    rung: n => `Rung ${n}`,
    rungNowHint: '— do these now',
    kindBuilding: 'BLD',
    kindTech: 'TECH',
    alreadyMet: 'Already met',
    forceTarget: 'Force target',
    overridesComputed: target => `overrides computed target of ${target}`,
    reasonPlaceholder: 'Why did you adjust these targets? e.g. "Bumped Common House to 8 — ran out of housing before hitting the tech gate."',
    reasons: {
      whitelist: () => 'Moonlight whitelist',
      gate: () => 'Moonlight gate',
      routeTarget: () => 'Route target',
      goalBuildingFocus: () => 'Goal building focus',
      prerequisiteFor: targetId => `Prerequisite for ${translate(targetId) || targetId}`,
      goalTargetTech: () => 'Goal target tech',
      supportTech: () => 'Support tech',
      bootstrapProducer: resourceId => `Bootstrap producer for ${translate(resourceId, 'res_') || resourceId}`,
      resourceBridge: () => 'Resource bridge',
      resourceCapBridge: resourceId => `Storage bridge for ${translate(resourceId, 'res_') || resourceId}`,
      foodCoverageForMoonlightNight: () => 'Moonlight food coverage'
    },
    blocked: {
      'resource-cap': resourceId => `Storage too small for ${translate(resourceId, 'res_') || resourceId}`,
      'resource-speed': resourceId => `Produces nothing yet for ${translate(resourceId, 'res_') || resourceId}`,
      structural: (reqType, reqId) => `Locked by ${(GOAL_PATH_REQ_TYPE_LABEL[reqType] || {}).en || reqType}: ${translate(reqId) || reqId}`
    }
  },
  zh: {
    title: '通往',
    emptyState: '该视图需要先在智能建造设置里选择一个目标（Moonlight Night / 速刷超转生 / 灭世）才能显示路线。',
    activeOverrides: '生效中的强制覆盖',
    noOverrides: '——其余节点均按计算结果执行',
    summit: '☾ 山顶',
    summitHint: '——目标本身',
    rung: n => `第 ${n} 阶`,
    rungNowHint: '——现在就做这些',
    kindBuilding: '建筑',
    kindTech: '科技',
    alreadyMet: '已达标',
    forceTarget: '强制目标',
    overridesComputed: target => `覆盖计算出的目标值 ${target}`,
    reasonPlaceholder: '为什么调整了这些目标？例如：“把普通民居调到 8——在到达科技门槛前住房就不够了。”',
    reasons: {
      whitelist: () => '月色白名单',
      gate: () => '月色关卡',
      routeTarget: () => '路线目标',
      goalBuildingFocus: () => '目标重点建筑',
      prerequisiteFor: targetId => `${translate(targetId) || targetId}的前置条件`,
      goalTargetTech: () => '目标科技',
      supportTech: () => '辅助科技',
      bootstrapProducer: resourceId => `${translate(resourceId, 'res_') || resourceId}产出的启动建筑`,
      resourceBridge: () => '资源桥梁',
      resourceCapBridge: resourceId => `${translate(resourceId, 'res_') || resourceId}上限桥梁`,
      foodCoverageForMoonlightNight: () => '月明之夜食物覆盖'
    },
    blocked: {
      'resource-cap': resourceId => `${translate(resourceId, 'res_') || resourceId}的仓储上限不够`,
      'resource-speed': resourceId => `${translate(resourceId, 'res_') || resourceId}目前产出为 0`,
      structural: (reqType, reqId) => `被${(GOAL_PATH_REQ_TYPE_LABEL[reqType] || {}).zh || reqType}锁定：${translate(reqId) || reqId}`
    }
  }
};

const getGoalPathLang = () => {
  try {
    return localStorage.get(GOAL_PATH_LANG_STORAGE_KEY) || 'en';
  } catch (e) {
    return 'en';
  }
};
const setGoalPathLang = lang => {
  try {
    localStorage.set(GOAL_PATH_LANG_STORAGE_KEY, lang);
  } catch (e) {}
};

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[char]);

const goalPathNodeLabel = node => translate(node.id, node.kind === 'tech' ? 'tec_' : '') || node.id;

const goalPathReasonText = (reason, lang) => {
  const formatter = GOAL_PATH_I18N[lang].reasons[reason.key];
  if (!formatter) return reason.key;
  if (reason.key === 'prerequisiteFor') return formatter(reason.targetId);
  if (reason.key === 'bootstrapProducer') return formatter(reason.resourceId);
  if (reason.key === 'resourceCapBridge') return formatter(reason.resourceId);
  return formatter();
};

const goalPathBlockClass = blockReason => {
  if (!blockReason) return '';
  if (blockReason.type === 'resource-cap') return 'gp-reason-cap';
  if (blockReason.type === 'resource-speed') return 'gp-reason-speed';
  return 'gp-reason-structural';
};

const goalPathBlockText = (blockReason, lang) => {
  if (!blockReason) return '';
  const formatter = GOAL_PATH_I18N[lang].blocked[blockReason.type];
  if (!formatter) return blockReason.type;
  if (blockReason.type === 'structural') return formatter(blockReason.reqType, blockReason.reqId);
  return formatter(blockReason.resourceId);
};

const renderGoalPathNode = (node, lang, forcedTargets) => {
  const t = GOAL_PATH_I18N[lang];
  const statusClass = node.status === 'met' ? 'gp-st-met' : node.status === 'blocked' ? `gp-st-blocked ${goalPathBlockClass(node.blockReason)}` : 'gp-st-queued';
  const kindLabel = node.kind === 'tech' ? t.kindTech : t.kindBuilding;
  const name = escapeHtml(goalPathNodeLabel(node));
  const reasonTexts = (node.reasons || []).map(reason => goalPathReasonText(reason, lang)).filter(Boolean);
  const reasonLine = reasonTexts.length
    ? `<div class="gp-node-reason">${escapeHtml([...new Set(reasonTexts)].join(' / '))}</div>`
    : '';
  const hasOverride = node.kind === 'building' && Object.prototype.hasOwnProperty.call(forcedTargets, node.id);
  let extra = '';
  if (node.status === 'met') {
    extra = `<div class="gp-node-met-tag">✓ ${escapeHtml(t.alreadyMet)}</div>`;
  } else if (node.status === 'blocked') {
    extra = `<div class="gp-node-tag"><span class="dot"></span>${escapeHtml(goalPathBlockText(node.blockReason, lang))}</div>`;
  } else if (node.kind === 'building') {
    const overrideId = `gp-ov-${node.id}`;
    const overrideValue = hasOverride ? forcedTargets[node.id] : node.target;
    extra = `<div class="gp-node-override">
      <input type="checkbox" id="${overrideId}" class="gp-override-toggle" data-node-id="${node.id}" ${hasOverride ? 'checked' : ''}>
      <label for="${overrideId}"><span class="box"></span>${escapeHtml(t.forceTarget)}</label>
      <div class="gp-override-fields">
        <input type="number" class="gp-override-value" data-node-id="${node.id}" value="${overrideValue}" min="0" max="999" step="1">
        <span>${escapeHtml(t.overridesComputed(node.target))}</span>
      </div>
    </div>`;
  }
  return `<div class="gp-node ${statusClass}${hasOverride ? ' gp-has-override' : ''}">
    <div class="gp-node-top">
      <div class="gp-node-name"><span class="gp-node-kind">${escapeHtml(kindLabel)}</span>${name}</div>
      <div class="gp-node-count">${node.current} / <b>${node.target}</b></div>
    </div>
    ${reasonLine}
    ${extra}
  </div>`;
};

const persistGoalPathOverrides = () => {
  try {
    localStorage.set('options', state.options);
  } catch (e) {}
};

const setGoalPathOverride = (nodeId, value) => {
  if (!state.options.smartBuild) state.options.smartBuild = {};
  if (!state.options.smartBuild.forcedTargets) state.options.smartBuild.forcedTargets = {};
  state.options.smartBuild.forcedTargets[nodeId] = value;
  persistGoalPathOverrides();
};

const removeGoalPathOverride = nodeId => {
  if (state.options.smartBuild && state.options.smartBuild.forcedTargets) {
    delete state.options.smartBuild.forcedTargets[nodeId];
    persistGoalPathOverrides();
  }
};

const wireGoalPathLadderEvents = container => {
  [...container.querySelectorAll('.gp-override-toggle')].forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const nodeId = checkbox.dataset.nodeId;
      const valueInput = container.querySelector(`.gp-override-value[data-node-id="${nodeId}"]`);
      if (checkbox.checked) {
        setGoalPathOverride(nodeId, Number(valueInput ? valueInput.value : 0));
      } else {
        removeGoalPathOverride(nodeId);
      }
      renderGoalPathOverrides();
    });
  });
  [...container.querySelectorAll('.gp-override-value')].forEach(input => {
    input.addEventListener('change', () => {
      const nodeId = input.dataset.nodeId;
      const checkbox = container.querySelector(`.gp-override-toggle[data-node-id="${nodeId}"]`);
      if (checkbox && checkbox.checked) {
        setGoalPathOverride(nodeId, Number(input.value));
        renderGoalPathOverrides();
      }
    });
  });
};

const renderGoalPathLadder = () => {
  const lang = getGoalPathLang();
  const t = GOAL_PATH_I18N[lang];
  const container = document.querySelector('#taGoalPathLadder');
  if (!container) return;
  const snapshot = smartBuildPlanner.getPathSnapshot();
  if (!snapshot.nodes.length) {
    container.innerHTML = `<p class="gp-empty">${escapeHtml(t.emptyState)}</p>`;
    return;
  }
  const forcedTargets = (state.options.smartBuild && state.options.smartBuild.forcedTargets) || {};
  const byLayer = {};
  snapshot.nodes.forEach(node => {
    (byLayer[node.layer] = byLayer[node.layer] || []).push(node);
  });
  const layers = Object.keys(byLayer).map(Number).sort((a, b) => a - b);
  const summitLayer = layers[layers.length - 1];
  const rungsHtml = layers.map(layer => {
    const nodes = byLayer[layer];
    const isSummit = layer === summitLayer && layer > 0;
    const isNow = layer === 0;
    const nodesHtml = nodes.map(node => renderGoalPathNode(node, lang, forcedTargets)).join('');
    if (isSummit) {
      return `<div class="gp-rung gp-is-summit">
        <div class="gp-rung-label">${escapeHtml(t.summit)} <span class="gp-rung-hint">${escapeHtml(t.summitHint)}</span></div>
        <div class="gp-node-grid">${nodesHtml}</div>
      </div>`;
    }
    return `<div class="gp-rung ${isNow ? 'gp-is-now' : ''}">
      <div class="gp-rung-num">${layer}</div>
      <div class="gp-rung-label">${escapeHtml(t.rung(layer))}${isNow ? ` <span class="gp-rung-hint">${escapeHtml(t.rungNowHint)}</span>` : ''}</div>
      <div class="gp-node-grid">${nodesHtml}</div>
    </div>`;
  }).reverse().join('');
  container.innerHTML = `<div class="gp-ladder">${rungsHtml}</div>`;
  wireGoalPathLadderEvents(container);
};

const renderGoalPathOverrides = () => {
  const lang = getGoalPathLang();
  const t = GOAL_PATH_I18N[lang];
  const container = document.querySelector('#taGoalPathOverrides');
  if (!container) return;
  const forcedTargets = (state.options.smartBuild && state.options.smartBuild.forcedTargets) || {};
  const ids = Object.keys(forcedTargets);
  const chips = ids.map(id => `<span class="gp-override-chip" data-node-id="${id}">${escapeHtml(id)} → ${forcedTargets[id]}<button type="button" class="gp-remove-override" data-node-id="${id}" title="Remove override">✕</button></span>`).join('');
  const emptyHint = ids.length ? '' : `<span class="empty-hint">${escapeHtml(t.noOverrides)}</span>`;
  container.innerHTML = `<span class="label">${escapeHtml(t.activeOverrides)}</span>${chips}${emptyHint}`;
  [...container.querySelectorAll('.gp-remove-override')].forEach(button => {
    button.addEventListener('click', () => {
      removeGoalPathOverride(button.dataset.nodeId);
      refreshGoalPathTab();
    });
  });
};

const refreshGoalPathTab = () => {
  renderGoalPathLadder();
  renderGoalPathOverrides();
};

const exportGoalPathData = () => {
  const snapshot = smartBuildPlanner.getPathSnapshot();
  const forcedTargets = (state.options.smartBuild && state.options.smartBuild.forcedTargets) || {};
  const reasonBox = document.querySelector('#taGoalPathReason');
  const payload = {
    exportedAt: new Date().toISOString(),
    goal: snapshot.goal,
    nodes: snapshot.nodes,
    forcedTargets,
    notes: reasonBox ? reasonBox.value : ''
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `theresmore-goal-path-${snapshot.goal || 'export'}-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const applyGoalPathLang = lang => {
  setGoalPathLang(lang);
  const root = document.querySelector('#taGoalPathTabContent');
  if (root) root.setAttribute('data-ui-lang', lang);
  [...document.querySelectorAll('.gp-lang-btn')].forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.setLang === lang);
  });
  const textarea = document.querySelector('#taGoalPathReason');
  if (textarea) textarea.setAttribute('placeholder', GOAL_PATH_I18N[lang].reasonPlaceholder);
  refreshGoalPathTab();
};

const initGoalPathTab = () => {
  [...document.querySelectorAll('.gp-lang-btn')].forEach(btn => {
    btn.addEventListener('click', () => applyGoalPathLang(btn.dataset.setLang));
  });
  const refreshButton = document.querySelector('#taGoalPathRefresh');
  if (refreshButton) refreshButton.addEventListener('click', refreshGoalPathTab);
  const clearButton = document.querySelector('#taGoalPathClearOverrides');
  if (clearButton) {
    clearButton.addEventListener('click', () => {
      if (state.options.smartBuild) state.options.smartBuild.forcedTargets = {};
      persistGoalPathOverrides();
      refreshGoalPathTab();
    });
  }
  const exportButton = document.querySelector('#taGoalPathExport');
  if (exportButton) exportButton.addEventListener('click', exportGoalPathData);
  const tabRadio = document.querySelector('#topLevelOptions-goalPath');
  if (tabRadio) tabRadio.addEventListener('change', refreshGoalPathTab);
  applyGoalPathLang(getGoalPathLang());
};
