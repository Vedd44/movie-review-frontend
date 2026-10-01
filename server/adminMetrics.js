const timestamp = value => {
  const text = String(value || '');
  return Date.parse(/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(text) && !/(?:Z|[+-]\d\d:\d\d)$/i.test(text) ? `${text}Z` : text);
};
function buildAdminMetrics(sessions, now = Date.now()) {
  if (!Array.isArray(sessions)) return null;
  const since = now - 7 * 86400000;
  const events = sessions.flatMap(row => (Array.isArray(row.payload?.interactions) ? row.payload.interactions : []).map(entry => ({ ...entry, owner: row.user_id, time: timestamp(entry.timestamp) })))
    .filter(entry => Number.isFinite(entry.time) && entry.time >= since && entry.time <= now).sort((a,b) => a.time - b.time);
  const requests = events.filter(entry => entry.type === 'request_result' && entry.metadata?.version === 1);
  const outcomes = Object.fromEntries(['pick','no_match','failed','fallback'].map(outcome => [outcome, requests.filter(entry => entry.metadata.outcome === outcome).length]));
  const durations = requests.map(entry => Number(entry.metadata.latency_ms)).filter(ms => Number.isFinite(ms) && ms > 0 && ms <= 180000).sort((a,b) => a-b);
  const percentile = fraction => durations.length ? durations[Math.min(durations.length-1, Math.ceil(durations.length*fraction)-1)] : null;
  // A cohort is a user/movie pair with an observed pick. Only later events
  // count, and repeated impressions cannot inflate the denominator.
  const cohort = new Map();
  events.forEach(entry => {
    if (!entry.movie?.id) return;
    const key = `${entry.owner}:${entry.movie.id}`;
    if (entry.type === 'pick_shown' && !cohort.has(key)) cohort.set(key,{saved:false,watched:false});
    const pair = cohort.get(key);
    if (!pair) return;
    if (entry.type === 'save') pair.saved = true;
    if (entry.type === 'seen' && pair.saved) pair.watched = true;
  });
  return {
    scope: 'Retained signed-in activity · last 7 days',
    coverage: 'Up to 80 retained events per profile, from the latest 250 profiles. Guest requests and expired history are excluded. Browser-reported outcomes are operational signals, not an audited global total.',
    requests: { total: requests.length, ...outcomes, median_ms: percentile(.5), p95_ms: percentile(.95), failure_rate: requests.length ? outcomes.failed / requests.length : null },
    funnel: { picked: cohort.size, saved: [...cohort.values()].filter(pair=>pair.saved).length, watched: [...cohort.values()].filter(pair=>pair.watched).length },
    recent_failures: requests.filter(entry => ['failed','fallback'].includes(entry.metadata.outcome)).slice(-5).reverse().map(entry => ({created_at:entry.timestamp,surface:entry.metadata.surface,outcome:entry.metadata.outcome,latency_ms:entry.metadata.latency_ms})),
  };
}
module.exports = { buildAdminMetrics };
