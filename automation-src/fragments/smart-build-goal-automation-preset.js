const GOAL_AUTOMATION_PRESETS = {
  moonlightNight: {
    ancestor: 'ancestor_researcher',
    path: 'humans'
  }
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

const applyGoalAutomationPreset = goalId => {
  const preset = GOAL_AUTOMATION_PRESETS[goalId];
  if (!preset) return;
  state.options.ancestor = { enabled: true, selected: preset.ancestor };
  state.options.path = { enabled: true, selected: preset.path };
  state.options.prestige.enabled = true;
  localStorage.set('options', state.options);

  syncAutomationOptionDom('ancestor', 'enabled', true);
  syncAutomationOptionDom('ancestor', 'selected', preset.ancestor);
  syncAutomationOptionDom('path', 'enabled', true);
  syncAutomationOptionDom('path', 'selected', preset.path);
  syncAutomationOptionDom('prestige', 'enabled', true);

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
