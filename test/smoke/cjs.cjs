// Prueba de humo del paquete construido, como CommonJS: node test/smoke/cjs.cjs
const Typesearch = require('../../dist/cjs/index.js');
const { APIError, Typesearch: Named } = require('../../dist/cjs/index.js');

(async () => {
  if (Named !== Typesearch || Typesearch.default !== Typesearch) throw new Error('exports');
  const { check } = await import('./server.mjs');
  await check(Typesearch, APIError);
  console.log(`ok: typesearch-js ${Typesearch.VERSION} (CommonJS) en Node ${process.version}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
