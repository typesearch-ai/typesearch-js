#!/usr/bin/env node
/*
 * Genera src/generated.ts a partir del OpenAPI de la API.
 *
 *   node scripts/generate-types.mjs              desde la copia de openapi/openapi.json
 *   node scripts/generate-types.mjs --fetch      baja el OpenAPI vivo, actualiza la copia y regenera
 *   node scripts/generate-types.mjs --from <archivo|url>   desde otro OpenAPI (una rama de la API, por ejemplo)
 *   node scripts/generate-types.mjs --check      falla si src/generated.ts no coincide con la copia
 *
 * El OpenAPI de la API define cada respuesta entera, sin $ref: el mismo resultado aparece en `results`,
 * `groups[].results`, `near_misses`… Acá cada objeto se identifica por su forma (sin descripciones ni
 * límites) y se declara una sola vez, con el nombre de NOMBRES según dónde aparece primero. Un objeto nuevo
 * que no esté en NOMBRES recibe un nombre armado con la ruta y un aviso: conviene agregarlo a la tabla.
 *
 * Sin dependencias: corre con Node 18+.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COPIA = path.join(RAIZ, 'openapi/openapi.json');
const SALIDA = path.join(RAIZ, 'src/generated.ts');
const VIVO = 'https://api.typesearch.ai/v1/openapi.json';

// Las piezas del contrato, en el orden en que se declaran.
const COMPONENTES = [
  'SearchRequest',
  'SimilarRequest',
  'SiteSearchRequest',
  'ContentsRequest',
  'SearchResponse',
  'ContentsResponse',
  'Problem',
  'Job',
  'Usage',
];

// Las opciones que recibe cada método: el cuerpo del pedido sin los argumentos posicionales.
const OPCIONES = {
  SearchRequest: { nombre: 'SearchOptions', sin: ['query', 'stream'], docu: 'Options for `search()` and `searchStream()`: every field of `POST /v1/search` but `query`.' },
  SimilarRequest: { nombre: 'SimilarOptions', sin: ['url'], docu: 'Options for `similar()`: every field of `POST /v1/similar` but `url`.' },
  SiteSearchRequest: { nombre: 'SiteSearchOptions', sin: ['site', 'query', 'stream'], docu: 'Options for `siteSearch()`: every field of `POST /v1/search/site` but `site` and `query`.' },
  ContentsRequest: { nombre: 'ContentsOptions', sin: ['urls'], docu: 'Options for `contents()`: every field of `POST /v1/contents` but `urls`.' },
};

// Ruta donde aparece un objeto (o una enumeración) por primera vez → su nombre público.
// `[]` es un elemento de lista, `{}` un valor de mapa y `<x>` la variante de una unión con `type: "x"`.
const NOMBRES = {
  'SearchRequest.mode': 'Mode',
  'SearchRequest.questions{}': 'Question',
  'SearchRequest.questions{}<boolean>': 'BooleanQuestion',
  'SearchRequest.questions{}<boolean>.criteria': 'BooleanCriteria',
  'SearchRequest.questions{}<choice>': 'ChoiceQuestion',
  'SearchRequest.questions{}<score>': 'ScoreQuestion',
  'SearchResponse.mode': 'Mode',
  'SearchResponse.results[]': 'Result',
  'SearchResponse.results[].read': 'Reading',
  'SearchResponse.results[].tone': 'ResultTone',
  'SearchResponse.results[].answers': 'Answers',
  'SearchResponse.results[].answers.values{}': 'Answer',
  'SearchResponse.results[].answers.values{}<boolean>': 'BooleanAnswer',
  'SearchResponse.results[].answers.values{}<choice>': 'ChoiceAnswer',
  'SearchResponse.results[].answers.values{}<score>': 'ScoreAnswer',
  'SearchResponse.results[].duplicates[]': 'Duplicate',
  'SearchResponse.groups[]': 'QueryGroup',
  'SearchResponse.groups[].diffusion': 'Diffusion',
  'SearchResponse.groups[].diffusion.by_day[]': 'DiffusionDay',
  'SearchResponse.groups[].diffusion.by_source[]': 'DiffusionSource',
  'SearchResponse.groups[].diffusion.first': 'FirstPublication',
  'SearchResponse.groups[].tone': 'ToneSummary',
  'SearchResponse.groups[].tone.overall': 'ToneCounts',
  'SearchResponse.groups[].tone.by_source[]': 'SourceTone',
  'SearchResponse.groups[].essential': 'Essential',
  'SearchResponse.groups[].essential.excerpts[]': 'EssentialExcerpt',
  'SearchResponse.groups[].temporal': 'QueryDate',
  'SearchResponse.groups[].temporal.window': 'DateWindow',
  'SearchResponse.reference': 'Reference',
  'SearchResponse.index': 'IndexInfo',
  'SearchResponse.usage': 'SearchUsage',
  'SearchResponse.budget': 'Budget',
  'SearchResponse.discovery': 'Discovery',
  'SearchResponse.warnings[]': 'ResponseWarning',
  'ContentsResponse.results[]': 'ContentsResult',
  'ContentsResponse.results[].error': 'ContentsError',
  'ContentsResponse.usage': 'ContentsUsage',
  'Problem.errors[]': 'FieldError',
  'Usage.key': 'UsageKey',
  'Usage.limits': 'UsageLimits',
  'Usage.today': 'UsageToday',
  'Usage.last_30_days': 'UsagePeriod',
  'Usage.credit': 'Credit',
  'Usage.pricing': 'Pricing',
  'Usage.pricing.per_1000_requests': 'RequestPricing',
  'Usage.pricing.per_1000_pages': 'PagePricing',
};

// Descripciones para los campos que el OpenAPI todavía no describe (se usan sólo si falta la suya).
const DOCS = {
  'Result.url': 'The article URL.',
  'Result.title': 'The headline.',
  'Result.source': 'The outlet that published it.',
  'Result.published_at': 'Publication date-time (ISO 8601, UTC), when known.',
  'Result.section': 'The section the outlet declares, or the first segment of the URL path.',
  'Result.headline_relevance': 'Probability that the headline alone is about the query.',
  'Result.read': 'Set when the article was opened and read: its probability and how central the topic is (0–3).',
  'Result.highlights': 'Short verbatim excerpts about the query (up to 25 words), from articles that were read.',
  'Result.tone': 'Tone relative to the query, when `tone: true`.',
  'Result.answers': 'Answers to your `questions`, when you asked some.',
  'Result.duplicates': 'The same story from other outlets, when `dedupe: true`.',
  'SearchResponse.id': 'The request id, also in the `X-Request-Id` header.',
  'SearchResponse.found': 'Whether any result scored 0.5 or more.',
  'SearchResponse.total': 'How many relevant articles exist; it can be more than `max_results`.',
  'SearchResponse.results': 'The relevant articles, most relevant first.',
  'SearchResponse.diffusion': 'Articles per day and per source, and who published first.',
  'SearchResponse.tone': 'Tone counts overall and by source, when `tone: true`.',
  'SearchResponse.essential': 'Up to three verbatim excerpts that capture the story, when `essential` is on.',
  'SearchResponse.reference': 'The reference article, in a `similar` response.',
  'SearchResponse.site': 'The site searched, in a live site search.',
  'SearchResponse.usage': 'Model tokens, calls, time and what this request was billed (`cost_usd`).',
  'SearchResponse.budget': 'The `max_tokens` cap and how much of it was used.',
  'SearchResponse.cached_at': 'When the cached result was computed; `null` if it was computed now.',
  'SearchResponse.warnings': 'Things that did not stop the request, such as a domain that is not indexed.',
  'ContentsResult.status': '`ok`, or `error` with the reason in `error`. One URL failing never fails the request.',
  'ContentsResult.excerpt': 'A short verbatim excerpt (up to 25 words, never from the first paragraph).',
  'ContentsResult.relevance': 'With a `query`: probability that the page is about it.',
  'Job.status': '`queued`, `running`, `succeeded` (with `result`) or `failed` (with `error`).',
  'Job.result': 'The search response, once the job succeeded.',
  'Job.error': 'The problem details, if the job failed.',
  'Usage.today': 'Since 00:00 UTC.',
  'Usage.credit': 'The prepaid credit of the organization.',
  'Usage.pricing': 'The price list, in USD per 1,000 requests or pages.',
};

// --- Entrada -------------------------------------------------------------------------------

const argumentos = process.argv.slice(2);
const opcion = (nombre) => argumentos.includes(nombre);
const valor = (nombre) => {
  const i = argumentos.indexOf(nombre);
  return i === -1 ? undefined : argumentos[i + 1];
};

async function leer(origen) {
  if (/^https?:\/\//.test(origen)) {
    const r = await fetch(origen, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`${origen}: HTTP ${r.status}`);
    return await r.text();
  }
  return fs.readFileSync(origen, 'utf8');
}

let texto;
if (opcion('--fetch')) {
  texto = JSON.stringify(JSON.parse(await leer(VIVO)), null, 2) + '\n';
  fs.writeFileSync(COPIA, texto);
} else {
  texto = await leer(valor('--from') ?? COPIA);
}
const spec = JSON.parse(texto);
const esquemas = spec.components.schemas;

// --- Forma de un esquema ---------------------------------------------------------------------

const SIN_FORMA = new Set(['description', 'title', 'examples', 'default', 'pattern', 'format', 'minLength', 'maxLength', 'minimum', 'maximum', 'minItems', 'maxItems', 'propertyNames', 'additionalProperties']);

/** Un valor JSON cualquiera: los `*___schemaN` recursivos que genera zod. */
const esJson = (nombre) => /___schema\d+$/.test(nombre);

function forma(e) {
  if (!e || typeof e !== 'object') return e;
  if (Array.isArray(e)) return e.map(forma);
  if (e.$ref) {
    const n = e.$ref.split('/').pop();
    return esJson(n) ? { json: true } : forma(esquemas[n]);
  }
  const f = {};
  for (const [k, v] of Object.entries(e).sort(([a], [b]) => a.localeCompare(b))) {
    if (k === 'properties') f.properties = Object.fromEntries(Object.entries(v).map(([p, s]) => [p, forma(s)]));
    else if (k === 'additionalProperties') f.additionalProperties = typeof v === 'object' ? forma(v) : v;
    else if (k === 'propertyNames') f.propertyNames = v.enum ? { enum: v.enum } : undefined;
    else if (!SIN_FORMA.has(k)) f[k] = forma(v);
  }
  return f;
}
const clave = (e) => JSON.stringify(forma(e));

// --- Tipos -------------------------------------------------------------------------------------

const declaraciones = new Map(); // nombre → texto (null mientras se arma)
const porForma = new Map(); // forma → nombre
const avisos = [];

const pascal = (s) => s.replace(/(^|[_\-\s.]+)(\w)/g, (_, __, c) => c.toUpperCase()).replace(/[^\w]/g, '');
const clavePropiedad = (p) => (/^[A-Za-z_$][\w$]*$/.test(p) ? p : JSON.stringify(p));
const envolver = (t) => (/[|&]/.test(t) ? `(${t})` : t);

function nombrar(ruta) {
  if (NOMBRES[ruta]) return NOMBRES[ruta];
  const [raiz, ...resto] = ruta.split('.');
  const ultimo = resto.length ? resto[resto.length - 1] : '';
  const nombre = pascal(raiz) + pascal(ultimo.replace(/\[\]|\{\}|<.*>/g, ''));
  avisos.push(`Sin nombre en NOMBRES: ${ruta} → ${nombre}`);
  return nombre;
}

function reservar(nombre) {
  let n = nombre;
  for (let i = 2; declaraciones.has(n); i++) n = `${nombre}${i}`;
  if (n !== nombre) avisos.push(`Nombre repetido: ${nombre} → ${n}`);
  declaraciones.set(n, null);
  return n;
}

function doc(texto, sangria = '') {
  if (!texto) return '';
  const lineas = texto.replace(/\*\//g, '*\\/').split('\n');
  if (lineas.length === 1) return `${sangria}/** ${lineas[0]} */\n`;
  return `${sangria}/**\n${lineas.map((l) => `${sangria} * ${l}`).join('\n')}\n${sangria} */\n`;
}

/** Los valores por defecto y los límites de un campo de pedido, para el comentario. */
function limites(e) {
  const partes = [];
  const rango = (min, max, unidad = '') => (min !== undefined && max !== undefined && max < 1e15 ? `${min}–${max}${unidad}` : min !== undefined ? `at least ${min}${unidad}` : max !== undefined ? `at most ${max}${unidad}` : null);
  const base = e.anyOf?.find((x) => x.type === 'integer' || x.type === 'array') ?? e;
  const r = base.type === 'array' ? rango(base.minItems, base.maxItems, ' items') : rango(base.minimum, base.maximum);
  if (r) partes.push(`${r[0].toUpperCase()}${r.slice(1)}.`);
  if ('default' in e && e.default !== null && !(typeof e.default === 'object' && Object.keys(e.default).length === 0)) {
    partes.push(`Defaults to \`${JSON.stringify(e.default)}\`.`);
  }
  return partes.join(' ');
}

function tipo(e, ruta) {
  if (e.$ref) {
    const n = e.$ref.split('/').pop();
    return esJson(n) ? 'JsonValue' : objeto(esquemas[n], n);
  }
  const variantes = e.anyOf ?? e.oneOf;
  if (variantes) return union(variantes, ruta);
  if ('const' in e) return JSON.stringify(e.const);
  if (e.enum) return enumeracion(e, ruta);
  if (Array.isArray(e.type)) return e.type.map((t) => tipo({ ...e, type: t }, ruta)).join(' | ');
  switch (e.type) {
    case 'string':
      return 'string';
    case 'integer':
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    case 'array':
      return `${envolver(tipo(e.items ?? {}, `${ruta}[]`))}[]`;
    case 'object': {
      if (e.properties) return objeto(e, ruta);
      const v = typeof e.additionalProperties === 'object' ? tipo(e.additionalProperties, `${ruta}{}`) : 'unknown';
      const claves = e.propertyNames?.enum;
      if (claves) return `Record<${claves.map((c) => JSON.stringify(c)).join(' | ')}, ${v}>`;
      return `Record<string, ${v}>`;
    }
    default:
      return 'unknown';
  }
}

function enumeracion(e, ruta) {
  const t = e.enum.map((v) => JSON.stringify(v)).join(' | ');
  const k = `enum:${t}`;
  if (porForma.has(k)) return porForma.get(k);
  if (!NOMBRES[ruta]) return t;
  const n = reservar(NOMBRES[ruta]);
  porForma.set(k, n);
  declaraciones.set(n, `${doc(e.description)}export type ${n} = ${t};\n`);
  return n;
}

function union(variantes, ruta) {
  const objetos = variantes.filter((v) => v.type === 'object' && v.properties);
  // Una unión de objetos con `type` constante (preguntas, respuestas): cada variante con su nombre.
  if (objetos.length > 1 && objetos.every((o) => o.properties.type && 'const' in o.properties.type)) {
    const k = `union:${clave({ anyOf: variantes })}`;
    if (porForma.has(k)) return porForma.get(k);
    const n = reservar(nombrar(ruta));
    porForma.set(k, n);
    const miembros = variantes.map((v) => (v.properties?.type && 'const' in v.properties.type ? tipo(v, `${ruta}<${v.properties.type.const}>`) : tipo(v, ruta)));
    declaraciones.set(n, `export type ${n} = ${miembros.join(' | ')};\n`);
    return n;
  }
  const tipos = [...new Set(variantes.map((v) => tipo(v, ruta)))];
  return tipos.join(' | ');
}

function objeto(e, ruta) {
  const k = clave(e);
  if (porForma.has(k)) {
    // La misma forma con otro nombre elegido (el error de una URL y un aviso son {code, message}): un alias.
    const existente = porForma.get(k);
    const propio = NOMBRES[ruta];
    if (!propio || propio === existente || declaraciones.has(propio)) return declaraciones.has(propio) ? propio : existente;
    declaraciones.set(propio, `export type ${propio} = ${existente};\n`);
    return propio;
  }
  const n = reservar(esquemas[ruta] ? ruta : nombrar(ruta));
  porForma.set(k, n);
  declaraciones.set(n, `${doc(e.description)}export interface ${n} {\n${campos(e, ruta, n).join('\n')}\n}\n`);
  return n;
}

function campos(e, ruta, n, { sin = [], fechas = false } = {}) {
  const esPedido = ruta.split(/[.[{<]/)[0].endsWith('Request');
  const requeridos = new Set(e.required ?? []);
  return Object.entries(e.properties)
    .filter(([p]) => !sin.includes(p))
    .map(([p, s]) => {
      let t = tipo(s, `${ruta}.${p}`);
      if (fechas && /"format":"date/.test(JSON.stringify(s))) t = `${t} | Date`;
      const texto = [s.description ?? DOCS[`${n}.${p}`], esPedido ? limites(s) : ''].filter(Boolean).join(' ');
      return `${doc(texto, '  ')}  ${clavePropiedad(p)}${requeridos.has(p) ? '' : '?'}: ${t};`;
    });
}

for (const c of COMPONENTES) {
  if (!esquemas[c]) throw new Error(`El OpenAPI no tiene components.schemas.${c}`);
  objeto(esquemas[c], c);
}
// Las opciones de cada método del SDK: el cuerpo sin lo que va como argumento, y fechas que aceptan un Date.
for (const [c, { nombre, sin, docu }] of Object.entries(OPCIONES)) {
  const n = reservar(nombre);
  declaraciones.set(n, `${doc(docu)}export interface ${n} {\n${campos(esquemas[c], c, c, { sin, fechas: true }).join('\n')}\n}\n`);
}
const faltan = Object.keys(esquemas).filter((c) => !COMPONENTES.includes(c) && !esJson(c));
if (faltan.length) avisos.push(`Componentes nuevos sin generar (sumalos a COMPONENTES): ${faltan.join(', ')}`);

// --- Salida ------------------------------------------------------------------------------------

const huella = createHash('sha256').update(JSON.stringify(spec)).digest('hex').slice(0, 12);
const salida = `// Generado por scripts/generate-types.mjs desde el OpenAPI de la API (${spec.info.version}, ${huella}).
// No editar a mano: \`npm run generate\` (o \`npm run generate -- --fetch\` para traer el vivo).

/** Any JSON value. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

${[...declaraciones.values()].join('\n')}`;

if (opcion('--check')) {
  const actual = fs.existsSync(SALIDA) ? fs.readFileSync(SALIDA, 'utf8') : '';
  if (actual !== salida) {
    console.error('src/generated.ts no está al día con openapi/openapi.json: corré `npm run generate`.');
    process.exit(1);
  }
  console.log('src/generated.ts al día.');
} else {
  fs.writeFileSync(SALIDA, salida);
  console.log(`src/generated.ts: ${declaraciones.size} tipos desde el OpenAPI ${spec.info.version} (${huella}).`);
}
for (const a of avisos) console.warn(`aviso: ${a}`);
