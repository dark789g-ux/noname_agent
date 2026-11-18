async function runSelectionBatches(players, runtime) {
  const queue = [...players];
  while (queue.length > 0) {
    const first = queue.shift();
    if (!runtime.eligible(first)) {
      runtime.local(first);
      continue;
    }
    const batch = [first];
    for (let i = 0; i < queue.length; ) {
      const next = queue[i];
      if (!runtime.eligible(next)) {
        i++;
        continue;
      }
      if (!runtime.canBatch(batch, next)) break;
      batch.push(next);
      queue.splice(i, 1);
    }
    const jobs = batch.map((player) => runtime.prepare(player));
    const results = await Promise.all(jobs.map((job) => runtime.decide(job)));
    jobs.forEach((job, i) => runtime.commit(job, results[i]));
    jobs.forEach((job) => runtime.release(job));
  }
}
export {
  runSelectionBatches
};
