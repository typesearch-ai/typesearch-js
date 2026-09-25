/**
 * Stream a deep search: print each step as it happens and the results as they are confirmed.
 *
 *   npx tsx examples/stream.ts "election polls"
 */
import Typesearch from 'typesearch-js';

const ts = new Typesearch();

const query = process.argv[2] ?? 'election polls';
const controller = new AbortController();
process.once('SIGINT', () => controller.abort()); // Ctrl-C stops the request

for await (const event of ts.searchStream(query, { mode: 'deep', max_results: 5 }, { signal: controller.signal })) {
  switch (event.type) {
    case 'step':
      if (event.step.status === 'running') console.log(`· ${event.step.text}`);
      break;
    case 'partial':
      console.log(`  ${event.response.results.length} results so far`);
      break;
    case 'result':
      console.log(`\n${event.response.total} relevant articles:`);
      for (const r of event.response.results) console.log(`${r.score.toFixed(2)}  ${r.title}  ${r.url}`);
  }
}
