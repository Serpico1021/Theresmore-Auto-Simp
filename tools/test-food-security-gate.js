const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const fragment = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const plannerSource = [
  'automation-src/fragments/smart-build-planner/00-data-tables.js',
  'automation-src/fragments/smart-build-planner/10-game-state-adapter.js',
  'automation-src/fragments/smart-build-planner/20-goal-routes.js',
  'automation-src/fragments/smart-build-planner/30-path-engine.js',
  'automation-src/fragments/smart-build-planner/40-path-output.js',
  'automation-src/fragments/smart-build-planner/90-export.js'
].map(fragment);

const makePlanner = ({ goal, houseCount, farmCount, farmerCount, includePopulation = true, forcedTargets = {} }) => {
  const buildings = [
    { id: 'common_house', tab: 1, req: [] },
    { id: 'farm', tab: 1, req: [] }
  ];
  const population = includePopulation ? [{ id: 'farmer', value: farmerCount }] : [];
  const gameData = {
    idxs: {
      buildings: { common_house: 0, farm: 1 },
      population: includePopulation ? { farmer: 0 } : {}
    },
    run: {
      buildings: [{ value: houseCount }, { value: farmCount }],
      population
    }
  };
  const resourceStore = { get: () => ({ current: 100, max: 100, speed: 1 }) };
  const context = {
    buildings,
    tech: [],
    resources: resourceStore,
    reactUtil: { getGameData: () => gameData },
    state: { options: { smartBuild: { enabled: true, goal, forcedTargets } } },
    CONSTANTS: { SUBPAGES_INDEX: { city: 0 } },
    smartBuildPlanner: null
  };
  const source = [
    ...plannerSource.slice(0, -1),
    `smartBuildGoals[${JSON.stringify(goal)}] = smartBuildGoals[${JSON.stringify(goal)}] || {};`,
    `smartBuildRoutes[${JSON.stringify(goal)}] = smartBuildRoutes[${JSON.stringify(goal)}] || {};`,
    `smartBuildRoutes[${JSON.stringify(goal)}].buildingTargets = [{ id: 'common_house', target: 2, priority: 9 }];`,
    `smartBuildRoutes[${JSON.stringify(goal)}].supportTargets = [{ id: 'farm', target: 1, priority: 5 }];`,
    plannerSource.at(-1)
  ];
  return vm.runInNewContext(`(() => { ${source.join('\n')} })()`, context);
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const nodeFor = (planner, id) => planner.getPathSnapshot().nodes.find(node => node.kind === 'building' && node.id === id);

for (const goal of ['moonlightNight', 'fastNgPlus']) {
  assert(nodeFor(makePlanner({ goal, houseCount: 0, farmCount: 0, farmerCount: 0 }), 'common_house').status !== 'blocked', `${goal}: first house should be allowed`);
  assert(nodeFor(makePlanner({ goal, houseCount: 1, farmCount: 0, farmerCount: 0 }), 'common_house').blockReason.requirement === 'farm', `${goal}: missing farm should block`);
  assert(nodeFor(makePlanner({ goal, houseCount: 1, farmCount: 1, farmerCount: 0 }), 'common_house').status !== 'blocked', `${goal}: farm should be sufficient to unblock`);
  assert(nodeFor(makePlanner({ goal, houseCount: 1, farmCount: 1, farmerCount: 1 }), 'common_house').status !== 'blocked', `${goal}: assigned farmer should remain unblocked`);
}

const progressNode = nodeFor(makePlanner({ goal: 'progress', houseCount: 1, farmCount: 0, farmerCount: 0 }), 'common_house');
assert(progressNode && progressNode.status !== 'blocked', 'progress: food security gate must be disabled');
const missingPopulationNode = nodeFor(makePlanner({ goal: 'moonlightNight', houseCount: 1, farmCount: 1, farmerCount: 0, includePopulation: false }), 'common_house');
assert(missingPopulationNode.status !== 'blocked', 'population state must not affect the farm-only gate');
const forcedPlanner = makePlanner({ goal: 'moonlightNight', houseCount: 1, farmCount: 0, farmerCount: 0, forcedTargets: { common_house: 80 } });
assert(forcedPlanner.getTargets('city').common_house === 0, 'forced target must not bypass food security gate');

console.log('food security gate tests passed');
