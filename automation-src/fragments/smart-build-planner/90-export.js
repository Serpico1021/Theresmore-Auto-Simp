const getUnitTargets = configuredUnitsObject => {
  const options = getOptions();
  if (!options.enabled || options.manualOverrides || options.goal !== 'annihilator') return null;
  return getAnnihilatorUnitTargets(configuredUnitsObject);
};
const getExploreTargets = configuredExploreOptions => {
  const options = getOptions();
  if (!options.enabled || options.manualOverrides || options.goal !== 'annihilator') return null;
  return getAnnihilatorExploreTargets(configuredExploreOptions);
};
const getAttackTargets = configuredAttackOptions => {
  const options = getOptions();
  if (!options.enabled || options.manualOverrides || options.goal !== 'annihilator') return null;
  return getAnnihilatorAttackWhitelist(configuredAttackOptions);
};
const getPrayerTargets = () => {
  const options = getOptions();
  if (!options.enabled || options.prayerEnabled === false || options.manualOverrides || options.goal !== 'annihilator') return null;
  return { ...annihilatorRoute.prayerTargets };
};
return {
  getTargets,
  getResearchTargets,
  getUnitTargets,
  getExploreTargets,
  getAttackTargets,
  getPrayerTargets,
  isDangerousResearchOverridden,
  shouldGateDangerousResearch,
  getPathSnapshot,
  getAnnihilatorRouteSnapshot
};
