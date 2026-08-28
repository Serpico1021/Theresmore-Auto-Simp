const isDangerousResearchStructurallyReady = techId => {
  const target = tech.find(technology => technology.id === techId);
  if (!target || !target.req) return true;
  return target.req.filter(req => req.type !== 'resource').every(req => {
    if (req.type === 'building') {
      const building = buildings.find(item => item.id === req.id);
      return !!building && getCount(building) >= req.value;
    }
    return isUnlockCompleted(req.type, req.id);
  });
};
const getNextDangerousFight = goal => {
  const next = getGoalDangerousFights(goal).find(item => !isTechCompleted(item.techId)) || null;
  if (!next || !isDangerousResearchStructurallyReady(next.techId)) return null;
  return next;
};
let dangerousFightCache = {
  key: '',
  at: 0,
  value: []
};
const canWinDangerousFight = fightId => {
  try {
    return armyCalculator.canWinBattle(fightId, true, false, state.options.autoSortArmy.enabled);
  } catch (error) {
    logger({
      msgLevel: 'debug',
      msg: `Smart planner could not evaluate dangerous fight ${fightId}: ${error && error.message ? error.message : error}`
    });
    return false;
  }
};
const getBlockedDangerousFights = options => {
  const goal = getGoal(options);
  if (!options.armyEnabled) return [];
  const nextDangerousFight = getNextDangerousFight(goal);
  if (!nextDangerousFight) return [];
  const gameData = reactUtil.getGameData();
  const armyStore = gameData && gameData.ArmyStore ? gameData.ArmyStore : {};
  const cacheKey = `${options.goal}|${nextDangerousFight.techId}|${armyStore.ownedCount || 0}|${armyStore.cap || 0}|${state.options.autoSortArmy.enabled ? 1 : 0}`;
  if (dangerousFightCache.key === cacheKey && Date.now() - dangerousFightCache.at < 2500) return dangerousFightCache.value;
  dangerousFightCache = {
    key: cacheKey,
    at: Date.now(),
    value: canWinDangerousFight(nextDangerousFight.fightId) ? [] : [nextDangerousFight]
  };
  return dangerousFightCache.value;
};
const shouldGateDangerousResearch = researchKey => {
  const options = getOptions();
  if (!options.enabled || !smartBuildDangerousFights[researchKey]) return false;
  const goal = getGoal(options);
  if ((goal.dangerousResearchOverrides || []).includes(researchKey)) return false;
  return true;
};
const isDangerousResearchOverridden = researchKey => {
  const options = getOptions();
  if (!options.enabled) return false;
  const goal = getGoal(options);
  return (goal.dangerousResearchOverrides || []).includes(researchKey);
};
