const applyForcedTargets = (targets, forcedTargets, allowedTab) => {
  if (!forcedTargets) return targets;
  Object.keys(forcedTargets).forEach(id => {
    const building = buildings.find(candidate => candidate.id === id);
    if (!building || building.tab !== allowedTab) return;
    const value = Number(forcedTargets[id]);
    if (!Number.isFinite(value)) return;
    targets[id] = value;
    targets[`prio_${id}`] = Math.max(targets[`prio_${id}`] || 0, 9);
  });
  return targets;
};
const getTargets = (subpage, manualOptions = {}) => {
  const options = getOptions();
  if (!options.enabled || options.manualOverrides) return null;
  if (!getGoal(options)) return null;
  const resourceMap = getResourceMap();
  const path = getPath(options, resourceMap);
  const allowedTab = CONSTANTS.SUBPAGES_INDEX[subpage] + 1;
  const targets = {};
  buildings.filter(building => building.tab === allowedTab).forEach(building => {
    const node = path.nodesById[`building:${building.id}`];
    const canExpandCommonHouse = building.id === 'common_house' && isFoodSecurityGateEnabled(options) && hasAssignedFarmer();
    if (!node || node.status === 'met') {
      if (node && node.status === 'met' && canExpandCommonHouse) {
        targets[building.id] = Math.min(options.maxTarget, 15);
        targets[`prio_${building.id}`] = 9;
        return;
      }
      targets[building.id] = 0;
      targets[`prio_${building.id}`] = 0;
      return;
    }
    let targetValue = node.targetValue;
    if (canExpandCommonHouse) {
      targetValue = Math.max(targetValue, Math.min(options.maxTarget, 15));
    }
    targets[building.id] = node.status === 'blocked' ? 0 : targetValue;
    targets[`prio_${building.id}`] = node.status === 'blocked' ? 0 : layerToPriority(node.layer);
  });
  Object.entries(getGoalBuildingMinimums(options.goal)).forEach(([id, minimum]) => {
    const building = buildings.find(candidate => candidate.id === id);
    if (!building || building.tab !== allowedTab) return;
    if (getCount(building) < minimum) {
      targets[id] = Math.max(targets[id] || 0, minimum);
      targets[`prio_${id}`] = Math.max(targets[`prio_${id}`] || 0, 9);
    }
  });
  applyForcedTargets(targets, options.forcedTargets, allowedTab);
  buildings.filter(building => building.tab === allowedTab).forEach(building => {
    const blockReason = getFoodSecurityBlockReason(options, building.id, getCount(building));
    if (blockReason) {
      targets[building.id] = 0;
      targets[`prio_${building.id}`] = 0;
    }
  });
  return targets;
};
const getResearchTargets = (manualOptions = {}) => {
  const options = getOptions();
  if (!options.enabled || options.researchEnabled === false || options.manualOverrides) return null;
  if (!getGoal(options)) return null;
  const resourceMap = getResourceMap();
  const path = getPath(options, resourceMap);
  const targets = {};
  tech.forEach(technology => {
    const node = path.nodesById[`tech:${technology.id}`];
    targets[technology.id] = (!node || node.status === 'met') ? 0 : layerToPriority(node.layer);
  });
  getMandatoryGoalTechs(options.goal).forEach(technology => {
    if (!isTechCompleted(technology.id)) targets[technology.id] = Math.max(targets[technology.id] || 0, 9);
  });
  return targets;
};
const getPathSnapshot = () => {
  const options = getOptions();
  const goal = getGoal(options);
  if (!goal) return { goal: options.goal, nodes: [] };
  const resourceMap = getResourceMap();
  const path = getPath(options, resourceMap);
  const nodes = Object.values(path.nodesById).map(node => {
    const current = node.kind === 'building'
      ? getCount(buildings.find(candidate => candidate.id === node.id))
      : (isTechCompleted(node.id) ? 1 : 0);
    return {
      kind: node.kind,
      id: node.id,
      layer: node.layer,
      status: node.status,
      blockReason: node.blockReason,
      current,
      target: node.targetValue,
      reasons: node.reasons
    };
  }).sort((a, b) => a.layer - b.layer);
  return { goal: options.goal, nodes };
};
