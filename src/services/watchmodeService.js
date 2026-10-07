import axios from 'axios';
import { API_BASE_URL } from '../discovery';
const cache = new Map(), pending = new Map();
export async function fetchWatchmodeAvailability(movieId) {
  const id = Number(movieId);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const known = cache.get(id);
  if (known?.expires > Date.now()) return known.value;
  if (!pending.has(id)) {
    const request = Promise.resolve().then(() => axios.post(`${API_BASE_URL}/movies/${id}/watch-availability`, {}, {timeout:30000}))
      .then(response => {
        const value = response?.data?.availability;
        const availability = value?.source === 'watchmode' && value.region === 'US' ? value : null;
        const checkedAt = Date.parse(availability?.checked_at);
        const expires = availability && Number.isFinite(checkedAt) ? Math.min(Date.now()+30*60000,checkedAt+7*86400000) : Date.now()+5*60000;
        cache.set(id,{value:availability,expires});
        while (cache.size > 500) cache.delete(cache.keys().next().value);
        return availability;
      })
      .catch(() => { cache.set(id,{value:null,expires:Date.now()+60000}); return null; })
      .finally(() => pending.delete(id));
    pending.set(id,request);
  }
  return pending.get(id);
}
