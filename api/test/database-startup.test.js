import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeWithRetry } from '../src/database-startup.js';
import { createApp } from '../src/app.js';
import { memoryDb } from './helpers/memory-db.js';
import { formatDatabaseError } from '../src/db-error.js';

const networkError = () =>
  Object.assign(new Error('Connection timed out'), {
    name: 'MongoServerSelectionError',
  });

test('connection diagnostics include underlying failures while redacting credentials', () => {
  const error = networkError();
  error.reason = {
    servers: new Map([
      [
        'host',
        { error: { message: 'Failed mongodb://user:secret@example.test/db' } },
      ],
    ]),
  };
  const formatted = formatDatabaseError(error);
  assert.match(formatted, /Failed <redacted MongoDB URI>/);
  assert.ok(!formatted.includes('secret'));
});

test('database startup retries temporary failures with capped backoff and recovers', async () => {
  let calls = 0;
  const delays = [];
  await initializeWithRetry(
    async () => {
      if (++calls <= 8) throw networkError();
    },
    {
      wait: async (delay) => {
        delays.push(delay);
      },
    }
  );
  assert.equal(calls, 9);
  assert.deepEqual(
    delays,
    [1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]
  );
});

test('database startup stops on permanent errors or shutdown', async () => {
  const error = Object.assign(new Error('Invalid credentials'), {
    name: 'MongoServerError',
    code: 18,
  });
  await assert.rejects(
    initializeWithRetry(async () => {
      throw error;
    }),
    (result) => result === error
  );
  const shutdown = new AbortController();
  let calls = 0;
  await initializeWithRetry(
    async () => {
      calls++;
      throw networkError();
    },
    {
      signal: shutdown.signal,
      wait: async () => {
        shutdown.abort();
      },
    }
  );
  assert.equal(calls, 1);
});

test('API stays reachable during startup and reports database outages without restarting', async () => {
  const db = memoryDb();
  let ready = false;
  let disconnected = false;
  db.command = async () => {
    if (disconnected) throw networkError();
    return { ok: 1 };
  };
  const server = createApp(db, { isReady: () => ready }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/health`;
  try {
    const starting = await fetch(url);
    assert.equal(starting.status, 503);
    assert.equal(starting.headers.get('retry-after'), '5');
    ready = true;
    assert.equal((await fetch(url)).status, 200);
    disconnected = true;
    const unavailable = await fetch(url);
    assert.equal(unavailable.status, 503);
    assert.match((await unavailable.json()).error, /temporarily unavailable/);
    disconnected = false;
    assert.equal((await fetch(url)).status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
