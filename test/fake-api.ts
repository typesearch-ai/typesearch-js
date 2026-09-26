/*
 * Una API falsa de typesearch, por HTTP de verdad, que cumple el contrato del OpenAPI:
 * valida cada pedido contra el esquema de su ruta (como la API, rechaza campos desconocidos con
 * 400 invalid_request) y cada respuesta que manda contra el esquema de la respuesta, así que las
 * pruebas fallan si el SDK manda algo que la API no acepta o si un ejemplo se aleja del contrato.
 *
 * `api.next(...)` encola respuestas armadas a mano (errores, 429, cortes de conexión, flujos rotos)
 * que se usan antes que las normales, en orden.
 */
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import type { Job, SearchResponse } from '../src/types.ts';

const openapi = JSON.parse(fs.readFileSync(new URL('../openapi/openapi.json', import.meta.url), 'utf8'));
const addFormats = addFormatsModule as unknown as (ajv: Ajv2020) => void;
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema({ $id: 'https://fake.typesearch.test/openapi', components: openapi.components });

function validator(nombre: string) {
  const v = ajv.getSchema(`https://fake.typesearch.test/openapi#/components/schemas/${nombre}`);
  if (!v) throw new Error(`Sin esquema ${nombre}`);
  return v;
}

export const KEY = 'ts_test_0123456789';

export interface Recorded {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: http.IncomingHttpHeaders;
  body: any;
}

export interface Scripted {
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
  /** Eventos SSE; con `raw`, el cuerpo tal cual (para probar el parser). */
  events?: { event: string; data: unknown }[];
  raw?: string;
  /** Corta la conexión sin responder. */
  destroy?: boolean;
  /** Espera antes de responder (para los tiempos de espera). */
  delayMs?: number;
  /** Deja el flujo abierto después de los eventos. */
  hang?: boolean;
}

// --- Ejemplos que cumplen el contrato ---------------------------------------------------------

export function result(n: number, extra: Record<string, unknown> = {}) {
  return {
    url: `https://diarioejemplo.example/economia/nota-${n}`,
    title: `El dólar cerró estable por ${n}ª rueda`,
    source: 'Diario Ejemplo',
    country: 'AR',
    language: 'es',
    published_at: '2026-09-21T18:05:00.000Z',
    section: 'economia',
    snippet: 'La divisa se mantuvo sin cambios frente al cierre anterior.',
    score: 0.96 - n / 100,
    headline_relevance: 0.91,
    read: null,
    highlights: [],
    tone: null,
    answers: null,
    duplicates: [],
    date_match: null,
    referenced_date: null,
    found_in: 'index',
    ...extra,
  };
}

export function searchResponse(extra: Partial<Record<keyof SearchResponse, unknown>> = {}): SearchResponse {
  return {
    id: 'req_fake0001',
    object: 'search',
    mode: 'fast',
    queries: ['el dólar'],
    found: true,
    total: 2,
    results: [result(1), result(2, { url: 'https://reddiaria.example/economia/nota-2', source: 'Red Diaria' })],
    groups: null,
    near_misses: [],
    rejected: [],
    diffusion: null,
    tone: null,
    essential: null,
    reference: null,
    temporal: null,
    site: null,
    index: null,
    usage: { tokens: 1840, calls: 2, cost_usd: 0, headlines: 160, from_memory: 12, pages_direct: 0, pages_browser: 0, duration_ms: 910 },
    budget: null,
    discovery: null,
    incomplete: false,
    cached_at: null,
    warnings: [],
    ...extra,
  } as SearchResponse;
}

function job(id: string, status: Job['status'], extra: Partial<Job> = {}): Job {
  return { id, object: 'job', status, created_at: '2026-09-22T14:03:11.000Z', finished_at: null, result: null, error: null, ...extra };
}

export function problem(status: number, code: string, extra: Record<string, unknown> = {}) {
  return { type: `urn:typesearch:error:${code}`, title: code, status, detail: `detail of ${code}`, code, request_id: 'req_fakeerr1', ...extra };
}

// --- El servidor --------------------------------------------------------------------------

export class FakeApi {
  readonly requests: Recorded[] = [];
  /** Conexiones que el cliente cerró antes de que terminara la respuesta. */
  closedEarly = 0;
  #queue: Scripted[] = [];
  #jobs = new Map<string, { polls: number; fail: boolean; site: string }>();
  #server: http.Server;
  url = '';

  constructor() {
    this.#server = http.createServer((req, res) => void this.#handle(req, res));
  }

  async start(): Promise<this> {
    await new Promise<void>((resolve) => this.#server.listen(0, '127.0.0.1', resolve));
    this.url = `http://127.0.0.1:${(this.#server.address() as AddressInfo).port}`;
    return this;
  }

  async close(): Promise<void> {
    this.#server.closeAllConnections?.();
    await new Promise<void>((resolve) => this.#server.close(() => resolve()));
  }

  next(...responses: Scripted[]): this {
    this.#queue.push(...responses);
    return this;
  }

  reset(): void {
    this.requests.length = 0;
    this.#queue.length = 0;
    this.#jobs.clear();
    this.closedEarly = 0;
  }

  get last(): Recorded {
    const r = this.requests[this.requests.length - 1];
    if (!r) throw new Error('Sin pedidos');
    return r;
  }

  async #handle(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://x');
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const text = Buffer.concat(chunks).toString('utf8');
    let body: any = undefined;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = text;
    }
    this.requests.push({ method: req.method ?? 'GET', path: url.pathname, query: url.searchParams, headers: req.headers, body });
    res.on('close', () => {
      if (!res.writableFinished) this.closedEarly++;
    });

    const scripted = this.#queue.shift();
    if (scripted) return this.#scripted(scripted, res);

    const auth = req.headers.authorization ?? (req.headers['x-api-key'] ? `Bearer ${req.headers['x-api-key']}` : undefined);
    if (!auth) return this.#json(res, 401, problem(401, 'missing_api_key'), 'Problem');
    if (auth !== `Bearer ${KEY}`) return this.#json(res, 401, problem(401, 'invalid_api_key'), 'Problem');

    const ruta = `${req.method} ${url.pathname}`;
    try {
      if (ruta === 'POST /v1/search') return this.#search(res, body, 'SearchRequest', 'search');
      if (ruta === 'POST /v1/similar') return this.#search(res, body, 'SimilarRequest', 'similar');
      if (ruta === 'POST /v1/search/site') return this.#site(res, body);
      if (ruta === 'POST /v1/contents') return this.#contents(res, body);
      if (req.method === 'GET' && url.pathname.startsWith('/v1/jobs/')) return this.#job(res, decodeURIComponent(url.pathname.slice(9)));
      if (ruta === 'GET /v1/usage') return this.#json(res, 200, usage(), 'Usage');
      return this.#json(res, 404, problem(404, 'not_found'), 'Problem');
    } catch (e) {
      return this.#json(res, 500, problem(500, 'fake_error', { detail: String(e) }), 'Problem');
    }
  }

  #invalid(res: http.ServerResponse, body: unknown, esquema: string): boolean {
    const v = validator(esquema);
    if (v(body)) return false;
    const errors = (v.errors ?? []).map((e) => ({ path: e.instancePath.replace(/^\//, '').replace(/\//g, '.') || '(body)', message: `${e.message}${e.params && 'additionalProperty' in e.params ? `: ${e.params.additionalProperty}` : ''}` }));
    this.#json(res, 400, problem(400, 'invalid_request', { detail: `${errors[0]?.path}: ${errors[0]?.message}`, errors }), 'Problem');
    return true;
  }

  #search(res: http.ServerResponse, body: any, esquema: string, object: 'search' | 'similar') {
    if (this.#invalid(res, body, esquema)) return;
    const queries = object === 'similar' ? [] : Array.isArray(body.query) ? body.query : [body.query];
    const r = searchResponse({
      object,
      mode: body.mode ?? 'normal',
      queries,
      reference: object === 'similar' ? { url: body.url, title: 'Inflación: qué esperan los analistas' } : null,
    });
    if (body.stream) return this.#stream(res, r);
    this.#json(res, 200, r, 'SearchResponse');
  }

  #site(res: http.ServerResponse, body: any) {
    if (this.#invalid(res, body, 'SiteSearchRequest')) return;
    const r = searchResponse({ object: 'site_search', mode: body.mode ?? 'normal', queries: [body.query], site: body.site, index: null });
    if (body.stream) return this.#stream(res, r);
    const id = `job_fake${this.#jobs.size + 1}`;
    this.#jobs.set(id, { polls: 0, fail: String(body.site).includes('fail'), site: body.site });
    this.#json(res, 202, job(id, 'queued'), 'Job', { Location: `/v1/jobs/${id}` });
  }

  #job(res: http.ServerResponse, id: string) {
    const j = this.#jobs.get(id);
    if (!j) return this.#json(res, 404, problem(404, 'job_not_found'), 'Problem');
    j.polls++;
    if (j.polls < 2) return this.#json(res, 200, job(id, 'running'), 'Job');
    if (j.fail) {
      return this.#json(res, 200, job(id, 'failed', { finished_at: '2026-09-22T14:03:39.000Z', error: problem(502, 'site_unreachable', { detail: 'The site did not answer.' }) as Job['error'] }), 'Job');
    }
    const r = searchResponse({ id, object: 'site_search', mode: 'normal', queries: ['el dólar'], site: j.site, index: null });
    this.#json(res, 200, job(id, 'succeeded', { finished_at: '2026-09-22T14:03:39.000Z', result: r }), 'Job');
  }

  #contents(res: http.ServerResponse, body: any) {
    if (this.#invalid(res, body, 'ContentsRequest')) return;
    const vacio = { title: null, description: null, published_at: null, source: null, excerpt: null, highlights: [], relevance: null };
    const results = (body.urls as string[]).map((u) =>
      u.includes('unreachable')
        ? { url: u, status: 'error', error: { code: 'site_unreachable', message: 'The site did not answer.' }, ...vacio }
        : {
            url: u,
            status: 'ok',
            error: null,
            title: 'Presupuesto 2027: las claves del proyecto',
            description: 'El Gobierno envió el proyecto al Congreso.',
            published_at: '2026-09-16T01:12:00.000Z',
            source: 'Red Diaria',
            excerpt: 'El proyecto prevé un superávit primario…',
            highlights: body.query ? ['El proyecto prevé un superávit primario…'] : [],
            relevance: body.query ? 0.97 : null,
          },
    );
    this.#json(res, 200, { id: 'req_fakecont', object: 'contents', results, usage: { tokens: 1320, calls: 1, cost_usd: 0, duration_ms: 1840 } }, 'ContentsResponse');
  }

  #stream(res: http.ServerResponse, final: SearchResponse) {
    const partial = { ...final, results: final.results.slice(0, 1), usage: { ...final.usage, cost_usd: null } };
    this.#sse(res, [
      { event: 'step', data: { id: 'juicio-indice', text: 'The model reads 160 headlines from the index', status: 'running', detail: null } },
      { event: 'partial', data: partial },
      { event: 'step', data: { id: 'juicio-indice', text: 'The model reads 160 headlines from the index', status: 'done', detail: null } },
      { event: 'result', data: final },
    ]);
  }

  #sse(res: http.ServerResponse, events: { event: string; data: unknown }[], hang = false) {
    for (const e of events) {
      if (e.event === 'partial' || e.event === 'result') check('SearchResponse', e.data);
      if (e.event === 'error') check('Problem', e.data);
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'X-Request-Id': 'req_fakesse1' });
    res.write(': latido\n\n');
    for (const e of events) res.write(`event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`);
    if (!hang) res.end();
  }

  #json(res: http.ServerResponse, status: number, body: unknown, esquema: string, headers: Record<string, string> = {}) {
    check(esquema, body);
    res.writeHead(status, {
      'Content-Type': status >= 400 ? 'application/problem+json; charset=utf-8' : 'application/json; charset=utf-8',
      'X-Request-Id': 'req_fake0001',
      'X-RateLimit-Limit': '600',
      ...headers,
    });
    res.end(JSON.stringify(body));
  }

  async #scripted(s: Scripted, res: http.ServerResponse) {
    if (s.delayMs) await new Promise((r) => setTimeout(r, s.delayMs));
    if (s.destroy) {
      res.socket?.destroy();
      return;
    }
    if (s.raw !== undefined) {
      res.writeHead(s.status ?? 200, { 'Content-Type': 'text/event-stream', ...s.headers });
      res.write(s.raw);
      if (!s.hang) res.end();
      return;
    }
    if (s.events) return this.#sse(res, s.events, s.hang);
    const status = s.status ?? 200;
    res.writeHead(status, { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json', 'X-Request-Id': 'req_fakescr1', ...s.headers });
    res.end(s.body === undefined ? '' : typeof s.body === 'string' ? s.body : JSON.stringify(s.body));
  }
}

function usage() {
  return {
    object: 'usage',
    key: { id: 'ts_live_Xk3P9qaB', name: 'Production' },
    limits: { tokens_per_day: 1000000, requests_per_minute: 600, requests_per_second: 10 },
    today: { requests: 412, tokens: 183920, cost_usd: 0.41, remaining_tokens: 816080 },
    last_30_days: { requests: 9120, tokens: 4102330, cost_usd: 9.12 },
    credit: { balance_usd: 42.6, plan: 'payg', spent_this_month_usd: 9.12, monthly_limit_usd: null },
    pricing: {
      currency: 'USD',
      // Precios de mentira: los reales están en typesearch.ai/pricing.
      per_1000_requests: { ultra: 0, fast: 0, normal: 0, deep: 0, similar: 0, similar_deep: 0, site_search: 0 },
      per_1000_pages: { contents: 0, contents_with_query: 0 },
    },
  };
}

/** Falla si un ejemplo no cumple el esquema del contrato. */
export function check(esquema: string, body: unknown): void {
  const v = validator(esquema);
  if (!v(body)) throw new Error(`El ejemplo no cumple ${esquema}: ${ajv.errorsText(v.errors)}`);
}
