const getResourceCost = (req, count = 0) => {
  const value = Number(req.value) || 0;
  if (!value) return 0;
  return value * (req.multi ? Math.pow(req.multi, count) : 1);
};
const registerResourceCapShortfall = (shortfalls, req, resourceMap, source) => {
  const res = resourceMap[req.id];
  const required = getResourceCost(req, source && Number.isFinite(source.count) ? source.count : 0);
  const currentMax = res && Number(res.max) > 0 ? Number(res.max) : 0;
  if (!required || currentMax >= required) return;
  if (!shortfalls[req.id] || shortfalls[req.id].required < required) {
    shortfalls[req.id] = {
      id: req.id,
      required,
      currentMax,
      deficit: required - currentMax,
      source: source ? source.id : req.id,
      sourceType: source ? source.type : 'resource'
    };
  }
};
const getResearchResourceCapShortfalls = (goal, resourceMap) => {
  const shortfalls = {};
  getGoalTechs(goal).forEach(target => {
    (target.req || []).filter(req => req.type === 'resource').forEach(req => {
      registerResourceCapShortfall(shortfalls, req, resourceMap, {
        id: target.id,
        type: 'tech',
        count: 0
      });
    });
  });
  return shortfalls;
};
const getRouteBuildingResourceCapShortfalls = (route, resourceMap, options) => {
  const shortfalls = {};
  getExpandedRouteTargets(route).forEach(routeEntry => {
    const building = buildings.find(candidate => candidate.id === routeEntry.id);
    if (!building) return;
    const count = getCount(building);
    if (count >= getStageCap(building, options)) return;
    (building.req || []).filter(req => req.type === 'resource').forEach(req => {
      registerResourceCapShortfall(shortfalls, req, resourceMap, {
        id: building.id,
        type: 'building',
        count
      });
    });
  });
  return shortfalls;
};
const getResourceCapShortfalls = (goal, route, resourceMap, options) => {
  const shortfalls = {};
  [
    getResearchResourceCapShortfalls(goal, resourceMap),
    getRouteBuildingResourceCapShortfalls(route, resourceMap, options)
  ].forEach(group => {
    Object.values(group).forEach(shortfall => {
      if (!shortfalls[shortfall.id] || shortfalls[shortfall.id].required < shortfall.required) {
        shortfalls[shortfall.id] = shortfall;
      }
    });
  });
  return shortfalls;
};
const getGoalResourceBonus = (id, goal, resourceMap) => {
  if (!goal.resourceFocus || !goal.resourceFocus.includes(id)) return 0;
  const res = resourceMap[id];
  if (!res) return 14;
  const fillRatio = res.max > 0 ? res.current / res.max : 0;
  let bonus = 14;
  if (fillRatio < 0.5) bonus += 8;
  if (res.speed <= 0) bonus += 10;
  return bonus;
};
const getGoalRequirementBonus = (building, goal) => {
  let bonus = goal.buildingFocus && goal.buildingFocus.includes(building.id) ? 34 : 0;
  getGoalTechs(goal).forEach(target => {
    if (!target.req) return;
    target.req.filter(req => req.type === 'building' && req.id === building.id).forEach(req => {
      const count = getCount(building);
      if (count < req.value) {
        bonus += 70 + (req.value - count) * 12;
      }
    });
    target.req.filter(req => req.type === 'resource').forEach(req => {
      if (building.gen && building.gen.find(gen => (gen.type === 'resource' || gen.type === 'cap') && gen.id === req.id && gen.value > 0)) {
        bonus += 10;
      }
    });
  });
  return bonus;
};
const getCapShortfallBonus = (building, goal, route, resourceMap, options) => {
  const shortfalls = getResourceCapShortfalls(goal, route, resourceMap, options);
  const entries = Object.values(shortfalls);
  if (!entries.length || !building.gen) return 0;
  return entries.reduce((bonus, shortfall) => {
    const capGen = building.gen.find(gen => gen.type === 'cap' && gen.id === shortfall.id && gen.value > 0);
    if (!capGen) return bonus;
    const severity = shortfall.required > 0 ? Math.min(1, shortfall.deficit / shortfall.required) : 0;
    return bonus + 95 + severity * 95 + Math.min(40, Number(capGen.value) || 0);
  }, 0);
};
const PRODUCTION_STORAGE_CAP_SECONDS = 90;
const getProductionStorageCap = (building, resourceMap, options) => {
  const resourceGens = (building.gen || []).filter(item => item.type === 'resource' && item.value > 0);
  if (!resourceGens.length) return Infinity;
  return resourceGens.reduce((cap, item) => {
    const res = resourceMap[item.id];
    if (!res || !(res.max > 0)) return cap;
    const projectedSpeed = (res.speed || 0) + item.value;
    if (projectedSpeed <= 0) return cap;
    const secondsToFill = (res.max - res.current) / projectedSpeed;
    if (secondsToFill >= PRODUCTION_STORAGE_CAP_SECONDS) return cap;
    return Math.min(cap, Math.max(getCount(building), 1));
  }, Infinity);
};
const STAGE_DECAY_FLOOR = 4;
const getStageCap = (building, options) => {
  const cap = building.cap || Number(options.maxTarget) || smartBuildDefaults.maxTarget;
  const stage = getCurrentStageIndex();
  const tier = building.age === 100 ? stage : building.age;
  const gap = stage - tier;
  if (gap <= 0) return cap;
  return Math.max(STAGE_DECAY_FLOOR, Math.round(cap / Math.pow(2, gap)));
};
const applyTitanOverrides = (targets, options) => {
  Object.keys(smartBuildTitanOverrides).forEach(titanId => {
    const entry = smartBuildTitanOverrides[titanId];
    const titanBuilding = buildings.find(building => building.id === titanId);
    if (!titanBuilding || getCount(titanBuilding) < 1) return;
    if (entry.goals && !entry.goals.includes(options.goal)) return;
    (entry.replaces || []).forEach(replace => {
      if (!(replace.id in targets)) return;
      const factor = Number(replace.capFactor) || 0;
      targets[replace.id] = factor > 0 ? Math.floor(targets[replace.id] * factor) : 0;
    });
  });
  return targets;
};
const getBattleTemplate = blockedFights => {
  if (!blockedFights || !blockedFights.length) return null;
  return smartBuildBattleTemplates[blockedFights[0].fightId] || null;
};
const getTemplateBuildingEntry = (building, template) => template && template.preferredBuildings ? template.preferredBuildings.find(entry => entry.id === building.id) : null;
const getDangerousBattleBuildingBonus = (building, options) => {
  const blockedFights = getBlockedDangerousFights(options);
  if (!blockedFights.length || !building.gen) return 0;
  const templateEntry = getTemplateBuildingEntry(building, getBattleTemplate(blockedFights));
  const templateBonus = templateEntry ? 120 + (templateEntry.priority || 8) * 8 : 0;
  return templateBonus + building.gen.reduce((bonus, gen) => {
    if (gen.type === 'cap' && gen.id === 'army' && gen.value > 0) return bonus + 95 + Math.min(45, gen.value * 2);
    if (gen.type === 'modifier' && gen.type_id === 'army' && gen.type_gen === 'stat' && (gen.gen === 'defense' || gen.gen === 'attack')) {
      return bonus + 50 + Math.min(35, Math.abs(gen.value || 0) * 4);
    }
    return bonus;
  }, 0);
};
const getRouteRequirementBonus = (building, route, options) => {
  const routeEntry = getRouteEntry(building, route);
  if (!routeEntry) return 0;
  const count = getCount(building);
  const target = getStageCap(building, options);
  if (count >= target) return routeEntry.priority >= 8 ? 8 : 3;
  return 80 + (target - count) * 14 + (routeEntry.priority || 6) * 5;
};
const getGoalFocusPrerequisiteBonus = (building, goal) => {
  const focusEntry = getExpandedGoalFocusTargets(goal).find(target => target.id === building.id);
  if (!focusEntry) return 0;
  const count = getCount(building);
  if (count >= focusEntry.target) return focusEntry.priority >= 8 ? 8 : 3;
  return 80 + (focusEntry.target - count) * 14 + (focusEntry.priority || 6) * 5;
};
const getCostWait = (building, count, resourceMap) => {
  if (!building.req) return 0;
  return building.req.filter(req => req.type === 'resource').reduce((wait, req) => {
    const res = resourceMap[req.id];
    if (!res) return wait + 999;
    const multi = req.multi ? Math.pow(req.multi, count) : 1;
    const cost = req.value * multi;
    if (res.current >= cost) return wait;
    if (res.speed <= 0) return wait + 999;
    return Math.max(wait, (cost - res.current) / res.speed);
  }, 0);
};
const getBottleneckScore = (id, resourceMap) => {
  const res = resourceMap[id];
  if (!res) return 0;
  let score = 0;
  const fillRatio = res.max > 0 ? res.current / res.max : 0;
  if (res.speed < 0) score += 22;
  if (res.speed === 0 && fillRatio < 0.5) score += 12;
  if (fillRatio < 0.25) score += 10;
  if (fillRatio < 0.1) score += 8;
  if (res.speed > 0 && res.max > res.current) {
    const secondsToFill = (res.max - res.current) / res.speed;
    if (secondsToFill > 180) score += 10;
    if (secondsToFill > 600) score += 8;
  }
  return score;
};
const getCapPressure = (id, resourceMap) => {
  const res = resourceMap[id];
  if (!res || res.max <= 0 || res.speed <= 0) return 0;
  const fillRatio = res.current / res.max;
  const secondsToFill = (res.max - res.current) / res.speed;
  if (fillRatio > 0.9 || secondsToFill < 60) return 18;
  if (fillRatio > 0.75 || secondsToFill < 180) return 10;
  return 0;
};
const scoreBuilding = (building, resourceMap, options) => {
  const strategyWeights = smartBuildStrategyWeights[options.strategy] || smartBuildStrategyWeights.balanced;
  const goal = getGoal(options);
  const route = getRoute(options);
  const count = getCount(building);
  let score = 0;
  let risk = 0;
  const gen = building.gen || [];
  gen.forEach(item => {
    if (item.type === 'resource' && item.value > 0) {
      score += (6 + getBottleneckScore(item.id, resourceMap) + getGoalResourceBonus(item.id, goal, resourceMap)) * Math.min(4, item.value);
    }
    if (item.type === 'resource' && item.value < 0) {
      const res = resourceMap[item.id];
      const riskMultiplier = options.risk === 'aggressive' ? 0.55 : options.risk === 'conservative' ? 1.65 : 1;
      if (!res || res.speed + item.value <= 0) risk += Math.abs(item.value) * 16 * riskMultiplier;
      if (res && res.max > 0 && res.current / res.max < 0.35) risk += Math.abs(item.value) * 8 * riskMultiplier;
    }
    if (item.type === 'cap') {
      score += 5 + getCapPressure(item.id, resourceMap) + getGoalResourceBonus(item.id, goal, resourceMap) * 0.45;
    }
    if (item.type === 'population') {
      score += item.id === 'unemployed' ? 11 : 7;
    }
  });
  const costWait = getCostWait(building, count, resourceMap);
  if (costWait > options.maxWaitSeconds) score -= 18;
  else if (costWait > 60) score -= 8;
  if (building.cat === 'wonders') score -= options.risk === 'aggressive' ? 12 : 28;
  score *= strategyWeights[building.cat] || 1;
  score *= goal.weights && goal.weights[building.cat] ? goal.weights[building.cat] : 1;
  score += getGoalRequirementBonus(building, goal);
  score += getRouteRequirementBonus(building, route, options);
  score += getGoalFocusPrerequisiteBonus(building, goal);
  score += getCapShortfallBonus(building, goal, route, resourceMap, options);
  score += getDangerousBattleBuildingBonus(building, options);
  score -= Math.max(0, count - 6) * 0.55;
  return score - risk;
};
const toPriority = score => {
  if (score >= 50) return 7;
  if (score >= 34) return 6;
  if (score >= 22) return 5;
  if (score >= 13) return 4;
  if (score >= 7) return 3;
  return 0;
};
const toExtra = score => {
  if (score >= 45) return 3;
  if (score >= 24) return 2;
  return 1;
};
const applyManualOverrides = (targets, manualOptions, options) => {
  if (!options.manualOverrides || !manualOptions) return targets;
  Object.keys(manualOptions).filter(key => !key.includes('prio_')).forEach(key => {
    if (manualOptions[key]) {
      targets[key] = manualOptions[key];
      targets[`prio_${key}`] = manualOptions[`prio_${key}`] || 4;
    }
  });
  return targets;
};
const applyRouteTargets = (targets, subpage, options) => {
  const route = getRoute(options);
  if (!route) return targets;
  const allowedTab = CONSTANTS.SUBPAGES_INDEX[subpage] + 1;
  getExpandedRouteTargets(route).forEach(routeEntry => {
    const building = buildings.find(candidate => candidate.id === routeEntry.id);
    if (!building || building.tab !== allowedTab) return;
    if (!(building.id in targets)) return;
    targets[`prio_${building.id}`] = Math.max(targets[`prio_${building.id}`] || 0, routeEntry.priority || 8);
  });
  return targets;
};
const applyCapBridgeTargets = (targets, subpage, resourceMap, options) => {
  const goal = getGoal(options);
  const shortfalls = getResourceCapShortfalls(goal, getRoute(options), resourceMap, options);
  if (!Object.keys(shortfalls).length) return targets;
  const allowedTab = CONSTANTS.SUBPAGES_INDEX[subpage] + 1;
  buildings.filter(building => building.tab === allowedTab && building.gen && isBuildingUnlocked(building)).forEach(building => {
    const helpsCap = building.gen.find(gen => gen.type === 'cap' && gen.value > 0 && shortfalls[gen.id]);
    if (!helpsCap) return;
    const count = getCount(building);
    const cap = building.cap || Number(options.maxTarget) || smartBuildDefaults.maxTarget;
    if (count >= cap) return;
    const bridgeMax = Math.min(cap, Number(options.maxTarget) || smartBuildDefaults.maxTarget, count + Math.max(1, Number(options.maxExtra) || smartBuildDefaults.maxExtra));
    if (bridgeMax <= count) return;
    targets[building.id] = Math.max(targets[building.id] || 0, bridgeMax);
    targets[`prio_${building.id}`] = Math.max(targets[`prio_${building.id}`] || 0, 9);
  });
  return targets;
};
const applyDangerousBattleBuildingTargets = (targets, subpage, options) => {
  const blockedFights = getBlockedDangerousFights(options);
  if (!blockedFights.length) return targets;
  const template = getBattleTemplate(blockedFights);
  const allowedTab = CONSTANTS.SUBPAGES_INDEX[subpage] + 1;
  buildings.filter(building => building.tab === allowedTab && building.gen).forEach(building => {
    const helpsArmy = building.gen.find(gen => gen.type === 'cap' && gen.id === 'army' && gen.value > 0 || gen.type === 'modifier' && gen.type_id === 'army' && gen.type_gen === 'stat');
    const templateEntry = getTemplateBuildingEntry(building, template);
    if (!helpsArmy && !templateEntry) return;
    const count = getCount(building);
    const cap = building.cap || Number(options.maxTarget) || smartBuildDefaults.maxTarget;
    if (count >= cap) return;
    const battleMax = Math.min(cap, Number(options.maxTarget) || smartBuildDefaults.maxTarget, count + Math.max(1, Number(options.maxExtra) || smartBuildDefaults.maxExtra));
    if (battleMax <= count) return;
    targets[building.id] = Math.max(targets[building.id] || 0, battleMax);
    targets[`prio_${building.id}`] = Math.max(targets[`prio_${building.id}`] || 0, templateEntry ? templateEntry.priority || 9 : 9);
  });
  return targets;
};
const getTargets = (subpage, manualOptions = {}) => {
  const options = getOptions();
  if (!options.enabled) return null;
  const resourceMap = getResourceMap();
  const route = getRoute(options);
  const routeTargetIds = new Set(getExpandedRouteTargets(route).map(entry => entry.id));
  const targets = {};
  buildings.filter(building => building.tab === CONSTANTS.SUBPAGES_INDEX[subpage] + 1).forEach(building => {
    const score = scoreBuilding(building, resourceMap, options);
    const prio = toPriority(score);
    if (!prio && !routeTargetIds.has(building.id)) return;
    const count = getCount(building);
    const cap = building.cap || Number(options.maxTarget) || smartBuildDefaults.maxTarget;
    const max = Math.min(
      cap,
      Number(options.maxTarget) || smartBuildDefaults.maxTarget,
      count + Math.min(Number(options.maxExtra) || smartBuildDefaults.maxExtra, toExtra(score)),
      getProductionStorageCap(building, resourceMap, options),
      getStageCap(building, options)
    );
    if (max <= count) return;
    targets[building.id] = max;
    targets[`prio_${building.id}`] = prio;
  });
  applyCapBridgeTargets(targets, subpage, resourceMap, options);
  applyDangerousBattleBuildingTargets(targets, subpage, options);
  applyRouteTargets(targets, subpage, options);
  applyTitanOverrides(targets, options);
  return applyManualOverrides(targets, manualOptions, options);
};
