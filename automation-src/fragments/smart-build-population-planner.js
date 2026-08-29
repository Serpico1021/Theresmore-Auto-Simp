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
  const routeMinimums = {
    moonlightNight: { professor: 1, supplier: 1, carpenter: 1 },
    fastNgPlus: { professor: 1, supplier: 1, carpenter: 1 }
  };
  const balanceJobs = ['lumberjack', 'quarryman', 'miner', 'artisan'];
  const safetyResourceIds = ['food', 'wood', 'stone', 'copper', 'iron', 'tools', 'cow', 'horse'];
  let lastSnapshot = null;

  const getResourceRules = () => Object.fromEntries(Object.entries(resourceRules).map(([id, rule]) => [id, { ...rule }]));
  const getRouteJobs = goal => [...(routeJobs[goal] || [])];
  const getRouteMinimums = goal => ({ ...(routeMinimums[goal] || {}) });
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
  const getJobDelta = getJobProduction;
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
  const isAvailable = job => Number(job.current) < Math.min(Number(job.max) || 0, Number(job.maxAvailable) || 0);
  const getRouteJob = (goal, jobs) => {
    const minimums = getRouteMinimums(goal);
    return getRouteJobs(goal).map(id => jobs.find(job => (job.key || job.id) === id))
      .find(job => job && isAvailable(job) && Number(job.current) < (minimums[job.key || job.id] || 1));
  };
  const getSafetyJob = (jobs, resourceSpeeds) => {
    const deficits = getResourceDeficit(resourceSpeeds).filter(item => safetyResourceIds.includes(item.id));
    for (const deficit of deficits) {
      const candidate = jobs.filter(job => isAvailable(job) && getJobDelta(job, deficit.id) > 0 && canApplyJob(job, resourceSpeeds))
        .sort((a, b) => balanceJobs.indexOf(a.key || a.id) - balanceJobs.indexOf(b.key || b.id))[0];
      if (candidate) return candidate;
    }
    return null;
  };
  const allSafetyResourcesSafe = resourceSpeeds => safetyResourceIds.every(id => {
    const rule = resourceRules[id];
    if (!rule) return true;
    return getSpeed(resourceSpeeds, id) > rule.minimum;
  });
  const planJobs = ({ goal, jobs = [], resourceSpeeds = {}, balanceCursor = 0 }) => {
    const priorityMap = createPriorityMap(goal, jobs, resourceSpeeds);
    const candidates = jobs.filter(isAvailable);
    const deficits = getResourceDeficit(resourceSpeeds);
    const routeJob = getRouteJob(goal, candidates);
    if (routeJob) return { jobs: [routeJob], deficits, resourcesSafe: false, phase: 'route', nextBalanceCursor: 0, priorityMap };
    const safetyJob = getSafetyJob(candidates, resourceSpeeds);
    if (safetyJob) return { jobs: [safetyJob], deficits, resourcesSafe: false, phase: 'safety', nextBalanceCursor: 0, priorityMap };
    const start = Number.isInteger(balanceCursor) && balanceCursor >= 0 ? balanceCursor % balanceJobs.length : 0;
    const balancedJob = balanceJobs.map((_, offset) => balanceJobs[(start + offset) % balanceJobs.length])
      .map(id => candidates.find(job => (job.key || job.id) === id && canApplyJob(job, resourceSpeeds)))
      .find(Boolean);
    if (balancedJob) return { jobs: [balancedJob], deficits, resourcesSafe: allSafetyResourcesSafe(resourceSpeeds), phase: 'balance', nextBalanceCursor: (balanceJobs.indexOf(balancedJob.key || balancedJob.id) + 1) % balanceJobs.length, priorityMap };
    const sorted = candidates.filter(job => canApplyJob(job, resourceSpeeds)).sort((a, b) => {
      const aKey = a.key || a.id;
      const bKey = b.key || b.id;
      return (priorityMap[bKey] || 0) - (priorityMap[aKey] || 0) || Number(a.current) - Number(b.current);
    });
    return { jobs: sorted, deficits, resourcesSafe: allSafetyResourcesSafe(resourceSpeeds), phase: 'balance', nextBalanceCursor: 0, priorityMap };
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
  return { getResourceRules, getRouteJobs, getRouteMinimums, getSnapshot, shouldRebalance, hasStructuralChange, planJobs, resetSnapshot, balanceJobs };
})();
