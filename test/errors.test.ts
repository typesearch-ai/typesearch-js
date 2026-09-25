import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import Typesearch, {
  APIConnectionError,
  APIError,
  APITimeoutError,
  AuthenticationError,
  BadRequestError,
  BudgetError,
  InternalServerError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
  TypesearchError,
} from '../src/index.ts';
import { FakeApi, KEY, problem, searchResponse } from './fake-api.ts';

let api: FakeApi;
let ts: Typesearch;

beforeAll(async () => {
  api = await new FakeApi().start();
  ts = new Typesearch({ apiKey: KEY, baseURL: api.url });
});
afterAll(() => api.close());
afterEach(() => api.reset());

const fail = (status: number, code: string, headers: Record<string, string> = {}, extra: Record<string, unknown> = {}) => ({
  status,
  headers,
  body: problem(status, code, extra),
});

describe('typed errors', () => {
  test.each([
    [400, 'invalid_request', BadRequestError],
    [401, 'invalid_api_key', AuthenticationError],
    [402, 'insufficient_credits', BudgetError],
    [402, 'budget_too_small', BudgetError],
    [403, 'robots_disallowed', PermissionDeniedError],
    [403, 'source_unavailable', PermissionDeniedError],
    [404, 'job_not_found', NotFoundError],
    [429, 'quota_exceeded', RateLimitError],
    [499, 'cancelled', APIError],
  ])('%i %s → %o', async (status, code, cls) => {
    api.next(fail(status, code, { 'retry-after': '3600' }));
    const e = await ts.search('el dólar').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(cls);
    expect(e).toBeInstanceOf(APIError);
    expect(e).toBeInstanceOf(TypesearchError);
    const err = e as APIError;
    expect(err.status).toBe(status);
    expect(err.code).toBe(code);
    expect(err.message).toBe(`detail of ${code}`);
    expect(err.requestId).toBe('req_fakeerr1');
    expect(api.requests).toHaveLength(1); // none of them is retried
  });

  test('a real 401 from the API: missing or invalid key', async () => {
    const other = new Typesearch({ apiKey: 'ts_live_wrong', baseURL: api.url });
    const e = await other.usage().catch((x: unknown) => x);
    expect(e).toBeInstanceOf(AuthenticationError);
    expect((e as APIError).code).toBe('invalid_api_key');
  });

  test('an error body that is not JSON still gives a typed error, with the request id from the header', async () => {
    api.next({ status: 400, body: 'Bad gateway <html>' });
    const e = await ts.usage().catch((x: unknown) => x);
    expect(e).toBeInstanceOf(BadRequestError);
    expect((e as APIError).code).toBe('unknown_error');
    expect((e as APIError).requestId).toBe('req_fakescr1');
  });

  test('a successful answer that is not JSON is a TypesearchError, not a crash', async () => {
    api.next({ status: 200, body: '<html>' });
    await expect(ts.usage()).rejects.toThrow(/not JSON/);
  });
});

describe('retries', () => {
  test('429 rate_limited is retried after Retry-After, and the RateLimitError carries it', async () => {
    api.next(fail(429, 'rate_limited', { 'retry-after': '0' }), fail(429, 'rate_limited', { 'retry-after': '0' }));
    const res = await ts.usage();
    expect(res.object).toBe('usage');
    expect(api.requests).toHaveLength(3);

    api.reset();
    api.next(fail(429, 'rate_limited', { 'retry-after': '7' }));
    const e = await ts.usage({ maxRetries: 0 }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(RateLimitError);
    expect((e as RateLimitError).retryAfter).toBe(7);
  });

  test('Retry-After as an HTTP date is honoured', async () => {
    const soon = new Date(Date.now() + 1200).toUTCString(); // whole seconds: up to ~1.2 s
    api.next(fail(503, 'upstream_unavailable', { 'retry-after': soon }));
    const t0 = Date.now();
    await ts.usage();
    expect(Date.now() - t0).toBeGreaterThanOrEqual(150);
    expect(api.requests).toHaveLength(2);
  });

  test('quota_exceeded is never retried', async () => {
    api.next(fail(429, 'quota_exceeded', { 'retry-after': '0' }));
    await expect(ts.usage()).rejects.toBeInstanceOf(RateLimitError);
    expect(api.requests).toHaveLength(1);
  });

  test('5xx is retried up to maxRetries, then thrown as InternalServerError', async () => {
    api.next(fail(503, 'shutting_down', { 'retry-after': '0' }), fail(502, 'site_unreachable', { 'retry-after': '0' }), fail(500, 'internal_error', { 'retry-after': '0' }));
    const e = await ts.search('el dólar').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(InternalServerError);
    expect((e as APIError).code).toBe('internal_error');
    expect(api.requests).toHaveLength(3);
    // The same body every time.
    expect(new Set(api.requests.map((r) => JSON.stringify(r.body))).size).toBe(1);
  });

  test('maxRetries: 0 per request, or for the whole client', async () => {
    api.next(fail(503, 'upstream_unavailable', { 'retry-after': '0' }));
    await expect(ts.usage({ maxRetries: 0 })).rejects.toBeInstanceOf(InternalServerError);
    expect(api.requests).toHaveLength(1);
    api.reset();
    const once = new Typesearch({ apiKey: KEY, baseURL: api.url, maxRetries: 0 });
    api.next(fail(503, 'upstream_unavailable', { 'retry-after': '0' }));
    await expect(once.usage()).rejects.toBeInstanceOf(InternalServerError);
    expect(api.requests).toHaveLength(1);
  });

  test('without Retry-After it backs off exponentially', async () => {
    api.next(fail(503, 'upstream_unavailable'));
    const t0 = Date.now();
    await ts.usage();
    const waited = Date.now() - t0;
    expect(waited).toBeGreaterThanOrEqual(370); // 500 ms minus up to 25% of jitter
    expect(waited).toBeLessThan(2000);
  });

  test('a dropped connection is retried, then thrown as APIConnectionError', async () => {
    api.next({ destroy: true });
    expect((await ts.usage()).object).toBe('usage');
    api.reset();
    api.next({ destroy: true }, { destroy: true });
    const e = await ts.usage({ maxRetries: 1 }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(APIConnectionError);
    expect((e as Error).cause).toBeDefined();
  });

  test('a server that never answers: APITimeoutError after `timeout`, retried', async () => {
    api.next({ delayMs: 400, body: searchResponse() }, { delayMs: 400, body: searchResponse() });
    const e = await ts.search('el dólar', {}, { timeout: 100, maxRetries: 1 }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(APITimeoutError);
    expect(e).toBeInstanceOf(APIConnectionError);
    expect(api.requests).toHaveLength(2);
  });

  test('aborting the signal rejects with its reason and does not retry', async () => {
    api.next({ delayMs: 500, body: searchResponse() });
    const controller = new AbortController();
    const pending = ts.search('el dólar', {}, { signal: controller.signal });
    setTimeout(() => controller.abort(), 50);
    const e = await pending.catch((x: unknown) => x);
    expect((e as Error).name).toBe('AbortError');
    expect(api.requests).toHaveLength(1);
    // An already-aborted signal does not even send the request.
    api.reset();
    await expect(ts.usage({ signal: AbortSignal.abort(new Error('stop')) })).rejects.toThrow('stop');
    expect(api.requests).toHaveLength(0);
  });

  test('aborting while it waits to retry stops waiting', async () => {
    api.next(fail(503, 'upstream_unavailable', { 'retry-after': '30' }));
    const controller = new AbortController();
    const pending = ts.usage({ signal: controller.signal });
    setTimeout(() => controller.abort(new Error('enough')), 100);
    await expect(pending).rejects.toThrow('enough');
    expect(api.requests).toHaveLength(1);
  });
});
