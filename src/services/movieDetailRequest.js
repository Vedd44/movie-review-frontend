import axios from "axios";

// Only the catalog's explicit, short admission delay is retryable. Do not
// retry transport/upstream failures, missing hints, or longer rate limits.
const shortRetryDelay = (error) => {
  if (error.response?.status !== 429) return null;
  const seconds = error.response.data?.retry_after_seconds;
  return Number.isInteger(seconds) && seconds >= 1 && seconds <= 3 ? seconds * 1000 : null;
};

const abortError = () => Object.assign(new Error("Movie request cancelled"), { name: "AbortError" });

function waitForRetry(delay, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return; }
    const onAbort = () => { clearTimeout(timer); reject(abortError()); };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delay);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function requestMovieDetails(url, { signal } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    if (signal?.aborted) throw abortError();
    try {
      return await axios.get(url, { signal });
    } catch (error) {
      const delay = shortRetryDelay(error);
      if (signal?.aborted || delay === null || attempt >= 2) throw error;
      await waitForRetry(delay, signal);
    }
  }
}
