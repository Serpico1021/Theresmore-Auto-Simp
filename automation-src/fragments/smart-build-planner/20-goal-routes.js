const getGoal = options => smartBuildGoals[options.goal] || null;
const getRoute = options => smartBuildRoutes[options.goal] || null;
const getGoalBuildingMinimums = goal => goal && ['moonlightNight', 'fastNgPlus'].includes(goal)
  ? { house_workers: 12, monument: 12, city_hall: 2 }
  : {};
const getRouteTargets = route => {
  if (!route) return [];
  return [...(route.buildingTargets || []), ...(route.supportTargets || [])];
};
const clampBuildingTarget = (building, value) => {
  const target = Math.max(0, Number(value) || 0);
  const cap = Number(building && building.cap);
  return Number.isFinite(cap) && cap > 0 ? Math.min(target, cap) : target;
};
const expandPrerequisiteTargets = (seedEntries, reasonLabel = { key: 'target' }) => {
  if (!seedEntries || !seedEntries.length) return [];
  const byId = {};
  const visiting = {};
  const addEntry = (entry, inheritedPriority = 6, reason = reasonLabel) => {
    if (!entry || !entry.id) return;
    const building = buildings.find(candidate => candidate.id === entry.id);
    if (!building) return;
    const priority = Math.max(entry.priority || 0, inheritedPriority || 0, 1);
    const configuredTarget = Number(entry.target);
    const buildingCap = Number(building.cap);
    const requestedTarget = configuredTarget === -1
      ? (Number.isFinite(buildingCap) && buildingCap > 0 ? buildingCap : 999)
      : Math.max(1, configuredTarget || 1);
    const target = clampBuildingTarget(building, requestedTarget);
    if (!byId[entry.id] || byId[entry.id].target < target || byId[entry.id].priority < priority) {
      byId[entry.id] = {
        id: entry.id,
        target,
        priority,
        reason: entry.reason || reason
      };
    }
    if (visiting[entry.id]) return;
    visiting[entry.id] = true;
    (building.req || []).filter(req => req.type === 'building').forEach(req => {
      addEntry({
        id: req.id,
        target: Math.max(1, Number(req.value) || 1),
        priority: Math.min(10, priority + 1),
        reason: { key: 'prerequisiteFor', targetId: entry.id }
      }, Math.min(10, priority + 1), { key: 'prerequisiteFor', targetId: entry.id });
    });
    visiting[entry.id] = false;
  };
  seedEntries.forEach(entry => addEntry(entry, entry.priority || 6, entry.reason || reasonLabel));
  return Object.values(byId);
};
const getExpandedRouteTargets = route => {
  if (!route) return [];
  return expandPrerequisiteTargets(getRouteTargets(route), { key: 'routeTarget' });
};
const getExpandedGoalFocusTargets = goal => {
  if (!goal.buildingFocus || !goal.buildingFocus.length) return [];
  const seeds = goal.buildingFocus.map(id => ({
    id,
    target: 1,
    priority: 6,
    reason: { key: 'goalBuildingFocus' }
  }));
  return expandPrerequisiteTargets(seeds, { key: 'goalBuildingFocus' });
};
const getRouteEntry = (building, route) => getExpandedRouteTargets(route).find(entry => entry.id === building.id);
const getGoalTechs = goal => (goal.targetTechs || []).map(techId => tech.find(technology => technology.id === techId)).filter(Boolean);
const getGoalTechEntries = goal => [
  ...(goal.supportTechs || []).map(techId => ({ id: techId, reason: { key: 'supportTech' } })),
  ...(goal.targetTechs || []).map(techId => ({ id: techId, reason: { key: 'goalTargetTech' } }))
].map(entry => ({
  technology: tech.find(technology => technology.id === entry.id),
  reason: entry.reason
})).filter(entry => entry.technology);
const getMandatoryGoalTechs = goal => {
  if (!goal || !['moonlightNight', 'fastNgPlus'].includes(goal)) return [];
  return tech.filter(technology => technology.id === 'house_of_workers' ||
    (technology.id.startsWith('heirloom_') && (technology.req || []).some(req => req.type === 'building' && req.id === 'monument')));
};
