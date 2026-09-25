/*
 * Contra la API de verdad: corre sólo con `npm run test:live` y TYPESEARCH_API_KEY en el entorno (con
 * `npm test` se saltea aunque haya clave, para no gastar sin querer).
 * Gasta muy poco: dos búsquedas `fast` de 3 resultados y el contenido de una URL; `sources` y
 * `usage` no cobran. Con TYPESEARCH_LIVE_FULL=1 suma `similar` y una búsqueda en un sitio en vivo.
 * TYPESEARCH_BASE_URL apunta a otra API (local o de prueba).
 */
import { describe, expect, test } from 'vitest';
import Typesearch, { AuthenticationError, BadRequestError } from '../src/index.ts';

const key = process.env.TYPESEARCH_LIVE === '1' ? process.env.TYPESEARCH_API_KEY : undefined;
const full = process.env.TYPESEARCH_LIVE_FULL === '1';

describe.skipIf(!key)('live API', () => {
  // Sin clave el bloque se saltea, pero su cuerpo igual se ejecuta al juntar las pruebas.
  const ts = key ? new Typesearch({ apiKey: key }) : (undefined as never);

  test('usage and coverage (free)', async () => {
    const usage = await ts.usage();
    expect(usage.object).toBe('usage');
    expect(usage.limits.requests_per_minute).toBeGreaterThan(0);
    const coverage = await ts.sources();
    expect(coverage.total).toBeGreaterThan(0);
    const one = await ts.sources({ domain: 'example.com' });
    expect(one.object).toBe('source');
  });

  let url: string | undefined;

  test('search, fast', async () => {
    const res = await ts.search('inflación', { mode: 'fast', max_results: 3, days: 7 });
    expect(res.object).toBe('search');
    expect(res.results.length).toBeLessThanOrEqual(3);
    for (const r of res.results) {
      expect(r.score).toBeGreaterThanOrEqual(0.5);
      expect(r.url).toMatch(/^https?:\/\//);
    }
    url = res.results[0]?.url;
  }, 60_000);

  test('stream, fast', async () => {
    const types = new Set<string>();
    const stream = ts.searchStream('inflación', { mode: 'fast', max_results: 3, days: 7 });
    for await (const e of stream) types.add(e.type);
    expect(types.has('result')).toBe(true);
  }, 60_000);

  test('contents of a result', async () => {
    if (!url) return;
    const res = await ts.contents([url]);
    expect(res.results[0]?.url).toBe(url);
  }, 60_000);

  test('an invalid request and a wrong key are typed errors', async () => {
    await expect(ts.search('x')).rejects.toBeInstanceOf(BadRequestError);
    await expect(new Typesearch({ apiKey: 'ts_live_invalid' }).usage()).rejects.toBeInstanceOf(AuthenticationError);
  });

  test.skipIf(!full)('similar and a live site search', async () => {
    if (url) {
      const similar = await ts.similar(url, { mode: 'fast', max_results: 3 });
      expect(similar.object).toBe('similar');
    }
    const site = await ts.siteSearchAndWait(new URL(url ?? 'https://example.com').hostname, 'economía', { mode: 'fast', max_results: 3 });
    expect(site.object).toBe('site_search');
  }, 180_000);
});
