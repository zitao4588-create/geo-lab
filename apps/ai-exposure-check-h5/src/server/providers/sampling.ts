import OpenAI, { type ClientOptions } from 'openai';
import type { AiProviderStatus, AiSample, SamplePrompt } from '../../shared/types.js';

interface DeepSeekConfig {
  apiKey?: string;
  baseUrl: string;
  model: string;
  fallbackModels: string[];
  sampleConcurrency: number;
  sampleMaxRetries: number;
}

interface SamplingProviderConfig {
  provider: 'deepseek' | 'hy3' | 'qwen' | 'doubao';
  apiKey?: string;
  baseUrl: string;
  model: string;
  fallbackModels?: string[];
  sampleConcurrency: number;
  sampleMaxRetries: number;
  timeoutMs: number;
  maxTokens: number;
  readyNote: string;
  sampledNote: string;
  enabled: boolean;
  samplingAllowed: boolean;
  costGuard: 'provider_enforced' | 'user_authorized' | 'disabled';
}

const preferredProviderModels = new Map<SamplingProviderConfig['provider'], string>();

export class SamplingUnavailableError extends Error {
  constructor(message = '真实 AI 采样暂不可用，请稍后再试') {
    super(message);
    this.name = 'SamplingUnavailableError';
  }
}

export function getSamplingRuntime() {
  const config = getConfig();
  const samplingConfigs = getSamplingProviderConfigs();
  const samplingProviders = samplingConfigs.map((providerConfig) => buildRuntimeProviderStatus(providerConfig));

  return {
    provider: 'deepseek' as const,
    model: config.model,
    hasApiKey: samplingConfigs.some((providerConfig) => Boolean(providerConfig.apiKey) && providerConfig.samplingAllowed),
    hasConfiguredKey: samplingConfigs.some((providerConfig) => Boolean(providerConfig.apiKey)),
    configuredProviderCount: samplingConfigs.filter((providerConfig) => Boolean(providerConfig.apiKey)).length,
    samplingAllowedProviderCount: samplingConfigs.filter((providerConfig) => Boolean(providerConfig.apiKey) && providerConfig.samplingAllowed).length,
    sampleConcurrency: config.sampleConcurrency,
    sampleMaxRetries: config.sampleMaxRetries,
    providers: samplingProviders
  };
}

export async function sampleAiProviders(prompts: SamplePrompt[]): Promise<{ samples: AiSample[]; providerStatuses: AiProviderStatus[] }> {
  const samplingConfigs = getSamplingProviderConfigs();
  const configuredProviders = samplingConfigs.filter(isSamplingAllowedProvider);
  if (configuredProviders.length === 0) {
    throw new SamplingUnavailableError('当前没有已启用且已配置 API key 的 AI 采样 provider，无法生成最终 GEO 分析报告');
  }

  const providerResults = await Promise.all(configuredProviders.map(async (config) => {
    const samples = await sampleProviderAnswers(config, prompts);
    const successCount = samples.filter((sample) => sample.status === 'success').length;
    const failureCount = samples.filter((sample) => sample.status === 'failed').length;
    const status: AiProviderStatus = {
      provider: config.provider,
      model: samples.find((sample) => sample.status === 'success')?.model || config.model,
      status: successCount > 0 && failureCount > 0 ? 'partial' : successCount > 0 ? 'sampled' : 'unavailable',
      promptCount: prompts.length,
      successCount,
      failureCount,
      note: successCount > 0 ? config.sampledNote : `${config.provider} 本次未返回可用采样。`
    };
    return { samples, status };
  }));

  const samples = providerResults.flatMap((result) => result.samples);
  const providerStatuses: AiProviderStatus[] = [
    ...providerResults.map((result) => result.status),
    ...samplingConfigs
      .filter((config) => !config.apiKey || !config.samplingAllowed)
      .map((config) => buildRuntimeProviderStatus(config, prompts.length))
  ];

  return { samples, providerStatuses };
}

async function sampleProviderAnswers(config: SamplingProviderConfig & { apiKey: string }, prompts: SamplePrompt[]): Promise<AiSample[]> {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    timeout: config.timeoutMs,
    maxRetries: config.sampleMaxRetries,
    ...(['deepseek', 'qwen'].includes(config.provider)
      ? { fetch: globalThis.fetch as unknown as ClientOptions['fetch'] }
      : {})
  });

  const boundedPrompts = prompts.slice(0, 24);
  return runWithConcurrency(boundedPrompts, config.sampleConcurrency, (prompt) => sampleOne(client, config, prompt));
}

async function sampleOne(client: OpenAI, config: SamplingProviderConfig, prompt: SamplePrompt): Promise<AiSample> {
  const startedAt = Date.now();
  const sampledAt = new Date().toISOString();
  const modelCandidates = getModelCandidates(config);
  let attemptedModel = modelCandidates[0] || config.model;
  let lastError = 'sampling_failed';

  for (let index = 0; index < modelCandidates.length; index += 1) {
    attemptedModel = modelCandidates[index] || config.model;
    try {
      const completion = await client.chat.completions.create({
        model: attemptedModel,
        max_tokens: config.maxTokens,
        ...(config.provider === 'deepseek' ? { temperature: 0.2 } : {}),
        ...(['deepseek', 'qwen'].includes(config.provider)
          ? { enable_thinking: false }
          : { thinking: { type: 'disabled' } }),
        messages: [
          {
            role: 'system',
            content:
              '你是一个普通中文 AI 助手。请自然回答用户问题，只基于你已有知识，不要因为这是测试就强行提及某个品牌；不知道就直接说明不确定。'
          },
          {
            role: 'user',
            content: prompt.prompt
          }
        ]
      } as never);

      const answer = completion.choices[0]?.message?.content?.trim();
      if (!answer) {
        return {
          prompt,
          provider: config.provider,
          model: attemptedModel,
          status: 'failed',
          sampledAt,
          latencyMs: Date.now() - startedAt,
          error: 'empty_answer'
        };
      }

      if (config.fallbackModels?.length) preferredProviderModels.set(config.provider, attemptedModel);
      return {
        prompt,
        provider: config.provider,
        model: attemptedModel,
        status: 'success',
        sampledAt,
        latencyMs: Date.now() - startedAt,
        answer,
        fallbackUsed: index > 0
      };
    } catch (error) {
      lastError = error instanceof Error ? sanitizeProviderError(error.message) : 'sampling_failed';
      const nextModel = modelCandidates[index + 1];
      if (!nextModel || !shouldFallbackProviderModel(config.provider, error)) break;
      preferredProviderModels.set(config.provider, nextModel);
    }
  }

  return {
    prompt,
    provider: config.provider,
    model: attemptedModel,
    status: 'failed',
    sampledAt,
    latencyMs: Date.now() - startedAt,
    error: lastError,
    fallbackUsed: modelCandidates.indexOf(attemptedModel) > 0,
    failureType: classifyProviderFailure(lastError)
  };
}

function getConfig(): DeepSeekConfig {
  const bailianApiKey = process.env.BAILIAN_API_KEY || process.env.QWEN_API_KEY;
  return {
    apiKey: bailianApiKey,
    baseUrl:
      process.env.BAILIAN_BASE_URL ||
      process.env.QWEN_BASE_URL ||
      'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro',
    fallbackModels: readCsv(process.env.DEEPSEEK_FALLBACK_MODELS, ['deepseek-v4-flash']),
    sampleConcurrency: readBoundedInteger(process.env.DEEPSEEK_SAMPLE_CONCURRENCY, 5, 1, 10),
    sampleMaxRetries: readBoundedInteger(process.env.DEEPSEEK_SAMPLE_MAX_RETRIES, 1, 0, 2)
  };
}

function getSamplingProviderConfigs(): SamplingProviderConfig[] {
  const deepseek = getConfig();
  const bailianApiKey = process.env.BAILIAN_API_KEY || process.env.QWEN_API_KEY;
  const bailianBaseUrl =
    process.env.BAILIAN_BASE_URL ||
    process.env.QWEN_BASE_URL ||
    'https://dashscope.aliyuncs.com/compatible-mode/v1';
  return [
    {
      provider: 'deepseek',
      apiKey: deepseek.apiKey,
      baseUrl: deepseek.baseUrl,
      model: deepseek.model,
      fallbackModels: deepseek.fallbackModels,
      sampleConcurrency: deepseek.sampleConcurrency,
      sampleMaxRetries: deepseek.sampleMaxRetries,
      timeoutMs: 18_000,
      maxTokens: 650,
      readyNote: '阿里云百炼 DeepSeek 免费额度接口已配置，可进行真实采样。',
      sampledNote: '阿里云百炼 DeepSeek OpenAI-compatible API 已完成真实采样。',
      enabled: readBoolean(process.env.DEEPSEEK_ENABLED, true),
      samplingAllowed: readBoolean(process.env.DEEPSEEK_ENABLED, true) && Boolean(deepseek.apiKey),
      costGuard: deepseek.apiKey ? 'provider_enforced' : 'disabled'
    },
    {
      provider: 'hy3',
      apiKey: process.env.HY3_API_KEY,
      baseUrl: process.env.HY3_BASE_URL || 'https://tokenhub.tencentmaas.com/v1',
      model: process.env.HY3_MODEL || 'hy3',
      sampleConcurrency: readBoundedInteger(process.env.HY3_SAMPLE_CONCURRENCY, 4, 1, 8),
      sampleMaxRetries: readBoundedInteger(process.env.HY3_SAMPLE_MAX_RETRIES, 1, 0, 2),
      timeoutMs: 20_000,
      maxTokens: 500,
      readyNote: '腾讯 TokenHub Hy3 API key 已配置，可进行真实采样。',
      sampledNote: '腾讯 TokenHub Hy3 API 已完成真实采样。',
      enabled: readBoolean(process.env.HY3_ENABLED, true),
      samplingAllowed: readBoolean(process.env.HY3_ENABLED, true) && Boolean(process.env.HY3_API_KEY),
      costGuard: process.env.HY3_API_KEY ? 'user_authorized' : 'disabled'
    },
    {
      provider: 'qwen',
      apiKey: bailianApiKey,
      baseUrl: bailianBaseUrl,
      model: process.env.QWEN_MODEL || 'qwen3.7-plus',
      sampleConcurrency: readBoundedInteger(process.env.QWEN_SAMPLE_CONCURRENCY, 4, 1, 8),
      sampleMaxRetries: readBoundedInteger(process.env.QWEN_SAMPLE_MAX_RETRIES, 1, 0, 2),
      timeoutMs: 20_000,
      maxTokens: 500,
      readyNote: '阿里云百炼 Qwen API key 已配置，可进行真实采样。',
      sampledNote: '阿里云百炼 Qwen OpenAI-compatible API 已完成真实采样。',
      enabled: readBoolean(process.env.QWEN_ENABLED, true),
      samplingAllowed: readBoolean(process.env.QWEN_ENABLED, true) && Boolean(bailianApiKey),
      costGuard: bailianApiKey ? 'provider_enforced' : 'disabled'
    },
    {
      provider: 'doubao',
      apiKey: process.env.DOUBAO_API_KEY || process.env.ARK_API_KEY,
      baseUrl: process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
      model: process.env.DOUBAO_MODEL || 'doubao-seed-2-0-lite-260215',
      fallbackModels: readCsv(process.env.DOUBAO_FALLBACK_MODELS, [
        'doubao-seed-2-0-mini-260215',
        'doubao-seed-2-1-turbo-260628',
        'doubao-seed-1-8-251228',
        'doubao-seed-2-1-pro-260628'
      ]),
      sampleConcurrency: readBoundedInteger(process.env.DOUBAO_SAMPLE_CONCURRENCY, 4, 1, 8),
      sampleMaxRetries: readBoundedInteger(process.env.DOUBAO_SAMPLE_MAX_RETRIES, 1, 0, 2),
      timeoutMs: 20_000,
      maxTokens: 500,
      readyNote: '火山方舟豆包 API key 已配置，可进行真实采样。',
      sampledNote: '火山方舟豆包 OpenAI-compatible API 已完成真实采样。',
      enabled: readBoolean(process.env.DOUBAO_ENABLED, true),
      samplingAllowed: readBoolean(process.env.DOUBAO_ENABLED, true) && Boolean(process.env.DOUBAO_API_KEY || process.env.ARK_API_KEY),
      costGuard: process.env.DOUBAO_API_KEY || process.env.ARK_API_KEY ? 'user_authorized' : 'disabled'
    }
  ];
}

function isSamplingAllowedProvider(config: SamplingProviderConfig): config is SamplingProviderConfig & { apiKey: string } {
  return Boolean(config.apiKey) && config.samplingAllowed;
}

function buildRuntimeProviderStatus(config: SamplingProviderConfig, promptCount = 0): AiProviderStatus {
  const configured = Boolean(config.apiKey);
  const samplingAllowed = configured && config.samplingAllowed;
  return {
    provider: config.provider,
    model: config.model,
    status: samplingAllowed ? 'ready' : 'unavailable',
    promptCount,
    successCount: 0,
    failureCount: 0,
    configured,
    enabled: config.enabled,
    samplingAllowed,
    costGuard: configured ? config.costGuard : 'disabled',
    note: !configured
      ? `${config.provider} 官方采样接口未配置。`
      : !config.enabled
        ? `${config.provider} 已配置，但 provider 开关已关闭。`
      : samplingAllowed
        ? `${config.readyNote} 此状态只表示开关已启用且 key 已配置，不代表 key 当前有效或最近调用成功。`
        : `${config.provider} 已配置，但当前不能参与采样。`
  };
}

function readBoundedInteger(value: string | undefined, fallback: number, min: number, max: number) {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function readBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function readCsv(value: string | undefined, fallback: string[]) {
  const items = (value || fallback.join(','))
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set(items)];
}

function getModelCandidates(config: SamplingProviderConfig) {
  const models = [...new Set([config.model, ...(config.fallbackModels || [])])];
  const preferredModel = preferredProviderModels.get(config.provider);
  if (!preferredModel) return models;
  const preferredIndex = models.indexOf(preferredModel);
  return preferredIndex >= 0 ? models.slice(preferredIndex) : models;
}

function shouldFallbackProviderModel(provider: SamplingProviderConfig['provider'], error: unknown) {
  if (!['deepseek', 'doubao'].includes(provider)) return false;
  if (!error || typeof error !== 'object') return false;
  const status = 'status' in error && typeof error.status === 'number' ? error.status : undefined;
  if (status !== undefined) return [402, 403, 404, 429].includes(status);
  const code = 'code' in error ? String(error.code || '') : '';
  const message = error instanceof Error ? error.message : String(error);
  return /quota|free.?tier|allocation|rate.?limit|balance|billing|overdue|access.?denied|not activated|not found|not exist|unavailable|insufficient|exhaust|resource.?package/iu.test(`${code} ${message}`);
}

async function runWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  worker: (item: TInput) => Promise<TOutput>
): Promise<TOutput[]> {
  const results: TOutput[] = [];
  let index = 0;

  async function next() {
    while (index < items.length) {
      const current = index;
      index += 1;
      const item = items[current];
      if (item === undefined) return;
      results[current] = await worker(item);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
  return results;
}

export function sanitizeProviderError(value: string) {
  return value
    .replace(/sk-[a-zA-Z0-9_-]+/gu, '[redacted_key]')
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gu, 'Bearer [redacted]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/gu, '[redacted_ip]')
    .slice(0, 180);
}

function classifyProviderFailure(value: string) {
  if (/timeout|timed out|abort/iu.test(value)) return 'timeout';
  if (/quota|free.?tier|allocation|balance|billing|exhaust|resource.?package/iu.test(value)) return 'quota_or_billing';
  if (/429|rate.?limit/iu.test(value)) return 'rate_limit';
  if (/401|403|access|auth|permission|allowlist/iu.test(value)) return 'authorization';
  if (/network|socket|connect|dns|fetch failed/iu.test(value)) return 'network';
  return 'provider_error';
}
