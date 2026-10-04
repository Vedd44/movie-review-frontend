const KEY = 'reelbot:cookie-consent:v1';
export const CONSENT_EVENT = 'reelbot:consent-changed';
export const COOKIE_SETTINGS_EVENT = 'reelbot:cookie-settings';
const MAX_AGE = 180 * 24 * 60 * 60 * 1000;
let memoryChoice = null;

export function getCookieChoice() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return memoryChoice;
    const choice = JSON.parse(raw);
    if (choice?.version === 1 && ['accepted', 'rejected'].includes(choice.value) && Number.isFinite(choice.at) && Date.now() >= choice.at && Date.now() - choice.at < MAX_AGE) return choice.value;
    return null;
  } catch { return memoryChoice; }
}
export const hasAnalyticsConsent = () => getCookieChoice() === 'accepted';
export function setCookieChoice(value) {
  if (!['accepted', 'rejected'].includes(value)) return;
  memoryChoice = null;
  try { window.localStorage.setItem(KEY, JSON.stringify({version: 1, value, at: Date.now()})); } catch { memoryChoice = value; /* Retain the choice for this page if storage is unavailable. */ }
  window['ga-disable-G-M66HQLHV22'] = value !== 'accepted';
  if (value === 'rejected') {
    window.dataLayer = [];
    for (const cookie of document.cookie.split(';')) {
      const name = cookie.split('=')[0].trim();
      if (!/^_ga(?:_|$)|^_gid$|^_gat(?:_|$)/.test(name)) continue;
      for (const domain of ['', window.location.hostname, `.${window.location.hostname}`]) {
        document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ''}`;
      }
    }
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
}
export function subscribeCookieChoice(callback) {
  const storage = event => { if (event.key === KEY || event.key === null) callback(); };
  let previous = getCookieChoice();
  const expiryTimer = window.setInterval(() => { const next = getCookieChoice(); if (next !== previous) { previous = next; callback(); } }, 60000);
  window.addEventListener(CONSENT_EVENT, callback);
  window.addEventListener('storage', storage);
  return () => { window.clearInterval(expiryTimer); window.removeEventListener(CONSENT_EVENT, callback); window.removeEventListener('storage', storage); };
}
export function openCookieSettings() { window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT)); }

export function loadGoogleAnalytics() {
  if (!hasAnalyticsConsent() || document.querySelector('script[data-reelbot-gtag]')) return;
  window['ga-disable-G-M66HQLHV22'] = false;
  window.dataLayer = [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', 'G-M66HQLHV22', {allow_google_signals: false, allow_ad_personalization_signals: false});
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=G-M66HQLHV22';
  script.dataset.reelbotGtag = 'true';
  document.head.appendChild(script);
}
