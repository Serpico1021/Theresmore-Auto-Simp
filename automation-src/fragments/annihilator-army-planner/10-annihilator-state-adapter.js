const isAnnihilatorStageDefeated = stage => {
  const gameData = reactUtil.getGameData && reactUtil.getGameData();
  const enemies = gameData && gameData.run && gameData.run.enemies;
  if (!Array.isArray(enemies)) return false;
  const enemy = enemies.find(entry => entry && entry.id === stage.id);
  return !!enemy && Number(enemy.owned) === 1;
};
const isAnnihilatorStageFound = stage => !stage.reqFoundTech || isTechCompleted(stage.reqFoundTech);
const getRecruitedUnitCount = unitId => getUnitCount({ id: unitId });
