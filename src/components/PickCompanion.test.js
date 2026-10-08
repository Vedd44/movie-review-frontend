import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import PickCompanion from './PickCompanion';
import { TasteProfileProvider } from '../hooks/useTasteProfile';
import { tasteProfileService } from '../services/tasteProfileService';
import { reelbotCloudService } from '../services/reelbotCloudService';

let mockUser = null;
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser, authReady: true }), PENDING_SAVE_KEY: 'pending-save' }));
jest.mock('../services/reelbotCloudService', () => ({ reelbotCloudService: {
  isConfigured: true, getLocalProfileOwner: jest.fn(() => ''), clearLocalAccountCache: jest.fn(),
  bootstrapUserState: jest.fn(), saveUserState: jest.fn(), activateLocalCache: jest.fn(),
} }));
const movie = { id: 1, title: 'A movie', genre_ids: [35, 10749], runtime: 110 };
const snapshot = profile => ({ profile, interactions: [], homePickSession: null });
const app = props => <TasteProfileProvider><PickCompanion movie={movie} {...props} /></TasteProfileProvider>;
const openFeedback = () => fireEvent.click(screen.getByText('Watched or not for you?'));
const click = async name => {
  fireEvent.click(screen.getByRole('button', { name, exact: true }));
  await waitFor(() => expect(screen.getByRole('button', { name, exact: true })).not.toBeDisabled());
};
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); jest.clearAllMocks(); mockUser = null;
  reelbotCloudService.bootstrapUserState.mockResolvedValue(snapshot(tasteProfileService.createEmptyProfile()));
  reelbotCloudService.saveUserState.mockImplementation(async (id, profile) => snapshot(profile));
});

test.each(['guest', 'account'])('%s feedback switches, persists, and undoes without implying broader taste', async mode => {
  mockUser = mode === 'account' ? { id: 'feedback-owner' } : null;
  const onRefine = jest.fn();
  let view;
  await act(async () => { view = render(app({ onRefine })); });
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Not for me' })).not.toBeVisible();
  openFeedback();
  await click('Watched');
  expect(screen.getByText('Marked as watched.')).toBeVisible();
  expect(screen.getByText(mockUser ? 'You can manage your watched movies in My Movies.' : 'Saved on this device. Select Watched again to undo.')).toBeVisible();
  await click('Not for me');
  expect(screen.queryByText('Marked as watched.')).not.toBeInTheDocument();
  expect(screen.getByText("Got it. We won't recommend this movie again.")).toBeVisible();
  expect(screen.getByText(mockUser ? 'You can change this anytime in My Movies.' : 'Saved on this device. Select Not for me again to undo.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Watched' })).toHaveAttribute('aria-pressed', 'false');
  expect(onRefine).not.toHaveBeenCalled();
  expect(screen.queryByText(/For this pick, would you prefer/)).not.toBeInTheDocument();
  for (const name of ['Too long', 'Too intense', 'Not my mood']) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();

  const stored = tasteProfileService.load();
  expect(stored.skipped.map(item => item.id)).toEqual([movie.id]);
  expect(stored.seen).toEqual([]);
  expect(tasteProfileService.getPickExcludedIds(stored, { prompt: 'a romantic comedy' })).toEqual([movie.id]);
  const memory = stored.behavioralMemory;
  for (const key of ['preferredGenres', 'avoidedGenres', 'tonePreferences', 'pacePreferences', 'runtimePreference']) expect(memory[key]).toEqual({});
  expect(memory.userProfile.dislikedGenres).toEqual([]);
  if (mockUser) {
    expect(reelbotCloudService.saveUserState.mock.calls.every(call => call[0] === mockUser.id)).toBe(true);
    reelbotCloudService.bootstrapUserState.mockResolvedValue(snapshot(reelbotCloudService.saveUserState.mock.calls.at(-1)[1]));
  } else expect(reelbotCloudService.saveUserState).not.toHaveBeenCalled();
  view.unmount();
  await act(async () => { view = render(app({ onRefine })); });
  openFeedback();
  expect(screen.getByRole('button', { name: 'Not for me' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText("Got it. We won't recommend this movie again.")).toBeVisible();
  await click('Not for me');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(tasteProfileService.getPickExcludedIds(tasteProfileService.load(), { prompt: 'a romantic comedy' })).not.toContain(movie.id);
  await click('Not for me');
  await click('Watched');
  expect(screen.getByRole('button', { name: 'Not for me' })).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByText('Marked as watched.')).toBeVisible();
  await click('Watched');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(tasteProfileService.load().seen).toEqual([]);
});

test('a failed account save rolls back without a success confirmation', async () => {
  mockUser = { id: 'feedback-owner' };
  reelbotCloudService.saveUserState.mockRejectedValueOnce(new Error('Offline'));
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
  await act(async () => { render(app()); });
  openFeedback();
  await click('Not for me');
  expect(screen.getByText('Could not save that change. Try again.')).toBeVisible();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Not for me' })).toHaveAttribute('aria-pressed', 'false');
  errorLog.mockRestore();
});

test('keeps bounded request adjustments separate, disables pending actions, and clears confirmation for a new movie', async () => {
  const onRefine = jest.fn();
  const refineActions = [{ id: 'lighter', label: 'Lighter' }, { id: 'shorter', label: 'Shorter' }, { id: 'different_angle', label: 'Different angle' }, { id: 'darker', label: 'Darker' }];
  const props = { onRefine, refineActions };
  const view = render(app(props));
  expect(screen.getByRole('button', { name: 'Darker' })).not.toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Shorter' }));
  expect(onRefine).toHaveBeenCalledTimes(1);
  expect(onRefine).toHaveBeenCalledWith(refineActions[1]);
  openFeedback();
  await click('Not for me');
  view.rerender(app({ ...props, disabled: true }));
  expect(screen.getByRole('button', { name: 'Watched' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Shorter' })).toBeDisabled();
  view.rerender(app({ ...props, movie: { id: 2, title: 'Another movie' } }));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
