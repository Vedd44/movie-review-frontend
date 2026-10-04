import React, { lazy, Suspense, useEffect, useState } from 'react';
import { hasAnalyticsConsent, subscribeCookieChoice, loadGoogleAnalytics } from '../cookieConsent';
const OptionalAnalytics = lazy(() => import('./OptionalAnalytics'));
export default function ConsentAnalytics() {
  const [allowed, setAllowed] = useState(hasAnalyticsConsent);
  useEffect(() => {
    if (allowed) loadGoogleAnalytics();
    return subscribeCookieChoice(() => {
      const next = hasAnalyticsConsent();
      setAllowed(next);
      if (allowed && !next) {
        // Reload unloads already-running provider scripts after withdrawal.
        window['ga-disable-G-M66HQLHV22'] = true;
        window.location.reload();
      }
    });
  }, [allowed]);
  return allowed ? <Suspense fallback={null}><OptionalAnalytics /></Suspense> : null;
}
