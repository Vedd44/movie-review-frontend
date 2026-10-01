const test = require('node:test');
const assert = require('node:assert/strict');
const {buildAdminMetrics} = require('./adminMetrics');
const now = Date.parse('2026-10-01T20:00:00Z');
const event = (type,id,minute,metadata={}) => ({type,movie:{id},timestamp:`2026-10-01T19:${String(minute).padStart(2,'0')}:00`,metadata});
test('operational sample separates no-match from failure and keeps owner/time attribution', () => {
  const result = buildAdminMetrics([
    {user_id:'a',payload:{interactions:[event('save',1,1),event('pick_shown',1,2),event('pick_shown',1,3),event('seen',1,4),event('save',1,5),event('seen',1,6),event('request_result',null,7,{version:1,outcome:'pick',latency_ms:6000}),event('request_result',null,8,{version:1,outcome:'no_match',latency_ms:10})]}},
    {user_id:'b',payload:{interactions:[event('seen',1,7),event('save',1,8),event('request_result',null,9,{version:1,outcome:'failed',latency_ms:9000})]}}
  ],now);
  assert.deepEqual(result.funnel,{picked:1,saved:1,watched:1});
  assert.equal(result.requests.total,3);
  assert.equal(result.requests.failure_rate,1/3);
  assert.equal(result.requests.median_ms,6000);
  assert.equal(result.requests.p95_ms,9000);
  assert.equal(result.recent_failures.length,1);
});
test('missing data stays unavailable and an empty sample has no made-up latency', () => {
  assert.equal(buildAdminMetrics(null,now),null);
  const empty = buildAdminMetrics([],now);
  assert.equal(empty.requests.median_ms,null);
  assert.equal(empty.requests.failure_rate,null);
});
