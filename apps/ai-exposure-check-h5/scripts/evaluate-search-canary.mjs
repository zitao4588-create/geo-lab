import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAuditUrl } from '../dist/server/server/pageAudit.js';

const providerOrder = ['anysearch', 'tavily', 'jina', 'volcengine'];
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(appRoot, '../..');
const canaryRoot = path.join(repoRoot, 'outputs/h5-mvp/search-grounding-canary-20260713');
const runsRoot = path.join(canaryRoot, 'runs');
const cases = JSON.parse(await readFile(path.join(canaryRoot, 'cases.json'), 'utf8'));
const scoringCorrections = JSON.parse(await readFile(path.join(canaryRoot, 'scoring-corrections.json'), 'utf8'));
const urlCheckOverrides = JSON.parse(await readFile(path.join(canaryRoot, 'url-check-overrides.json'), 'utf8'));
let cumulativeRequestCount = 0;
const latestRuns = await loadLatestRuns();
const urlChecks = [];
const scoreRows = [];
const providerSummaries = [];

for (const provider of providerOrder) {
  const run = latestRuns.get(provider);
  if (!run) {
    providerSummaries.push(emptyProviderSummary(provider, 'no_run_evidence'));
    continue;
  }

  const rawByCase = new Map();
  for (const testCase of cases) {
    const rawPath = path.join(run.runDir, 'raw', provider, `${testCase.id}.json`);
    try {
      rawByCase.set(testCase.id, JSON.parse(await readFile(rawPath, 'utf8')));
    } catch {
      rawByCase.set(testCase.id, null);
    }
  }

  for (const testCase of cases.filter((item) => item.query_type === 'official_source' && item.role !== 'negative_control')) {
    const raw = rawByCase.get(testCase.id);
    const results = raw?.response?.results ?? [];
    const expectedDomains = expectedDomainsFor(testCase);
    const officialResult = results.find((result) => expectedDomains.some((domain) => hostnameMatches(result.url, domain)));
    const selected = officialResult ?? results[0];
    if (!selected) {
      urlChecks.push({
        provider,
        case_id: testCase.id,
        selected_url: '',
        selected_is_official: false,
        checked: false,
        accessible: null,
        verification_status: 'not_checked',
        status: '',
        final_url: '',
        error: raw?.response?.error || 'no_result_url'
      });
      continue;
    }
    urlChecks.push({
      provider,
      case_id: testCase.id,
      selected_url: selected.url,
      selected_is_official: Boolean(officialResult),
      ...(await checkUrl(selected.url))
    });
  }

  for (const row of run.summary.rows) {
    const testCase = cases.find((item) => item.id === row.case_id);
    const raw = rawByCase.get(row.case_id);
    const expectedDomains = expectedDomainsFor(testCase);
    const officialPosition = expectedDomains.length === 0
      ? null
      : (raw?.response?.results ?? []).findIndex((result) => expectedDomains.some((domain) => hostnameMatches(result.url, domain)));
    const negativeText = testCase?.must_not_invent_entity
      ? (raw?.response?.results ?? []).flatMap((item) => [item.title, item.snippet]).join('\n')
      : '';
    const urlCheck = urlChecks.find((item) => item.provider === provider && item.case_id === row.case_id);
    scoreRows.push({
      provider,
      case_id: row.case_id,
      entity: row.entity,
      role: row.role,
      query_type: row.query_type,
      status: row.status,
      latency_ms: row.latency_ms,
      result_count: row.result_count,
      exact_entity_hit: row.exact_entity_hit,
      official_domain_hit: expectedDomains.length === 0 ? 'not_applicable' : (officialPosition >= 0 ? 'yes' : 'no'),
      official_domain_position: officialPosition !== null && officialPosition >= 0 ? officialPosition + 1 : '',
      negative_entity_invented: testCase?.must_not_invent_entity
        ? (negativeText.includes(testCase.entity) ? 'yes' : 'no')
        : 'not_applicable',
      url_checked: urlCheck?.checked ? 'yes' : 'no',
      url_accessible: urlCheck?.checked ? (urlCheck.accessible ? 'yes' : 'no') : 'not_checked',
      raw_evidence_path: path.relative(canaryRoot, path.join(run.runDir, 'raw', provider, `${row.case_id}.json`)),
      evaluator_note: row.error || ''
    });
  }

  providerSummaries.push(summarizeProvider(provider, run, rawByCase));
}

const evaluation = {
  generatedAt: new Date().toISOString(),
  requestCount: cumulativeRequestCount,
  selectedRunRequestCount: providerSummaries.reduce((total, item) => total + item.attempted_requests, 0),
  urlCheckCount: urlChecks.filter((item) => item.checked).length,
  providers: providerSummaries,
  conclusion: chooseConclusion(providerSummaries)
};

await writeFile(path.join(canaryRoot, 'url-checks.json'), `${JSON.stringify(urlChecks, null, 2)}\n`, 'utf8');
await writeFile(path.join(canaryRoot, 'evaluation.json'), `${JSON.stringify(evaluation, null, 2)}\n`, 'utf8');
await writeFile(path.join(canaryRoot, 'scores.csv'), renderCsv(scoreRows), 'utf8');
console.log(JSON.stringify(evaluation, null, 2));

async function loadLatestRuns() {
  const output = new Map();
  const entries = await readdir(runsRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const runDir = path.join(runsRoot, entry.name);
    try {
      const summary = JSON.parse(await readFile(path.join(runDir, 'summary.json'), 'utf8'));
      cumulativeRequestCount += Number(summary.searchRequestCount ?? summary.rows?.length ?? 0);
      for (const provider of summary.providers ?? []) {
        const current = output.get(provider);
        if (!current || String(summary.generatedAt) > String(current.summary.generatedAt)) {
          output.set(provider, { runDir, summary });
        }
      }
    } catch {
      // Ignore incomplete run directories; they are not valid evidence.
    }
  }
  return output;
}

function summarizeProvider(provider, run, rawByCase) {
  const rows = run.summary.rows ?? [];
  const latencies = rows.map((row) => Number(row.latency_ms)).filter(Number.isFinite).sort((a, b) => a - b);
  const officialCases = ['F2', 'D2', 'A2'];
  const targetExactCases = ['F1', 'D1'];
  const negativeCases = ['N1', 'N2', 'N3'];
  const checks = urlChecks.filter((item) => item.provider === provider && item.checked);
  const successCount = rows.filter((row) => row.status === 'success').length;
  const officialHits = officialCases.every((id) => {
    const testCase = cases.find((item) => item.id === id);
    const expectedDomains = expectedDomainsFor(testCase);
    const raw = rawByCase.get(id);
    return (raw?.response?.results ?? []).some((result) => expectedDomains.some((domain) => hostnameMatches(result.url, domain)));
  });
  const targetExactHits = targetExactCases.every((id) => rows.find((row) => row.case_id === id)?.exact_entity_hit === 'yes');
  const negativeControlValid = negativeCases.every((id) => {
    const raw = rawByCase.get(id);
    if (raw?.response?.status !== 'success') return false;
    const testCase = cases.find((item) => item.id === id);
    const text = (raw.response.results ?? []).flatMap((item) => [item.title, item.snippet]).join('\n');
    return !text.includes(testCase.entity);
  });
  const urlAccessibleRate = checks.length === 0 ? null : checks.filter((item) => item.accessible).length / checks.length;
  const p95 = percentile(latencies, 0.95);
  const freeBoundaryConfirmed = providerOrder.includes(provider);
  const commercialTermsConfirmed = false;
  const strictCandidate = successCount >= 11
    && officialHits
    && targetExactHits
    && negativeControlValid
    && urlAccessibleRate !== null
    && urlAccessibleRate >= 0.9
    && p95 <= 8_000
    && freeBoundaryConfirmed
    && commercialTermsConfirmed;
  return {
    provider,
    run_id: path.basename(run.runDir),
    planned_requests: Number(run.summary.plannedSearchRequestCount ?? run.summary.caseCount ?? 0),
    attempted_requests: Number(run.summary.searchRequestCount ?? rows.length),
    successful_requests: successCount,
    p95_ms: p95,
    official_source_all_hit: officialHits,
    target_exact_all_hit: targetExactHits,
    negative_control_valid: negativeControlValid,
    checked_url_count: checks.length,
    checked_url_accessible_rate: urlAccessibleRate === null ? null : Number(urlAccessibleRate.toFixed(4)),
    free_boundary_confirmed: freeBoundaryConfirmed,
    commercial_terms_confirmed: commercialTermsConfirmed,
    stopped_early: (run.summary.stoppedProviders ?? []).length > 0,
    stop_reason: run.summary.stoppedProviders?.[0]?.reason ?? '',
    strict_candidate: strictCandidate
  };
}

function emptyProviderSummary(provider, reason) {
  return {
    provider,
    run_id: '',
    planned_requests: 0,
    attempted_requests: 0,
    successful_requests: 0,
    p95_ms: 0,
    official_source_all_hit: false,
    target_exact_all_hit: false,
    negative_control_valid: false,
    checked_url_count: 0,
    checked_url_accessible_rate: null,
    free_boundary_confirmed: false,
    commercial_terms_confirmed: false,
    stopped_early: true,
    stop_reason: reason,
    strict_candidate: false
  };
}

function chooseConclusion(summaries) {
  const winner = summaries.find((item) => item.strict_candidate);
  return winner ? `candidate:${winner.provider}` : 'no_provider_meets_strict_h5_threshold';
}

async function checkUrl(startUrl) {
  const override = urlCheckOverrides.find((item) => normalizeUrl(item.url) === normalizeUrl(startUrl));
  if (override) {
    return {
      checked: true,
      accessible: Boolean(override.accessible),
      verification_status: override.accessible ? 'accessible' : 'inaccessible',
      verification_method: override.verification_method,
      verified_at: override.verified_at,
      status: '',
      final_url: startUrl,
      error: '',
      note: override.note
    };
  }
  const signal = AbortSignal.timeout(12_000);
  let currentUrl = startUrl;
  const visited = new Set();
  try {
    for (let hop = 0; hop <= 4; hop += 1) {
      if (visited.has(currentUrl)) throw new Error('redirect_loop');
      visited.add(currentUrl);
      await validateAuditUrl(currentUrl, { recheck: true });
      const response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/json;q=0.8,*/*;q=0.5',
          'User-Agent': 'AIExposureCheckH5-Canary/0.1 (+https://exposure.playgamelab.cn)'
        }
      });
      await response.body?.cancel();
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) throw new Error('redirect_without_location');
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }
      return {
        checked: true,
        accessible: response.status >= 200 && response.status < 400,
        verification_status: response.status >= 200 && response.status < 400 ? 'accessible' : 'inaccessible',
        status: response.status,
        final_url: currentUrl,
        error: response.status >= 200 && response.status < 400 ? '' : `HTTP ${response.status}`
      };
    }
    throw new Error('too_many_redirects');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'url_check_failed';
    const environmentBlocked = message === 'private_or_reserved_address' || message === 'dns_rebinding_or_private_address';
    return {
      checked: !environmentBlocked,
      accessible: environmentBlocked ? null : false,
      verification_status: environmentBlocked ? 'environment_blocked' : 'failed',
      status: '',
      final_url: currentUrl,
      error: message
    };
  }
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    url.pathname = url.pathname.replace(/\/$/, '') || '/';
    return url.toString();
  } catch {
    return String(value);
  }
}

function hostnameMatches(value, expectedDomain) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    const expected = String(expectedDomain).toLowerCase();
    return hostname === expected || hostname.endsWith(`.${expected}`);
  } catch {
    return false;
  }
}

function expectedDomainsFor(testCase) {
  const correction = scoringCorrections.find((item) => item.case_id === testCase?.id);
  return correction?.accepted_official_domains ?? testCase?.expected_official_domains ?? [];
}

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  return values[Math.max(0, Math.ceil(values.length * ratio) - 1)];
}

function renderCsv(rows) {
  const headers = Object.keys(rows[0] ?? {});
  const csv = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return `${headers.join(',')}\n${rows.map((row) => headers.map((key) => csv(row[key])).join(',')).join('\n')}\n`;
}
