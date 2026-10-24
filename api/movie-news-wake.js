// Scheduled read wakes the existing Render service. Only its durable due/lease
// checks may start work; this endpoint cannot force or bypass a refresh/budget.
function createWakeHandler(fetcher = fetch) {
 return async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({error:'Method not allowed'}); }
  try {
   const response = await fetcher('https://movie-review-backend-zevb.onrender.com/movie-news', {signal:AbortSignal.timeout(55000),cache:'no-store'});
   // A cold, not-yet-populated snapshot can return503 while the due worker runs.
   if (![200,503].includes(response.status)) throw new Error('Wake unavailable');
   return res.status(200).json({ok:true, snapshotReady:response.status === 200});
  } catch { return res.status(503).json({error:'News service wake unavailable'}); }
 };
}
module.exports=createWakeHandler();
module.exports.createWakeHandler=createWakeHandler;
