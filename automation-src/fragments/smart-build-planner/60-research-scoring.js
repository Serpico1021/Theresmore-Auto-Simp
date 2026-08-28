const getResearchGroups = () => groupChoices(tech);
const getTechUnlockBonus = (technology, options, goal, route) => {
  const focusTargets = getExpandedGoalFocusTargets(goal);
  const routeTargets = getExpandedRouteTargets(route);
  if (!focusTargets.length && !routeTargets.length) return 0;
  const unlockedBuildings = buildings.filter(building => (building.req || []).some(req => req.type === 'tech' && req.id === technology.id));
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
const getPrayerTechBonus = (technology, options, goal, route) => {
  const wantedPrayers = spells.filter(spell => spell.type === 'prayer' && (spell.req || []).some(req => req.type === 'tech' && req.id === technology.id));
  if (!wantedPrayers.length) return 0;
  return wantedPrayers.reduce((max, prayer) => Math.max(max, getPrayerUnlockBonus(prayer, options, goal, route)), 0);
};
const getResearchProductionBonus = (technology, options, goal) => {
  const weights = smartBuildStrategyWeights[options.strategy] || smartBuildStrategyWeights.balanced;
  let bonus = 0;
  (technology.gen || []).forEach(gen => {
    if (gen.type === 'resource') {
      const focusWeight = goal.resourceFocus && goal.resourceFocus.includes(gen.id) ? 1.6 : 1;
      bonus += Math.abs(gen.value || 0) * (gen.perc ? 6 : 1.5) * focusWeight;
    } else if (gen.type === 'modifier' && gen.type_id === 'army') {
      bonus += Math.abs(gen.value || 0) * 2;
    }
  });
  return bonus * (weights.science || 1);
};
const scoreResearch = (technology, options, goal, route, blockedFights) => {
  if (resetResearch.includes(technology.id) && !(goal.targetTechs || []).includes(technology.id)) return 0;
  if ((options.researchExcludes || []).includes(technology.id)) return 0;
  const isDangerous = technology.confirm || unsafeResearch.includes(technology.id);
  let score = isDangerous ? 4 : 8;
  if ((goal.targetTechs || []).includes(technology.id)) score += 220;
  score += getResearchProductionBonus(technology, options, goal);
  score += getTechUnlockBonus(technology, options, goal, route);
  score += getPrayerTechBonus(technology, options, goal, route);
  if (isDangerous) {
    score += blockedFights.some(fight => fight.techId === technology.id) ? 40 : 10;
  }
  return score;
};
const applyResearchManualOverrides = (targets, manualOptions, options) => {
  if (!options.manualOverrides || !manualOptions) return targets;
  Object.keys(manualOptions).forEach(key => {
    if (manualOptions[key]) targets[key] = manualOptions[key];
  });
  return targets;
};
const isDirectlyRelevantResearch = (technology, options, goal, route) =>
  (goal.targetTechs || []).includes(technology.id) ||
  getTechUnlockBonus(technology, options, goal, route) > 0 ||
  getPrayerTechBonus(technology, options, goal, route) > 0;
const expandTechPrerequisites = seedIds => {
  const result = new Set();
  const visiting = {};
  const visit = techId => {
    if (result.has(techId) || visiting[techId] || isTechCompleted(techId)) return;
    const technology = tech.find(item => item.id === techId);
    if (!technology) return;
    visiting[techId] = true;
    result.add(techId);
    (technology.req || []).filter(req => req.type === 'tech').forEach(req => visit(req.id));
    visiting[techId] = false;
  };
  seedIds.forEach(visit);
  return result;
};
const getResearchTargets = (manualOptions = {}) => {
  const options = getOptions();
  if (!options.enabled || options.researchEnabled === false) return null;
  const goal = getGoal(options);
  const route = getRoute(options);
  const blockedFights = getBlockedDangerousFights(options);
  const relevantSeeds = tech
    .filter(technology => isDirectlyRelevantResearch(technology, options, goal, route))
    .map(technology => technology.id);
  const requiredPrereqs = expandTechPrerequisites(relevantSeeds);
  const targets = {};
  tech.forEach(technology => {
    const relevant = isDirectlyRelevantResearch(technology, options, goal, route) || requiredPrereqs.has(technology.id);
    targets[technology.id] = relevant ? toPriority(scoreResearch(technology, options, goal, route, blockedFights)) : 0;
  });
  getResearchGroups().forEach(group => {
    const members = (group.value || []).map(id => tech.find(technology => technology.id === id)).filter(Boolean);
    if (!members.length) return;
    const winner = members.reduce((best, candidate) => targets[candidate.id] > targets[best.id] ? candidate : best, members[0]);
    members.forEach(member => {
      if (member.id !== winner.id) targets[member.id] = 0;
    });
  });
  return applyResearchManualOverrides(targets, manualOptions, options);
};
