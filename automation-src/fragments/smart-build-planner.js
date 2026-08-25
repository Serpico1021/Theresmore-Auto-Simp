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
      buildingFocus: ['city_center', 'academy_of_freethinkers', 'mana_pit', 'harbor_district'],
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
        { id: 'common_house', target: 15, priority: 9, reason: 'moonlight whitelist: 15 common houses' },
        { id: 'quarry', target: 3, priority: 8, reason: 'moonlight whitelist: 3 quarries' },
        { id: 'artisan_workshop', target: 5, priority: 8, reason: 'moonlight whitelist: 5 artisan workshops' },
        { id: 'watchman_outpost', target: 4, priority: 10, reason: 'moonlight gate: 4 watchman outposts' }
      ],
      supportTargets: [
        { id: 'guild_of_craftsmen', target: 1, priority: 6 },
        { id: 'university', target: 1, priority: 5 },
        { id: 'farm', target: 5, priority: 5 },
        { id: 'carpenter_workshop', target: 1, priority: 5 },
        { id: 'grocery', target: 1, priority: 5 },
        { id: 'stable', target: 1, priority: 5 }
      ]
    },
    druid: {
      label: 'Druid route',
      buildingTargets: [
        { id: 'common_house', target: 15, priority: 9 },
        { id: 'mansion', target: 3, priority: 8 },
        { id: 'quarry', target: 3, priority: 8 },
        { id: 'carpenter_workshop', target: 3, priority: 8 },
        { id: 'grocery', target: 3, priority: 8 },
        { id: 'steelworks', target: 3, priority: 8 },
        { id: 'alchemic_laboratory', target: 1, priority: 8 },
        { id: 'city_center', target: 1, priority: 9 },
        { id: 'academy_of_freethinkers', target: 1, priority: 9 },
        { id: 'refugee_district', target: 1, priority: 8 },
        { id: 'mana_pit', target: 1, priority: 9 },
        { id: 'artisan_workshop', target: 5, priority: 8 },
        { id: 'marketplace', target: 3, priority: 7 },
        { id: 'university', target: 3, priority: 8 },
        { id: 'watchman_outpost', target: 4, priority: 9 },
        { id: 'temple', target: 1, priority: 8 }
      ],
      supportTargets: [
        { id: 'guild_of_craftsmen', target: 1, priority: 6 },
        { id: 'farm', target: 5, priority: 5 },
        { id: 'stable', target: 1, priority: 5 }
      ]
    },
    annihilator: {
      label: 'Annihilator route',
      buildingTargets: [
        { id: 'common_house', target: 15, priority: 9 },
        { id: 'mansion', target: 3, priority: 8 },
        { id: 'quarry', target: 3, priority: 8 },
        { id: 'carpenter_workshop', target: 3, priority: 8 },
        { id: 'grocery', target: 3, priority: 8 },
        { id: 'steelworks', target: 3, priority: 8 },
        { id: 'alchemic_laboratory', target: 1, priority: 8 },
        { id: 'city_center', target: 1, priority: 9 },
        { id: 'academy_of_freethinkers', target: 1, priority: 9 },
        { id: 'refugee_district', target: 1, priority: 8 },
        { id: 'mana_pit', target: 1, priority: 9 },
        { id: 'harbor_district', target: 1, priority: 9 },
        { id: 'artisan_workshop', target: 5, priority: 8 },
        { id: 'marketplace', target: 3, priority: 7 },
        { id: 'university', target: 3, priority: 8 },
        { id: 'statue_lurezia', target: 1, priority: 6 },
        { id: 'island_outpost', target: 1, priority: 9 },
        { id: 'watchman_outpost', target: 4, priority: 9 },
        { id: 'temple', target: 3, priority: 8 },
        { id: 'colony_hall', target: 12, priority: 9 },
        { id: 'lumix_plant', target: 1, priority: 8 },
        { id: 'sanctum_healing', target: 1, priority: 8 },
        { id: 'containment_cell', target: 3, priority: 8 },
        { id: 'beacon_light', target: 5, priority: 10 },
        { id: 'light_square_b', target: 5, priority: 10 },
        { id: 'signal_machine', target: 1, priority: 10 }
      ],
      supportTargets: [
        { id: 'guild_of_craftsmen', target: 1, priority: 6 },
        { id: 'farm', target: 5, priority: 5 },
        { id: 'stable', target: 1, priority: 5 },
        { id: 'mana_extractors', target: 3, priority: 6 },
        { id: 'arcane_school', target: 5, priority: 6 }
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
  const smartBuildPlanner = (() => {
    const getOptions = () => ({
      ...smartBuildDefaults,
      ...(state.options.smartBuild || {})
    });
    const getResourceMap = () => {
      const map = {};
      smartBuildResources.forEach(id => {
        const value = resources.get(id);
        if (value) map[id] = value;
      });
      return map;
    };
    const getCount = building => {
      const key = keyGen.building.key(building.id);
      const counts = reactUtil.getGameData() && reactUtil.getGameData().idxs ? reactUtil.getGameData().idxs.buildings : {};
      return counts && counts[key] ? counts[key] : 0;
    };
    const getUnitCount = unit => {
      const gameData = reactUtil.getGameData();
      const armyIndex = gameData && gameData.idxs && gameData.idxs.army ? gameData.idxs.army[unit.id] : null;
      const armyData = armyIndex !== null && typeof armyIndex !== 'undefined' && gameData.run && gameData.run.army ? gameData.run.army[armyIndex] : null;
      return armyData ? armyData.value : 0;
    };
    const getGoal = options => smartBuildGoals[options.goal] || smartBuildGoals.progress;
    const getRoute = options => smartBuildRoutes[options.goal] || null;
    const getRouteTargets = route => {
      if (!route) return [];
      return [...(route.buildingTargets || []), ...(route.supportTargets || [])];
    };
    const getExpandedRouteTargets = route => {
      if (!route) return [];
      const byId = {};
      const visiting = {};
      const addEntry = (entry, inheritedPriority = 6, reason = 'route target') => {
        if (!entry || !entry.id) return;
        const building = buildings.find(candidate => candidate.id === entry.id);
        if (!building) return;
        const priority = Math.max(entry.priority || 0, inheritedPriority || 0, 1);
        const target = Math.max(1, Number(entry.target) || 1);
        if (!byId[entry.id] || byId[entry.id].target < target || byId[entry.id].priority < priority) {
          byId[entry.id] = {
            id: entry.id,
            target,
            priority,
            reason: entry.reason || reason
          };
        }
        if (visiting[entry.id]) return;
        visiting[entry.id] = true;
        (building.req || []).filter(req => req.type === 'building').forEach(req => {
          addEntry({
            id: req.id,
            target: Math.max(1, Number(req.value) || 1),
            priority: Math.min(10, priority + 1),
            reason: `route prerequisite for ${entry.id}`
          }, Math.min(10, priority + 1), `route prerequisite for ${entry.id}`);
        });
        visiting[entry.id] = false;
      };
      getRouteTargets(route).forEach(entry => addEntry(entry, entry.priority || 6, entry.reason || 'route target'));
      return Object.values(byId);
    };
    const getRouteEntry = (building, route) => getExpandedRouteTargets(route).find(entry => entry.id === building.id);
    const getGoalTechs = goal => (goal.targetTechs || []).map(techId => tech.find(technology => technology.id === techId)).filter(Boolean);
    const getGoalDangerousFights = goal => (goal.targetTechs || []).filter(techId => smartBuildDangerousFights[techId]).map(techId => ({
      techId,
      fightId: smartBuildDangerousFights[techId]
    }));
    const hasIndexedOrRunItem = (id, prefixes = []) => {
      const gameData = reactUtil.getGameData && reactUtil.getGameData();
      if (!gameData) return false;
      const keys = [id, ...prefixes.map(prefix => `${prefix}${id}`)];
      const idxGroups = gameData.idxs ? Object.keys(gameData.idxs).map(key => gameData.idxs[key]).filter(group => group && typeof group === 'object') : [];
      if (idxGroups.some(group => keys.some(key => typeof group[key] !== 'undefined'))) return true;
      const runGroups = gameData.run ? Object.keys(gameData.run).map(key => gameData.run[key]).filter(Boolean) : [];
      return runGroups.some(group => {
        if (Array.isArray(group)) {
          return group.some(item => keys.includes(item) || item && keys.includes(item.id || item.key || item.tech || item.name) && item.value !== 0);
        }
        if (typeof group === 'object') return keys.some(key => !!group[key]);
        return false;
      });
    };
    const isTechCompleted = techId => {
      return hasIndexedOrRunItem(techId, ['tec_']);
    };
    const isUnlockCompleted = (type, id) => {
      if (type === 'tech' || type === 'research') return isTechCompleted(id);
      if (type === 'prayer' || type === 'magic') return hasIndexedOrRunItem(id, ['fai_']);
      if (type === 'legacy') return hasIndexedOrRunItem(id, ['leg_']);
      return false;
    };
    const isDangerousResearchStructurallyReady = techId => {
      const target = tech.find(technology => technology.id === techId);
      if (!target || !target.req) return true;
      return target.req.filter(req => req.type !== 'resource').every(req => {
        if (req.type === 'building') {
          const building = buildings.find(item => item.id === req.id);
          return !!building && getCount(building) >= req.value;
        }
        return isUnlockCompleted(req.type, req.id);
      });
    };
    const getNextDangerousFight = goal => {
      const next = getGoalDangerousFights(goal).find(item => !isTechCompleted(item.techId)) || null;
      if (!next || !isDangerousResearchStructurallyReady(next.techId)) return null;
      return next;
    };
    let dangerousFightCache = {
      key: '',
      at: 0,
      value: []
    };
    const canWinDangerousFight = fightId => {
      try {
        return armyCalculator.canWinBattle(fightId, true, false, state.options.autoSortArmy.enabled);
      } catch (error) {
        logger({
          msgLevel: 'debug',
          msg: `Smart planner could not evaluate dangerous fight ${fightId}: ${error && error.message ? error.message : error}`
        });
        return false;
      }
    };
    const getBlockedDangerousFights = options => {
      const goal = getGoal(options);
      if (!options.armyEnabled) return [];
      const nextDangerousFight = getNextDangerousFight(goal);
      if (!nextDangerousFight) return [];
      const gameData = reactUtil.getGameData();
      const armyStore = gameData && gameData.ArmyStore ? gameData.ArmyStore : {};
      const cacheKey = `${options.goal}|${nextDangerousFight.techId}|${armyStore.ownedCount || 0}|${armyStore.cap || 0}|${state.options.autoSortArmy.enabled ? 1 : 0}`;
      if (dangerousFightCache.key === cacheKey && Date.now() - dangerousFightCache.at < 2500) return dangerousFightCache.value;
      dangerousFightCache = {
        key: cacheKey,
        at: Date.now(),
        value: canWinDangerousFight(nextDangerousFight.fightId) ? [] : [nextDangerousFight]
      };
      return dangerousFightCache.value;
    };
    const shouldGateDangerousResearch = researchKey => {
      const options = getOptions();
      if (!options.enabled || !options.armyEnabled || !smartBuildDangerousFights[researchKey]) return false;
      const goal = getGoal(options);
      const nextDangerousFight = getNextDangerousFight(goal);
      return !!nextDangerousFight && nextDangerousFight.techId === researchKey;
    };
    const getResourceCost = (req, count = 0) => {
      const value = Number(req.value) || 0;
      if (!value) return 0;
      return value * (req.multi ? Math.pow(req.multi, count) : 1);
    };
    const registerResourceCapShortfall = (shortfalls, req, resourceMap, source) => {
      const res = resourceMap[req.id];
      const required = getResourceCost(req, source && Number.isFinite(source.count) ? source.count : 0);
      const currentMax = res && Number(res.max) > 0 ? Number(res.max) : 0;
      if (!required || currentMax >= required) return;
      if (!shortfalls[req.id] || shortfalls[req.id].required < required) {
        shortfalls[req.id] = {
          id: req.id,
          required,
          currentMax,
          deficit: required - currentMax,
          source: source ? source.id : req.id,
          sourceType: source ? source.type : 'resource'
        };
      }
    };
    const getResearchResourceCapShortfalls = (goal, resourceMap) => {
      const shortfalls = {};
      getGoalTechs(goal).forEach(target => {
        (target.req || []).filter(req => req.type === 'resource').forEach(req => {
          registerResourceCapShortfall(shortfalls, req, resourceMap, {
            id: target.id,
            type: 'tech',
            count: 0
          });
        });
      });
      return shortfalls;
    };
    const getRouteBuildingResourceCapShortfalls = (route, resourceMap) => {
      const shortfalls = {};
      getExpandedRouteTargets(route).forEach(routeEntry => {
        const building = buildings.find(candidate => candidate.id === routeEntry.id);
        if (!building) return;
        const count = getCount(building);
        if (count >= routeEntry.target) return;
        (building.req || []).filter(req => req.type === 'resource').forEach(req => {
          registerResourceCapShortfall(shortfalls, req, resourceMap, {
            id: building.id,
            type: 'building',
            count
          });
        });
      });
      return shortfalls;
    };
    const getResourceCapShortfalls = (goal, route, resourceMap) => {
      const shortfalls = {};
      [
        getResearchResourceCapShortfalls(goal, resourceMap),
        getRouteBuildingResourceCapShortfalls(route, resourceMap)
      ].forEach(group => {
        Object.values(group).forEach(shortfall => {
          if (!shortfalls[shortfall.id] || shortfalls[shortfall.id].required < shortfall.required) {
            shortfalls[shortfall.id] = shortfall;
          }
        });
      });
      return shortfalls;
    };
    const getGoalResourceBonus = (id, goal, resourceMap) => {
      if (!goal.resourceFocus || !goal.resourceFocus.includes(id)) return 0;
      const res = resourceMap[id];
      if (!res) return 14;
      const fillRatio = res.max > 0 ? res.current / res.max : 0;
      let bonus = 14;
      if (fillRatio < 0.5) bonus += 8;
      if (res.speed <= 0) bonus += 10;
      return bonus;
    };
    const getGoalRequirementBonus = (building, goal) => {
      let bonus = goal.buildingFocus && goal.buildingFocus.includes(building.id) ? 34 : 0;
      getGoalTechs(goal).forEach(target => {
        if (!target.req) return;
        target.req.filter(req => req.type === 'building' && req.id === building.id).forEach(req => {
          const count = getCount(building);
          if (count < req.value) {
            bonus += 70 + (req.value - count) * 12;
          }
        });
        target.req.filter(req => req.type === 'resource').forEach(req => {
          if (building.gen && building.gen.find(gen => (gen.type === 'resource' || gen.type === 'cap') && gen.id === req.id && gen.value > 0)) {
            bonus += 10;
          }
        });
      });
      return bonus;
    };
    const getCapShortfallBonus = (building, goal, route, resourceMap) => {
      const shortfalls = getResourceCapShortfalls(goal, route, resourceMap);
      const entries = Object.values(shortfalls);
      if (!entries.length || !building.gen) return 0;
      return entries.reduce((bonus, shortfall) => {
        const capGen = building.gen.find(gen => gen.type === 'cap' && gen.id === shortfall.id && gen.value > 0);
        if (!capGen) return bonus;
        const severity = shortfall.required > 0 ? Math.min(1, shortfall.deficit / shortfall.required) : 0;
        return bonus + 95 + severity * 95 + Math.min(40, Number(capGen.value) || 0);
      }, 0);
    };
    const getBattleTemplate = blockedFights => {
      if (!blockedFights || !blockedFights.length) return null;
      return smartBuildBattleTemplates[blockedFights[0].fightId] || null;
    };
    const getTemplateBuildingEntry = (building, template) => template && template.preferredBuildings ? template.preferredBuildings.find(entry => entry.id === building.id) : null;
    const getDangerousBattleBuildingBonus = (building, options) => {
      const blockedFights = getBlockedDangerousFights(options);
      if (!blockedFights.length || !building.gen) return 0;
      const templateEntry = getTemplateBuildingEntry(building, getBattleTemplate(blockedFights));
      const templateBonus = templateEntry ? 120 + (templateEntry.priority || 8) * 8 : 0;
      return templateBonus + building.gen.reduce((bonus, gen) => {
        if (gen.type === 'cap' && gen.id === 'army' && gen.value > 0) return bonus + 95 + Math.min(45, gen.value * 2);
        if (gen.type === 'modifier' && gen.type_id === 'army' && gen.type_gen === 'stat' && (gen.gen === 'defense' || gen.gen === 'attack')) {
          return bonus + 50 + Math.min(35, Math.abs(gen.value || 0) * 4);
        }
        return bonus;
      }, 0);
    };
    const getRouteRequirementBonus = (building, route) => {
      const routeEntry = getRouteEntry(building, route);
      if (!routeEntry) return 0;
      const count = getCount(building);
      if (count >= routeEntry.target) return routeEntry.priority >= 8 ? 8 : 3;
      return 80 + (routeEntry.target - count) * 14 + (routeEntry.priority || 6) * 5;
    };
    const getCostWait = (building, count, resourceMap) => {
      if (!building.req) return 0;
      return building.req.filter(req => req.type === 'resource').reduce((wait, req) => {
        const res = resourceMap[req.id];
        if (!res) return wait + 999;
        const multi = req.multi ? Math.pow(req.multi, count) : 1;
        const cost = req.value * multi;
        if (res.current >= cost) return wait;
        if (res.speed <= 0) return wait + 999;
        return Math.max(wait, (cost - res.current) / res.speed);
      }, 0);
    };
    const getBottleneckScore = (id, resourceMap) => {
      const res = resourceMap[id];
      if (!res) return 0;
      let score = 0;
      const fillRatio = res.max > 0 ? res.current / res.max : 0;
      if (res.speed < 0) score += 22;
      if (res.speed === 0 && fillRatio < 0.5) score += 12;
      if (fillRatio < 0.25) score += 10;
      if (fillRatio < 0.1) score += 8;
      if (res.speed > 0 && res.max > res.current) {
        const secondsToFill = (res.max - res.current) / res.speed;
        if (secondsToFill > 180) score += 10;
        if (secondsToFill > 600) score += 8;
      }
      return score;
    };
    const getCapPressure = (id, resourceMap) => {
      const res = resourceMap[id];
      if (!res || res.max <= 0 || res.speed <= 0) return 0;
      const fillRatio = res.current / res.max;
      const secondsToFill = (res.max - res.current) / res.speed;
      if (fillRatio > 0.9 || secondsToFill < 60) return 18;
      if (fillRatio > 0.75 || secondsToFill < 180) return 10;
      return 0;
    };
    const scoreBuilding = (building, resourceMap, options) => {
      const strategyWeights = smartBuildStrategyWeights[options.strategy] || smartBuildStrategyWeights.balanced;
      const goal = getGoal(options);
      const route = getRoute(options);
      const count = getCount(building);
      let score = 0;
      let risk = 0;
      const gen = building.gen || [];
      gen.forEach(item => {
        if (item.type === 'resource' && item.value > 0) {
          score += (6 + getBottleneckScore(item.id, resourceMap) + getGoalResourceBonus(item.id, goal, resourceMap)) * Math.min(4, item.value);
        }
        if (item.type === 'resource' && item.value < 0) {
          const res = resourceMap[item.id];
          const riskMultiplier = options.risk === 'aggressive' ? 0.55 : options.risk === 'conservative' ? 1.65 : 1;
          if (!res || res.speed + item.value <= 0) risk += Math.abs(item.value) * 16 * riskMultiplier;
          if (res && res.max > 0 && res.current / res.max < 0.35) risk += Math.abs(item.value) * 8 * riskMultiplier;
        }
        if (item.type === 'cap') {
          score += 5 + getCapPressure(item.id, resourceMap) + getGoalResourceBonus(item.id, goal, resourceMap) * 0.45;
        }
        if (item.type === 'population') {
          score += item.id === 'unemployed' ? 11 : 7;
        }
      });
      const costWait = getCostWait(building, count, resourceMap);
      if (costWait > options.maxWaitSeconds) score -= 18;
      else if (costWait > 60) score -= 8;
      if (building.cat === 'wonders') score -= options.risk === 'aggressive' ? 12 : 28;
      score *= strategyWeights[building.cat] || 1;
      score *= goal.weights && goal.weights[building.cat] ? goal.weights[building.cat] : 1;
      score += getGoalRequirementBonus(building, goal);
      score += getRouteRequirementBonus(building, route);
      score += getCapShortfallBonus(building, goal, route, resourceMap);
      score += getDangerousBattleBuildingBonus(building, options);
      score -= Math.max(0, count - 6) * 0.55;
      return score - risk;
    };
    const toPriority = score => {
      if (score >= 50) return 7;
      if (score >= 34) return 6;
      if (score >= 22) return 5;
      if (score >= 13) return 4;
      if (score >= 7) return 3;
      return 0;
    };
    const toExtra = score => {
      if (score >= 45) return 3;
      if (score >= 24) return 2;
      return 1;
    };
    const applyManualOverrides = (targets, manualOptions, options) => {
      if (!options.manualOverrides || !manualOptions) return targets;
      Object.keys(manualOptions).filter(key => !key.includes('prio_')).forEach(key => {
        if (manualOptions[key]) {
          targets[key] = manualOptions[key];
          targets[`prio_${key}`] = manualOptions[`prio_${key}`] || 4;
        }
      });
      return targets;
    };
    const applyRouteTargets = (targets, subpage, options) => {
      const route = getRoute(options);
      if (!route) return targets;
      const allowedTab = CONSTANTS.SUBPAGES_INDEX[subpage] + 1;
      getExpandedRouteTargets(route).forEach(routeEntry => {
        const building = buildings.find(candidate => candidate.id === routeEntry.id);
        if (!building || building.tab !== allowedTab) return;
        const count = getCount(building);
        if (count >= routeEntry.target) return;
        const cap = building.cap || Number(options.maxTarget) || smartBuildDefaults.maxTarget;
        const routeMax = Math.min(routeEntry.target, cap, Number(options.maxTarget) || smartBuildDefaults.maxTarget, count + Math.min(Number(options.maxExtra) || smartBuildDefaults.maxExtra, Math.max(1, routeEntry.target - count)));
        if (routeMax <= count) return;
        targets[building.id] = Math.max(targets[building.id] || 0, routeMax);
        targets[`prio_${building.id}`] = Math.max(targets[`prio_${building.id}`] || 0, routeEntry.priority || 8);
      });
      return targets;
    };
    const applyCapBridgeTargets = (targets, subpage, resourceMap, options) => {
      const goal = getGoal(options);
      const shortfalls = getResourceCapShortfalls(goal, getRoute(options), resourceMap);
      if (!Object.keys(shortfalls).length) return targets;
      const allowedTab = CONSTANTS.SUBPAGES_INDEX[subpage] + 1;
      buildings.filter(building => building.tab === allowedTab && building.gen).forEach(building => {
        const helpsCap = building.gen.find(gen => gen.type === 'cap' && gen.value > 0 && shortfalls[gen.id]);
        if (!helpsCap) return;
        const count = getCount(building);
        const cap = building.cap || Number(options.maxTarget) || smartBuildDefaults.maxTarget;
        if (count >= cap) return;
        const bridgeMax = Math.min(cap, Number(options.maxTarget) || smartBuildDefaults.maxTarget, count + Math.max(1, Number(options.maxExtra) || smartBuildDefaults.maxExtra));
        if (bridgeMax <= count) return;
        targets[building.id] = Math.max(targets[building.id] || 0, bridgeMax);
        targets[`prio_${building.id}`] = Math.max(targets[`prio_${building.id}`] || 0, 9);
      });
      return targets;
    };
    const applyDangerousBattleBuildingTargets = (targets, subpage, options) => {
      const blockedFights = getBlockedDangerousFights(options);
      if (!blockedFights.length) return targets;
      const template = getBattleTemplate(blockedFights);
      const allowedTab = CONSTANTS.SUBPAGES_INDEX[subpage] + 1;
      buildings.filter(building => building.tab === allowedTab && building.gen).forEach(building => {
        const helpsArmy = building.gen.find(gen => gen.type === 'cap' && gen.id === 'army' && gen.value > 0 || gen.type === 'modifier' && gen.type_id === 'army' && gen.type_gen === 'stat');
        const templateEntry = getTemplateBuildingEntry(building, template);
        if (!helpsArmy && !templateEntry) return;
        const count = getCount(building);
        const cap = building.cap || Number(options.maxTarget) || smartBuildDefaults.maxTarget;
        if (count >= cap) return;
        const battleMax = Math.min(cap, Number(options.maxTarget) || smartBuildDefaults.maxTarget, count + Math.max(1, Number(options.maxExtra) || smartBuildDefaults.maxExtra));
        if (battleMax <= count) return;
        targets[building.id] = Math.max(targets[building.id] || 0, battleMax);
        targets[`prio_${building.id}`] = Math.max(targets[`prio_${building.id}`] || 0, templateEntry ? templateEntry.priority || 9 : 9);
      });
      return targets;
    };
    const getTemplateUnitEntry = (unit, template) => template && template.preferredUnits ? template.preferredUnits.find(entry => entry.id === unit.id) : null;
    const getUnitScore = (unit, template = null) => {
      if (!unit || unit.type === 'enemy' || unit.type === 'settlement' || unit.type === 'spy') return 0;
      let score = (unit.defense || 0) * 2.4 + (unit.attack || 0) * 0.75;
      if (unit.splash) score += unit.splash * 2;
      if (unit.trample) score += unit.trample * 0.08;
      if (unit.category === 3) score += 18;
      if (unit.category === 1) score += 7;
      const templateEntry = getTemplateUnitEntry(unit, template);
      if (templateEntry) score = score * (templateEntry.weight || 1) + 80 + (templateEntry.priority || 8) * 10;
      (unit.gen || []).filter(gen => gen.type === 'resource' && gen.value < 0).forEach(gen => {
        score -= Math.abs(gen.value) * (gen.id === 'food' ? 6 : 3);
      });
      return score;
    };
    const applyUnitManualOverrides = (targets, manualOptions, options) => {
      if (!options.manualOverrides || !manualOptions) return targets;
      Object.keys(manualOptions).filter(key => !key.includes('prio_')).forEach(key => {
        if (manualOptions[key]) {
          targets[key] = manualOptions[key];
          targets[`prio_${key}`] = manualOptions[`prio_${key}`] || 4;
        }
      });
      return targets;
    };
    const getUnitTargets = (manualOptions = {}) => {
      const options = getOptions();
      if (!options.enabled || !options.armyEnabled) return null;
      const blockedFights = getBlockedDangerousFights(options);
      if (!blockedFights.length) return null;
      const unitExtra = Math.max(1, Number(options.armyMaxExtra) || smartBuildDefaults.armyMaxExtra);
      const unitMaxTarget = Math.max(1, Number(options.armyMaxTarget) || smartBuildDefaults.armyMaxTarget);
      const template = getBattleTemplate(blockedFights);
      const targets = {};
      units.filter(unit => unit.type !== 'enemy' && unit.type !== 'settlement' && unit.type !== 'spy').map(unit => ({
        unit,
        score: getUnitScore(unit, template)
      })).filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 24).forEach((item, index) => {
        const unit = item.unit;
        const templateEntry = getTemplateUnitEntry(unit, template);
        const count = getUnitCount(unit);
        const cap = unit.cap || unitMaxTarget;
        const target = Math.min(cap, unitMaxTarget, count + unitExtra);
        if (target <= count) return;
        targets[unit.id] = target;
        targets[`prio_${unit.id}`] = templateEntry ? templateEntry.priority || 8 : Math.max(3, 10 - Math.floor(index / 4));
      });
      if (Object.keys(targets).length) {
        logger({
          msgLevel: 'debug',
          msg: `Smart army planner is preparing for next dangerous fight: ${blockedFights.map(item => `${item.techId}->${item.fightId}`).join(', ')}${template ? ` (${template.label})` : ''}`
        });
      }
      return applyUnitManualOverrides(targets, manualOptions, options);
    };
    const getTargets = (subpage, manualOptions = {}) => {
      const options = getOptions();
      if (!options.enabled) return null;
      const resourceMap = getResourceMap();
      const targets = {};
      buildings.filter(building => building.tab === CONSTANTS.SUBPAGES_INDEX[subpage] + 1).forEach(building => {
        const score = scoreBuilding(building, resourceMap, options);
        const prio = toPriority(score);
        if (!prio) return;
        const count = getCount(building);
        const cap = building.cap || Number(options.maxTarget) || smartBuildDefaults.maxTarget;
        const max = Math.min(cap, Number(options.maxTarget) || smartBuildDefaults.maxTarget, count + Math.min(Number(options.maxExtra) || smartBuildDefaults.maxExtra, toExtra(score)));
        if (max <= count) return;
        targets[building.id] = max;
        targets[`prio_${building.id}`] = prio;
      });
      applyCapBridgeTargets(targets, subpage, resourceMap, options);
      applyDangerousBattleBuildingTargets(targets, subpage, options);
      applyRouteTargets(targets, subpage, options);
      return applyManualOverrides(targets, manualOptions, options);
    };
    return {
      getTargets,
      getUnitTargets,
      shouldGateDangerousResearch
    };
  })();


