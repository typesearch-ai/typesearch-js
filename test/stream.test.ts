import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import Typesearch, { APIConnectionError, BudgetError, InternalServerError, TypesearchError, type SearchStreamEvent } from '../src/index.ts';
import { parseSSE } from '../src/stream.ts';
import { FakeApi, KEY, problem, searchResponse } from './fake-api.ts';

let api: FakeApi;
let ts: Typesearch;

beforeAll(async () => {
  api = await new FakeApi().start();
  ts = new Typesearch({ apiKey: KEY, baseURL: api.url });
});
afterAll(() => api.close());
afterEach(() => api.reset());

const until = async (cond: () => boolean, ms = 2000) => {
  const end = Date.now() + ms;
  while (!cond() && Date.now() < end) await new Promise((r) => setTimeout(r, 10));
  return cond();
};

function body(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(c) {
      for (const chunk of chunks) c.enqueue(encoder.encode(chunk));
      c.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>) {
  const out = [];
  for await (const m of parseSSE(stream)) out.push(m);
  return out;
}

describe('parseSSE', () => {
  test('events, comments, multi-line data and CRLF', async () => {
    const out = await collect(body(': latido\r\n\r\nevent: step\r\ndata: {"a":1}\r\n\r\ndata: line 1\ndata: line 2\n\n'));
    expect(out).toEqual([
      { event: 'step', data: '{"a":1}' },
      { event: 'message', data: 'line 1\nline 2' },
    ]);
  });

  test('messages split across chunks, even in the middle of a CRLF or a UTF-8 character', async () => {
    const bytes = new TextEncoder().encode('event: result\r\ndata: {"q":"el dólar"}\r\n\r\n');
    const i = bytes.indexOf(0xc3) + 1; // splits the "ó"
    const j = bytes.indexOf(0x0d); // splits the first \r\n
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(bytes.slice(0, j + 1));
        c.enqueue(bytes.slice(j + 1, i));
        c.enqueue(bytes.slice(i));
        c.close();
      },
    });
    expect(await collect(stream)).toEqual([{ event: 'result', data: '{"q":"el dólar"}' }]);
  });

  test('a body that ends without the blank line still delivers its last message', async () => {
    expect(await collect(body('event: result\ndata: {}'))).toEqual([{ event: 'result', data: '{}' }]);
    expect(await collect(body('event: result\n'))).toEqual([]);
  });
});

describe('searchStream', () => {
  test('steps, partial results and the final result, in order', async () => {
    const events: SearchStreamEvent[] = [];
    for await (const e of ts.searchStream('el dólar', { mode: 'deep' })) events.push(e);
    expect(api.last.body).toEqual({ query: 'el dólar', mode: 'deep', stream: true });
    expect(api.last.headers.accept).toBe('text/event-stream');
    expect(events.map((e) => e.type)).toEqual(['step', 'partial', 'step', 'result']);
    const [step, partial, , result] = events;
    expect(step?.type === 'step' && step.step.status).toBe('running');
    expect(partial?.type === 'partial' && partial.response.results).toHaveLength(1);
    expect(result?.type === 'result' && result.response.results).toHaveLength(2);
  });

  test('finalResponse() consumes the stream and returns the result', async () => {
    const final = await ts.searchStream('el dólar').finalResponse();
    expect(final.results).toHaveLength(2);
    // After iterating, finalResponse() returns what it saw.
    const s = ts.searchStream('el dólar');
    for await (const _ of s) void _;
    expect((await s.finalResponse()).total).toBe(2);
    await expect(async () => {
      for await (const _ of s) void _;
    }).rejects.toThrow(TypesearchError);
  });

  test('the request starts when iteration does', async () => {
    const s = ts.searchStream('el dólar');
    await new Promise((r) => setTimeout(r, 30));
    expect(api.requests).toHaveLength(0);
    await s.finalResponse();
    expect(api.requests).toHaveLength(1);
  });

  test('an `error` event is thrown as the typed API error', async () => {
    api.next({ events: [{ event: 'step', data: { id: 'juicio-indice', text: 'x', status: 'running', detail: null } }, { event: 'error', data: problem(402, 'budget_too_small') }] });
    const seen: string[] = [];
    const e = await (async () => {
      for await (const ev of ts.searchStream('el dólar', { max_tokens: 2000 })) seen.push(ev.type);
    })().catch((x: unknown) => x);
    expect(seen).toEqual(['step']);
    expect(e).toBeInstanceOf(BudgetError);
    expect((e as BudgetError).code).toBe('budget_too_small');
  });

  test('a stream that ends before the result is an APIConnectionError', async () => {
    api.next({ raw: 'event: step\ndata: {"id":"x","text":"x","status":"running","detail":null}\n\n' });
    await expect(ts.searchStream('el dólar').finalResponse()).rejects.toBeInstanceOf(APIConnectionError);
  });

  test('events the SDK does not know are skipped', async () => {
    api.next({ raw: `event: novelty\ndata: {"x":1}\n\nevent: result\ndata: ${JSON.stringify(searchResponse())}\n\n` });
    const types: string[] = [];
    for await (const e of ts.searchStream('el dólar')) types.push(e.type);
    expect(types).toEqual(['result']);
  });

  test('invalid JSON in an event is a TypesearchError', async () => {
    api.next({ raw: 'event: result\ndata: {oops\n\n' });
    await expect(ts.searchStream('el dólar').finalResponse()).rejects.toThrow(/not valid JSON/);
  });

  test('a 5xx before the stream starts is retried; after that, the stream works', async () => {
    api.next({ status: 503, headers: { 'retry-after': '0' }, body: problem(503, 'upstream_unavailable') });
    const final = await ts.searchStream('el dólar').finalResponse();
    expect(final.total).toBe(2);
    expect(api.requests).toHaveLength(2);
  });

  test('a 5xx that persists is thrown when iteration starts', async () => {
    const failing = { status: 500, headers: { 'retry-after': '0' }, body: problem(500, 'internal_error') };
    api.next(failing, failing, failing);
    await expect(ts.searchStream('el dólar').finalResponse()).rejects.toBeInstanceOf(InternalServerError);
  });

  test('breaking out of the loop closes the connection', async () => {
    api.next({ events: [{ event: 'step', data: { id: 'a', text: 'a', status: 'running', detail: null } }], hang: true });
    for await (const e of ts.searchStream('el dólar')) {
      expect(e.type).toBe('step');
      break;
    }
    expect(await until(() => api.closedEarly === 1)).toBe(true);
  });

  test('aborting the signal stops reading the stream', async () => {
    api.next({ events: [{ event: 'step', data: { id: 'a', text: 'a', status: 'running', detail: null } }], hang: true });
    const controller = new AbortController();
    const seen: string[] = [];
    const e = await (async () => {
      for await (const ev of ts.searchStream('el dólar', {}, { signal: controller.signal })) {
        seen.push(ev.type);
        controller.abort();
      }
    })().catch((x: unknown) => x);
    expect(seen).toEqual(['step']);
    expect((e as Error).name).toBe('AbortError');
    expect(await until(() => api.closedEarly === 1)).toBe(true);
  });
});

describe('siteSearchStream', () => {
  test('POST /v1/search/site with stream: true, as events', async () => {
    const final = await ts.siteSearchStream('diarioejemplo.example', 'el dólar', { mode: 'normal' }).finalResponse();
    expect(api.last.path).toBe('/v1/search/site');
    expect(api.last.body).toEqual({ site: 'diarioejemplo.example', query: 'el dólar', mode: 'normal', stream: true });
    expect(final.site).toBe('diarioejemplo.example');
  });
});
