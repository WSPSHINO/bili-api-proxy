import { timingSafeEqual } from 'node:crypto';

const allowed = new Map([
  ['/x/frontend/finger/spi', 'GET'],
  ['/x/web-interface/view', 'GET'],
  ['/x/web-interface/nav', 'GET'],
  ['/x/player/playurl', 'GET'],
  ['/x/player/wbi/playurl', 'GET'],
  ['/bapis/bilibili.api.ticket.v1.Ticket/GenWebTicket', 'POST'],
]);
const reply = (status, message) => new Response(JSON.stringify({ error: message }), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});

export async function handle(request, { token = process.env.PROXY_TOKEN, fetcher = fetch } = {}) {
  if (!token || token.length < 32) return reply(503, 'Proxy token not configured');
  const supplied = request.headers.get('x-proxy-token') || '';
  const a = Buffer.from(token), b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return reply(401, 'Unauthorized');
  let target;
  try {
    target = new URL(new URL(request.url).searchParams.get('url'));
  } catch { return reply(400, 'Invalid URL'); }
  if (target.protocol !== 'https:' || target.hostname !== 'api.bilibili.com'
      || target.port || target.username || target.password || target.hash
      || !allowed.has(target.pathname)) return reply(403, 'Target not allowed');
  if (allowed.get(target.pathname) !== request.method) return reply(405, 'Method not allowed');
  const headers = new Headers();
  for (const key of ['user-agent', 'referer', 'cookie', 'origin', 'content-type']) {
    if (request.headers.has(key)) headers.set(key, request.headers.get(key));
  }
  // The supported ticket call carries its parameters in the query, with no body.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const upstream = await fetcher(target.href, {
      method: request.method, headers, redirect: 'manual', signal: controller.signal
    });
    console.log('BILI_PROXY', JSON.stringify({path: target.pathname,
      status: upstream.status, contentType: upstream.headers.get('content-type')}));
    if (upstream.status >= 300 && upstream.status < 400) {
      await upstream.body?.cancel();
      return reply(502, 'Upstream redirect rejected');
    }
    const reader = upstream.body?.getReader();
    const chunks = [];
    let size = 0;
    if (reader) {
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 2 * 1024 * 1024) {
          await reader.cancel();
          return reply(502, 'Upstream response too large');
        }
        chunks.push(Buffer.from(value));
      }
    }
    return new Response([204, 205, 304].includes(upstream.status) ? null : Buffer.concat(chunks), {
      status: upstream.status,
      headers: {'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}
    });
  } catch {
    return reply(controller.signal.aborted ? 504 : 502, 'Upstream request failed');
  } finally { clearTimeout(timer); }
}

export default { fetch: (request) => handle(request) };
