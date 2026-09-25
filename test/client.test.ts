import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import Typesearch, { BadRequestError, DEFAULT_BASE_URL, JobFailedError, APITimeoutError, NotFoundError, TypesearchError, VERSION } from '../src/index.ts';
import pkg from '../package.json' with { type: 'json' };
import { FakeApi, KEY } from './fake-api.ts';

let api: FakeApi;
let ts: Typesearch;

beforeAll(async () => {
  api = await new FakeApi().start();
  ts = new Typesearch({ apiKey: KEY, baseURL: api.url });
});
afterAll(() => api.close());
afterEach(() => api.reset());

describe('client', () => {
  test('the key comes from the options, a string, or TYPESEARCH_API_KEY; a missing key is a clear error', () => {
    const before = { key: process.env.TYPESEARCH_API_KEY, base: process.env.TYPESEARCH_BASE_URL };
    try {
      delete process.env.TYPESEARCH_API_KEY;
      delete process.env.TYPESEARCH_BASE_URL;
      expect(() => new Typesearch()).toThrow(TypesearchError);
      expect(() => new Typesearch()).toThrow(/TYPESEARCH_API_KEY/);
      expect(new Typesearch('ts_live_a').baseURL).toBe(DEFAULT_BASE_URL);
      expect(new Typesearch('ts_live_a', 'http://localhost:3000/').baseURL).toBe('http://localhost:3000');
      expect(new Typesearch('ts_live_a', { timeout: 5 }).timeout).toBe(5);
      process.env.TYPESEARCH_API_KEY = ' ts_live_env ';
      process.env.TYPESEARCH_BASE_URL = 'http://127.0.0.1:9/';
      const c = new Typesearch();
      expect(c.baseURL).toBe('http://127.0.0.1:9');
      expect(c.timeout).toBe(70_000);
      expect(c.maxRetries).toBe(2);
    } finally {
      for (const [k, v] of [['TYPESEARCH_API_KEY', before.key], ['TYPESEARCH_BASE_URL', before.base]] as const) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });

  test('the version matches package.json', () => {
    expect(VERSION).toBe(pkg.version);
  });

  test('every request carries the key, the User-Agent and the default headers', async () => {
    const c = new Typesearch({ apiKey: KEY, baseURL: api.url, defaultHeaders: { 'X-Trace': 'a', 'User-Agent': 'mine/1' } });
    await c.usage({ headers: { 'x-trace': 'b' } });
    expect(api.last.headers.authorization).toBe(`Bearer ${KEY}`);
    expect(api.last.headers['user-agent']).toBe('mine/1');
    expect(api.last.headers['x-trace']).toBe('b');
    await ts.usage();
    expect(api.last.headers['user-agent']).toBe(`typesearch-js/${VERSION}`);
    expect(api.last.headers.accept).toBe('application/json');
  });
});

describe('search', () => {
  test('POST /v1/search with the query and the options, as the API names them', async () => {
    const res = await ts.search('el dólar', {
      mode: 'normal',
      max_results: 10,
      include_domains: ['reddiaria.example', 'diarioejemplo.example'],
      published_after: '2026-09-20',
      highlights: true,
      tone: undefined,
    });
    expect(api.last.method).toBe('POST');
    expect(api.last.path).toBe('/v1/search');
    expect(api.last.headers['content-type']).toBe('application/json');
    expect(api.last.body).toEqual({
      query: 'el dólar',
      mode: 'normal',
      max_results: 10,
      include_domains: ['reddiaria.example', 'diarioejemplo.example'],
      published_after: '2026-09-20',
      highlights: true,
    });
    expect(res.results[0]?.score).toBeTypeOf('number');
    expect(res.results[0]?.highlights).toEqual([]);
  });

  test('several queries, `days: null`, dates as Date and structured questions', async () => {
    const res = await ts.search(['el dólar', 'el FMI'], {
      mode: 'fast',
      days: null,
      published_before: new Date('2026-09-22T12:00:00Z'),
      questions: {
        stance: { type: 'choice', instructions: 'What is the stance?', criteria: { supportive: null, critical: null } },
        impact: { type: 'score', instructions: 'How much?', criteria: ['None', 'High'] },
      },
    });
    expect(api.last.body.query).toEqual(['el dólar', 'el FMI']);
    expect(api.last.body.days).toBeNull();
    expect(api.last.body.published_before).toBe('2026-09-22T12:00:00.000Z');
    expect(res.queries).toEqual(['el dólar', 'el FMI']);
  });

  test('a field the API does not know is rejected by the API, as a typed error with `errors`', async () => {
    const e = await ts.search('el dólar', { colour: 'red' } as never).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(BadRequestError);
    const err = e as BadRequestError;
    expect(err.status).toBe(400);
    expect(err.code).toBe('invalid_request');
    expect(err.errors[0]?.message).toMatch(/colour/);
    expect(err.requestId).toBe('req_fakeerr1');
    expect(api.requests).toHaveLength(1); // a 400 is not retried
  });
});

describe('similar and contents', () => {
  test('similar: POST /v1/similar with the URL; `reference` in the response', async () => {
    const res = await ts.similar('https://diarioejemplo.example/economia/nota', { mode: 'fast', exclude_domains: ['diarioejemplo.example'] });
    expect(api.last.path).toBe('/v1/similar');
    expect(api.last.body).toEqual({ url: 'https://diarioejemplo.example/economia/nota', mode: 'fast', exclude_domains: ['diarioejemplo.example'] });
    expect(res.object).toBe('similar');
    expect(res.reference?.url).toBe('https://diarioejemplo.example/economia/nota');
  });

  test('contents: a list or a single URL; each page with its own status', async () => {
    const res = await ts.contents(['https://reddiaria.example/economia/a', 'https://unreachable.example/b'], { query: 'el Presupuesto 2027' });
    expect(api.last.body).toEqual({ urls: ['https://reddiaria.example/economia/a', 'https://unreachable.example/b'], query: 'el Presupuesto 2027' });
    expect(res.results.map((p) => p.status)).toEqual(['ok', 'error']);
    expect(res.results[0]?.relevance).toBe(0.97);
    expect(res.results[1]?.error?.code).toBe('site_unreachable');
    await ts.contents('https://reddiaria.example/economia/a');
    expect(api.last.body).toEqual({ urls: ['https://reddiaria.example/economia/a'] });
  });
});

describe('live site search and jobs', () => {
  test('siteSearch returns the job; jobs.get reads it', async () => {
    const job = await ts.siteSearch('diarioejemplo.example', 'el dólar', { mode: 'normal' });
    expect(api.last.body).toEqual({ site: 'diarioejemplo.example', query: 'el dólar', mode: 'normal' });
    expect(job.status).toBe('queued');
    const again = await ts.jobs.get(job.id);
    expect(api.last.path).toBe(`/v1/jobs/${job.id}`);
    expect(again.status).toBe('running');
  });

  test('siteSearchAndWait polls until the job succeeds and returns its result', async () => {
    const res = await ts.siteSearchAndWait('diarioejemplo.example', 'el dólar', { mode: 'normal', max_results: 10 }, { pollInterval: 5 });
    expect(res.site).toBe('diarioejemplo.example');
    expect(res.object).toBe('site_search');
    expect(api.requests.map((r) => r.method)).toEqual(['POST', 'GET', 'GET']);
  });

  test('jobs.wait throws JobFailedError, with the job and its code, when it fails', async () => {
    const job = await ts.siteSearch('fail.example', 'el dólar');
    const e = await ts.jobs.wait(job.id, { pollInterval: 5 }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(JobFailedError);
    expect((e as JobFailedError).code).toBe('site_unreachable');
    expect((e as JobFailedError).job.id).toBe(job.id);
    expect((e as Error).message).toBe('The site did not answer.');
  });

  test('jobs.wait gives up after waitTimeout', async () => {
    const job = await ts.siteSearch('diarioejemplo.example', 'el dólar');
    const e = await ts.jobs.wait(job.id, { pollInterval: 50, waitTimeout: 10 }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(APITimeoutError);
    expect((e as Error).message).toMatch(/did not finish/);
  });

  test('an unknown job is a NotFoundError', async () => {
    const e = await ts.jobs.get('job_nope/../x').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(NotFoundError);
    expect(api.last.path).toBe('/v1/jobs/job_nope%2F..%2Fx');
  });
});

describe('coverage and usage', () => {
  test('sources(): the aggregate coverage', async () => {
    const res = await ts.sources();
    expect(api.last.path).toBe('/v1/sources');
    expect([...api.last.query.keys()]).toEqual([]);
    expect(res.by_country[0]?.country).toBe('AR');
  });

  test('sources({ domain }): whether one domain is covered', async () => {
    const yes = await ts.sources({ domain: 'diarioejemplo.example' });
    expect(api.last.query.get('domain')).toBe('diarioejemplo.example');
    expect(yes.covered && yes.name).toBe('Diario Ejemplo');
    const no = await ts.sources({ domain: 'otro diario.example' });
    expect(api.last.query.get('domain')).toBe('otro diario.example');
    expect(no.covered).toBe(false);
  });

  test('usage()', async () => {
    const u = await ts.usage();
    expect(api.last.path).toBe('/v1/usage');
    expect(u.today.remaining_tokens).toBe(816080);
    expect(u.limits.requests_per_minute).toBe(600);
  });
});
