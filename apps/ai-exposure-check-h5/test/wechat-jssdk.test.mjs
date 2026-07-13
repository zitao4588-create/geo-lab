import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildWechatJssdkConfig,
  createWechatJssdkSignature,
  normalizeWechatJssdkUrl
} from '../dist/server/server/wechatJssdk.js';

test('WeChat JSSDK URL allowlist keeps query and removes hash', () => {
  assert.equal(
    normalizeWechatJssdkUrl('https://exposure.playgamelab.cn/?report=diag_test#result'),
    'https://exposure.playgamelab.cn/?report=diag_test'
  );
  assert.throws(() => normalizeWechatJssdkUrl('http://exposure.playgamelab.cn/'), /not_allowed/u);
  assert.throws(() => normalizeWechatJssdkUrl('https://example.com/'), /not_allowed/u);
  assert.throws(() => normalizeWechatJssdkUrl('https://user:pass@exposure.playgamelab.cn/'), /not_allowed/u);
  assert.throws(() => normalizeWechatJssdkUrl(`https://exposure.playgamelab.cn/?q=${'a'.repeat(2100)}`), /invalid/u);
});
test('WeChat JSSDK signature is stable for the exact query URL', () => {
  const input = 'jsapi_ticket=controlled-ticket&noncestr=controlled-nonce&timestamp=1700000000&url=https://exposure.playgamelab.cn/?report=diag_test';
  const expected = createHash('sha1').update(input).digest('hex');
  assert.equal(
    createWechatJssdkSignature('controlled-ticket', 'controlled-nonce', 1_700_000_000, 'https://exposure.playgamelab.cn/?report=diag_test'),
    expected
  );
});

test('WeChat credentials are cached once with mode 600 and never returned to the browser', async () => {
  const runtimeDir = await mkdtemp(path.join(os.tmpdir(), 'aiec-wechat-jssdk-'));
  const cacheFile = path.join(runtimeDir, 'wechat-jssdk-cache.json');
  let tokenCalls = 0;
  let ticketCalls = 0;
  const fetchImpl = async (url) => {
    const target = String(url);
    if (target.includes('/stable_token')) {
      tokenCalls += 1;
      return Response.json({ access_token: 'controlled-access-token', expires_in: 7200 });
    }
    ticketCalls += 1;
    return Response.json({ errcode: 0, errmsg: 'ok', ticket: 'controlled-jsapi-ticket', expires_in: 7200 });
  };
  const options = {
    appId: 'wx-controlled-app-id',
    appSecret: 'controlled-app-secret',
    cacheFile,
    fetchImpl,
    now: () => 1_700_000_000_000,
    nonce: () => 'controlled-nonce'
  };

  const [first, second] = await Promise.all([
    buildWechatJssdkConfig('https://exposure.playgamelab.cn/?report=diag_test#one', options),
    buildWechatJssdkConfig('https://exposure.playgamelab.cn/?report=diag_test#two', options)
  ]);
  assert.equal(tokenCalls, 1);
  assert.equal(ticketCalls, 1);
  assert.equal(first.signature, second.signature);
  assert.deepEqual(first.jsApiList, ['updateAppMessageShareData', 'updateTimelineShareData']);
  assert.doesNotMatch(JSON.stringify(first), /access-token|jsapi-ticket|app-secret/u);
  assert.equal((await stat(cacheFile)).mode & 0o777, 0o600);

  await buildWechatJssdkConfig('https://exposure.playgamelab.cn/?report=diag_test', options);
  assert.equal(tokenCalls, 1);
  assert.equal(ticketCalls, 1);
});
