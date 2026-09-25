/**
 * Search, then get metadata and a short verbatim excerpt about the query for the top results.
 * `contents()` never returns the full text: at most one excerpt of up to 25 words per article.
 *
 *   npx tsx examples/contents.ts "energy prices"
 */
import Typesearch from 'typesearch-js';

const ts = new Typesearch();

const query = process.argv[2] ?? 'energy prices';
const { results } = await ts.search(query, { mode: 'fast', max_results: 3 });
if (results.length === 0) throw new Error(`Nothing found for "${query}"`);

const pages = await ts.contents(
  results.map((r) => r.url),
  { query }, // picks the excerpt about the query and scores each page's relevance
);

for (const page of pages.results) {
  if (page.status === 'error') {
    console.log(`✗ ${page.url}: ${page.error?.code}`);
    continue;
  }
  console.log(`${page.relevance?.toFixed(2) ?? '–'}  ${page.title} (${page.source})`);
  console.log(`      ${page.description ?? ''}`);
  for (const h of page.highlights) console.log(`      “${h}”`);
}
