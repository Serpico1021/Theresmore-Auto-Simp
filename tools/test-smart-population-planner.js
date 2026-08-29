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
assert.strictEqual(JSON.stringify(planner.getRouteJobs('fastNgPlus')), JSON.stringify(['carpenter', 'professor', 'supplier']));
assert.strictEqual(JSON.stringify(planner.getRouteJobs('titanThenFastNgPlus')), JSON.stringify([]));

const safeResources = {
  food: 2, wood: 2, stone: 2, copper: 2, iron: 2, tools: 2,
  cow: 1, horse: 1, building_material: 2, crystal: 2, supplies: 2
};
const jobs = [
  { key: 'supplier', current: 0, max: 99, maxAvailable: 3, resourcesGenerated: [{ id: 'supplies', value: 2 }], resourcesUsed: [] },
  { key: 'professor', current: 0, max: 99, maxAvailable: 3, resourcesGenerated: [{ id: 'research', value: 6 }], resourcesUsed: [{ id: 'gold', value: -3 }] },
  { key: 'carpenter', current: 0, max: 99, maxAvailable: 3, resourcesGenerated: [{ id: 'building_material', value: 2 }], resourcesUsed: [] }
];
assert.strictEqual(JSON.stringify(planner.planJobs({ goal: 'fastNgPlus', jobs, resourceSpeeds: safeResources }).jobs.map(job => job.key)), JSON.stringify(['carpenter', 'professor', 'supplier']));

const snapshot = planner.getSnapshot({ goal: 'fastNgPlus', jobs: [], unassigned: 0, resourceSpeeds: safeResources });
planner.resetSnapshot();
assert.strictEqual(planner.shouldRebalance(snapshot), true);
const expanded = planner.getSnapshot({ goal: 'fastNgPlus', jobs: [{ key: 'carpenter', maxAvailable: 1 }], unassigned: 0, resourceSpeeds: safeResources });
const expandedAgain = planner.getSnapshot({ goal: 'fastNgPlus', jobs: [{ key: 'carpenter', maxAvailable: 2 }], unassigned: 0, resourceSpeeds: safeResources });
planner.resetSnapshot();
planner.shouldRebalance(expanded);
assert.strictEqual(planner.hasStructuralChange(expandedAgain), true);

console.log('smart population planner tests passed');
