import http from 'node:http';
import { pathToFileURL } from 'node:url';

export async function startFakeOpenAiServer({ delayMs = 80, fail = false, failModels = {}, pages = {}, port = 0 } = {}) {
  let callCount = 0;
  let activeCount = 0;
  let peakConcurrency = 0;
  const requests = [];

  const server = http.createServer(async (request, response) => {
    if (request.method === 'GET' && Object.hasOwn(pages, request.url)) {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(pages[request.url]);
      return;
    }

    if (request.method !== 'POST' || request.url !== '/v1/chat/completions') {
      response.writeHead(404, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: { message: 'not_found' } }));
      return;
    }

    let rawBody = '';
    for await (const chunk of request) rawBody += chunk;

    const body = JSON.parse(rawBody);
    callCount += 1;
    const callId = callCount;
    activeCount += 1;
    peakConcurrency = Math.max(peakConcurrency, activeCount);
    requests.push(body);
    try {
      await delay(delayMs);

      if (fail) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: { message: 'controlled_provider_failure', type: 'server_error' } }));
        return;
      }

      const modelFailure = failModels[body.model];
      if (modelFailure) {
        response.writeHead(modelFailure.status || 429, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({
          error: {
            message: modelFailure.message || 'controlled_model_quota_exhausted',
            type: modelFailure.type || 'rate_limit_error',
            code: modelFailure.code || 'quota_exhausted'
          }
        }));
        return;
      }

      const isPolishRequest = body.response_format?.type === 'json_object';
      const content = isPolishRequest
        ? JSON.stringify({ recommendations: [], roadmap: [] })
        : '这是本地受控采样回答，仅用于验证请求恢复，不代表真实平台结果。';

      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({
        id: `chatcmpl-controlled-${callId}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: body.model || 'controlled-model',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content },
            finish_reason: 'stop'
          }
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
      }));
    } finally {
      activeCount -= 1;
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('fake_provider_address_unavailable');

  return {
    origin: `http://127.0.0.1:${address.port}`,
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    get callCount() {
      return callCount;
    },
    get peakConcurrency() {
      return peakConcurrency;
    },
    requests,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    })
  };
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const provider = await startFakeOpenAiServer({
    delayMs: Number(process.env.FAKE_DEEPSEEK_DELAY_MS || 150),
    fail: process.env.FAKE_DEEPSEEK_FAIL === '1',
    port: Number(process.env.FAKE_DEEPSEEK_PORT || 0)
  });

  console.log(`Fake OpenAI API listening at ${provider.baseUrl}`);

  const shutdown = async () => {
    await provider.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
