const getResearchGroups = () => groupChoices(tech);
const getTechUnlockBonus = (technology, goal) => {
  const focusTargets = getExpandedGoalFocusTargets(goal);
  if (!focusTargets.length) return 0;
  const unlockedBuildings = buildings.filter(building => (building.req || []).some(req => req.type === 'tech' && req.id === technology.id));
  if (!unlockedBuildings.length) return 0;
  const bestPriority = unlockedBuildings.reduce((max, building) => {
    const entry = focusTargets.find(target => target.id === building.id);
    return entry ? Math.max(max, entry.priority || 0) : max;
  }, 0);
  return bestPriority ? 60 + bestPriority * 8 : 0;
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
const scoreResearch = (technology, options, goal, blockedFights) => {
  if (resetResearch.includes(technology.id) && !(goal.targetTechs || []).includes(technology.id)) return 0;
  if ((options.researchExcludes || []).includes(technology.id)) return 0;
  const isDangerous = technology.confirm || unsafeResearch.includes(technology.id);
  let score = isDangerous ? 4 : 8;
  if ((goal.targetTechs || []).includes(technology.id)) score += 220;
  score += getResearchProductionBonus(technology, options, goal);
  score += getTechUnlockBonus(technology, goal);
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
const getResearchTargets = (manualOptions = {}) => {
  const options = getOptions();
  if (!options.enabled || options.researchEnabled === false) return null;
  const goal = getGoal(options);
  const blockedFights = getBlockedDangerousFights(options);
  const targets = {};
  tech.forEach(technology => {
    targets[technology.id] = toPriority(scoreResearch(technology, options, goal, blockedFights));
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
