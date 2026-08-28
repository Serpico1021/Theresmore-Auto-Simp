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
  maxWaitSeconds: 180
};
const smartBuildResources = ['food', 'wood', 'stone', 'gold', 'research', 'tools', 'copper', 'iron', 'cow', 'horse', 'mana', 'building_material', 'faith', 'supplies', 'crystal', 'steel', 'saltpetre', 'natronite'];
const smartBuildStrategyWeights = {
  balanced: {
    resource: 1.15,
    science: 1,
    living_quarters: 1,
    defense: 0.85,
    faith: 0.9,
    commercial_area: 0.95,
    warehouse: 1.05,
    wonders: 0.35
  },
  research: {
    resource: 1,
    science: 1.55,
    living_quarters: 1,
    defense: 0.65,
    faith: 0.8,
    commercial_area: 0.85,
    warehouse: 1,
    wonders: 0.35
  },
  prestige: {
    resource: 1.25,
    science: 0.9,
    living_quarters: 0.9,
    defense: 1.1,
    faith: 0.8,
    commercial_area: 0.9,
    warehouse: 0.75,
    wonders: 0.25
  },
  military: {
    resource: 1.05,
    science: 0.8,
    living_quarters: 1,
    defense: 1.55,
    faith: 0.85,
    commercial_area: 0.9,
    warehouse: 0.9,
    wonders: 0.3
  }
};
const smartBuildGoals = {
  progress: {
    resourceFocus: ['research', 'wood', 'stone', 'tools', 'iron', 'building_material'],
    buildingFocus: ['city_center', 'academy_of_freethinkers', 'refugee_district', 'mana_pit', 'harbor_district'],
    targetTechs: ['architecture', 'establish_boundaries', 'moonlight_night', 'end_ancient_era', 'end_feudal_era', 'end_era_4_1', 'end_era_4_2'],
    weights: {
      resource: 1.2,
      science: 1.05,
      living_quarters: 1,
      defense: 0.9,
      warehouse: 1
    }
  },
  moonlightNight: {
    dangerousResearchOverrides: ['moonlight_night'],
    resourceFocus: ['research', 'food', 'wood', 'stone', 'iron', 'tools'],
    buildingFocus: ['common_house', 'quarry', 'artisan_workshop', 'watchman_outpost'],
    targetTechs: ['architecture', 'establish_boundaries', 'moonlight_night'],
    weights: {
      resource: 1.1,
      science: 1.35,
      living_quarters: 1,
      defense: 1.7,
      warehouse: 0.85,
      wonders: 0.2
    }
  },
  druid: {
    resourceFocus: ['research', 'food', 'wood', 'stone', 'iron', 'tools', 'building_material', 'mana', 'faith'],
    buildingFocus: ['common_house', 'mansion', 'quarry', 'carpenter_workshop', 'grocery', 'steelworks', 'alchemic_laboratory', 'city_center', 'academy_of_freethinkers', 'refugee_district', 'mana_pit', 'marketplace', 'university', 'watchman_outpost', 'temple'],
    targetTechs: ['bronze_working', 'mathematic', 'religion', 'architecture', 'establish_boundaries', 'banking', 'knighthood', 'chemistry', 'moonlight_night', 'end_feudal_era', 'dragon_assault', 'magic_arts_teaching', 'mana_utilization', 'lonely_druid'],
    weights: {
      resource: 1.2,
      science: 1.35,
      faith: 1.1,
      defense: 1.25,
      warehouse: 0.9,
      wonders: 0.45
    }
  },
  gloriousRetirement: {
    resourceFocus: ['research', 'gold', 'crystal', 'iron', 'tools'],
    buildingFocus: ['watchman_outpost', 'bank', 'credit_union', 'crystal_farm_b', 'mansion', 'carpenter_workshop', 'steelworks'],
    targetTechs: ['architecture', 'establish_boundaries', 'banking', 'knighthood', 'moonlight_night', 'glorious_retirement'],
    weights: {
      resource: 1.1,
      science: 1.2,
      commercial_area: 1.25,
      defense: 1.1,
      warehouse: 0.85,
      wonders: 0.2
    }
  },
  annihilator: {
    resourceFocus: ['research', 'mana', 'crystal', 'steel', 'supplies', 'building_material', 'faith'],
    buildingFocus: ['common_house', 'mansion', 'quarry', 'carpenter_workshop', 'grocery', 'steelworks', 'alchemic_laboratory', 'city_center', 'academy_of_freethinkers', 'refugee_district', 'mana_pit', 'harbor_district', 'marketplace', 'university', 'statue_lurezia', 'island_outpost', 'watchman_outpost', 'temple', 'colony_hall', 'lumix_plant', 'sanctum_healing', 'containment_cell', 'beacon_light', 'light_square_b', 'signal_machine', 'mana_extractors', 'arcane_school', 'industrial_plant'],
    targetTechs: ['architecture', 'establish_boundaries', 'banking', 'knighthood', 'moonlight_night', 'end_feudal_era', 'dragon_assault', 'research_annhilator', 'create_annhilator', 'launch_annhilator', 'destroy_annhilator'],
    weights: {
      resource: 1.25,
      science: 1.3,
      faith: 1.15,
      defense: 1.15,
      warehouse: 0.95,
      wonders: 0.35
    }
  }
};
const smartBuildRoutes = {
  moonlightNight: {
    label: 'Moonlight Night',
    buildingTargets: [
      { id: 'common_house', priority: 9, reason: 'moonlight whitelist' },
      { id: 'quarry', priority: 8, reason: 'moonlight whitelist' },
      { id: 'artisan_workshop', priority: 8, reason: 'moonlight whitelist' },
      { id: 'watchman_outpost', priority: 10, reason: 'moonlight gate' }
    ],
    supportTargets: [
      { id: 'guild_of_craftsmen', priority: 6 },
      { id: 'university', priority: 5 },
      { id: 'farm', priority: 5 },
      { id: 'carpenter_workshop', priority: 5 },
      { id: 'grocery', priority: 5 },
      { id: 'stable', priority: 5 }
    ]
  },
  druid: {
    label: 'Druid route',
    buildingTargets: [
      { id: 'common_house', priority: 9 },
      { id: 'mansion', priority: 8 },
      { id: 'quarry', priority: 8 },
      { id: 'carpenter_workshop', priority: 8 },
      { id: 'grocery', priority: 8 },
      { id: 'steelworks', priority: 8 },
      { id: 'alchemic_laboratory', priority: 8 },
      { id: 'city_center', priority: 9 },
      { id: 'academy_of_freethinkers', priority: 9 },
      { id: 'refugee_district', priority: 8 },
      { id: 'mana_pit', priority: 9 },
      { id: 'artisan_workshop', priority: 8 },
      { id: 'marketplace', priority: 7 },
      { id: 'university', priority: 8 },
      { id: 'watchman_outpost', priority: 9 },
      { id: 'temple', priority: 8 }
    ],
    supportTargets: [
      { id: 'guild_of_craftsmen', priority: 6 },
      { id: 'farm', priority: 5 },
      { id: 'stable', priority: 5 }
    ]
  },
  annihilator: {
    label: 'Annihilator route',
    buildingTargets: [
      { id: 'common_house', priority: 9 },
      { id: 'mansion', priority: 8 },
      { id: 'quarry', priority: 8 },
      { id: 'carpenter_workshop', priority: 8 },
      { id: 'grocery', priority: 8 },
      { id: 'steelworks', priority: 8 },
      { id: 'alchemic_laboratory', priority: 8 },
      { id: 'city_center', priority: 9 },
      { id: 'academy_of_freethinkers', priority: 9 },
      { id: 'refugee_district', priority: 8 },
      { id: 'mana_pit', priority: 9 },
      { id: 'harbor_district', priority: 9 },
      { id: 'artisan_workshop', priority: 8 },
      { id: 'marketplace', priority: 7 },
      { id: 'university', priority: 8 },
      { id: 'statue_lurezia', priority: 6 },
      { id: 'island_outpost', priority: 9 },
      { id: 'watchman_outpost', priority: 9 },
      { id: 'temple', priority: 8 },
      { id: 'colony_hall', priority: 9 },
      { id: 'lumix_plant', priority: 8 },
      { id: 'sanctum_healing', priority: 8 },
      { id: 'containment_cell', priority: 8 },
      { id: 'beacon_light', priority: 10 },
      { id: 'light_square_b', priority: 10 },
      { id: 'signal_machine', priority: 10 }
    ],
    supportTargets: [
      { id: 'guild_of_craftsmen', priority: 6 },
      { id: 'farm', priority: 5 },
      { id: 'stable', priority: 5 },
      { id: 'mana_extractors', priority: 6 },
      { id: 'arcane_school', priority: 6 }
    ]
  }
};
const smartBuildDangerousFights = {
  moonlight_night: 'army_of_goblin',
  dragon_assault: 'army_of_dragon',
  mysterious_robbery: 'fallen_angel_army_1',
  fallen_angel: 'fallen_angel_army_2',
  orc_horde: 'orc_horde_boss',
  kobold_nation: 'king_kobold_nation',
  barbarian_tribes: 'barbarian_horde',
  mindless_evil: 'mindless_evil_boss'
};
const smartBuildTitanOverrides = {
  // key: 泰坦建筑 id（已建成，getCount >= 1 时生效）
  // replaces: [{ id: 普通建筑 id, capFactor: 目标数量乘数（0 表示完全不用造）}]
  // goals: 可选，只在列出的 goal 下生效；不填则对所有 goal 生效
  // 首版为空表，具体泰坦建筑/替代关系待后续单独确认后填充（见设计 spec 的"开放问题"）
};
const smartBuildBattleTemplates = {
  army_of_goblin: {
    label: 'Moonlight Night goblin defense',
    preferredUnits: [
      { id: 'spearman', weight: 1.45, priority: 10 },
      { id: 'heavy_warrior', weight: 1.25, priority: 9 },
      { id: 'phalanx', weight: 1.2, priority: 9 },
      { id: 'archer', weight: 1.05, priority: 8 },
      { id: 'warrior', weight: 1, priority: 7 },
      { id: 'light_cavarly', weight: 0.8, priority: 6 }
    ],
    preferredBuildings: [
      { id: 'watchman_outpost', priority: 10 },
      { id: 'boot_camp', priority: 9 },
      { id: 'castrum_militia', priority: 8 },
      { id: 'recruit_training_center', priority: 8 }
    ]
  },
  army_of_dragon: {
    label: 'Dragon Assault defense',
    preferredUnits: [
      { id: 'phalanx', weight: 1.55, priority: 10 },
      { id: 'knight', weight: 1.35, priority: 9 },
      { id: 'cleric', weight: 1.35, priority: 9 },
      { id: 'heavy_warrior', weight: 1.25, priority: 8 },
      { id: 'crossbowman', weight: 1.15, priority: 8 },
      { id: 'paladin', weight: 1.1, priority: 8 },
      { id: 'archer', weight: 0.85, priority: 6 }
    ],
    preferredBuildings: [
      { id: 'boot_camp', priority: 10 },
      { id: 'recruit_training_center', priority: 9 },
      { id: 'mercenary_outpost', priority: 8 },
      { id: 'watchman_outpost', priority: 8 }
    ]
  }
};
