const getOptions = () => ({
  ...smartBuildDefaults,
  ...(state.options.smartBuild || {})
});
const getResourceMap = () => {
  const map = {};
  smartBuildResources.forEach(id => {
    const value = resources.get(id);
    if (value) map[id] = value;
  });
  return map;
};
const getCount = building => {
  const gameData = reactUtil.getGameData();
  const idx = gameData && gameData.idxs && gameData.idxs.buildings ? gameData.idxs.buildings[building.id] : undefined;
  if (typeof idx === 'undefined') return 0;
  const entry = gameData.run && gameData.run.buildings ? gameData.run.buildings[idx] : null;
  const numeric = entry ? Number(entry.value) : 0;
  return Number.isFinite(numeric) ? numeric : 0;
};
const getUnitCount = unit => {
  const gameData = reactUtil.getGameData();
  const armyIndex = gameData && gameData.idxs && gameData.idxs.army ? gameData.idxs.army[unit.id] : null;
  const armyData = armyIndex !== null && typeof armyIndex !== 'undefined' && gameData.run && gameData.run.army ? gameData.run.army[armyIndex] : null;
  return armyData ? armyData.value : 0;
};
const isFoodSecurityGateEnabled = options => ['moonlightNight', 'fastNgPlus'].includes(options && options.goal);
const FIRST_HOUSE_WOOD_RESERVE = 24;
const FIRST_HOUSE_FOOD_RESERVE = 57.5;
const getFirstHouseMaterialBlockReason = () => {
  const wood = resources.get('wood');
  const food = resources.get('food');
  const woodReady = wood && Number(wood.current) > FIRST_HOUSE_WOOD_RESERVE;
  const foodReady = food && Number(food.current) > FIRST_HOUSE_FOOD_RESERVE;
  if (woodReady && foodReady) return null;
  return {
    type: 'food-security',
    requirement: 'first-house-materials',
    woodMinimum: FIRST_HOUSE_WOOD_RESERVE,
    foodMinimum: FIRST_HOUSE_FOOD_RESERVE
  };
};
const getAssignedJobCount = jobId => {
  const gameData = reactUtil.getGameData && reactUtil.getGameData();
  if (!gameData) return 0;
  const rawPopulation = gameData.run && gameData.run.population;
  const population = Array.isArray(rawPopulation)
    ? rawPopulation
    : rawPopulation && typeof rawPopulation === 'object'
      ? Object.values(rawPopulation)
      : [];
  const normalizeJobId = value => String(value || '').replace(/^(population_|pop_)/, '');
  const matchesJob = item => item && normalizeJobId(item.id || item.key || item.job) === jobId;
  const populationIndex = gameData.idxs && gameData.idxs.population ? gameData.idxs.population : {};
  const indexKeys = [jobId, `population_${jobId}`, `pop_${jobId}`];
  const index = indexKeys.map(key => populationIndex[key]).find(value => Number.isInteger(Number(value)));
  const indexedEntry = typeof index !== 'undefined' ? population[Number(index)] : null;
  const entry = matchesJob(indexedEntry) ? indexedEntry : population.find(matchesJob);
  const numeric = entry ? Number(entry.value ?? entry.current ?? entry.count) : 0;
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};
const getFoodSecurityBlockReason = (options, buildingId, count) => {
  if (buildingId !== 'common_house' || !isFoodSecurityGateEnabled(options)) return null;
  if (count < 1) return getFirstHouseMaterialBlockReason();
  const farm = buildings.find(candidate => candidate.id === 'farm');
  if (!farm || getCount(farm) < 1) return { type: 'food-security', requirement: 'farm' };
  return null;
};
const hasIndexedOrRunItem = (id, prefixes = []) => {
  const gameData = reactUtil.getGameData && reactUtil.getGameData();
  if (!gameData) return false;
  const keys = [id, ...prefixes.map(prefix => `${prefix}${id}`)];
  const idxGroups = gameData.idxs ? Object.keys(gameData.idxs).map(key => gameData.idxs[key]).filter(group => group && typeof group === 'object') : [];
  if (idxGroups.some(group => keys.some(key => typeof group[key] !== 'undefined'))) return true;
  const runGroups = gameData.run ? Object.keys(gameData.run).map(key => gameData.run[key]).filter(Boolean) : [];
  return runGroups.some(group => {
    if (Array.isArray(group)) {
      return group.some(item => keys.includes(item) || item && keys.includes(item.id || item.key || item.tech || item.name) && item.value !== 0);
    }
    if (typeof group === 'object') return keys.some(key => !!group[key]);
    return false;
  });
};
const isTechCompleted = techId => {
  return hasIndexedOrRunItem(techId, ['tec_']);
};
const isBuildingUnlocked = building => {
  if (!building.req) return true;
  return building.req.filter(req => req.type !== 'resource').every(req => {
    if (req.type === 'building') {
      const prereq = buildings.find(item => item.id === req.id);
      return !!prereq && getCount(prereq) >= req.value;
    }
    return isUnlockCompleted(req.type, req.id);
  });
};
const isUnlockCompleted = (type, id) => {
  if (type === 'tech' || type === 'research') return isTechCompleted(id);
  if (type === 'prayer' || type === 'magic') return hasIndexedOrRunItem(id, ['fai_']);
  if (type === 'legacy') return hasIndexedOrRunItem(id, ['leg_']);
  if (type === 'enemy') return hasIndexedOrRunItem(id);
  return false;
};
const getCompletedLegacyIds = () => (typeof legacies !== 'undefined' ? legacies : [])
  .filter(legacy => isUnlockCompleted('legacy', legacy.id))
  .map(legacy => legacy.id)
  .sort();
const hasStageGate = building => (building.req || []).some(req => req.type !== 'resource');
const getCurrentStageIndex = () => {
  const unlockedAges = buildings.filter(building => building.age !== 100 && hasStageGate(building) && isBuildingUnlocked(building)).map(building => building.age).filter(age => Number.isFinite(age));
  return unlockedAges.length ? Math.max(...unlockedAges) : 1;
};
