const getTemplateUnitEntry = (unit, template) => template && template.preferredUnits ? template.preferredUnits.find(entry => entry.id === unit.id) : null;
const getUnitScore = (unit, template = null) => {
  if (!unit || unit.type === 'enemy' || unit.type === 'settlement' || unit.type === 'spy') return 0;
  let score = (unit.defense || 0) * 2.4 + (unit.attack || 0) * 0.75;
  if (unit.splash) score += unit.splash * 2;
  if (unit.trample) score += unit.trample * 0.08;
  if (unit.category === 3) score += 18;
  if (unit.category === 1) score += 7;
  const templateEntry = getTemplateUnitEntry(unit, template);
  if (templateEntry) score = score * (templateEntry.weight || 1) + 80 + (templateEntry.priority || 8) * 10;
  (unit.gen || []).filter(gen => gen.type === 'resource' && gen.value < 0).forEach(gen => {
    score -= Math.abs(gen.value) * (gen.id === 'food' ? 6 : 3);
  });
  return score;
};
const applyUnitManualOverrides = (targets, manualOptions, options) => {
  if (!options.manualOverrides || !manualOptions) return targets;
  Object.keys(manualOptions).filter(key => !key.includes('prio_')).forEach(key => {
    if (manualOptions[key]) {
      targets[key] = manualOptions[key];
      targets[`prio_${key}`] = manualOptions[`prio_${key}`] || 4;
    }
  });
  return targets;
};
const smartBuildExploreBaselineExcludedGoals = ['moonlightNight'];
const EXPLORE_BASELINE_COUNT = 3;
const getExploreBaselineTargets = options => {
  if (!options.enabled || !options.armyEnabled) return {};
  if (smartBuildExploreBaselineExcludedGoals.includes(options.goal)) return {};
  const targets = {};
  smartBuildExploreUnits.forEach(entry => {
    const unit = units.find(candidate => candidate.id === entry.unitId);
    if (!unit) return;
    const count = getUnitCount(unit);
    const target = Math.min(unit.cap || EXPLORE_BASELINE_COUNT, EXPLORE_BASELINE_COUNT);
    if (target <= count) return;
    targets[unit.id] = target;
    targets[`prio_${unit.id}`] = 4;
  });
  return targets;
};
const getUnitTargets = (manualOptions = {}) => {
  const options = getOptions();
  if (!options.enabled || !options.armyEnabled) return null;
  const targets = getExploreBaselineTargets(options);
  const blockedFights = getBlockedDangerousFights(options);
  if (blockedFights.length) {
    const unitExtra = Math.max(1, Number(options.armyMaxExtra) || smartBuildDefaults.armyMaxExtra);
    const unitMaxTarget = Math.max(1, Number(options.armyMaxTarget) || smartBuildDefaults.armyMaxTarget);
    const template = getBattleTemplate(blockedFights);
    units.filter(unit => unit.type !== 'enemy' && unit.type !== 'settlement' && unit.type !== 'spy').map(unit => ({
      unit,
      score: getUnitScore(unit, template)
    })).filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 24).forEach((item, index) => {
      const unit = item.unit;
      const templateEntry = getTemplateUnitEntry(unit, template);
      const count = getUnitCount(unit);
      const cap = unit.cap || unitMaxTarget;
      const target = Math.min(cap, unitMaxTarget, count + unitExtra);
      if (target <= count) return;
      targets[unit.id] = target;
      targets[`prio_${unit.id}`] = templateEntry ? templateEntry.priority || 8 : Math.max(3, 10 - Math.floor(index / 4));
    });
    logger({
      msgLevel: 'debug',
      msg: `Smart army planner is preparing for next dangerous fight: ${blockedFights.map(item => `${item.techId}->${item.fightId}`).join(', ')}${template ? ` (${template.label})` : ''}`
    });
  }
  if (!Object.keys(targets).length) return null;
  return applyUnitManualOverrides(targets, manualOptions, options);
};
