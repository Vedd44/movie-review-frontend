import { act, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth, PENDING_SAVE_KEY } from './AuthContext';
let mockListener;
const mockAuth = {
  getSession: jest.fn(async () => ({ data: { session: null } })),
  onAuthStateChange: jest.fn(listener => { mockListener = listener; return { data: { subscription: { unsubscribe: jest.fn() } } }; }),
  resend: jest.fn(async () => ({ data: {}, error: null })),
  signUp: jest.fn(async () => ({ data: { session: null }, error: null })),
  signInWithOAuth: jest.fn(async () => ({ data: {}, error: null })),
};
jest.mock('../lib/supabaseClient', () => ({ isSupabaseConfigured: true, getSupabaseClient: async () => ({ auth: mockAuth }) }));
let auth;
jest.mock('../analytics', () => ({ trackProductEvent: jest.fn() }));
const { trackProductEvent } = require('../analytics');
function Probe() { auth = useAuth(); return null; }
beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.signUp.mockResolvedValue({ data: { session: null }, error: null });
  mockAuth.resend.mockResolvedValue({ data: {}, error: null });
  window.localStorage.clear(); window.history.replaceState({}, '', '/');
  mockAuth.getSession.mockResolvedValue({ data: { session: null } });
  mockAuth.onAuthStateChange.mockImplementation(listener => { mockListener = listener; return { data: { subscription: { unsubscribe: jest.fn() } } }; });
});

test('expired email links open a safe recovery prompt and remove the URL error', async () => {
  window.history.replaceState({}, '', '/#error=access_denied&error_code=otp_expired');
  render(<MemoryRouter><AuthProvider><Probe /></AuthProvider></MemoryRouter>);
  await waitFor(() => expect(auth.authReady).toBe(true));
  expect(auth.authPromptOpen).toBe(true);
  expect(auth.authNotice.view).toBe('email-link');
  expect(window.location.hash).toBe('');
});
test('a claimed recovery type without a session does not activate password recovery', async () => {
  window.history.replaceState({}, '', '/reset-password#type=recovery');
  render(<MemoryRouter><AuthProvider><Probe /></AuthProvider></MemoryRouter>);
  await waitFor(() => expect(auth.authReady).toBe(true));
  expect(auth.passwordRecoveryActive).toBe(false);
  expect(auth.recoverySession).toBeNull();
});
test('confirmation reporting requires an actual verified session', async () => {
  window.history.replaceState({}, '', '/#type=signup');
  mockAuth.getSession.mockResolvedValue({ data: { session: { user: { id:'new-user', email_confirmed_at:'2026-10-04T17:00:00Z' } } } });
  render(<MemoryRouter><AuthProvider><Probe /></AuthProvider></MemoryRouter>);
  await waitFor(() => expect(auth.authReady).toBe(true));
  expect(auth.authNotice.kind).toBe('success');
  expect(trackProductEvent).toHaveBeenCalledWith('sign_up', {method:'email', email_verified:true});
});
test('unverified signup is reported separately and resend keeps the canonical redirect', async () => {
  render(<MemoryRouter><AuthProvider><Probe /></AuthProvider></MemoryRouter>);
  await waitFor(() => expect(auth.authReady).toBe(true));
  await act(async () => { await auth.signUpWithPassword({email:'viewer@example.com',password:'password1'}); await auth.resendConfirmation(' VIEWER@example.com '); });
  expect(trackProductEvent).toHaveBeenCalledWith('signup_confirmation_requested', {method:'email',confirmation_required:true});
  expect(mockAuth.resend).toHaveBeenCalledWith({type:'signup',email:'viewer@example.com',options:{emailRedirectTo:'http://localhost/'}});
});
test('password recovery remains isolated across token refresh until completion', async () => {
  render(<MemoryRouter><AuthProvider><Probe /></AuthProvider></MemoryRouter>);
  await waitFor(() => expect(auth.authReady).toBe(true));
  const session = { user: { id: 'test-account' } };
  await act(async () => mockListener('PASSWORD_RECOVERY', session));
  expect(auth.passwordRecoveryActive).toBe(true); expect(auth.user).toBeNull();
  await act(async () => mockListener('TOKEN_REFRESHED', session));
  expect(auth.passwordRecoveryActive).toBe(true); expect(auth.user).toBeNull();
  await act(async () => mockListener('SIGNED_OUT', null));
  expect(auth.passwordRecoveryActive).toBe(false); expect(auth.user).toBeNull();
});
test('sign-in leaves an intended save pending until the shared library restores', async () => {
  window.localStorage.setItem(PENDING_SAVE_KEY, JSON.stringify({ id: 348, title: 'Alien' }));
  render(<MemoryRouter><AuthProvider><Probe /></AuthProvider></MemoryRouter>);
  await waitFor(() => expect(auth.authReady).toBe(true));
  await act(async () => mockListener('SIGNED_IN', { user: { id: 'test-account' } }));
  expect(auth.user.id).toBe('test-account');
  expect(JSON.parse(window.localStorage.getItem(PENDING_SAVE_KEY)).id).toBe(348);
});
