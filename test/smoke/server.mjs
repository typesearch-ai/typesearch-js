// Un servidor mínimo para las pruebas de humo del paquete construido (Node 18+, Bun y Deno).
import http from 'node:http';

export async function start() {
  let calls = 0;
  const server = http.createServer(async (req, res) => {
    calls++;
    let body = '';
    for await (const c of req) body += c;
    const data = body ? JSON.parse(body) : {};
    if (req.headers.authorization !== 'Bearer ts_test_smoke') {
      res.writeHead(401, { 'Content-Type': 'application/problem+json' });
      return res.end(JSON.stringify({ type: 'x', title: 'x', status: 401, detail: 'no', code: 'invalid_api_key', request_id: 'req_1' }));
    }
    if (calls === 1) {
      // El primer pedido falla con 503: el SDK tiene que reintentar.
      res.writeHead(503, { 'Content-Type': 'application/problem+json', 'Retry-After': '0' });
      return res.end(JSON.stringify({ type: 'x', title: 'x', status: 503, detail: 'later', code: 'upstream_unavailable', request_id: 'req_1' }));
    }
    const result = { id: 'req_2', object: 'search', mode: 'fast', queries: [data.query], found: true, total: 1, results: [{ url: 'https://diarioejemplo.example/a', title: 'El dólar', score: 0.9 }] };
    if (data.stream) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write(`event: step\ndata: {"id":"a","text":"a","status":"running","detail":null}\n\n`);
      return res.end(`event: result\ndata: ${JSON.stringify(result)}\n\n`);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

export async function check(Typesearch, APIError) {
  const api = await start();
  try {
    const ts = new Typesearch({ apiKey: 'ts_test_smoke', baseURL: api.url });
    const res = await ts.search('el dólar', { mode: 'fast' });
    if (res.results[0].score !== 0.9) throw new Error('search');
    const final = await ts.searchStream('el dólar').finalResponse();
    if (final.total !== 1) throw new Error('stream');
    const bad = new Typesearch({ apiKey: 'ts_live_bad', baseURL: api.url });
    const e = await bad.search('el dólar').catch((x) => x);
    if (!(e instanceof APIError) || e.code !== 'invalid_api_key') throw new Error('errors');
  } finally {
    api.close();
  }
}
