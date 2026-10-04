import React, { useEffect, useState } from 'react';
import { getCookieChoice, setCookieChoice, subscribeCookieChoice, COOKIE_SETTINGS_EVENT } from '../cookieConsent';

export default function CookieConsent() {
  const [choice, setChoice] = useState(getCookieChoice);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const unsubscribe = subscribeCookieChoice(() => setChoice(getCookieChoice()));
    const open = () => setEditing(true);
    window.addEventListener(COOKIE_SETTINGS_EVENT, open);
    return () => { unsubscribe(); window.removeEventListener(COOKIE_SETTINGS_EVENT, open); };
  }, []);
  if (choice && !editing) return null;
  const choose = value => { setCookieChoice(value); setChoice(value); setEditing(false); };
  return <section className="cookie-consent" aria-label="Cookie preferences">
    <div><strong>Cookies, your choice.</strong><p>Essential storage keeps sign-in and movie preferences working. Optional analytics helps us improve ReelBot. <a href="/privacy">Privacy Policy</a></p></div>
    <div className="cookie-consent-actions">
      <button type="button" onClick={() => choose('rejected')}>Reject analytics</button>
      <button type="button" onClick={() => choose('accepted')}>Accept analytics</button>
      {editing && choice ? <button type="button" className="cookie-consent-cancel" onClick={() => setEditing(false)}>Cancel</button> : null}
    </div>
  </section>;
}
