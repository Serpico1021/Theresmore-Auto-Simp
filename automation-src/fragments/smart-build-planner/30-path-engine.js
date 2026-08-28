const isDangerousResearchOverridden = researchKey => {
  const options = getOptions();
  if (!options.enabled) return false;
  const goal = getGoal(options);
  return !!goal && (goal.dangerousResearchOverrides || []).includes(researchKey);
};
const shouldGateDangerousResearch = () => false;
const getResourceCost = (req, count = 0) => {
  const value = Number(req.value) || 0;
  if (!value) return 0;
  return value * (req.multi ? Math.pow(req.multi, count) : 1);
};
const buildingProducesResource = (building, resourceId) => (building.gen || []).some(gen =>
  gen.value > 0 && (
    gen.type === 'resource' && gen.id === resourceId ||
    gen.type === 'modifier' && gen.type_gen === 'resource' && gen.gen === resourceId
  ));
const buildingRaisesResourceCap = (building, resourceId) => (building.gen || []).some(gen =>
  gen.type === 'cap' && gen.id === resourceId && gen.value > 0);
const getResourceCapValue = (building, resourceId) => (building.gen || [])
  .filter(gen => gen.type === 'cap' && gen.id === resourceId)
  .reduce((total, gen) => total + (Number(gen.value) || 0), 0);
const getResourceGenValue = (building, resourceId) => (building.gen || [])
  .filter(gen => gen.type === 'resource' && gen.id === resourceId)
  .reduce((total, gen) => total + (Number(gen.value) || 0), 0);
const techDependsOnAny = (techId, forbiddenTechIds, seen = {}) => {
  if (!techId || !forbiddenTechIds || !forbiddenTechIds.length) return false;
  if (forbiddenTechIds.includes(techId)) return true;
  if (seen[`tech:${techId}`]) return false;
  seen[`tech:${techId}`] = true;
  const technology = tech.find(candidate => candidate.id === techId);
  if (!technology) return false;
  return (technology.req || []).some(req => {
    if (req.type === 'tech') return techDependsOnAny(req.id, forbiddenTechIds, seen);
    if (req.type === 'building') return buildingDependsOnAnyTech(req.id, forbiddenTechIds, seen);
    return false;
  });
};
const buildingDependsOnAnyTech = (buildingId, forbiddenTechIds, seen = {}) => {
  if (!buildingId || !forbiddenTechIds || !forbiddenTechIds.length) return false;
  if (seen[`building:${buildingId}`]) return false;
  seen[`building:${buildingId}`] = true;
  const building = buildings.find(candidate => candidate.id === buildingId);
  if (!building) return false;
  return (building.req || []).some(req => {
    if (req.type === 'tech') return techDependsOnAny(req.id, forbiddenTechIds, seen);
    if (req.type === 'building') return buildingDependsOnAnyTech(req.id, forbiddenTechIds, seen);
    return false;
  });
};
const isAllowedGoalBridge = (building, goal) => {
  const allowedBridgeBuildings = (goal && goal.allowedBridgeBuildings) || [];
  if (allowedBridgeBuildings.length && !allowedBridgeBuildings.includes(building.id)) return false;
  const forbiddenTechIds = (goal && goal.postGoalBoundaryTechs) || [];
  return !buildingDependsOnAnyTech(building.id, forbiddenTechIds, {});
};
const isBridgeReason = reason => reason && ['bootstrapProducer', 'resourceBridge', 'resourceCapBridge', 'foodCoverageForMoonlightNight'].includes(reason.key);
const isAllowedPathNodeForGoal = (node, goal) => {
  if (!goal || !node) return true;
  const forbiddenTechIds = goal.postGoalBoundaryTechs || [];
  if (node.kind === 'tech') return !forbiddenTechIds.includes(node.id) || (goal.targetTechs || []).includes(node.id);
  if (buildingDependsOnAnyTech(node.id, forbiddenTechIds, {})) return false;
  const allowedBridgeBuildings = goal.allowedBridgeBuildings || [];
  if (allowedBridgeBuildings.length && (node.reasons || []).some(isBridgeReason) && !allowedBridgeBuildings.includes(node.id)) return false;
  return true;
};
const findDirectProducer = (resourceId, goal) => buildings.find(building =>
  buildingProducesResource(building, resourceId) && isAllowedGoalBridge(building, goal));
const findCapProvider = (resourceId, goal) => {
  const candidates = buildings.filter(building =>
    buildingRaisesResourceCap(building, resourceId) && isAllowedGoalBridge(building, goal));
  const preferred = (goal && goal.capProviderPreferences && goal.capProviderPreferences[resourceId]) || [];
  if (preferred.length) {
    const byPreference = preferred.map(id => candidates.find(building => building.id === id)).filter(Boolean);
    if (byPreference.length) {
      return byPreference.sort((a, b) => {
        const unlockedDelta = Number(isBuildingUnlocked(b)) - Number(isBuildingUnlocked(a));
        if (unlockedDelta) return unlockedDelta;
        return getResourceCapValue(b, resourceId) - getResourceCapValue(a, resourceId);
      })[0];
    }
  }
  return candidates.sort((a, b) => getResourceCapValue(b, resourceId) - getResourceCapValue(a, resourceId))[0];
};
const layerToPriority = layer => Math.max(1, 9 - Math.max(0, layer));
const createPathNode = (kind, id) => ({
  kind,
  id,
  key: `${kind}:${id}`,
  targetValue: 0,
  reasons: [],
  layer: 0,
  status: 'pending',
  blockReason: null
});
const computeShortestPath = (options, resourceMap) => {
  const goal = getGoal(options);
  const route = getRoute(options);
  const nodesById = {};
  const visiting = {};
  const projectedResourceCaps = {};
  const getProjectedResourceCap = resourceId => {
    if (typeof projectedResourceCaps[resourceId] !== 'undefined') return projectedResourceCaps[resourceId];
    const res = resourceMap[resourceId];
    projectedResourceCaps[resourceId] = res ? Number(res.max) || 0 : 0;
    return projectedResourceCaps[resourceId];
  };
  const addReason = (node, reason) => {
    if (!reason) return;
    const key = JSON.stringify(reason);
    if (!(node.reasons || []).some(existing => JSON.stringify(existing) === key)) node.reasons.push(reason);
  };
  const getOrCreateNode = (kind, id) => {
    const key = `${kind}:${id}`;
    if (!nodesById[key]) nodesById[key] = createPathNode(kind, id);
    return nodesById[key];
  };
  const resolveResourceReqs = (reqs, count) => {
    let maxPrereqLayer = -1;
    let blocked = null;
    reqs.filter(req => req.type === 'resource').forEach(req => {
      const res = resourceMap[req.id];
      const cost = getResourceCost(req, count);
      if (!cost) return;
      const availableCap = getProjectedResourceCap(req.id);
      if (!res || availableCap < cost) {
        const capProvider = findCapProvider(req.id, goal);
        if (capProvider) {
          const capGain = getResourceCapValue(capProvider, req.id);
          const missingCap = Math.max(0, cost - availableCap);
          const extraCount = capGain > 0 ? Math.max(1, Math.ceil(missingCap / capGain)) : 1;
          const providerNode = nodesById[`building:${capProvider.id}`];
          const currentTarget = Math.max(getCount(capProvider), providerNode ? providerNode.targetValue : 0);
          const targetValue = Math.min(options.maxTarget || 80, currentTarget + extraCount);
          projectedResourceCaps[req.id] = availableCap + Math.max(0, targetValue - currentTarget) * capGain;
          const capNode = resolveBuilding(capProvider.id, targetValue, { key: 'resourceCapBridge', resourceId: req.id });
          maxPrereqLayer = Math.max(maxPrereqLayer, capNode.layer);
        } else {
          blocked = blocked || { type: 'resource-cap', resourceId: req.id };
        }
        return;
      }
      if (res.speed <= 0) {
        const producer = findDirectProducer(req.id, goal);
        if (producer) {
          const producerNode = resolveBuilding(producer.id, getCount(producer) + 1, { key: 'bootstrapProducer', resourceId: req.id });
          maxPrereqLayer = Math.max(maxPrereqLayer, producerNode.layer);
        } else {
          blocked = blocked || { type: 'resource-speed', resourceId: req.id };
        }
      }
    });
    return { maxPrereqLayer, blocked };
  };
  const resolveStructuralReqs = (reqs, ownerId) => {
    let maxPrereqLayer = -1;
    let blocked = null;
    reqs.filter(req => req.type !== 'resource').forEach(req => {
      if (req.type === 'building') {
        const prereq = buildings.find(candidate => candidate.id === req.id);
        if (!prereq || getCount(prereq) >= req.value) return;
        const prereqNode = resolveBuilding(req.id, req.value, { key: 'prerequisiteFor', targetId: ownerId });
        maxPrereqLayer = Math.max(maxPrereqLayer, prereqNode.layer);
        return;
      }
      if (isUnlockCompleted(req.type, req.id)) return;
      if (req.type === 'tech') {
        const techNode = resolveTech(req.id, { key: 'prerequisiteFor', targetId: ownerId });
        maxPrereqLayer = Math.max(maxPrereqLayer, techNode.layer);
        return;
      }
      blocked = blocked || { type: 'structural', reqType: req.type, reqId: req.id };
    });
    return { maxPrereqLayer, blocked };
  };
  const resolveBuilding = (buildingId, targetValue, reason) => {
    const building = buildings.find(candidate => candidate.id === buildingId);
    if (!building) return null;
    const node = getOrCreateNode('building', buildingId);
    node.targetValue = Math.max(node.targetValue, targetValue);
    addReason(node, reason);
    if (visiting[node.key]) return node;
    const count = getCount(building);
    if (count >= node.targetValue) {
      node.status = 'met';
      node.layer = 0;
      return node;
    }
    visiting[node.key] = true;
    const req = building.req || [];
    const structural = resolveStructuralReqs(req, buildingId);
    const resourceGate = resolveResourceReqs(req, count);
    visiting[node.key] = false;
    const blocked = structural.blocked || resourceGate.blocked;
    const maxPrereqLayer = Math.max(structural.maxPrereqLayer, resourceGate.maxPrereqLayer);
    node.status = blocked ? 'blocked' : 'queued';
    node.blockReason = blocked || null;
    node.layer = maxPrereqLayer + 1;
    return node;
  };
  const resolveTech = (techId, reason) => {
    const technology = tech.find(candidate => candidate.id === techId);
    if (!technology) return null;
    const node = getOrCreateNode('tech', techId);
    addReason(node, reason);
    node.targetValue = 1;
    if (visiting[node.key]) return node;
    if (isTechCompleted(techId)) {
      node.status = 'met';
      node.layer = 0;
      return node;
    }
    visiting[node.key] = true;
    const req = technology.req || [];
    const structural = resolveStructuralReqs(req, techId);
    const resourceGate = resolveResourceReqs(req, 0);
    visiting[node.key] = false;
    const blocked = structural.blocked || resourceGate.blocked;
    const maxPrereqLayer = Math.max(structural.maxPrereqLayer, resourceGate.maxPrereqLayer);
    node.status = blocked ? 'blocked' : 'queued';
    node.blockReason = blocked || null;
    node.layer = maxPrereqLayer + 1;
    return node;
  };
  const applyMoonlightNightFoodCoverage = () => {
    if (options.goal !== 'moonlightNight') return;
    const farm = buildings.find(candidate => candidate.id === 'farm');
    const commonHouse = buildings.find(candidate => candidate.id === 'common_house');
    if (!farm || !commonHouse || !isBuildingUnlocked(farm)) return;
    const food = resourceMap.food;
    const foodSpeed = food ? Number(food.speed) || 0 : 0;
    const commonHouseNode = nodesById['building:common_house'];
    const commonHouseTarget = Math.max(getCount(commonHouse), commonHouseNode ? commonHouseNode.targetValue : 0);
    const commonHouseFoodUse = Math.abs(getResourceGenValue(commonHouse, 'food')) || 1;
    const currentFoodShortfall = Math.max(0, Math.ceil((foodSpeed * -1) / commonHouseFoodUse));
    const target = Math.min(options.maxTarget || 80, Math.max(getCount(farm), commonHouseTarget + 1, getCount(commonHouse) + currentFoodShortfall + 1));
    if (target > getCount(farm)) {
      resolveBuilding('farm', target, { key: 'foodCoverageForMoonlightNight' });
    }
  };
  if (goal) getExpandedGoalFocusTargets(goal).forEach(entry => resolveBuilding(entry.id, entry.target, entry.reason));
  if (route) getExpandedRouteTargets(route).forEach(entry => resolveBuilding(entry.id, entry.target, entry.reason));
  applyMoonlightNightFoodCoverage();
  if (goal) getGoalTechEntries(goal).forEach(entry => resolveTech(entry.technology.id, entry.reason));
  return { nodesById };
};
const getPathFingerprint = (options, resourceMap) => {
  const legacyIds = getCompletedLegacyIds();
  const resourceSignature = smartBuildResources.map(id => {
    const res = resourceMap[id];
    return res ? `${id}:${res.speed}:${res.max}` : `${id}:-`;
  });
  return [options.goal, ...legacyIds, ...resourceSignature].join('|');
};
let pathCache = { fingerprint: null, path: null };
const getPath = (options, resourceMap) => {
  const fingerprint = getPathFingerprint(options, resourceMap);
  if (pathCache.fingerprint === fingerprint && pathCache.path) return pathCache.path;
  pathCache = { fingerprint, path: computeShortestPath(options, resourceMap) };
  return pathCache.path;
};
