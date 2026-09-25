# typesearch-js

The official TypeScript and JavaScript client for the [typesearch API](https://typesearch.ai/docs): news
search for AI agents, with a calibrated relevance score on every result.

```bash
npm install typesearch-js
```

Node 18+, Bun, Deno, Cloudflare Workers and other edge runtimes. No dependencies. ESM and CommonJS, fully
typed.

## Quickstart

Create a key in the [dashboard](https://app.typesearch.ai) and set it as `TYPESEARCH_API_KEY`:

```ts
import Typesearch from 'typesearch-js';

const ts = new Typesearch(); // reads TYPESEARCH_API_KEY

const res = await ts.search('inflation', { mode: 'fast', max_results: 5 });

for (const r of res.results) {
  console.log(r.score.toFixed(2), r.title, `(${r.source})`);
}
```

Every result carries a `score`: the calibrated probability that it is about your query. Threshold on it
directly — `0.9` means relevant, and anything between `0.35` and `0.65` means the model is undecided.

## Create a client

| Option | Default | |
| --- | --- | --- |
| `apiKey` | `TYPESEARCH_API_KEY` | Your key. `new Typesearch('ts_live_…')` works too. |
| `baseURL` | `https://api.typesearch.ai` | Or `TYPESEARCH_BASE_URL`. |
| `timeout` | `70000` | Milliseconds before a request is aborted. A `deep` search can take about a minute. |
| `maxRetries` | `2` | Retries on connection errors, `429 rate_limited` and `5xx`. |
| `defaultHeaders` | — | Headers sent with every request. |
| `fetch` | global `fetch` | A custom implementation, for proxies or tests. |

In runtimes without environment variables (Cloudflare Workers and other edge runtimes), pass `apiKey`
explicitly. Keep keys on the server: never ship one to a browser or a mobile app.

## What you can do

| Method | Endpoint | |
| --- | --- | --- |
| `search(query, options?)` | `POST /v1/search` | Search the index: one query, or up to five judged together. |
| `searchStream(query, options?)` | `POST /v1/search` | The same, as events: steps, partial results, the final result. |
| `similar(url, options?)` | `POST /v1/similar` | Articles about the same story as a URL. |
| `contents(urls, options?)` | `POST /v1/contents` | Metadata and a short verbatim excerpt of up to 10 URLs. |
| `siteSearch(site, query, options?)` | `POST /v1/search/site` | Search a live site. Returns a job. |
| `siteSearchAndWait(site, query, options?)` | `POST /v1/search/site` | The same, waiting for the result. |
| `siteSearchStream(site, query, options?)` | `POST /v1/search/site` | The same, as events. |
| `jobs.get(id)` · `jobs.wait(id)` | `GET /v1/jobs/{id}` | A job's status and result. |
| `sources()` · `sources({ domain })` | `GET /v1/sources` | Coverage by country and language, or whether one domain is covered. |
| `usage()` | `GET /v1/usage` | Usage, limits and credit of your key. |

Options and response fields have the same names as the [HTTP API](https://typesearch.ai/docs/api-reference)
(snake_case) and are typed from its OpenAPI document: `SearchOptions`, `SearchResponse`, `Result`,
`ContentsResponse`, `Job` and the rest are exported.

### Search

```ts
const res = await ts.search('el dólar', {
  mode: 'normal', // 'ultra' | 'fast' | 'normal' | 'deep'
  max_results: 10,
  include_domains: ['reddiaria.example', 'diarioejemplo.example'],
  published_after: '2026-09-20', // or a Date
  highlights: true,
});

// Several queries at once, judged together
const multi = await ts.search(['el dólar', 'el FMI'], { mode: 'fast' });
multi.groups?.forEach((g) => console.log(g.query, g.total));
```

`days: null` searches the whole index; leaving `days` out keeps the default of 7. Add `questions` for
typed answers on every result, and `tone`, `dedupe` or `essential` for enrichments — see the
[guides](https://typesearch.ai/docs/guides/structured-output).

### Stream

```ts
for await (const event of ts.searchStream('el dólar', { mode: 'deep' })) {
  if (event.type === 'step') console.log('·', event.step.text);
  if (event.type === 'partial') render(event.response.results);
  if (event.type === 'result') render(event.response.results);
}

// Or only the final result
const final = await ts.searchStream('el dólar').finalResponse();
```

The request starts when you start iterating. An `error` event is thrown as an [`APIError`](#errors);
breaking out of the loop, or aborting the `signal`, closes the connection.

### Similar and contents

```ts
const similar = await ts.similar('https://diarioejemplo.example/economia/…', {
  exclude_domains: ['diarioejemplo.example'],
});

const pages = await ts.contents(['https://reddiaria.example/economia/…'], { query: 'el dólar' });
for (const page of pages.results) {
  if (page.status === 'ok') console.log(page.relevance, page.title, page.highlights);
  else console.log(page.url, page.error?.code);
}
```

`contents()` never returns the full text: at most one excerpt of up to 25 words per article.

### Live site search

```ts
// Create the job and wait for it
const res = await ts.siteSearchAndWait('diarioejemplo.example', 'el dólar', { mode: 'normal' });

// Or handle the job yourself
const job = await ts.siteSearch('diarioejemplo.example', 'el dólar');
const done = await ts.jobs.wait(job.id, { pollInterval: 2000, waitTimeout: 120_000 });

// Or stream it
for await (const event of ts.siteSearchStream('diarioejemplo.example', 'el dólar')) {
  // …
}
```

`jobs.wait()` resolves with the job's result and throws `JobFailedError` if the job fails.

### Coverage and usage

```ts
const coverage = await ts.sources(); // sources and articles, by country and language

const site = await ts.sources({ domain: 'diarioejemplo.example' });
if (site.covered) console.log(site.name, site.articles);

const usage = await ts.usage();
console.log(usage.today.remaining_tokens, usage.limits.requests_per_minute);
```

## Errors

Every error extends `TypesearchError`. API errors are `APIError` subclasses with `status`, `code` (stable,
for programs), `requestId` and, for invalid requests, `errors` per field.

| Class | When |
| --- | --- |
| `BadRequestError` | 400 |
| `AuthenticationError` | 401 |
| `BudgetError` | 402 — `budget_too_small`, `insufficient_credits` or `spend_limit_reached` |
| `PermissionDeniedError` | 403 |
| `NotFoundError` | 404 |
| `RateLimitError` | 429 — with `retryAfter` |
| `InternalServerError` | 5xx |
| `APIConnectionError` · `APITimeoutError` | No response, or too slow |
| `JobFailedError` | A live site search job failed |

```ts
import { BadRequestError, RateLimitError, APIError } from 'typesearch-js';

try {
  await ts.search('x');
} catch (e) {
  if (e instanceof BadRequestError) console.log(e.code, e.errors);
  else if (e instanceof RateLimitError) console.log(e.code, e.retryAfter);
  else if (e instanceof APIError) console.log(e.status, e.code, e.requestId);
  else throw e;
}
```

## Retries, timeouts and cancelling

Connection errors, timeouts, `429 rate_limited` and `5xx` are retried twice with exponential backoff and
jitter, honouring `Retry-After`; `quota_exceeded` never is. Every method takes a last argument to
override the client's settings per request:

```ts
const controller = new AbortController();

const res = await ts.search('el dólar', { mode: 'deep' }, {
  timeout: 90_000,
  maxRetries: 0,
  signal: controller.signal,
  headers: { 'X-Trace-Id': 'abc' },
});
```

For a stream, `timeout` covers the wait until the response starts; aborting the signal also stops reading
it.

## Examples

[`examples/`](examples) has three short scripts: [search](examples/search.ts),
[contents](examples/contents.ts) and [streaming](examples/stream.ts).

## Development

```bash
npm ci
npm run generate            # types from openapi/openapi.json (-- --fetch to pull the live one first)
npm run lint                # typecheck, and generated types up to date
npm test                    # against a fake API that validates every request against the OpenAPI
npm run test:live           # against the real API: needs TYPESEARCH_API_KEY (spends less than a cent)
npm run build && npm run smoke
```

## License

[MIT](LICENSE)
