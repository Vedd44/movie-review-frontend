// Shared by browser capture and the ingestion endpoint. Never retain raw URLs.
const redactText = (value, max = 1200) => String(value || '').slice(0, max)
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email removed]')
  .replace(/(?:\+?\d[\d ().-]{7,}\d)/g, '[phone removed]')
  .replace(/\b(?:Bearer\s+\S+|sk-[A-Za-z0-9_-]{12,})/gi, '[credential removed]')
  .replace(/https?:\/\/[^\s]+/gi, '[link removed]');
const cleanLabel = value => redactText(value, 100).replace(/[\r\n\t]/g, ' ').trim();
function acquisitionFromLocation(href, referrer = '') {
  try {
    const url = new URL(href); const params = url.searchParams;
    const source = cleanLabel(params.get('utm_source'));
    const medium = cleanLabel(params.get('utm_medium')).toLowerCase();
    const campaign = cleanLabel(params.get('utm_campaign'));
    let ref = ''; try { const host = new URL(referrer).hostname; if(host !== url.hostname) ref = host; } catch {}
    const paid = /^(?:cpc|ppc|paid|paid[_ -]?(?:social|search)|display|cpm|ads?)$/.test(medium) || ['gclid','msclkid'].some(key => params.has(key));
    const search = /(^|\.)(?:google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.yahoo\.com)$/.test(ref);
    return {channel:paid?'paid':medium==='organic'||search?'organic':source||ref?'referral':'direct',source:source||ref||(paid?'Paid campaign':'Direct / unknown'),medium,campaign,landing_path:url.pathname.slice(0,180)};
  } catch { return {channel:'direct',source:'Direct / unknown',medium:'',campaign:'',landing_path:'/'}; }
}
function sanitizeAcquisition(value = {}) {
  return {channel:['paid','organic','referral','direct'].includes(value.channel)?value.channel:'direct',source:cleanLabel(value.source)||'Direct / unknown',medium:cleanLabel(value.medium),campaign:cleanLabel(value.campaign),landing_path:String(value.landing_path||'/').split(/[?#]/)[0].slice(0,180)};
}
function sanitizeRequestDetails(p = {}) {
  const details = {};
  if (/^[0-9a-f-]{36}$/i.test(p.request_id || '')) details.request_id = p.request_id;
  details.prompt = redactText(p.prompt, 600).trim();
  details.result_text = redactText(p.result_text, 1200).trim();
  details.movie_title = redactText(p.movie_title, 180).trim();
  details.alternate_titles = redactText(p.alternate_titles, 360).trim();
  return details;
}
module.exports = {redactText, acquisitionFromLocation, sanitizeAcquisition, sanitizeRequestDetails};
