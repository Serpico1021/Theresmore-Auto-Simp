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
  manualResourceClicksPerSecond: 8,
  forcedTargets: {}
};
const smartBuildResources = ['food', 'wood', 'stone', 'gold', 'research', 'tools', 'copper', 'iron', 'cow', 'horse', 'mana', 'building_material', 'faith', 'supplies', 'crystal', 'steel', 'saltpetre', 'natronite'];
const smartBuildGoals = {
  moonlightNight: {
    dangerousResearchOverrides: ['moonlight_night'],
    postGoalBoundaryTechs: ['moonlight_night', 'end_feudal_era'],
    allowedBridgeBuildings: [
      'common_house',
      'farm',
      'lumberjack_camp',
      'quarry',
      'mine',
      'artisan_workshop',
      'school',
      'marketplace',
      'carpenter_workshop',
      'grocery',
      'university',
      'guild_of_craftsmen',
      'steelworks',
      'stable',
      'titan_work_area',
      'watchman_outpost'
    ],
    capProviderPreferences: {
      research: ['school', 'university'],
      gold: ['marketplace', 'artisan_workshop'],
      tools: ['marketplace', 'artisan_workshop'],
      building_material: ['carpenter_workshop'],
      supplies: ['grocery'],
      steel: ['steelworks']
    },
    resourceFocus: ['research', 'food', 'wood', 'stone', 'copper', 'iron', 'tools'],
    buildingFocus: ['common_house', 'farm', 'lumberjack_camp', 'quarry', 'mine', 'artisan_workshop', 'school', 'watchman_outpost'],
    supportTechs: ['servitude'],
    targetTechs: ['architecture', 'establish_boundaries', 'moonlight_night']
  }
};
const smartBuildRoutes = {
  moonlightNight: {
    label: 'Moonlight Night',
    buildingTargets: [
      { id: 'common_house', priority: 9, reason: { key: 'whitelist' } },
      { id: 'quarry', priority: 8, reason: { key: 'whitelist' } },
      { id: 'mine', priority: 8, reason: { key: 'resourceBridge' } },
      { id: 'artisan_workshop', priority: 8, reason: { key: 'whitelist' } },
      { id: 'school', priority: 8, reason: { key: 'resourceCapBridge' } },
      { id: 'watchman_outpost', priority: 10, reason: { key: 'gate' } }
    ],
    supportTargets: [
      { id: 'guild_of_craftsmen', priority: 6 },
      { id: 'university', priority: 5 },
      { id: 'marketplace', priority: 5 },
      { id: 'farm', priority: 8 },
      { id: 'carpenter_workshop', priority: 5 },
      { id: 'grocery', priority: 5 },
      { id: 'stable', priority: 5 },
      { id: 'lumberjack_camp', priority: 6 },
      { id: 'titan_work_area', priority: 7 }
    ]
  }
};
