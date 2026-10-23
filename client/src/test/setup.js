import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { resetMockDb } from '../mocks/db.js';
import { server } from '../mocks/server.js';

// Node's fetch rejects relative URLs, but the API client calls `/api/...`. Resolve them against the
// jsdom origin, as a browser would. Tests that stub fetch themselves replace this wrapper.
const nativeFetch = globalThis.fetch;
globalThis.fetch = (input, init) =>
  nativeFetch(
    typeof input === 'string' && input.startsWith('/') ? new URL(input, location.origin) : input,
    init,
  );

// Fail on requests no handler covers, so a missing mock shows up as a test failure.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetMockDb();
});

afterAll(() => server.close());
