const isAnnihilatorStageDefeated = stage => {
  const enemy = getRunCollectionEntry('enemies', stage.id);
  return !!enemy && Number(enemy.owned) === 1;
};
const isAnnihilatorStageFound = stage => !stage.reqFoundTech || isTechCompleted(stage.reqFoundTech);
const getRecruitedUnitCount = unitId => getUnitCount({ id: unitId });
