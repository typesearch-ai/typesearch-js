// Prueba de humo del paquete construido, como ESM: node test/smoke/esm.mjs (también bun y deno).
import Typesearch, { APIError, VERSION } from '../../dist/esm/index.js';
import { check } from './server.mjs';

await check(Typesearch, APIError);
console.log(`ok: typesearch-js ${VERSION} (ESM) en ${globalThis.Deno ? 'Deno' : globalThis.Bun ? 'Bun' : `Node ${process.version}`}`);
