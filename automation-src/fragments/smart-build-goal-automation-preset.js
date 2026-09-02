const GOAL_AUTOMATION_PRESETS = {
  moonlightNight: {
    // Both fast routes deliberately start with the food-focused ancestor.
    // The path selection remains the human route and is independent from the ancestor.
    ancestor: 'ancestor_farmer',
    path: 'humans',
    ngplus: false
  },
  fastNgPlus: {
    ancestor: 'ancestor_farmer',
    path: 'humans',
    ngplus: 25
  },
  annihilator: {
    ancestor: 'ancestor_farmer',
    path: 'humans',
    ngplus: false,
    strategy: 'military',
    difficulty: 'difficulty_0'
  }
};

const DEFAULT_GOAL_LEGACY_PRIORITIES = {
  gift_nature: 6,
  strong_workers: 5,
  guild_craftsmen: 7
};

const getGoalLegacyPriorities = () => {
  if (typeof legacies === 'undefined') return {};
  return Object.fromEntries(legacies.map(legacy => [
    legacy.id,
    DEFAULT_GOAL_LEGACY_PRIORITIES[legacy.id] || 4
  ]));
};

const syncAutomationOptionDom = (setting, key, value) => {
  const el = document.querySelector(`.option[data-setting="${setting}"][data-key="${key}"]`);
  if (!el) return;
  if (el.type === 'checkbox') {
    el.checked = !!value;
  } else {
    el.value = value;
  }
};

const syncPageOptionDom = (page, subpage, key, subkey, value) => {
  const selector = [
    `.option[data-page="${page}"]`,
    subpage ? `[data-subpage="${subpage}"]` : ':not([data-subpage])',
    `[data-key="${key}"]`,
    subkey ? `[data-subkey="${subkey}"]` : ':not([data-subkey])'
  ].join('');
  const el = document.querySelector(selector);
  if (!el) return;
  if (el.type === 'checkbox') {
    el.checked = !!value;
  } else {
    el.value = value;
  }
};

const applyAnnihilatorArmyPreset = () => {
  const armyPageId = CONSTANTS.PAGES.ARMY;
  const armyPage = state.options.pages && state.options.pages[armyPageId];
  if (!armyPage || !armyPage.subpages) return;
  const enabledSubpages = [CONSTANTS.SUBPAGES.ARMY, CONSTANTS.SUBPAGES.EXPLORE, CONSTANTS.SUBPAGES.ATTACK];

  armyPage.enabled = true;
  syncPageOptionDom(armyPageId, null, 'enabled', null, true);
  enabledSubpages.forEach(subpageId => {
    const subpage = armyPage.subpages[subpageId];
    if (!subpage) return;
    subpage.enabled = true;
    syncPageOptionDom(armyPageId, subpageId, 'enabled', null, true);
  });

  const attackSubpage = armyPage.subpages[CONSTANTS.SUBPAGES.ATTACK];
  if (!attackSubpage) return;
  attackSubpage.options = attackSubpage.options || {};
  [...annihilatorRoute.stages, ...annihilatorRoute.optionalStages].forEach(stage => {
    attackSubpage.options[stage.id] = true;
    syncPageOptionDom(armyPageId, CONSTANTS.SUBPAGES.ATTACK, 'options', stage.id, true);
  });
};

const applyGoalAutomationPreset = goalId => {
  const preset = GOAL_AUTOMATION_PRESETS[goalId];
  if (!preset) return;
  state.options.ancestor = { enabled: true, selected: preset.ancestor };
  state.options.path = { enabled: true, selected: preset.path };
  state.options.prestige.enabled = true;
  state.options.prestige.options = {
    ...(state.options.prestige.options || {}),
    ...getGoalLegacyPriorities()
  };
  if (preset.ngplus !== undefined) {
    state.options.ngplus.enabled = !!preset.ngplus;
    if (preset.ngplus) state.options.ngplus.value = preset.ngplus;
  }
  if (preset.strategy) state.options.smartBuild.strategy = preset.strategy;
  if (preset.difficulty) {
    state.options.difficulty = { enabled: true, selected: preset.difficulty };
  }
  if (goalId === 'annihilator') applyAnnihilatorArmyPreset();
  if (preset.strategy) syncAutomationOptionDom('smartBuild', 'strategy', preset.strategy);
  localStorage.set('options', state.options);

  syncAutomationOptionDom('ancestor', 'enabled', true);
  syncAutomationOptionDom('ancestor', 'selected', preset.ancestor);
  syncAutomationOptionDom('path', 'enabled', true);
  syncAutomationOptionDom('path', 'selected', preset.path);
  syncAutomationOptionDom('prestige', 'enabled', true);
  if (preset.ngplus !== undefined) {
    syncAutomationOptionDom('ngplus', 'enabled', !!preset.ngplus);
    if (preset.ngplus) syncAutomationOptionDom('ngplus', 'value', preset.ngplus);
  }
  if (preset.difficulty) {
    syncAutomationOptionDom('difficulty', 'enabled', true);
    syncAutomationOptionDom('difficulty', 'selected', preset.difficulty);
  }

  logger({
    msgLevel: 'log',
    msg: `Goal automation preset applied for ${goalId}: auto-ancestor/auto-path/auto-prestige enabled.`
  });
};

const initGoalAutomationPreset = () => {
  applyGoalAutomationPreset(state.options.smartBuild.goal);
  const goalSelect = document.querySelector('.option[data-setting="smartBuild"][data-key="goal"]');
  if (goalSelect) {
    goalSelect.addEventListener('change', () => applyGoalAutomationPreset(goalSelect.value));
  }
};
