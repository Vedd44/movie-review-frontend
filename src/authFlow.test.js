import { getAuthReturn, authErrorMessage } from './authFlow';
afterEach(() => window.history.replaceState({}, '', '/'));
test('expired links use safe copy and preserve the recovery destination', () => {
 window.history.replaceState({}, '', '/reset-password#error=access_denied&error_code=otp_expired&error_description=untrusted');
 expect(getAuthReturn()).toEqual({kind:'error',view:'forgot-password',message:'That email link has expired or has already been used. Request a new link below.'});
});
test('confirmation return is distinguished from an ordinary visit', () => {
 window.history.replaceState({}, '', '/#type=signup&access_token=not-a-session');
 expect(getAuthReturn()).toEqual({kind:'confirmation'});
 window.history.replaceState({}, '', '/'); expect(getAuthReturn()).toBeNull();
});
test('OAuth cancellation never renders provider-supplied error text', () => {
 window.history.replaceState({}, '', '/?error=access_denied&error_description=untrusted');
 expect(getAuthReturn().message).not.toContain('untrusted');
});
test('auth errors show useful safe guidance', () => {
 expect(authErrorMessage({code:'over_request_rate_limit'},'Fallback')).toBe('Please wait a minute before trying again.');
 expect(authErrorMessage({code:'email_not_confirmed'},'Fallback')).toBe('Confirm your email before signing in.');
});
