import test from 'node:test';
import assert from 'node:assert/strict';
import {handle} from './api/proxy.js';
const token = 't'.repeat(48);
const url = 'https://api.bilibili.com/x/web-interface/view?bvid=BV1kvp36tEKh';
function req(target=url, key=token, method='GET') {
  return new Request('https://example.com/api/proxy?url='+encodeURIComponent(target), {
    method, headers: {'x-proxy-token': key, 'referer': 'https://www.bilibili.com/'}
  });
}
test('missing secret fails closed; bad token denied', async () => {
  assert.equal((await handle(req(), {token:''})).status,503);
  assert.equal((await handle(req(url,'wrong'), {token})).status,401);
});
test('restrict host, protocol, path and method', async () => {
  for (const u of ['https://api.bilibili.com.evil.test/x/web-interface/view',
    'http://api.bilibili.com/x/web-interface/view','https://127.0.0.1/',
    'https://api.bilibili.com/private','https://user@api.bilibili.com/x/web-interface/view']) {
    assert.equal((await handle(req(u),{token})).status,403);
  }
  assert.equal((await handle(req(url,token,'POST'),{token})).status,405);
});
test('forward allowed headers, omit proxy secret, preserve JSON', async () => {
  const result = await handle(req(),{token,fetcher:async (u,opts)=>{
    assert.equal(u,url);
    assert.equal(opts.headers.get('x-proxy-token'),null);
    assert.equal(opts.headers.get('referer'),'https://www.bilibili.com/');
    assert.equal(opts.redirect,'manual');
    return new Response('{"code":0}',{headers:{'content-type':'application/json'}});
  }});
  assert.equal(await result.text(),'{"code":0}');
});
test('preserve 412 for diagnosis',async()=>{
  const r=await handle(req(),{token,fetcher:async()=>new Response('blocked',{status:412})});
  assert.equal(r.status,412);
});
test('reject redirects and large bodies',async()=>{
  assert.equal((await handle(req(),{token,fetcher:async()=>new Response(null,{status:302})})).status,502);
  assert.equal((await handle(req(),{token,fetcher:async()=>new Response(new Uint8Array(2097153))})).status,502);
});
