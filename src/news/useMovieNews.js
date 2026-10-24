import { useEffect, useState } from 'react';
import { safeUrl } from './policy';

export function validatePublicSnapshot(value) {
  if (value?.version !== 1 || !Array.isArray(value.items)) throw new Error('Invalid news response');
  const seen = new Set();
  const items = value.items.filter(item => item && !item.synthetic &&
    typeof item.id === 'string' && item.id && typeof item.headline === 'string' && item.headline &&
    typeof item.summary === 'string' && typeof item.take === 'string' &&
    typeof item.sourceName === 'string' && item.sourceName && safeUrl(item.sourceUrl) &&
    Number.isFinite(Date.parse(item.publishedAt)) && Date.parse(item.publishedAt) <= Date.now())
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .filter(item => { if (seen.has(item.id) || seen.has(item.sourceUrl)) return false; seen.add(item.id); seen.add(item.sourceUrl); return true; })
    .slice(0, 25).map(item => ({ id: item.id, headline: item.headline, summary: item.summary, take: item.take,
      sourceName: item.sourceName, sourceUrl: item.sourceUrl, publishedAt: item.publishedAt,
      editorialReviewedAt: item.editorialReviewedAt, author: typeof item.author === 'string' ? item.author : '' }));
  return { version: 1, updatedAt: Number.isFinite(Date.parse(value.updatedAt)) ? value.updatedAt : null, items };
}
export default function useMovieNews() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ status: 'loading', snapshot: null });
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setState({ status: 'loading', snapshot: null });
    const timer = setTimeout(() => controller.abort(), 8000);
    async function load() {
      try {
        const response = await fetch('/api/movie-news', { signal: controller.signal, credentials: 'omit' });
        if (!response.ok) throw new Error('News unavailable');
        const snapshot = validatePublicSnapshot(await response.json());
        if (active) setState({ status: 'ready', snapshot });
      } catch {
        if (active) setState({ status: 'error', snapshot: null });
      } finally { clearTimeout(timer); }
    }
    load();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [attempt]);
  return { ...state, retry: () => setAttempt(value => value + 1) };
}
