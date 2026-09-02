const getOptions = () => ({
  ...smartBuildDefaults,
  ...(state.options.smartBuild || {})
});
const normalizeRunCollection = collection => {
  if (!collection) return [];
  if (typeof collection === 'object' && typeof collection.length === 'number' && Number.isFinite(collection.length)) {
    return Array.from({ length: Math.max(0, collection.length) }, (_, index) => collection[index])
      .filter(item => typeof item !== 'undefined');
  }
  if (typeof collection.values === 'function') {
    try {
      return Array.from(collection.values());
    } catch (error) {}
  }
  return typeof collection === 'object' ? Object.values(collection) : [];
};
const getRunCollection = groupName => {
  const gameData = reactUtil.getGameData && reactUtil.getGameData();
  return normalizeRunCollection(gameData && gameData.run ? gameData.run[groupName] : null);
};
const getRunCollectionEntry = (groupName, id, prefixes = []) => {
  const gameData = reactUtil.getGameData && reactUtil.getGameData();
  if (!gameData || !gameData.run) return null;
  const keys = [id, ...prefixes.map(prefix => `${prefix}${id}`)];
  const collection = gameData.run[groupName];
  const indexMap = gameData.idxs && gameData.idxs[groupName];
  const index = indexMap && keys.map(key => indexMap[key]).find(value => typeof value !== 'undefined');
  if (collection && typeof index !== 'undefined' && typeof collection[index] !== 'undefined') return collection[index];
  if (collection && typeof collection === 'object') {
    const directKey = keys.find(key => typeof collection[key] !== 'undefined');
    if (directKey) return collection[directKey];
  }
  return getRunCollection(groupName).find(entry => {
    if (keys.includes(entry)) return true;
    if (!entry || typeof entry !== 'object') return false;
    return keys.includes(entry.id || entry.key || entry.tech || entry.name || entry.job);
  }) || null;
};
const getRunResourceSnapshot = id => {
  const entry = getRunCollectionEntry('resources', id);
  const current = entry && typeof entry === 'object' ? Number(entry.value ?? entry.current) : Number(entry);
  if (!Number.isFinite(current)) return null;
  return { name: id, current, max: current, speed: 0, ttf: null, ttz: null };
};
const getResourceMap = () => {
  const map = {};
  smartBuildResources.forEach(id => {
    const value = smartBuildStaticResources.includes(id)
      ? getRunResourceSnapshot(id) || resources.get(id)
      : resources.get(id);
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
  const entry = getRunCollectionEntry('population', jobId, ['population_', 'pop_']);
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
    const items = normalizeRunCollection(group);
    if (items.some(item => keys.includes(item) || item && keys.includes(item.id || item.key || item.tech || item.name) && item.value !== 0)) return true;
    if (typeof group === 'object') return keys.some(key => !!group[key]);
    return false;
  });
};
const isTechCompleted = techId => {
  const entry = getRunCollectionEntry('techs', techId, ['tec_']);
  if (!entry) return false;
  return typeof entry === 'object'
    ? Number(entry.value ?? entry.current ?? entry.owned) > 0
    : Number(entry) > 0;
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
