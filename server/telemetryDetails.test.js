const test=require('node:test');const assert=require('node:assert/strict');
const {acquisitionFromLocation,sanitizeRequestDetails}=require('../src/telemetryDetails');
const {ownerDigest,ownerCookie,readOwnerCookie}=require('./telemetryIdentity');
test('attribution distinguishes paid, organic, referral and unknown without storing click IDs or raw URLs',()=>{
 assert.equal(acquisitionFromLocation('https://reelbot.movie/?utm_source=instagram&utm_medium=paid_social&utm_campaign=test').channel,'paid');
 assert.equal(acquisitionFromLocation('https://reelbot.movie/','https://www.google.com/search?q=private').channel,'organic');
 assert.equal(acquisitionFromLocation('https://reelbot.movie/','https://example.com/private?email=private').source,'example.com');
 assert.equal(acquisitionFromLocation('https://reelbot.movie/','https://reelbot.movie/browse').channel,'direct');
 assert.equal(acquisitionFromLocation('https://reelbot.movie/?fbclid=opaque').channel,'direct');
 const data=acquisitionFromLocation('https://reelbot.movie/?gclid=secret');assert.equal(data.channel,'paid');assert.ok(!JSON.stringify(data).includes('secret'));
});
test('private request details are bounded and redact obvious personal information and credentials',()=>{
 const details=sanitizeRequestDetails({prompt:'Email me at jonny@example.com or +1 (555) 123-4567 https://example.com?secret=foo Bearer token123',result_text:'x'.repeat(2000)});
 assert.ok(!details.prompt.includes('jonny@'));assert.ok(!details.prompt.includes('123-4567'));assert.ok(!details.prompt.includes('secret'));assert.ok(!details.prompt.includes('token123'));assert.equal(details.result_text.length,1200);
});
test('test-browser identity is signed, expires, and cannot be forged into an account identity',()=>{
 const previous=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY='test-only-secret';
 try{
  const now=1000;const cookie=ownerCookie('owner',now);
  assert.equal(readOwnerCookie(cookie,now),ownerDigest('owner'));
  assert.equal(readOwnerCookie(cookie.replace(ownerDigest('owner'),'a'.repeat(64)),now),'');
  assert.equal(readOwnerCookie(cookie,now+31*86400000),'');
  assert.ok(!cookie.includes('metrics-owner:owner'));assert.match(cookie,/HttpOnly; Secure; SameSite=Lax/);
 }finally{if(previous===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=previous;}
});
