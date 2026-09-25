/**
 * Search the news index and print each result with its calibrated score.
 *
 *   export TYPESEARCH_API_KEY=ts_live_…
 *   npx tsx examples/search.ts "central bank rates"
 */
import Typesearch from 'typesearch-js';

const ts = new Typesearch(); // reads TYPESEARCH_API_KEY

const query = process.argv[2] ?? 'inflation';
const res = await ts.search(query, {
  mode: 'fast', // ~1 s; 'ultra' (headlines only) costs less, 'normal' reads the top results before ranking them
  max_results: 5,
  days: 3,
  // include_domains: ['diarioejemplo.example'],
  // countries: ['US', 'GB'], languages: ['en'],
});

console.log(`${res.total} relevant articles for "${query}" (${res.usage.duration_ms} ms)`);
for (const r of res.results) {
  // score is a calibrated probability: 0.9 means about nine in ten such results are relevant.
  console.log(`${r.score.toFixed(2)}  ${r.title}  (${r.source ?? 'unknown source'}${r.country ? `, ${r.country}` : ''}, ${r.published_at?.slice(0, 10) ?? 'undated'})`);
  console.log(`      ${r.url}`);
}
if (!res.found) console.log('Nothing relevant. Closest:', res.near_misses.map((r) => r.title));
