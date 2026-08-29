const smartPopulationPlanner = (() => {
  const resourceRules = {
    food: { minimum: 1, priority: 100 },
    wood: { minimum: 1, priority: 90 },
    stone: { minimum: 1, priority: 90 },
    copper: { minimum: 1, priority: 90 },
    iron: { minimum: 1, priority: 90 },
    tools: { minimum: 1, priority: 90 },
    cow: { minimum: 0, priority: 70 },
    horse: { minimum: 0, priority: 70 },
    building_material: { minimum: 1, priority: 120 },
    crystal: { minimum: 1, priority: 120 },
    supplies: { minimum: 1, priority: 120 }
  };
  const routeJobs = {
    moonlightNight: ['carpenter', 'professor', 'supplier'],
    fastNgPlus: ['carpenter', 'professor', 'supplier'],
    titanThenFastNgPlus: []
  };
  let lastSnapshot = null;

  const getResourceRules = () => Object.fromEntries(Object.entries(resourceRules).map(([id, rule]) => [id, { ...rule }]));
  const getRouteJobs = goal => [...(routeJobs[goal] || [])];
  const getSpeed = (resourceSpeeds, id) => {
    const value = resourceSpeeds && resourceSpeeds[id];
    return Number.isFinite(Number(value)) ? Number(value) : 0;
  };
  const isResourceSafe = resourceSpeeds => Object.entries(resourceRules).every(([id, rule]) => getSpeed(resourceSpeeds, id) > rule.minimum);
  const getResourceDeficit = resourceSpeeds => Object.entries(resourceRules)
    .map(([id, rule]) => ({ id, ...rule, deficit: rule.minimum - getSpeed(resourceSpeeds, id) }))
    .filter(item => item.deficit >= 0)
    .sort((a, b) => b.priority - a.priority || b.deficit - a.deficit);
  const getJobProduction = (job, resourceId) => (job.resourcesGenerated || [])
    .filter(resource => resource.id === resourceId)
    .reduce((total, resource) => total + (Number(resource.value) || 0), 0);
  const canApplyJob = (job, resourceSpeeds) => Object.entries(resourceRules).every(([id, rule]) => {
    const generated = getJobProduction(job, id);
    const used = (job.resourcesUsed || []).filter(resource => resource.id === id)
      .reduce((total, resource) => total + (Number(resource.value) || 0), 0);
    const nextSpeed = getSpeed(resourceSpeeds, id) + generated + used;
    return nextSpeed > rule.minimum || generated + used >= 0;
  });
  const createPriorityMap = (goal, jobs, resourceSpeeds) => {
    const priorities = {};
    jobs.forEach((job, index) => { priorities[job.key || job.id] = index; });
    const route = getRouteJobs(goal);
    route.forEach((jobId, index) => { priorities[jobId] = 1000 - index; });
    getResourceDeficit(resourceSpeeds).forEach((deficit, index) => {
      jobs.filter(job => getJobProduction(job, deficit.id) > 0).forEach(job => {
        const key = job.key || job.id;
        priorities[key] = Math.max(priorities[key] || 0, 2000 - index);
      });
    });
    return priorities;
  };
  const planJobs = ({ goal, jobs = [], resourceSpeeds = {} }) => {
    const priorityMap = createPriorityMap(goal, jobs, resourceSpeeds);
    const candidates = jobs.filter(job => Number(job.current) < Math.min(Number(job.max) || 0, Number(job.maxAvailable) || 0));
    const deficits = getResourceDeficit(resourceSpeeds);
    const sorted = candidates.filter(job => canApplyJob(job, resourceSpeeds)).sort((a, b) => {
      const aKey = a.key || a.id;
      const bKey = b.key || b.id;
      return (priorityMap[bKey] || 0) - (priorityMap[aKey] || 0) || Number(a.current) - Number(b.current);
    });
    return { jobs: sorted, deficits, resourcesSafe: isResourceSafe(resourceSpeeds), priorityMap };
  };
  const normalizeJobSignature = jobs => (jobs || []).map(job => `${job.key || job.id}:${job.maxAvailable}`).sort().join(',');
  const getSnapshot = ({ goal, jobs = [], unassigned = 0, resourceSpeeds = {} }) => ({
    goal,
    jobs: normalizeJobSignature(jobs),
    unassigned: Number(unassigned) || 0,
    resourceSpeeds: Object.keys(resourceRules).map(id => `${id}:${getSpeed(resourceSpeeds, id)}`).join(',')
  });
  const shouldRebalance = (snapshot, previous = lastSnapshot) => {
    const changed = hasStructuralChange(snapshot, previous);
    const hasUnassigned = snapshot.unassigned > 0;
    lastSnapshot = snapshot;
    return changed || hasUnassigned;
  };
  const hasStructuralChange = (snapshot, previous = lastSnapshot) =>
    !previous || snapshot.goal !== previous.goal || snapshot.jobs !== previous.jobs;
  const resetSnapshot = () => { lastSnapshot = null; };
  return { getResourceRules, getRouteJobs, getSnapshot, shouldRebalance, hasStructuralChange, planJobs, resetSnapshot };
})();
