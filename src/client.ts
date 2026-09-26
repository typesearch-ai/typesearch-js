import {
  APIConnectionError,
  APITimeoutError,
  JobFailedError,
  TypesearchError,
  errorFor,
  retryAfterMs,
} from './errors.ts';
import { SearchStream, type OpenStream } from './stream.ts';
import type {
  ContentsOptions,
  ContentsResponse,
  Job,
  Problem,
  SearchOptions,
  SearchResponse,
  SimilarOptions,
  SimilarResponse,
  SiteSearchOptions,
  SiteSearchResponse,
  Usage,
} from './types.ts';
import { VERSION } from './version.ts';

export const DEFAULT_BASE_URL = 'https://api.typesearch.ai';
const DEFAULT_TIMEOUT = 70_000; // a deep search can take about a minute
const DEFAULT_MAX_RETRIES = 2;

export interface ClientOptions {
  /** Your API key. Defaults to the `TYPESEARCH_API_KEY` environment variable. */
  apiKey?: string;
  /** Defaults to `TYPESEARCH_BASE_URL`, or `https://api.typesearch.ai`. */
  baseURL?: string;
  /** Milliseconds before a request is aborted. Defaults to 70 000: a `deep` search can take about a minute. */
  timeout?: number;
  /** Retries on connection errors, `429 rate_limited` and `5xx`. Defaults to 2. */
  maxRetries?: number;
  /** Headers sent with every request. */
  defaultHeaders?: Record<string, string>;
  /** A custom `fetch`, for proxies, tests or older runtimes. Defaults to the global one. */
  fetch?: typeof fetch;
}

/** Per-request settings: the last argument of every method. */
export interface RequestOptions {
  /** Aborts the request, and stops reading a stream. */
  signal?: AbortSignal;
  /** Milliseconds before the request is aborted. For a stream, until the response starts. */
  timeout?: number;
  maxRetries?: number;
  /** Extra headers for this request. */
  headers?: Record<string, string>;
}

export interface WaitOptions extends RequestOptions {
  /** Milliseconds between polls. Defaults to 2000. */
  pollInterval?: number;
  /** Milliseconds to wait for the job in total before throwing `APITimeoutError`. Defaults to 120 000. */
  waitTimeout?: number;
}

type Method = 'GET' | 'POST';

/**
 * The typesearch API client.
 *
 * ```ts
 * import Typesearch from 'typesearch-js';
 *
 * const ts = new Typesearch(); // reads TYPESEARCH_API_KEY
 * const res = await ts.search('el dólar', { mode: 'fast', max_results: 5 });
 * for (const r of res.results) console.log(r.score.toFixed(2), r.title, r.source);
 * ```
 */
export class Typesearch {
  readonly baseURL: string;
  readonly timeout: number;
  readonly maxRetries: number;
  /** Live site search jobs: `get()` and `wait()`. */
  readonly jobs: Jobs;
  #apiKey: string;
  #headers: Record<string, string>;
  #fetch: typeof fetch;

  /**
   * @param options Client options, or just the API key: `new Typesearch('ts_live_…')`.
   * @param more When the first argument is the key: more options, or the base URL (like `new Exa(key, baseURL)`).
   */
  constructor(options: ClientOptions | string = {}, more?: ClientOptions | string) {
    const o: ClientOptions =
      typeof options === 'string' ? { ...(typeof more === 'string' ? { baseURL: more } : more), apiKey: options } : options;
    const apiKey = o.apiKey ?? readEnv('TYPESEARCH_API_KEY');
    if (!apiKey) {
      throw new TypesearchError(
        'Missing API key: pass `apiKey` or set the TYPESEARCH_API_KEY environment variable. Get one at https://app.typesearch.ai',
      );
    }
    this.#apiKey = apiKey;
    this.baseURL = (o.baseURL ?? readEnv('TYPESEARCH_BASE_URL') ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeout = o.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = o.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.#headers = lowercase(o.defaultHeaders);
    const f = o.fetch ?? globalThis.fetch;
    if (typeof f !== 'function') throw new TypesearchError('No `fetch` available: use Node 18+ or pass `fetch` in the options.');
    this.#fetch = o.fetch ? f : f.bind(globalThis);
    this.jobs = new Jobs(this);
  }

  // --- Endpoints ---------------------------------------------------------------------------

  /**
   * Searches the index: one query, or up to five judged together (results merged, plus one entry per
   * query in `groups`). Every result has a calibrated `score`.
   *
   * @see https://typesearch.ai/docs/api-reference/search
   */
  search(query: string | string[], options: SearchOptions = {}, request?: RequestOptions): Promise<SearchResponse> {
    return this.post('/v1/search', { query, ...body(options) }, request);
  }

  /**
   * The same search as a stream of events: `step`, `partial` (results so far) and `result`.
   *
   * @see https://typesearch.ai/docs/guides/streaming
   */
  searchStream(query: string | string[], options: SearchOptions = {}, request?: RequestOptions): SearchStream {
    return new SearchStream(() => this.openStream('/v1/search', { query, ...body(options), stream: true }, request));
  }

  /**
   * Articles in the index about the same story as a URL. The response has the shape of a search, with
   * the reference article in `reference`.
   *
   * @see https://typesearch.ai/docs/api-reference/similar
   */
  similar(url: string, options: SimilarOptions = {}, request?: RequestOptions): Promise<SimilarResponse> {
    return this.post('/v1/similar', { url, ...body(options) }, request);
  }

  /**
   * Metadata and a short verbatim excerpt of up to 10 URLs — never the full text. With a `query`, the
   * excerpt about it and each page's `relevance`. Each URL has its own `status`.
   *
   * @see https://typesearch.ai/docs/api-reference/contents
   */
  contents(urls: string | string[], options: ContentsOptions = {}, request?: RequestOptions): Promise<ContentsResponse> {
    return this.post('/v1/contents', { urls: Array.isArray(urls) ? urls : [urls], ...body(options) }, request);
  }

  /**
   * Searches a live site: its homepage, its sections and its own search box. It can take up to a
   * minute, so it returns a job: wait for it with `jobs.wait()`, or use `siteSearchAndWait()`.
   *
   * @see https://typesearch.ai/docs/api-reference/site-search
   */
  siteSearch(site: string, query: string, options: SiteSearchOptions = {}, request?: RequestOptions): Promise<Job> {
    return this.post('/v1/search/site', { site, query, ...body(options) }, request);
  }

  /** `siteSearch()`, then waits for the job and returns its result. Throws `JobFailedError` if it fails. */
  async siteSearchAndWait(
    site: string,
    query: string,
    options: SiteSearchOptions = {},
    request: WaitOptions = {},
  ): Promise<SiteSearchResponse> {
    const job = await this.siteSearch(site, query, options, request);
    return this.jobs.wait(job.id, request);
  }

  /** A live site search as a stream of events, instead of a job. */
  siteSearchStream(site: string, query: string, options: SiteSearchOptions = {}, request?: RequestOptions): SearchStream {
    return new SearchStream(() => this.openStream('/v1/search/site', { site, query, ...body(options), stream: true }, request));
  }

  /** Usage today and over the last 30 days, the limits of this key, its credit and the price list. */
  usage(request?: RequestOptions): Promise<Usage> {
    return this.send('GET', '/v1/usage', undefined, request);
  }

  // --- Transport ---------------------------------------------------------------------------

  /** @internal */
  post<T>(path: string, data: Record<string, unknown>, request?: RequestOptions): Promise<T> {
    return this.send('POST', path, data, request);
  }

  /** @internal Sends a request, with retries, and returns the parsed JSON body. */
  async send<T>(method: Method, path: string, data: unknown, request: RequestOptions = {}): Promise<T> {
    const text = await this.attempts(method, path, data, request, false);
    try {
      return JSON.parse(text) as T;
    } catch (cause) {
      throw new TypesearchError(`The API answered ${method} ${path} with a body that is not JSON.`, { cause });
    }
  }

  /** @internal Opens a Server-Sent Events response, with retries until it starts. */
  openStream(path: string, data: unknown, request: RequestOptions = {}): Promise<OpenStream> {
    return this.attempts('POST', path, data, request, true);
  }

  private async attempts(method: Method, path: string, data: unknown, request: RequestOptions, stream: false): Promise<string>;
  private async attempts(method: Method, path: string, data: unknown, request: RequestOptions, stream: true): Promise<OpenStream>;
  private async attempts(method: Method, path: string, data: unknown, request: RequestOptions, stream: boolean): Promise<string | OpenStream> {
    const maxRetries = request.maxRetries ?? this.maxRetries;
    const timeout = request.timeout ?? this.timeout;
    const signal = request.signal;
    const headers: Record<string, string> = {
      accept: stream ? 'text/event-stream' : 'application/json',
      authorization: `Bearer ${this.#apiKey}`,
      'user-agent': `typesearch-js/${VERSION}`,
      ...(data === undefined ? {} : { 'content-type': 'application/json' }),
      ...this.#headers,
      ...lowercase(request.headers),
    };
    const init: RequestInit = { method, headers, body: data === undefined ? undefined : JSON.stringify(data) };

    for (let attempt = 0; ; attempt++) {
      if (signal?.aborted) throw signal.reason;
      // One controller per attempt, fed by the caller's signal and the timeout. No AbortSignal.any():
      // with AbortSignal.timeout() inside, the timer can be garbage-collected and never fire.
      const controller = new AbortController();
      const onAbort = () => controller.abort(signal?.reason);
      signal?.addEventListener('abort', onAbort, { once: true });
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeout);
      const done = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      };

      let failure: unknown;
      let wait: number | null = null;
      try {
        const response = await this.#fetch(`${this.baseURL}${path}`, { ...init, signal: controller.signal });
        if (response.ok) {
          if (stream) {
            clearTimeout(timer); // a stream only times out while it waits for the response to start
            return { response, release: () => signal?.removeEventListener('abort', onAbort) };
          }
          const text = await response.text();
          done();
          return text;
        }
        const problem = await readProblem(response);
        done();
        const error = errorFor(response.status, problem, response.headers);
        if (!retriable(response.status, error.code)) throw error;
        failure = error;
        wait = retryAfterMs(response.headers);
      } catch (error) {
        done();
        if (signal?.aborted) throw signal.reason;
        if (error instanceof TypesearchError && failure !== error) throw error;
        if (failure === undefined) {
          failure = timedOut
            ? new APITimeoutError(`Request timed out after ${timeout} ms.`, { cause: error })
            : new APIConnectionError('Could not reach the typesearch API.', { cause: error });
        }
      }
      if (attempt >= maxRetries) throw failure;
      await sleep(delay(attempt, wait), signal);
    }
  }
}

/** Live site search jobs. */
export class Jobs {
  #client: Typesearch;

  /** @internal */
  constructor(client: Typesearch) {
    this.#client = client;
  }

  /**
   * A job's status and, when it succeeded, its `result`. Jobs last one day and are only visible to the
   * key that created them.
   */
  get(id: string, request?: RequestOptions): Promise<Job> {
    return this.#client.send('GET', `/v1/jobs/${encodeURIComponent(id)}`, undefined, request);
  }

  /** Polls a job until it finishes. Resolves with its result, or throws `JobFailedError`. */
  async wait(id: string, options: WaitOptions = {}): Promise<SiteSearchResponse> {
    const interval = options.pollInterval ?? 2000;
    const deadline = Date.now() + (options.waitTimeout ?? 120_000);
    while (true) {
      const job = await this.get(id, options);
      if (job.status === 'succeeded' && job.result) return job.result;
      if (job.status === 'failed') throw new JobFailedError(job);
      if (Date.now() + interval > deadline) {
        throw new APITimeoutError(`Job ${id} did not finish in time (last status: ${job.status}).`);
      }
      await sleep(interval, options.signal);
    }
  }
}

// --- Helpers ---------------------------------------------------------------------------------

/** 408, 409, 429 and 5xx are retried; the daily quota is not: it resets at 00:00 UTC. */
function retriable(status: number, code: string): boolean {
  if (code === 'quota_exceeded') return false;
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

/** `Retry-After` when it asks for up to a minute; otherwise exponential backoff with jitter (0.5 s, 1 s, 2 s… up to 8 s). */
function delay(attempt: number, retryAfter: number | null): number {
  if (retryAfter !== null && retryAfter <= 60_000) return retryAfter;
  return Math.min(500 * 2 ** attempt, 8000) * (1 - Math.random() * 0.25);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** The request body: dates as ISO strings and without `undefined` fields. */
function body(options: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(options)) {
    if (v === undefined) continue;
    out[k] = v instanceof Date ? v.toISOString() : v;
  }
  return out;
}

async function readProblem(response: Response): Promise<Partial<Problem>> {
  try {
    const text = await response.text();
    const parsed: unknown = text ? JSON.parse(text) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Partial<Problem>) : {};
  } catch {
    return {};
  }
}

function lowercase(headers: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers ?? {})) if (v !== undefined && v !== null) out[k.toLowerCase()] = v;
  return out;
}

/** An environment variable in Node, Bun or Deno; `undefined` in runtimes without one (edge). */
function readEnv(name: string): string | undefined {
  const g = globalThis as {
    process?: { env?: Record<string, string | undefined> };
    Deno?: { env?: { get?: (name: string) => string | undefined } };
  };
  try {
    const value = g.process?.env?.[name]?.trim();
    if (value) return value;
  } catch {}
  try {
    const value = g.Deno?.env?.get?.(name)?.trim();
    if (value) return value;
  } catch {}
  return undefined;
}
