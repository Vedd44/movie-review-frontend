import axios from "axios";

// Only the catalog's explicit, short admission delay is retryable. Do not
// retry transport/upstream failures, missing hints, or longer rate limits.
const shortRetryDelay = (error) => {
  if (error.response?.status !== 429) return null;
  const seconds = error.response.data?.retry_after_seconds;
  return Number.isInteger(seconds) && seconds >= 1 && seconds <= 3 ? seconds * 1000 : null;
};

const abortError = () => Object.assign(new Error("Movie request cancelled"), { name: "AbortError" });
const timeoutError = () => Object.assign(new Error("Movie details request timed out"), { code: "ECONNABORTED" });
const DETAIL_DEADLINE_MS = 15000;

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
  if (signal?.aborted) throw abortError();
  const controller = new AbortController();
  let rejectTermination;
  const termination = new Promise((_, reject) => { rejectTermination = reject; });
  const terminate = (error) => {
    // Settle our operation even if an adapter fails to honor cancellation;
    // abort the transport as well so timeout does not leave work running.
    rejectTermination(error);
    controller.abort();
  };
  const onAbort = () => terminate(abortError());
  signal?.addEventListener("abort", onAbort, { once: true });
  // One deadline covers the original request AND any short admission retries.
  const timer = setTimeout(() => terminate(timeoutError()), DETAIL_DEADLINE_MS);
  const run = async () => {
    for (let attempt = 0; ; attempt += 1) {
      if (controller.signal.aborted) throw abortError();
      try {
        return await axios.get(url, { signal: controller.signal, timeout: DETAIL_DEADLINE_MS });
      } catch (error) {
        const delay = shortRetryDelay(error);
        if (controller.signal.aborted || delay === null || attempt >= 2) throw error;
        await waitForRetry(delay, controller.signal);
      }
    }
  };
  try {
    return await Promise.race([run(), termination]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}
