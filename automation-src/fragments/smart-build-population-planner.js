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
    moonlightNight: ['professor', 'carpenter', 'supplier'],
    fastNgPlus: ['professor', 'carpenter', 'supplier']
  };
  const routeMinimums = {
    moonlightNight: { professor: 3, supplier: 1, carpenter: 1 },
    fastNgPlus: { professor: 3, supplier: 1, carpenter: 1 }
  };
  const balanceJobs = ['lumberjack', 'quarryman', 'miner', 'artisan'];
  const safetyResourceIds = ['food', 'wood', 'stone', 'copper', 'iron', 'tools'];
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
    .filter(item => item.deficit > 0)
    .sort((a, b) => b.priority - a.priority || b.deficit - a.deficit);
  const getJobProduction = (job, resourceId) => (job.resourcesGenerated || [])
    .filter(resource => resource.id === resourceId)
    .reduce((total, resource) => total + (Number(resource.value) || 0), 0);
  const getJobDelta = (job, resourceId) => getJobProduction(job, resourceId) + (job.resourcesUsed || [])
    .filter(resource => resource.id === resourceId)
    .reduce((total, resource) => total + (Number(resource.value) || 0), 0);
  const canApplyJob = (job, resourceSpeeds) => Object.entries(resourceRules).every(([id, rule]) => {
    const generated = getJobProduction(job, id);
    const used = (job.resourcesUsed || []).filter(resource => resource.id === id)
      .reduce((total, resource) => total + (Number(resource.value) || 0), 0);
    const nextSpeed = getSpeed(resourceSpeeds, id) + generated + used;
    return nextSpeed > rule.minimum || generated + used >= 0;
  });
  const getCapacity = job => Math.max(0, Math.min(Number(job.max) || 0, Number(job.maxAvailable) || 0) - (Number(job.current) || 0));
  const addJobProjection = (resourceSpeeds, job, count) => {
    Object.keys(resourceRules).forEach(id => { resourceSpeeds[id] = getSpeed(resourceSpeeds, id) + getJobDelta(job, id) * count; });
  };
  const addAllocation = (allocations, job, count, allocatedCounts = null) => {
    if (!job || count <= 0) return;
    allocations.push({ ...job, assignCount: count });
    const key = job.key || job.id;
    if (allocatedCounts) allocatedCounts[key] = (allocatedCounts[key] || 0) + count;
  };
  const createPriorityMap = (goal, jobs, resourceSpeeds) => {
    const priorities = {};
    jobs.forEach((job, index) => { priorities[job.key || job.id] = index; });
    getRouteJobs(goal).forEach((jobId, index) => { priorities[jobId] = 1000 - index; });
    getResourceDeficit(resourceSpeeds).forEach((deficit, index) => {
      jobs.filter(job => getJobProduction(job, deficit.id) > 0).forEach(job => {
        const key = job.key || job.id;
        priorities[key] = Math.max(priorities[key] || 0, 2000 - index);
      });
    });
    return priorities;
  };
  const isAvailable = job => Number(job.current) < Math.min(Number(job.max) || 0, Number(job.maxAvailable) || 0);
  const getSafetyCandidate = (jobs, resourceSpeeds, capacityFn = getCapacity) => {
    const safetyIds = [...safetyResourceIds, ...['cow', 'horse'].filter(id => jobs.some(job => getJobDelta(job, id) < 0))];
    const deficit = getResourceDeficit(resourceSpeeds).find(item => safetyIds.includes(item.id));
    if (!deficit) return null;
    return jobs.filter(job => capacityFn(job) > 0 && getJobDelta(job, deficit.id) > 0 && canApplyJob(job, resourceSpeeds))
      .sort((a, b) => balanceJobs.indexOf(a.key || a.id) - balanceJobs.indexOf(b.key || b.id))[0] || null;
  };
  const getSafetyAllocationCount = (job, resourceSpeeds) => {
    const useful = getResourceDeficit(resourceSpeeds).map(deficit => ({ deficit, delta: getJobDelta(job, deficit.id) }))
      .filter(item => item.delta > 0);
    return useful.length ? Math.max(1, Math.min(...useful.map(item => Math.ceil(item.deficit.deficit / item.delta)))) : 1;
  };
  const allSafetyResourcesSafe = resourceSpeeds => safetyResourceIds.every(id => {
    const rule = resourceRules[id];
    return !rule || getSpeed(resourceSpeeds, id) > rule.minimum;
  });
  const planJobs = ({ goal, jobs = [], unassigned = 1, resourceSpeeds = {}, balanceCursor = 0 }) => {
    const priorityMap = createPriorityMap(goal, jobs, resourceSpeeds);
    const candidates = jobs.filter(isAvailable);
    const deficits = getResourceDeficit(resourceSpeeds);
    const projectedSpeeds = Object.fromEntries(Object.keys(resourceRules).map(id => [id, getSpeed(resourceSpeeds, id)]));
    const allocations = [];
    const allocatedCounts = {};
    let remaining = Math.max(0, Number(unassigned));
    const take = count => Math.max(0, Math.min(count, remaining));
    const findJob = id => candidates.find(job => (job.key || job.id) === id);
    const capacity = job => Math.max(0, getCapacity(job) - (allocatedCounts[job.key || job.id] || 0));

    const farmer = findJob('farmer');
    if (farmer && remaining > 0 && Number(farmer.current) < 1) {
      const count = take(Math.min(1, capacity(farmer)));
      addAllocation(allocations, farmer, count, allocatedCounts);
      addJobProjection(projectedSpeeds, farmer, count);
      remaining -= count;
    }
    const minimums = getRouteMinimums(goal);
    for (const id of getRouteJobs(goal)) {
      if (remaining <= 0) break;
      const job = findJob(id);
      if (!job) continue;
      const count = take(Math.min(capacity(job), Math.max(0, (minimums[id] || 1) - Number(job.current || 0))));
      addAllocation(allocations, job, count, allocatedCounts);
      addJobProjection(projectedSpeeds, job, count);
      remaining -= count;
    }
    while (remaining > 0) {
      const safetyJob = getSafetyCandidate(candidates, projectedSpeeds, capacity);
      if (!safetyJob) break;
      const count = take(Math.min(capacity(safetyJob), getSafetyAllocationCount(safetyJob, projectedSpeeds)));
      if (!count) break;
      addAllocation(allocations, safetyJob, count, allocatedCounts);
      addJobProjection(projectedSpeeds, safetyJob, count);
      remaining -= count;
    }
    let cursor = Number.isInteger(balanceCursor) && balanceCursor >= 0 ? balanceCursor % balanceJobs.length : 0;
    while (remaining > 0) {
      const balancedOrder = balanceJobs.map((_, offset) => balanceJobs[(cursor + offset) % balanceJobs.length]);
      const balancedCandidates = balancedOrder
        .map(id => candidates.find(job => (job.key || job.id) === id && capacity(job) > 0 && canApplyJob(job, projectedSpeeds)))
        .filter(Boolean);
      if (!balancedCandidates.length) break;
      const lowestCount = Math.min(...balancedCandidates.map(job => (Number(job.current) || 0) + (allocatedCounts[job.key || job.id] || 0)));
      const balancedJob = balancedCandidates.find(job => (Number(job.current) || 0) + (allocatedCounts[job.key || job.id] || 0) === lowestCount);
      if (!balancedJob) break;
      addAllocation(allocations, balancedJob, 1, allocatedCounts);
      addJobProjection(projectedSpeeds, balancedJob, 1);
      remaining -= 1;
      cursor = (balanceJobs.indexOf(balancedJob.key || balancedJob.id) + 1) % balanceJobs.length;
    }
    const routeIds = getRouteJobs(goal);
    const sorted = candidates.filter(job => capacity(job) > 0 && !routeIds.includes(job.key || job.id) && canApplyJob(job, projectedSpeeds)).sort((a, b) => {
      const aKey = a.key || a.id;
      const bKey = b.key || b.id;
      return (priorityMap[bKey] || 0) - (priorityMap[aKey] || 0) || Number(a.current) - Number(b.current);
    });
    sorted.forEach(job => {
      if (remaining <= 0) return;
      const count = take(Math.min(capacity(job), remaining));
      addAllocation(allocations, job, count, allocatedCounts);
      addJobProjection(projectedSpeeds, job, count);
      remaining -= count;
    });
    const hasRoute = allocations.some(item => routeIds.includes(item.key || item.id));
    const hasSafety = allocations.some(item => !routeIds.includes(item.key || item.id) && !['farmer', ...balanceJobs].includes(item.key || item.id));
    const last = allocations[allocations.length - 1];
    const lastIndex = last ? balanceJobs.indexOf(last.key || last.id) : -1;
    return {
      jobs: allocations,
      deficits,
      resourcesSafe: allSafetyResourcesSafe(projectedSpeeds),
      phase: hasRoute ? 'route' : hasSafety ? 'safety' : 'balance',
      nextBalanceCursor: lastIndex >= 0 ? (lastIndex + 1) % balanceJobs.length : 0,
      priorityMap
    };
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
  const hasStructuralChange = (snapshot, previous = lastSnapshot) => !previous || snapshot.goal !== previous.goal || snapshot.jobs !== previous.jobs;
  const resetSnapshot = () => { lastSnapshot = null; };
  return { getResourceRules, getRouteJobs, getRouteMinimums, getSnapshot, shouldRebalance, hasStructuralChange, planJobs, resetSnapshot, balanceJobs };
})();
