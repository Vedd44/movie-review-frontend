// Ephemeral public catalog snapshots, scoped to one history entry and auth owner.
// Never store picks, taste profiles, credentials, or data in browser storage.
const snapshots = new Map();
const MAX_ENTRIES = 8;
const MAX_MOVIES = 1000;
let activeOwner;

export function browseHistoryKey(owner, locationKey, query) {
  if (activeOwner !== owner) {
    snapshots.clear();
    activeOwner = owner;
  }
  return JSON.stringify([owner, locationKey, query]);
}

export function readBrowseHistory(key) {
  return snapshots.get(key);
}

export function writeBrowseHistory(key, snapshot) {
  if (snapshot.movies.length > MAX_MOVIES) {
    snapshots.delete(key);
    return;
  }
  snapshots.delete(key);
  snapshots.set(key, snapshot);
  while (snapshots.size > MAX_ENTRIES) snapshots.delete(snapshots.keys().next().value);
}

export function clearBrowseHistory() {
  snapshots.clear();
  activeOwner = undefined;
}
