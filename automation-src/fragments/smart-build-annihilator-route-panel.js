// Annihilator Route panel: read-only view of smartBuildPlanner.getAnnihilatorRouteSnapshot().
// No edit/override interactions on purpose -- if the user wants to change something they go to
// the native Army/Research/Attack pages, this panel only answers "which enemies, how many troops".
const ANNIHILATOR_ROUTE_LANG_STORAGE_KEY = 'smartBuildAnnihilatorRouteLang';

const ANNIHILATOR_ROUTE_I18N = {
  en: {
    title: 'Annihilator Route',
    emptyState: 'This view is only available for the Annihilator goal. Select it in Smart Build settings to see your route.',
    currentFront: 'Current front',
    requiredArmy: 'Required army',
    reqFoundPending: 'Research pending',
    reqFoundReady: 'Research complete',
    noPrereq: 'No research gate',
    mainRoute: 'Main route',
    sideTargets: 'Side targets (optional farming)',
    dangerGates: 'Dangerous research gates',
    dangerGateHint: 'Researching these triggers an immediate defense battle (base template mechanism, shown as-is).',
    stopAttacksOn: 'Attacks are currently paused (stopAttacks armed)',
    stopAttacksOff: 'Attacks are not paused',
    clusterProgress: (done, total) => `${done} / ${total} defeated`,
    statusCleared: 'Cleared',
    statusFront: 'Current front',
    statusLocked: 'Locked',
    statusQueued: 'Found, awaiting turn',
    researched: 'Researched',
    pending: 'Not researched yet',
    fightLabel: 'Fight'
  },
  zh: {
    title: '灭世路线',
    emptyState: '该视图仅支持"灭世"目标，请先在智能建造设置里选择该目标。',
    currentFront: '当前前线',
    requiredArmy: '所需兵力',
    reqFoundPending: '前置科技未完成',
    reqFoundReady: '前置科技已完成',
    noPrereq: '无科技前置',
    mainRoute: '主线路线',
    sideTargets: '旁支目标（可选资源farming）',
    dangerGates: '危险科技闸门',
    dangerGateHint: '研究这些科技会立即结算一场防御战（base 模板自带机制，这里只展示状态）。',
    stopAttacksOn: '出击已暂停（stopAttacks 已启动）',
    stopAttacksOff: '出击未暂停',
    clusterProgress: (done, total) => `${done} / ${total} 已攻克`,
    statusCleared: '已攻克',
    statusFront: '当前前线',
    statusLocked: '未解锁',
    statusQueued: '已解锁，等待轮到',
    researched: '已研究',
    pending: '尚未研究',
    fightLabel: '防御战'
  }
};

const getAnnihilatorRouteLang = () => {
  try {
    return localStorage.get(ANNIHILATOR_ROUTE_LANG_STORAGE_KEY) || 'en';
  } catch (e) {
    return 'en';
  }
};
const setAnnihilatorRouteLang = lang => {
  try {
    localStorage.set(ANNIHILATOR_ROUTE_LANG_STORAGE_KEY, lang);
  } catch (e) {}
};

const annihilatorStageLabel = stageId => translate(stageId, 'ene_') || stageId;
const annihilatorTechLabel = techId => translate(techId, 'tec_') || techId;

const annihilatorStageStatus = (stage, currentStageIds) => {
  if (stage.defeated) return 'cleared';
  if (currentStageIds.includes(stage.id)) return 'front';
  return stage.found ? 'queued' : 'locked';
};

const renderAnnihilatorRequiredArmy = requiredArmy => Object.entries(requiredArmy || {})
  .map(([unitId, qty]) => `<span class="ar-army-chip">${escapeHtml(translate(unitId, 'uni_') || unitId)} <b>${qty}</b></span>`)
  .join('');

const renderAnnihilatorStageCard = (stage, lang, currentStageIds) => {
  const t = ANNIHILATOR_ROUTE_I18N[lang];
  const status = annihilatorStageStatus(stage, currentStageIds);
  const statusLabel = { cleared: t.statusCleared, front: t.statusFront, queued: t.statusQueued, locked: t.statusLocked }[status];
  const reqLine = stage.reqFoundTech
    ? `${escapeHtml(annihilatorTechLabel(stage.reqFoundTech))} — ${escapeHtml(stage.found ? t.reqFoundReady : t.reqFoundPending)}`
    : escapeHtml(t.noPrereq);
  const noteLine = stage.note ? `<div class="ar-stage-note">${escapeHtml(stage.note)}</div>` : '';
  return `<div class="ar-stage ar-status-${status}">
    <div class="ar-stage-top">
      <span class="ar-stage-name">${escapeHtml(annihilatorStageLabel(stage.id))}</span>
      <span class="ar-stage-pill">${escapeHtml(statusLabel)}</span>
    </div>
    <div class="ar-stage-req">${reqLine}</div>
    <div class="ar-stage-army">${renderAnnihilatorRequiredArmy(stage.requiredArmy)}</div>
    ${noteLine}
  </div>`;
};

const renderAnnihilatorMainRoute = (snapshot, lang) => {
  const { stages, currentStageIds } = snapshot;
  const html = [];
  let i = 0;
  while (i < stages.length) {
    const stage = stages[i];
    if (stage.parallelGroup) {
      const cluster = [];
      while (i < stages.length && stages[i].parallelGroup === stage.parallelGroup) {
        cluster.push(stages[i]);
        i += 1;
      }
      const done = cluster.filter(item => item.defeated).length;
      const t = ANNIHILATOR_ROUTE_I18N[lang];
      html.push(`<div class="ar-cluster">
        <div class="ar-cluster-header">${escapeHtml(t.clusterProgress(done, cluster.length))}</div>
        <div class="ar-cluster-grid">${cluster.map(item => renderAnnihilatorStageCard(item, lang, currentStageIds)).join('')}</div>
      </div>`);
    } else {
      html.push(renderAnnihilatorStageCard(stage, lang, currentStageIds));
      i += 1;
    }
  }
  return html.join('');
};

const renderAnnihilatorFrontHero = (snapshot, lang) => {
  const t = ANNIHILATOR_ROUTE_I18N[lang];
  const frontStages = snapshot.stages.filter(stage => snapshot.currentStageIds.includes(stage.id));
  if (!frontStages.length) return '';
  const names = frontStages.map(stage => escapeHtml(annihilatorStageLabel(stage.id))).join(' / ');
  const army = renderAnnihilatorRequiredArmy(frontStages[0].requiredArmy);
  return `<div class="ar-hero">
    <div class="ar-hero-label">${escapeHtml(t.currentFront)}</div>
    <div class="ar-hero-name">${names}</div>
    <div class="ar-hero-army-label">${escapeHtml(t.requiredArmy)}</div>
    <div class="ar-hero-army">${army}</div>
  </div>`;
};

const renderAnnihilatorSideTargets = (snapshot, lang) => {
  const t = ANNIHILATOR_ROUTE_I18N[lang];
  return snapshot.optionalStages.map(stage => {
    const status = stage.defeated ? 'cleared' : (stage.found ? 'queued' : 'locked');
    const statusLabel = { cleared: t.statusCleared, queued: t.statusQueued, locked: t.statusLocked }[status];
    return `<div class="ar-side ar-status-${status}">
      <span class="ar-side-name">${escapeHtml(annihilatorStageLabel(stage.id))}</span>
      <span class="ar-side-pill">${escapeHtml(statusLabel)}</span>
    </div>`;
  }).join('');
};

const renderAnnihilatorDangerGates = (snapshot, lang) => {
  const t = ANNIHILATOR_ROUTE_I18N[lang];
  const rows = snapshot.dangerGates.map(gate => `<div class="ar-gate-row ${gate.researched ? 'is-cleared' : ''}">
    <span class="ar-gate-tech">${escapeHtml(annihilatorTechLabel(gate.tech))}</span>
    <span class="ar-gate-fight">${escapeHtml(t.fightLabel)}: ${escapeHtml(gate.fight ? (translate(gate.fight) || gate.fight) : '—')}</span>
    <span class="ar-gate-status">${escapeHtml(gate.researched ? t.researched : t.pending)}</span>
  </div>`).join('');
  const stopAttacksActive = !!state.stopAttacks;
  return `<div class="ar-gate-hint">${escapeHtml(t.dangerGateHint)}</div>
    <div class="ar-gate-list">${rows}</div>
    <div class="ar-gate-stop ${stopAttacksActive ? 'is-active' : ''}">${escapeHtml(stopAttacksActive ? t.stopAttacksOn : t.stopAttacksOff)}</div>`;
};

const renderAnnihilatorRoutePanel = () => {
  const lang = getAnnihilatorRouteLang();
  const t = ANNIHILATOR_ROUTE_I18N[lang];
  const container = document.querySelector('#taAnnihilatorRouteBody');
  if (!container) return;
  const snapshot = smartBuildPlanner.getAnnihilatorRouteSnapshot();
  if (!snapshot) {
    container.innerHTML = `<p class="ar-empty">${escapeHtml(t.emptyState)}</p>`;
    return;
  }
  container.innerHTML = `
    ${renderAnnihilatorFrontHero(snapshot, lang)}
    <h3 class="ar-section-title">${escapeHtml(t.mainRoute)}</h3>
    <div class="ar-route-list">${renderAnnihilatorMainRoute(snapshot, lang)}</div>
    <h3 class="ar-section-title">${escapeHtml(t.sideTargets)}</h3>
    <div class="ar-side-list">${renderAnnihilatorSideTargets(snapshot, lang)}</div>
    <h3 class="ar-section-title">${escapeHtml(t.dangerGates)}</h3>
    ${renderAnnihilatorDangerGates(snapshot, lang)}
  `;
};

const applyAnnihilatorRouteLang = lang => {
  setAnnihilatorRouteLang(lang);
  const root = document.querySelector('#taAnnihilatorRouteTabContent');
  if (root) root.setAttribute('data-ui-lang', lang);
  [...document.querySelectorAll('.ar-lang-btn')].forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.setLang === lang);
  });
  renderAnnihilatorRoutePanel();
};

const initAnnihilatorRouteTab = () => {
  [...document.querySelectorAll('.ar-lang-btn')].forEach(btn => {
    btn.addEventListener('click', () => applyAnnihilatorRouteLang(btn.dataset.setLang));
  });
  const refreshButton = document.querySelector('#taAnnihilatorRouteRefresh');
  if (refreshButton) refreshButton.addEventListener('click', renderAnnihilatorRoutePanel);
  const tabRadio = document.querySelector('#topLevelOptions-annihilatorRoute');
  if (tabRadio) tabRadio.addEventListener('change', renderAnnihilatorRoutePanel);
  applyAnnihilatorRouteLang(getAnnihilatorRouteLang());
};
