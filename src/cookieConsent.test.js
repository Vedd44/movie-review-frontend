import { getCookieChoice, hasAnalyticsConsent, setCookieChoice, loadGoogleAnalytics } from './cookieConsent';
import { fireEvent, render, screen } from '@testing-library/react';
import CookieConsent from './components/CookieConsent';
import { trackProductEvent } from './analytics';

beforeEach(() => {
 window.localStorage.clear(); window.sessionStorage.clear();
 document.querySelectorAll('script[data-reelbot-gtag]').forEach(s => s.remove());
 window.gtag = jest.fn(); window.va = jest.fn(); window.dataLayer = [];
});
test('a previous scroll dismissal is not consent and cannot load analytics', () => {
 window.localStorage.setItem('reelbotCookieNoticeAccepted', 'true');
 expect(getCookieChoice()).toBeNull(); loadGoogleAnalytics();
 expect(document.querySelector('script[data-reelbot-gtag]')).toBeNull();
 trackProductEvent('page_viewed');
 expect(window.gtag).not.toHaveBeenCalled(); expect(window.va).not.toHaveBeenCalled(); expect(window.dataLayer).toEqual([]);
});
test('scrolling leaves a real choice available and rejection persists without blocking the page', () => {
 render(<CookieConsent />); fireEvent.scroll(window, {target: {scrollY: 500}});
 expect(screen.getByRole('button', {name: 'Accept analytics'})).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button', {name: 'Reject analytics'}));
 expect(hasAnalyticsConsent()).toBe(false); expect(getCookieChoice()).toBe('rejected');
 expect(screen.queryByRole('region', {name: 'Cookie preferences'})).not.toBeInTheDocument();
 loadGoogleAnalytics(); expect(document.querySelector('script[data-reelbot-gtag]')).toBeNull();
});
test('explicit acceptance loads Google once, and settings allows withdrawing consent', () => {
 render(<CookieConsent />);
 fireEvent.click(screen.getByRole('button', {name: 'Accept analytics'}));
 expect(hasAnalyticsConsent()).toBe(true); loadGoogleAnalytics(); loadGoogleAnalytics();
 expect(document.querySelectorAll('script[data-reelbot-gtag]')).toHaveLength(1);
 fireEvent(window, new Event('reelbot:cookie-settings'));
 fireEvent.click(screen.getByRole('button', {name: 'Reject analytics'}));
 expect(hasAnalyticsConsent()).toBe(false); expect(window['ga-disable-G-M66HQLHV22']).toBe(true);
 window.gtag = jest.fn(); trackProductEvent('movie_saved'); expect(window.gtag).not.toHaveBeenCalled();
});
test('expired, malformed and future choices fail closed', () => {
 for (const raw of ['invalid', JSON.stringify({version:1,value:'accepted',at:Date.now()-181*86400000}), JSON.stringify({version:1,value:'accepted',at:Date.now()+86400000})]) {
  window.localStorage.setItem('reelbot:cookie-consent:v1',raw); expect(hasAnalyticsConsent()).toBe(false);
 }
});
test('local personalization signals remain available when analytics is rejected', () => {
 setCookieChoice('rejected'); const listener=jest.fn();window.addEventListener('reelbot:analytics',listener);
 trackProductEvent('movie_saved',{movie_id:42});
 expect(listener).toHaveBeenCalledTimes(1); expect(window.gtag).not.toHaveBeenCalled();
 window.removeEventListener('reelbot:analytics',listener);
});
