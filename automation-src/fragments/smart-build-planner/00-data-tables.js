const smartBuildDefaults = {
  enabled: false,
  goal: 'progress',
  strategy: 'balanced',
  risk: 'normal',
  manualOverrides: false,
  maxExtra: 3,
  armyEnabled: true,
  armyMaxExtra: 25,
  armyMaxTarget: 250,
  maxTarget: 80,
  maxWaitSeconds: 180,
  forcedTargets: {}
};
const smartBuildResources = ['food', 'wood', 'stone', 'gold', 'research', 'tools', 'copper', 'iron', 'cow', 'horse', 'mana', 'building_material', 'faith', 'supplies', 'crystal', 'steel', 'saltpetre', 'natronite'];
const smartBuildGoals = {
  moonlightNight: {
    dangerousResearchOverrides: ['moonlight_night'],
    resourceFocus: ['research', 'food', 'wood', 'stone', 'iron', 'tools'],
    buildingFocus: ['common_house', 'quarry', 'artisan_workshop', 'watchman_outpost'],
    targetTechs: ['architecture', 'establish_boundaries', 'moonlight_night']
  }
};
const smartBuildRoutes = {
  moonlightNight: {
    label: 'Moonlight Night',
    buildingTargets: [
      { id: 'common_house', priority: 9, reason: { key: 'whitelist' } },
      { id: 'quarry', priority: 8, target: 5, reason: { key: 'whitelist' } },
      { id: 'artisan_workshop', priority: 8, reason: { key: 'whitelist' } },
      { id: 'watchman_outpost', priority: 10, reason: { key: 'gate' } }
    ],
    supportTargets: [
      { id: 'guild_of_craftsmen', priority: 6 },
      { id: 'university', priority: 5 },
      { id: 'farm', priority: 5, target: 5 },
      { id: 'carpenter_workshop', priority: 5 },
      { id: 'grocery', priority: 5 },
      { id: 'stable', priority: 5 },
      { id: 'lumberjack_camp', priority: 6, target: 5 },
      { id: 'mine', priority: 5, target: 5 },
      { id: 'titan_work_area', priority: 7 }
    ]
  }
};
