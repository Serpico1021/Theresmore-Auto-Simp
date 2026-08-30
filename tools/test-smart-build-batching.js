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
assert(source.includes('buttonWasUnavailable'), 'unavailable building gate missing');
assert(source.includes('const timeoutMs = 2000'), 'construction result timeout missing');
assert(source.includes('const pollIntervalMs = 100'), 'construction result polling interval missing');
assert(source.includes('waitForBuildingCountIncrease'), 'construction result polling helper missing');
assert(source.includes('currentCount > previousCount'), 'build success check missing');
assert(source.includes('const isResearchButtonAvailable = button =>'), 'research availability predicate missing');
assert(source.includes('hasAvailableResearch()'), 'research availability gate missing');
assert(source.includes("document.querySelectorAll('#maintabs-container button.btn')"), 'research preflight must inspect mounted research buttons');
assert(source.includes("completeFirstAgricultureResearch"), 'first-house agriculture flow missing');
assert(source.includes("isTechCompleted('agricolture')"), 'first-house agriculture completion check missing');
assert(source.includes("Researching agricolture before continuing after the first common house"), 'first-house agriculture log missing');
assert(source.includes('await adjustPopulation();'), 'population adjustment handoff missing');

console.log('smart build batching tests passed');
