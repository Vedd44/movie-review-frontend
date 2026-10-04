import React from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { hasAnalyticsConsent } from '../cookieConsent';
export default function OptionalAnalytics() {
  const beforeSend = event => hasAnalyticsConsent() ? event : null;
  return <><Analytics beforeSend={beforeSend} /><SpeedInsights beforeSend={beforeSend} /></>;
}
