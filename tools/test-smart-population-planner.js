const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('automation-src/fragments/smart-build-population-planner.js', 'utf8');
const context = vm.createContext({});
vm.runInContext(`${source}\nthis.planner = smartPopulationPlanner;`, context);
const planner = context.planner;

const rules = planner.getResourceRules();
for (const id of ['food', 'wood', 'stone', 'copper', 'iron', 'tools']) assert.strictEqual(rules[id].minimum, 1);
for (const id of ['cow', 'horse']) assert.strictEqual(rules[id].minimum, 0);
for (const id of ['building_material', 'crystal', 'supplies']) assert(rules[id].priority > rules.wood.priority);
assert.strictEqual(JSON.stringify(planner.getRouteJobs('fastNgPlus')), JSON.stringify(['professor', 'carpenter', 'supplier']));
assert.strictEqual(JSON.stringify(planner.getRouteJobs('titanThenFastNgPlus')), JSON.stringify([]));

const safeResources = {
  food: 2, wood: 2, stone: 2, copper: 2, iron: 2, tools: 2, gold: 10,
  cow: 1, horse: 1, building_material: 2, crystal: 2, supplies: 2
};
const jobs = [
  { key: 'supplier', current: 0, max: 99, maxAvailable: 3, resourcesGenerated: [{ id: 'supplies', value: 2 }], resourcesUsed: [] },
  { key: 'professor', current: 0, max: 99, maxAvailable: 3, resourcesGenerated: [{ id: 'research', value: 6 }], resourcesUsed: [{ id: 'gold', value: -3 }] },
  { key: 'carpenter', current: 0, max: 99, maxAvailable: 3, resourcesGenerated: [{ id: 'building_material', value: 2 }], resourcesUsed: [] }
];
const stagedPlan = planner.planJobs({ goal: 'fastNgPlus', jobs, unassigned: 8, resourceSpeeds: safeResources });
assert.strictEqual(JSON.stringify(stagedPlan.jobs.map(job => [job.key, job.assignCount])), JSON.stringify([['professor', 3], ['carpenter', 1], ['supplier', 1]]));
const stagedFoodJobs = [
  { key: 'farmer', current: 0, max: 99, maxAvailable: 5, resourcesGenerated: [{ id: 'food', value: 1.6 }] },
  { key: 'professor', current: 0, max: 99, maxAvailable: 3, resourcesGenerated: [{ id: 'research', value: 6 }], resourcesUsed: [] },
  { key: 'carpenter', current: 0, max: 99, maxAvailable: 1, resourcesGenerated: [{ id: 'building_material', value: 2 }], resourcesUsed: [] },
  { key: 'supplier', current: 0, max: 99, maxAvailable: 1, resourcesGenerated: [{ id: 'supplies', value: 2 }], resourcesUsed: [{ id: 'food', value: -3 }] }
];
const stagedFoodPlan = planner.planJobs({ goal: 'fastNgPlus', jobs: stagedFoodJobs, unassigned: 8, resourceSpeeds: { ...safeResources, food: 0 } });
assert.strictEqual(JSON.stringify(stagedFoodPlan.jobs.map(job => [job.key, job.assignCount])), JSON.stringify([['farmer', 1], ['professor', 3], ['carpenter', 1], ['supplier', 1], ['farmer', 2]]));
const professorFilledJobs = jobs.map(job => job.key === 'professor' ? { ...job, current: 3 } : job);
// Supplier is a route requirement in its own right; it must remain assignable
// immediately after NG+ even when the craftsmen guild is absent.
assert.strictEqual(planner.planJobs({
  goal: 'fastNgPlus',
  jobs: [{ key: 'supplier', current: 0, max: 99, maxAvailable: 1, resourcesGenerated: [{ id: 'supplies', value: 0.4 }], resourcesUsed: [] }],
  unassigned: 1,
  resourceSpeeds: { ...safeResources, supplies: 0 }
}).jobs[0].key, 'supplier');
const routeAssignedJobs = professorFilledJobs.map(job => job.key === 'supplier' ? { ...job, current: 1 } : job);
assert.strictEqual(planner.planJobs({ goal: 'fastNgPlus', jobs: routeAssignedJobs, unassigned: 1, resourceSpeeds: safeResources }).jobs[0].key, 'carpenter');
const allRouteJobs = routeAssignedJobs.map(job => job.key === 'carpenter' ? { ...job, current: 1 } : job);
const cowSafetyJobs = [...allRouteJobs, { key: 'breeder', current: 0, max: 99, maxAvailable: 3, resourcesGenerated: [{ id: 'cow', value: 1 }], resourcesUsed: [] }];
assert.strictEqual(planner.planJobs({ goal: 'fastNgPlus', jobs: cowSafetyJobs, unassigned: 1, resourceSpeeds: { ...safeResources, cow: -0.5 } }).jobs[0].key, 'breeder');
assert.strictEqual(planner.planJobs({ goal: 'moonlightNight', jobs: [{ key: 'farmer', current: 0, max: 99, maxAvailable: 1, resourcesGenerated: [{ id: 'food', value: 1.6 }] }, ...jobs], unassigned: 1, resourceSpeeds: safeResources }).jobs[0].key, 'farmer');
assert.strictEqual(planner.planJobs({ goal: 'progress', jobs: [{ key: 'farmer', current: 0, max: 99, maxAvailable: 1, resourcesGenerated: [{ id: 'food', value: 1.6 }] }, ...jobs], unassigned: 1, resourceSpeeds: safeResources }).jobs[0].key, 'farmer');

const productionJobs = [
  { key: 'lumberjack', current: 0, max: 99, maxAvailable: 3, resourcesGenerated: [{ id: 'wood', value: 0.7 }] },
  { key: 'quarryman', current: 0, max: 99, maxAvailable: 3, resourcesGenerated: [{ id: 'stone', value: 0.6 }] },
  { key: 'miner', current: 0, max: 99, maxAvailable: 3, resourcesGenerated: [{ id: 'copper', value: 0.5 }, { id: 'iron', value: 0.3 }] },
  { key: 'artisan', current: 0, max: 99, maxAvailable: 3, resourcesGenerated: [{ id: 'tools', value: 0.3 }] },
  { key: 'farmer', current: 0, max: 99, maxAvailable: 3, resourcesGenerated: [{ id: 'food', value: 1.6 }] }
];
const balancedProductionJobs = productionJobs.map(job => job.key === 'farmer' ? { ...job, current: 1 } : job);
assert.strictEqual(planner.planJobs({ goal: 'moonlightNight', jobs: balancedProductionJobs, resourceSpeeds: safeResources }).jobs[0].key, 'lumberjack');
assert.strictEqual(planner.planJobs({ goal: 'moonlightNight', jobs: balancedProductionJobs, resourceSpeeds: safeResources, balanceCursor: 1 }).jobs[0].key, 'quarryman');
const oneReleasedJobs = balancedProductionJobs.map(job => ({ ...job, maxAvailable: 99, current: job.key === 'lumberjack' ? 16 : job.key === 'quarryman' ? 10 : 11 }));
assert.strictEqual(planner.planJobs({ goal: 'moonlightNight', jobs: oneReleasedJobs, unassigned: 1, resourceSpeeds: safeResources }).jobs[0].key, 'quarryman');

const carpenterSupport = [
  { key: 'lumberjack', current: 0, max: 99, maxAvailable: 3, resourcesGenerated: [{ id: 'wood', value: 0.7 }] },
  { key: 'quarryman', current: 0, max: 99, maxAvailable: 3, resourcesGenerated: [{ id: 'stone', value: 0.6 }] },
  { key: 'artisan', current: 0, max: 99, maxAvailable: 3, resourcesGenerated: [{ id: 'tools', value: 0.3 }] }
];
const unsafeResources = { ...safeResources, wood: 0, stone: 0, tools: 0 };
assert.strictEqual(planner.planJobs({ goal: 'moonlightNight', jobs: carpenterSupport, resourceSpeeds: unsafeResources }).jobs[0].key, 'lumberjack');
const woodShortageJobs = productionJobs;
const woodShortagePlan = planner.planJobs({
  goal: 'moonlightNight',
  jobs: woodShortageJobs,
  unassigned: 8,
  resourceSpeeds: { ...safeResources, wood: -2 }
});
assert.strictEqual(JSON.stringify(woodShortagePlan.jobs.map(job => [job.key, job.assignCount])), JSON.stringify([
  ['farmer', 1],
  ['lumberjack', 3],
  ['quarryman', 1],
  ['miner', 1],
  ['artisan', 1],
  ['quarryman', 1]
]));

const snapshot = planner.getSnapshot({ goal: 'fastNgPlus', jobs: [], unassigned: 0, resourceSpeeds: safeResources });
planner.resetSnapshot();
assert.strictEqual(planner.shouldRebalance(snapshot), true);
const expanded = planner.getSnapshot({ goal: 'fastNgPlus', jobs: [{ key: 'carpenter', maxAvailable: 1 }], unassigned: 0, resourceSpeeds: safeResources });
const expandedAgain = planner.getSnapshot({ goal: 'fastNgPlus', jobs: [{ key: 'carpenter', maxAvailable: 2 }], unassigned: 0, resourceSpeeds: safeResources });
planner.resetSnapshot();
planner.shouldRebalance(expanded);
assert.strictEqual(planner.hasStructuralChange(expandedAgain), true);

console.log('smart population planner tests passed');
