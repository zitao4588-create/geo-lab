import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const appRoot = path.join(repoRoot, 'apps/ai-exposure-check-h5');

function loadEnv(text: string) {
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv(await readFile(path.join(appRoot, '.env.local'), 'utf8'));

// Keep the validation bounded: no SDK retries. Provider-model fallback is
// detected after every four-provider prompt round and stops the run.
process.env.DEEPSEEK_SAMPLE_MAX_RETRIES = '0';
process.env.QWEN_SAMPLE_MAX_RETRIES = '0';
process.env.HY3_SAMPLE_MAX_RETRIES = '0';
process.env.DOUBAO_SAMPLE_MAX_RETRIES = '0';

const { getSamplingRuntime, sampleAiProviders } = await import('../../../apps/ai-exposure-check-h5/src/server/providers/sampling.ts');
const promptRows = JSON.parse(await readFile(path.join(here, 'prompts.json'), 'utf8')) as Array<{
  entity_id: string;
  entity: string;
  entity_role: string;
  prompt_id: string;
  text: string;
}>;

const runtime = getSamplingRuntime();
const readyProviders = runtime.providers.filter((item) => item.samplingAllowed);
if (readyProviders.length !== 4) {
  throw new Error(`preflight_failed: expected 4 ready providers, got ${readyProviders.length}`);
}

const rawRoot = path.join(here, 'raw/api');
await mkdir(rawRoot, { recursive: true });
const allSamples: unknown[] = [];
let stoppedReason: string | null = null;

for (const row of promptRows) {
  const prompt = {
    id: `${row.entity_id}__${row.prompt_id}`,
    category: row.prompt_id === 'P2' ? 'category' : row.prompt_id === 'P3' ? 'competitor' : 'brand',
    prompt: row.text,
    targetFact: row.entity
  } as const;
  const result = await sampleAiProviders([prompt]);
  const round = result.samples.map((sample) => ({ ...sample, entity: row.entity, entityRole: row.entity_role, promptId: row.prompt_id }));
  allSamples.push(...round);

  for (const sample of round) {
    const providerDir = path.join(rawRoot, sample.provider);
    await mkdir(providerDir, { recursive: true });
    const baseName = `${row.entity_id}__${row.prompt_id}`;
    await writeFile(path.join(providerDir, `${baseName}.json`), `${JSON.stringify(sample, null, 2)}\n`, 'utf8');
    const answer = sample.status === 'success' ? sample.answer : `ERROR: ${sample.error || 'unknown_error'}`;
    const markdown = `# ${row.entity} ${row.prompt_id} — ${sample.provider}\n\n- model: ${sample.model}\n- status: ${sample.status}\n- sampled_at: ${sample.sampledAt}\n- latency_ms: ${sample.latencyMs}\n- fallback_used: ${Boolean(sample.fallbackUsed)}\n- searched_web: false\n\n## Prompt\n\n${row.text}\n\n## Raw answer\n\n${answer}\n`;
    await writeFile(path.join(providerDir, `${baseName}.md`), markdown, 'utf8');
  }

  const failed = round.filter((sample) => sample.status !== 'success');
  const fallback = round.filter((sample) => sample.fallbackUsed);
  if (fallback.length > 0) {
    stoppedReason = `fallback_expansion:${row.entity_id}:${row.prompt_id}:${fallback.map((item) => item.provider).join(',')}`;
    break;
  }
  if (failed.length >= 2) {
    stoppedReason = `multiple_provider_failures:${row.entity_id}:${row.prompt_id}:${failed.map((item) => item.provider).join(',')}`;
    break;
  }
}

const successCount = allSamples.filter((sample: any) => sample.status === 'success').length;
const failureCount = allSamples.filter((sample: any) => sample.status !== 'success').length;
const summary = {
  startedFromIsolatedRunner: true,
  completedAt: new Date().toISOString(),
  expectedProviders: 4,
  expectedPrompts: 16,
  expectedSuccessfulAnswers: 64,
  observedSamples: allSamples.length,
  successCount,
  failureCount,
  stoppedReason,
  providers: readyProviders.map((item) => ({ provider: item.provider, model: item.model })),
  searchedWeb: false
};
await writeFile(path.join(rawRoot, 'run-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
await writeFile(path.join(rawRoot, 'all-samples.json'), `${JSON.stringify(allSamples, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(summary)}\n`);

if (stoppedReason) process.exitCode = 2;
