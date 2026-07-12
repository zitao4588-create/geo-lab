import OpenAI, { type ClientOptions } from 'openai';
import type { AiProviderStatus, AiSample, DiagnosisInput, DiagnosisReport, SamplePrompt } from '../shared/types.js';

interface DeepSeekConfig {
  apiKey?: string;
  baseUrl: string;
  model: string;
  fallbackModels: string[];
  sampleConcurrency: number;
  sampleMaxRetries: number;
  polishEnabled: boolean;
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
}

interface NarrativeJsonResult {
  summary?: string;
  recommendations?: Array<{ title?: string; detail?: string }>;
  roadmap?: Array<{ title?: string; detail?: string }>;
}

const preferredProviderModels = new Map<SamplingProviderConfig['provider'], string>();

export class SamplingUnavailableError extends Error {
  constructor(message = '真实 AI 采样暂不可用，请稍后再试') {
    super(message);
    this.name = 'SamplingUnavailableError';
  }
}

export function getDeepSeekRuntime() {
  const config = getConfig();
  const samplingConfigs = getSamplingProviderConfigs();
  const samplingProviders = samplingConfigs.map((providerConfig) => buildRuntimeProviderStatus(providerConfig));

  return {
    provider: 'deepseek' as const,
    model: config.model,
    hasApiKey: samplingConfigs.some((providerConfig) => Boolean(providerConfig.apiKey)),
    configuredProviderCount: samplingConfigs.filter((providerConfig) => Boolean(providerConfig.apiKey)).length,
    sampleConcurrency: config.sampleConcurrency,
    sampleMaxRetries: config.sampleMaxRetries,
    polishEnabled: config.polishEnabled,
    providers: samplingProviders
  };
}

export async function sampleAiProviders(prompts: SamplePrompt[]): Promise<{ samples: AiSample[]; providerStatuses: AiProviderStatus[] }> {
  const samplingConfigs = getSamplingProviderConfigs();
  const configuredProviders = samplingConfigs.filter(isConfiguredProvider);
  if (configuredProviders.length === 0) {
    throw new SamplingUnavailableError('当前服务未配置可用的 AI 采样 key，无法生成最终 GEO 分析报告');
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
      .filter((config) => !config.apiKey)
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

export async function polishFinalReportWithDeepSeek(input: DiagnosisInput, report: DiagnosisReport): Promise<DiagnosisReport> {
  const config = getConfig();
  if (!config.apiKey || !config.polishEnabled) return report;

  try {
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: 12_000,
      maxRetries: 0
    });

    const completion = await client.chat.completions.create({
      model: config.model,
      temperature: 0.2,
      max_tokens: 900,
      enable_thinking: false,
      messages: [
        {
          role: 'system',
          content:
            '你是保守的中文 GEO 诊断报告编辑。只能基于提供的真实采样统计与规则分析润色摘要和行动建议，不得新增采样结果、排名承诺、媒体背书、客户案例、百分比或引用。必须输出 JSON。'
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'polish_final_geo_report_copy',
            constraints: [
              '面向小程序/本地工具创业者，语言直接',
              '保留证据边界，不要承诺排名提升',
              'summary 不超过 180 个中文字符',
              'recommendations 和 roadmap 只改标题/描述，不改变优先级和阶段'
            ],
            input: {
              businessName: input.businessName,
              description: input.description,
              industry: input.industry,
              city: input.city,
              targetCustomers: input.targetCustomers,
              competitors: input.competitors
            },
            reportFacts: {
              score: report.score,
              scoreLevel: report.scoreLevel,
              promptCount: report.aiMeta.promptCount,
              successCount: report.aiMeta.successCount,
              mentionRate: report.stages.aiSearch.mentionRate,
              mentionedCount: report.stages.aiSearch.mentionedCount,
              riskFlags: report.stages.sentimentRisk.flags,
              dimensionScores: report.stages.score.dimensions.map((item) => ({
                name: item.name,
                score: item.score,
                comment: item.comment
              })),
              recommendations: report.stages.recommendations,
              roadmap: report.stages.roadmap
            },
            expectedJsonShape: {
              recommendations: [{ title: 'string', detail: 'string' }],
              roadmap: [{ title: 'string', detail: 'string' }]
            }
          })
        }
      ]
    } as never);

    const content = completion.choices[0]?.message?.content;
    if (!content) return report;
    return mergeNarrative(report, JSON.parse(content) as NarrativeJsonResult);
  } catch {
    return report;
  }
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
        answer
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
    error: lastError
  };
}

function mergeNarrative(report: DiagnosisReport, ai: NarrativeJsonResult): DiagnosisReport {
  const recommendations = report.stages.recommendations.map((item, index) => {
    const rewrite = ai.recommendations?.[index];
    return {
      ...item,
      title: safeText(rewrite?.title, item.title, 42),
      detail: safeText(rewrite?.detail, item.detail, 160)
    };
  });

  const roadmap = report.stages.roadmap.map((item, index) => {
    const rewrite = ai.roadmap?.[index];
    return {
      ...item,
      title: safeText(rewrite?.title, item.title, 36),
      detail: safeText(rewrite?.detail, item.detail, 180)
    };
  });

  return {
    ...report,
    stages: {
      ...report.stages,
      recommendations,
      roadmap
    }
  };
}

function getConfig(): DeepSeekConfig {
  const bailianApiKey = process.env.BAILIAN_API_KEY || process.env.QWEN_API_KEY;
  return {
    apiKey: readBoolean(process.env.DEEPSEEK_ENABLED, true) ? bailianApiKey : undefined,
    baseUrl:
      process.env.BAILIAN_BASE_URL ||
      process.env.QWEN_BASE_URL ||
      'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro',
    fallbackModels: readCsv(process.env.DEEPSEEK_FALLBACK_MODELS, ['deepseek-v4-flash']),
    sampleConcurrency: readBoundedInteger(process.env.DEEPSEEK_SAMPLE_CONCURRENCY, 5, 1, 10),
    sampleMaxRetries: readBoundedInteger(process.env.DEEPSEEK_SAMPLE_MAX_RETRIES, 1, 0, 2),
    polishEnabled: readBoolean(process.env.DEEPSEEK_POLISH_ENABLED, false)
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
      sampledNote: '阿里云百炼 DeepSeek OpenAI-compatible API 已完成真实采样。'
    },
    {
      provider: 'hy3',
      apiKey: readBoolean(process.env.HY3_ENABLED, true) ? process.env.HY3_API_KEY : undefined,
      baseUrl: process.env.HY3_BASE_URL || 'https://tokenhub.tencentmaas.com/v1',
      model: process.env.HY3_MODEL || 'hy3',
      sampleConcurrency: readBoundedInteger(process.env.HY3_SAMPLE_CONCURRENCY, 4, 1, 8),
      sampleMaxRetries: readBoundedInteger(process.env.HY3_SAMPLE_MAX_RETRIES, 1, 0, 2),
      timeoutMs: 20_000,
      maxTokens: 500,
      readyNote: '腾讯 TokenHub Hy3 API key 已配置，可进行真实采样。',
      sampledNote: '腾讯 TokenHub Hy3 API 已完成真实采样。'
    },
    {
      provider: 'qwen',
      apiKey: readBoolean(process.env.QWEN_ENABLED, true) ? bailianApiKey : undefined,
      baseUrl: bailianBaseUrl,
      model: process.env.QWEN_MODEL || 'qwen3.7-plus',
      sampleConcurrency: readBoundedInteger(process.env.QWEN_SAMPLE_CONCURRENCY, 4, 1, 8),
      sampleMaxRetries: readBoundedInteger(process.env.QWEN_SAMPLE_MAX_RETRIES, 1, 0, 2),
      timeoutMs: 20_000,
      maxTokens: 500,
      readyNote: '阿里云百炼 Qwen API key 已配置，可进行真实采样。',
      sampledNote: '阿里云百炼 Qwen OpenAI-compatible API 已完成真实采样。'
    },
    {
      provider: 'doubao',
      apiKey: readBoolean(process.env.DOUBAO_ENABLED, true)
        ? process.env.DOUBAO_API_KEY || process.env.ARK_API_KEY
        : undefined,
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
      sampledNote: '火山方舟豆包 OpenAI-compatible API 已完成真实采样。'
    }
  ];
}

function isConfiguredProvider(config: SamplingProviderConfig): config is SamplingProviderConfig & { apiKey: string } {
  return Boolean(config.apiKey);
}

function buildRuntimeProviderStatus(config: SamplingProviderConfig, promptCount = 0): AiProviderStatus {
  return {
    provider: config.provider,
    model: config.model,
    status: config.apiKey ? 'ready' : 'unavailable',
    promptCount,
    successCount: 0,
    failureCount: 0,
    note: config.apiKey ? config.readyNote : `${config.provider} 官方采样接口未配置。`
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

function safeText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}...` : trimmed;
}

export function sanitizeProviderError(value: string) {
  return value
    .replace(/sk-[a-zA-Z0-9_-]+/gu, '[redacted_key]')
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gu, 'Bearer [redacted]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/gu, '[redacted_ip]')
    .slice(0, 180);
}
