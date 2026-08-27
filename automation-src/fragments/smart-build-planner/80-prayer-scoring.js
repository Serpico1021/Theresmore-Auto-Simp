const getPrayerUnlockBonus = (prayer, options, goal, route) => {
  const focusTargets = getExpandedGoalFocusTargets(goal);
  const routeTargets = getExpandedRouteTargets(route);
  if (!focusTargets.length && !routeTargets.length) return 0;
  const unlockedBuildings = buildings.filter(building => (building.req || []).some(req => req.type === 'prayer' && req.id === prayer.id));
  if (!unlockedBuildings.length) return 0;
  const bestPriority = unlockedBuildings.reduce((max, building) => {
    const focusEntry = focusTargets.find(target => target.id === building.id);
    const routeEntry = routeTargets.find(target => target.id === building.id);
    const entry = focusEntry || routeEntry;
    if (!entry) return max;
    const needed = focusEntry ? focusEntry.target : getStageCap(building, options);
    if (getCount(building) >= needed) return max;
    return Math.max(max, entry.priority || 0);
  }, 0);
  return bestPriority ? 60 + bestPriority * 8 : 0;
};
const scorePrayer = (prayer, options, goal, route) => {
  if ((options.prayerExcludes || []).includes(prayer.id)) return 0;
  return 10 + getPrayerUnlockBonus(prayer, options, goal, route);
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
