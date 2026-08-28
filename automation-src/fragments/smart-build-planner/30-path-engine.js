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
const findDirectProducer = resourceId => buildings.find(building =>
  isBuildingUnlocked(building) &&
  (building.gen || []).some(gen => gen.type === 'resource' && gen.id === resourceId && gen.value > 0));
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
      if (!res || res.max < cost) {
        blocked = blocked || { type: 'resource-cap', resourceId: req.id };
        return;
      }
      if (res.speed <= 0) {
        const producer = findDirectProducer(req.id);
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
    if (reason) node.reasons.push(reason);
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
    if (reason) node.reasons.push(reason);
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
  if (goal) {
    getGoalTechs(goal).forEach(technology => resolveTech(technology.id, { key: 'goalTargetTech' }));
    getExpandedGoalFocusTargets(goal).forEach(entry => resolveBuilding(entry.id, entry.target, entry.reason));
  }
  if (route) getExpandedRouteTargets(route).forEach(entry => resolveBuilding(entry.id, entry.target, entry.reason));
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
