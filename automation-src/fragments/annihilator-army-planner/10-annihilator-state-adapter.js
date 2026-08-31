const isAnnihilatorStageDefeated = stage => isUnlockCompleted('enemy', stage.id);
const isAnnihilatorStageFound = stage => !stage.reqFoundTech || isTechCompleted(stage.reqFoundTech);
const getRecruitedUnitCount = unitId => getUnitCount({ id: unitId });
