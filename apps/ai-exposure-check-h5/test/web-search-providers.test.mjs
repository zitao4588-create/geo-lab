import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getWebSearchRuntime,
  sanitizeSearchError,
  searchPublicWeb
} from '../dist/server/server/providers/webSearch.js';
import {
  getPublicWebGroundingRuntime,
  toPublicWebGrounding
} from '../dist/server/server/publicWebGrounding.js';
import { readProviderArg, selectCases } from '../scripts/search-canary-options.mjs';

const query = 'flomo 浮墨笔记 官网 官方';

test('canary options can restrict a real run to one provider and one fixed case', () => {
  const cases = [{ id: 'F1' }, { id: 'F2' }];
  assert.deepEqual(readProviderArg(['--providers=volcengine'], ['anysearch', 'volcengine']), ['volcengine']);
  assert.deepEqual(selectCases(['--cases=F1'], cases), [{ id: 'F1' }]);
  assert.throws(() => selectCases(['--cases=unknown'], cases), /unknown cases: unknown/u);
});

test('all web-search providers are disabled by default and expose no secret values', () => {
  const runtime = getWebSearchRuntime({});
  assert.deepEqual(runtime.providers.map((item) => item.provider), ['anysearch', 'tavily', 'jina', 'volcengine']);
  assert.ok(runtime.providers.every((item) => item.enabled === false && item.active === false));
  assert.doesNotMatch(JSON.stringify(runtime), /apiKey|secret|Bearer/u);
});

test('missing credentials skip a provider without making a request', async () => {
  let called = false;
  const result = await searchPublicWeb('tavily', query, {
    env: { TAVILY_SEARCH_ENABLED: 'true' },
    fetchImpl: async () => {
      called = true;
      return Response.json({});
    }
  });
  assert.equal(result.status, 'skipped');
  assert.equal(result.error, 'search_provider_not_configured');
  assert.equal(called, false);
});

test('AnySearch adapter supports the controlled anonymous canary and normalizes results', async () => {
  const calls = [];
  const result = await searchPublicWeb('anysearch', query, {
    env: {
      ANYSEARCH_SEARCH_ENABLED: 'true',
      ANYSEARCH_ALLOW_ANONYMOUS: 'true',
      ANYSEARCH_BASE_URL: 'https://anysearch.invalid'
    },
    fetchImpl: jsonFetch(calls, {
      results: [{ title: 'flomo 官网', url: 'https://flomoapp.com/', description: '浮墨笔记官方页面' }]
    })
  });
  assert.equal(result.status, 'success');
  assert.equal(result.results[0]?.url, 'https://flomoapp.com/');
  assert.equal(calls[0].url, 'https://anysearch.invalid/v1/search');
  assert.equal(calls[0].body.max_results, 5);
  assert.equal(calls[0].headers.authorization, undefined);
});

test('multi-provider grounding deduplicates candidates and scores only public evidence discoverability', () => {
  const runtime = getPublicWebGroundingRuntime({
    PUBLIC_WEB_GROUNDING_ENABLED: 'true',
    PUBLIC_WEB_GROUNDING_PROVIDERS: 'volcengine,anysearch',
    VOLCENGINE_SEARCH_ENABLED: 'true',
    VOLCENGINE_WEB_SEARCH_API_KEY: 'controlled-key',
    VOLCENGINE_WEB_SEARCH_MODEL: 'controlled-model',
    ANYSEARCH_SEARCH_ENABLED: 'true',
    ANYSEARCH_ALLOW_ANONYMOUS: 'true'
  });
  assert.equal(runtime.provider, 'multi');
  assert.deepEqual(runtime.providers.map((item) => item.provider), ['volcengine', 'anysearch']);
  assert.ok(runtime.providers.every((item) => item.active));

  const responses = ['volcengine', 'anysearch'].map((provider) => ({
    provider,
    query,
    status: 'success',
    searchedAt: '2026-07-14T00:00:00.000Z',
    latencyMs: provider === 'volcengine' ? 900 : 300,
    results: [{ title: 'flomo 浮墨笔记官网', url: 'https://flomoapp.com/', snippet: '官方卡片笔记产品' }]
  }));
  const grounding = toPublicWebGrounding({
    businessName: 'flomo 浮墨笔记',
    description: '卡片笔记工具',
    links: 'https://flomoapp.com/',
    industry: '个人知识管理',
    city: '全国',
    targetCustomers: '知识工作者'
  }, responses);
  assert.equal(grounding.status, 'success');
  assert.equal(grounding.results.length, 1);
  assert.deepEqual(grounding.results[0].providers, ['volcengine', 'anysearch']);
  assert.equal(grounding.discovery.score, 100);
  assert.equal(grounding.discovery.officialCandidateCount, 1);
  assert.equal(grounding.discovery.corroboratedDomainCount, 1);
});

test('Tavily adapter uses basic one-credit search and a bearer key', async () => {
  const calls = [];
  const result = await searchPublicWeb('tavily', query, {
    env: {
      TAVILY_SEARCH_ENABLED: 'true',
      TAVILY_API_KEY: 'tvly-controlled-key',
      TAVILY_BASE_URL: 'https://tavily.invalid'
    },
    fetchImpl: jsonFetch(calls, {
      results: [{ title: 'flomo', url: 'https://flomoapp.com/', content: '官方产品说明', score: 0.9 }],
      usage: { credits: 1 }
    })
  });
  assert.equal(result.status, 'success');
  assert.equal(result.usage?.credits, 1);
  assert.equal(calls[0].body.search_depth, 'basic');
  assert.equal(calls[0].body.auto_parameters, false);
  assert.equal(calls[0].headers.authorization, 'Bearer tvly-controlled-key');
});

test('Jina adapter URL-encodes the query and accepts JSON search results', async () => {
  const calls = [];
  const result = await searchPublicWeb('jina', query, {
    env: {
      JINA_SEARCH_ENABLED: 'true',
      JINA_API_KEY: 'jina_controlled_key',
      JINA_SEARCH_BASE_URL: 'https://jina.invalid'
    },
    fetchImpl: jsonFetch(calls, {
      data: [{ title: 'flomo 官网', url: 'https://flomoapp.com/', description: '卡片笔记工具' }]
    })
  });
  assert.equal(result.status, 'success');
  assert.equal(result.results.length, 1);
  assert.match(calls[0].url, /^https:\/\/jina\.invalid\/flomo%20/u);
  assert.equal(calls[0].method, 'GET');
});

test('Volcengine adapter uses Responses web_search and extracts URL citations', async () => {
  const calls = [];
  const result = await searchPublicWeb('volcengine', query, {
    env: {
      VOLCENGINE_SEARCH_ENABLED: 'true',
      VOLCENGINE_WEB_SEARCH_API_KEY: 'controlled-ark-key',
      VOLCENGINE_WEB_SEARCH_MODEL: 'controlled-doubao-model',
      VOLCENGINE_RESPONSES_URL: 'https://ark.invalid/api/v3/responses'
    },
    fetchImpl: jsonFetch(calls, {
      output: [{
        type: 'message',
        content: [{
          type: 'output_text',
          text: 'flomo 是卡片笔记工具。',
          annotations: [{ type: 'url_citation', title: 'flomo 官网', url: 'https://flomoapp.com/' }]
        }]
      }],
      usage: { input_tokens: 12, output_tokens: 8, total_tokens: 20 }
    })
  });
  assert.equal(result.status, 'success');
  assert.equal(result.answer, 'flomo 是卡片笔记工具。');
  assert.equal(result.results[0]?.url, 'https://flomoapp.com/');
  assert.equal(calls[0].body.tools[0].type, 'web_search');
  assert.equal(calls[0].body.store, false);
  assert.equal(calls[0].body.model, 'controlled-doubao-model');
});

test('provider errors redact credentials and source IPs', async () => {
  const result = await searchPublicWeb('tavily', query, {
    env: {
      TAVILY_SEARCH_ENABLED: 'true',
      TAVILY_API_KEY: 'tvly-secret-value',
      TAVILY_BASE_URL: 'https://tavily.invalid'
    },
    fetchImpl: async () => new Response(JSON.stringify({
      error: { message: 'Bearer tvly-secret-value rejected from 198.51.100.42' }
    }), { status: 401, headers: { 'content-type': 'application/json' } })
  });
  assert.equal(result.status, 'failed');
  assert.doesNotMatch(result.error || '', /tvly-secret-value|198\.51\.100\.42/u);
  assert.match(sanitizeSearchError('jina_secret-value 203.0.113.8'), /\[redacted_key\].*\[redacted_ip\]/u);
});

function jsonFetch(calls, payload) {
  return async (input, init = {}) => {
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    calls.push({
      url: String(input),
      method: init.method,
      headers,
      body: init.body ? JSON.parse(String(init.body)) : null
    });
    return Response.json(payload);
  };
}
