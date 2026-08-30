const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('automation-src/base/Theresmore-Automation_4.14.4.base.user.js', 'utf8');

assert(source.includes('const isPopulationSensitiveBuilding = building =>'), 'population-sensitive classifier missing');
assert(source.includes('const nextButton = buttons[0];'), 'batch lookahead missing');
assert(source.includes('!isPopulationSensitiveBuilding(nextButton.building)'), 'non-sensitive lookahead gate missing');
assert(source.includes('!shouldBuildButton(nextButton)'), 'safety-lock lookahead gate missing');
assert(source.includes('buttons = getAllButtons();'), 'post-build button refresh missing');
assert(!source.includes('buildsThisPass < maxBuildsThisPass'), 'population-sensitive batch must not stop at maxExtra');
assert(!source.includes('lastBuiltPopulationSensitive && buildsThisPass >= maxBuildsThisPass'), 'population-sensitive batch must not hand off at maxExtra');
assert(source.includes('await adjustPopulation();'), 'population adjustment handoff missing');

console.log('smart build batching tests passed');
