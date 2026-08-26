const smartBuildExploreUnits = [
  { unitId: 'scout', minKey: 'scoutsMin', maxKey: 'scoutsMax' },
  { unitId: 'explorer', minKey: 'explorersMin', maxKey: 'explorersMax' },
  { unitId: 'familiar', minKey: 'familiarsMin', maxKey: 'familiarsMax' }
];
const getExploreAffordabilityFactor = (unit, resourceMap) => {
  const costs = (unit.reqAttack || []).filter(req => req.type === 'resource');
  if (!costs.length) return 1;
  return costs.reduce((factor, cost) => {
    const res = resourceMap[cost.id];
    if (!res) return Math.min(factor, 0.3);
    const fillRatio = res.max > 0 ? res.current / res.max : (res.current > 0 ? 1 : 0);
    let resourceFactor = Math.max(0.15, Math.min(1, fillRatio / 0.6));
    if (res.speed < 0) resourceFactor *= 0.6;
    return Math.min(factor, resourceFactor);
  }, 1);
};
const applyExploreManualOverrides = (targets, manualOptions, options) => {
  if (!options.manualOverrides || !manualOptions) return targets;
  Object.keys(manualOptions).forEach(key => {
    if (manualOptions[key]) targets[key] = manualOptions[key];
  });
  return targets;
};
const getExploreTargets = (manualOptions = {}) => {
  const options = getOptions();
  if (!options.enabled || options.exploreEnabled === false) return null;
  const resourceMap = getResourceMap();
  const targets = {};
  smartBuildExploreUnits.forEach(entry => {
    const unit = units.find(candidate => candidate.id === entry.unitId);
    if (!unit) return;
    const owned = getUnitCount(unit);
    if (!owned) {
      targets[entry.minKey] = 0;
      targets[entry.maxKey] = 0;
      return;
    }
    const factor = getExploreAffordabilityFactor(unit, resourceMap);
    targets[entry.minKey] = 1;
    targets[entry.maxKey] = Math.max(1, Math.round(owned * factor));
  });
  return applyExploreManualOverrides(targets, manualOptions, options);
};
