const ANNIHILATOR_EXPLORE_MINIMUM = 200;
const getAnnihilatorAllStages = () => [...annihilatorRoute.stages, ...annihilatorRoute.optionalStages];
const getCurrentAnnihilatorStages = () => {
  const frontIndex = annihilatorRoute.stages.findIndex(stage => !isAnnihilatorStageDefeated(stage));
  if (frontIndex === -1) return [];
  const front = annihilatorRoute.stages[frontIndex];
  if (!front.parallelGroup) return [front];
  return annihilatorRoute.stages.filter(stage => stage.parallelGroup === front.parallelGroup && !isAnnihilatorStageDefeated(stage));
};
const getAnnihilatorUnitTargets = configuredUnitsObject => {
  const currentStages = getCurrentAnnihilatorStages();
  const configuredTargets = Object.fromEntries(Object.entries(annihilatorRoute.armyTargets || {}).flatMap(([unitId, qty]) => [
    [unitId, qty], [`prio_${unitId}`, 4]
  ]));
  if (!currentStages.length) return configuredTargets;
  const overrides = {};
  currentStages.forEach(stage => {
    Object.entries(stage.requiredArmy || {}).forEach(([unitId, qty]) => {
      overrides[unitId] = Math.max(overrides[unitId] || 0, qty);
    });
  });
  const targets = { ...configuredTargets };
  Object.entries(overrides).forEach(([unitId, qty]) => {
    targets[unitId] = qty;
    targets[`prio_${unitId}`] = 9;
  });
  return targets;
};
const getAnnihilatorAttackWhitelist = configuredAttackOptions => {
  const targets = { ...configuredAttackOptions };
  getAnnihilatorAllStages().forEach(stage => {
    if (isAnnihilatorStageFound(stage)) targets[stage.id] = true;
  });
  return targets;
};
const ANNIHILATOR_DANGER_GATE_TECHS = ['dragon_assault', 'mysterious_robbery', 'fallen_angel', 'orc_horde'];
const getAnnihilatorRouteSnapshot = () => {
  const options = getOptions();
  if (options.goal !== 'annihilator') return null;
  const mapStage = stage => ({
    id: stage.id,
    reqFoundTech: stage.reqFoundTech || null,
    found: isAnnihilatorStageFound(stage),
    defeated: isAnnihilatorStageDefeated(stage),
    requiredArmy: stage.requiredArmy || {},
    parallelGroup: stage.parallelGroup || null,
    note: stage.note || null
  });
  const currentStageIds = getCurrentAnnihilatorStages().map(stage => stage.id);
  return {
    stages: annihilatorRoute.stages.map(mapStage),
    optionalStages: annihilatorRoute.optionalStages.map(mapStage),
    currentStageIds,
    dangerGates: ANNIHILATOR_DANGER_GATE_TECHS.map(techId => ({
      tech: techId,
      fight: dangerousFightsMapping[techId] || null,
      researched: isTechCompleted(techId)
    }))
  };
};
const getAnnihilatorExploreTargets = configuredExploreOptions => {
  const hasRemainingMainStage = annihilatorRoute.stages.some(stage => !isAnnihilatorStageDefeated(stage));
  if (!hasRemainingMainStage) return configuredExploreOptions;
  return {
    ...configuredExploreOptions,
    scoutsMax: Math.max(configuredExploreOptions.scoutsMax || 0, ANNIHILATOR_EXPLORE_MINIMUM),
    explorersMax: Math.max(configuredExploreOptions.explorersMax || 0, ANNIHILATOR_EXPLORE_MINIMUM)
  };
};
