// Después de compilar a CommonJS:
// - dist/cjs lleva su propio package.json para que Node lo lea como CommonJS aunque el paquete sea "type": "module";
// - `require('typesearch-js')` devuelve la clase, con el resto de lo exportado como propiedades, para que
//   funcionen `const Typesearch = require('typesearch-js')` y `const { APIError } = require('typesearch-js')`.
import fs from 'node:fs';

const dist = new URL('../dist/cjs/', import.meta.url);
fs.writeFileSync(new URL('package.json', dist), '{ "type": "commonjs" }\n');

const index = new URL('index.js', dist);
fs.appendFileSync(
  index,
  `
module.exports = Object.assign(exports.default, exports);
Object.defineProperty(module.exports, '__esModule', { value: true });
`,
);
