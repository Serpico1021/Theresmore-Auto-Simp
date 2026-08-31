const annihilatorRoute = {
  stages: [
    { id: 'far_west_island',    reqFoundTech: 'seafaring',           requiredArmy: { heavy_warrior: 1600 } },
    { id: 'orcish_prison_camp', reqFoundTech: 'burned_farms',        requiredArmy: { heavy_warrior: 1600 } },
    { id: 'orc_raiding_party',  reqFoundTech: 'orcish_threat',       requiredArmy: { heavy_warrior: 1600 } },
    { id: 'orc_gormiak_citadel',reqFoundTech: 'orcish_citadel',      requiredArmy: { heavy_warrior: 1600 } },
    { id: 'orc_horith_citadel', reqFoundTech: 'mankind_darkest',     requiredArmy: { heavy_warrior: 1600 }, parallelGroup: 'mankind_darkest_unlocked' },
    { id: 'orc_ogsog_citadel',  reqFoundTech: 'mankind_darkest',     requiredArmy: { heavy_warrior: 1600 }, parallelGroup: 'mankind_darkest_unlocked' },
    { id: 'orc_turgon_citadel', reqFoundTech: 'mankind_darkest',     requiredArmy: { heavy_warrior: 1600 }, parallelGroup: 'mankind_darkest_unlocked' },
    { id: 'lost_valley',        reqFoundTech: 'ancient_artifact',    requiredArmy: { heavy_warrior: 1600 } },
    { id: 'corrupted_lands',    reqFoundTech: 'black_artifact',      requiredArmy: { heavy_warrior: 1600 } },
    { id: 'dark_village',       reqFoundTech: 'explore_sorrounding', requiredArmy: { heavy_warrior: 1600 }, note: 'requires 5 beacon buildings in addition to defeating this enemy (not covered by this route table)' }
  ],
  optionalStages: [
    { id: 'mountain_cave',    requiredArmy: { heavy_warrior: 1600 } },
    { id: 'worn_down_crypt',  reqFoundTech: 'guild',                requiredArmy: { heavy_warrior: 1600 } },
    { id: 'huge_cave',        reqFoundTech: 'underground_library',  requiredArmy: { heavy_warrior: 1600 } },
    { id: 'gulud_ugdun',      reqFoundTech: 'path_children',        requiredArmy: { heavy_warrior: 1600 } },
    { id: 'lich_fortress',    reqFoundTech: 'huge_cave_t',          requiredArmy: { heavy_warrior: 1600 } }
  ]
};
