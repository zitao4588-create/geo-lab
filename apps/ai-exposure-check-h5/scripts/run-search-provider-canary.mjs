import dotenv from 'dotenv';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getWebSearchRuntime,
  searchPublicWeb,
  webSearchProviderIds
} from '../dist/server/server/providers/webSearch.js';
import { readProviderArg, selectCases } from './search-canary-options.mjs';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(appRoot, '../..');
const canaryRoot = path.join(repoRoot, 'outputs/h5-mvp/search-grounding-canary-20260713');
dotenv.config({ path: path.join(appRoot, '.env.local') });
dotenv.config({ path: path.join(appRoot, '.env') });
const allCases = JSON.parse(await readFile(path.join(canaryRoot, 'cases.json'), 'utf8'));
const args = process.argv.slice(2);
const cases = selectCases(args, allCases);
const requestedProviders = readProviderArg(args, webSearchProviderIds);
const runtime = getWebSearchRuntime();
const activeProviders = runtime.providers
  .filter((provider) => provider.active && requestedProviders.includes(provider.provider))
  .map((provider) => provider.provider);

if (process.env.SEARCH_CANARY_CONFIRMED !== '1') {
  console.error('真实搜索 canary 尚未确认。请先核对 48 次搜索请求上限、免费额度和火山模型 Token 风险，再设置 SEARCH_CANARY_CONFIRMED=1。');
  process.exit(2);
}

if (activeProviders.length === 0) {
  console.error('没有已启用且已配置的搜索 provider。请检查 *_SEARCH_ENABLED 与服务端 API key。');
  process.exit(2);
}

const runId = new Date().toISOString().replace(/[:.]/gu, '-');
const runDir = path.join(canaryRoot, 'runs', runId);
await mkdir(path.join(runDir, 'raw'), { recursive: true });

const rows = [];
let searchRequestCount = 0;
const stoppedProviders = [];
for (const provider of activeProviders) {
  const providerDir = path.join(runDir, 'raw', provider);
  await mkdir(providerDir, { recursive: true });
  for (const testCase of cases) {
    const response = await searchPublicWeb(provider, testCase.query, {
      maxResults: 5,
      captureRawResponse: true
    });
    searchRequestCount += 1;
    await writeFile(path.join(providerDir, `${testCase.id}.json`), `${JSON.stringify({ case: testCase, response }, null, 2)}\n`, 'utf8');
    rows.push(scoreResponse(provider, testCase, response));
    const stopReason = providerStopReason(response);
    if (stopReason) {
      stoppedProviders.push({ provider, case_id: testCase.id, reason: stopReason });
      break;
    }
  }
}

const summary = {
  runId,
  generatedAt: new Date().toISOString(),
  providers: activeProviders,
  caseCount: cases.length,
  plannedSearchRequestCount: activeProviders.length * cases.length,
  searchRequestCount,
  stoppedProviders,
  rows
};
await writeFile(path.join(runDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
await writeFile(path.join(runDir, 'scores.csv'), renderCsv(rows), 'utf8');
console.log(JSON.stringify({ runDir, providers: activeProviders, cases: cases.length, requests: summary.searchRequestCount }, null, 2));

function providerStopReason(response) {
  if (response.status !== 'failed' || !response.error) return null;
  const error = String(response.error);
  if (/HTTP 4\d\d/iu.test(error)) return error;
  if (/(?:authentication|authorization|billing|payment|insufficient|quota|余额|欠费)/iu.test(error)) return error;
  return null;
}

function scoreResponse(provider, testCase, response) {
  const haystack = [
    response.answer || '',
    ...response.results.flatMap((item) => [item.title, item.url, item.snippet])
  ].join('\n').toLowerCase();
  const terms = testCase.expected_terms || [];
  const exactEntityHit = terms.length > 0 && terms.some((term) => haystack.includes(String(term).toLowerCase()));
  const domains = testCase.expected_official_domains || [];
  const officialPosition = domains.length === 0 ? null : response.results.findIndex((item) => {
    try {
      const hostname = new URL(item.url).hostname.toLowerCase();
      return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
    } catch {
      return false;
    }
  });
  return {
    provider,
    case_id: testCase.id,
    entity: testCase.entity,
    role: testCase.role,
    query_type: testCase.query_type,
    status: response.status,
    latency_ms: response.latencyMs,
    result_count: response.results.length,
    exact_entity_hit: terms.length === 0 ? 'not_applicable' : exactEntityHit ? 'yes' : 'no',
    official_domain_hit: domains.length === 0 ? 'not_applicable' : officialPosition >= 0 ? 'yes' : 'no',
    official_domain_position: officialPosition !== null && officialPosition >= 0 ? officialPosition + 1 : '',
    negative_entity_invented: testCase.must_not_invent_entity ? 'manual_review_required' : 'not_applicable',
    citations_accessible: 'manual_review_required',
    raw_evidence_path: `raw/${provider}/${testCase.id}.json`,
    error: response.error || ''
  };
}

function renderCsv(rows) {
  const headers = Object.keys(rows[0] || {});
  const csv = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return `${headers.join(',')}\n${rows.map((row) => headers.map((key) => csv(row[key])).join(',')).join('\n')}\n`;
}
