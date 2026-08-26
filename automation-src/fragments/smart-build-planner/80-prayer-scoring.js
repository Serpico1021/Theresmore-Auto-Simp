const getPrayerUnlockBonus = (prayer, goal, route) => {
  const wantedTargets = [...getExpandedGoalFocusTargets(goal), ...getExpandedRouteTargets(route)];
  if (!wantedTargets.length) return 0;
  const unlockedBuildings = buildings.filter(building => (building.req || []).some(req => req.type === 'prayer' && req.id === prayer.id));
  if (!unlockedBuildings.length) return 0;
  const bestPriority = unlockedBuildings.reduce((max, building) => {
    const entry = wantedTargets.find(target => target.id === building.id);
    if (!entry || getCount(building) >= entry.target) return max;
    return Math.max(max, entry.priority || 0);
  }, 0);
  return bestPriority ? 60 + bestPriority * 8 : 0;
};
const scorePrayer = (prayer, options, goal, route) => {
  if ((options.prayerExcludes || []).includes(prayer.id)) return 0;
  return 10 + getPrayerUnlockBonus(prayer, goal, route);
};
const applyPrayerManualOverrides = (targets, manualOptions, options) => {
  if (!options.manualOverrides || !manualOptions) return targets;
  Object.keys(manualOptions).forEach(key => {
    if (manualOptions[key]) targets[key] = manualOptions[key];
  });
  return targets;
};
const getPrayerTargets = (manualOptions = {}) => {
  const options = getOptions();
  if (!options.enabled || options.prayerEnabled === false) return null;
  const goal = getGoal(options);
  const route = getRoute(options);
  const targets = {};
  spells.filter(spell => spell.type === 'prayer').forEach(prayer => {
    targets[prayer.id] = toPriority(scorePrayer(prayer, options, goal, route));
  });
  return applyPrayerManualOverrides(targets, manualOptions, options);
};
