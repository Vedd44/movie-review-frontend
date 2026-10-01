import { act, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth, PENDING_SAVE_KEY } from './AuthContext';
let mockListener;
const mockAuth = {
  getSession: jest.fn(async () => ({ data: { session: null } })),
  onAuthStateChange: jest.fn(listener => { mockListener = listener; return { data: { subscription: { unsubscribe: jest.fn() } } }; }),
};
jest.mock('../lib/supabaseClient', () => ({ isSupabaseConfigured: true, getSupabaseClient: async () => ({ auth: mockAuth }) }));
let auth;
function Probe() { auth = useAuth(); return null; }
beforeEach(() => {
  window.localStorage.clear(); window.history.replaceState({}, '', '/');
  mockAuth.getSession.mockResolvedValue({ data: { session: null } });
  mockAuth.onAuthStateChange.mockImplementation(listener => { mockListener = listener; return { data: { subscription: { unsubscribe: jest.fn() } } }; });
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
