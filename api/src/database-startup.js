import { setTimeout } from 'node:timers/promises';

export function isDatabaseConnectionError(error) {
  return (
    [
      'MongoServerSelectionError',
      'MongoNetworkError',
      'MongoNetworkTimeoutError',
      'MongoTopologyClosedError',
      'MongoPoolClearedError',
    ].includes(error?.name) ||
    [
      'ENOTFOUND',
      'EAI_AGAIN',
      'ETIMEOUT',
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
    ].includes(error?.code)
  );
}

// Retry initialization only. Never replay requests that may have already written data.
export async function initializeWithRetry(
  initialize,
  { signal, onRetry = () => {}, wait = setTimeout } = {}
) {
  let attempt = 0;
  while (!signal?.aborted) {
    try {
      await initialize();
      return;
    } catch (error) {
      if (signal?.aborted) return;
      if (!isDatabaseConnectionError(error)) throw error;
      const delay = Math.min(1000 * 2 ** Math.min(attempt++, 5), 30000);
      onRetry(error, delay);
      try {
        await wait(delay, undefined, { signal });
      } catch (error) {
        if (signal?.aborted) return;
        throw error;
      }
    }
  }
}
