import OpenAI from 'openai';
import type { AiProvider, AiProviderStatus, AiSample, DiagnosisInput, DiagnosisReport, SamplePrompt } from '../shared/types.js';

interface DeepSeekConfig {
  apiKey?: string;
  baseUrl: string;
  model: string;
}

interface NarrativeJsonResult {
  summary?: string;
  recommendations?: Array<{ title?: string; detail?: string }>;
  roadmap?: Array<{ title?: string; detail?: string }>;
}

export class SamplingUnavailableError extends Error {
  constructor(message = '真实 AI 采样暂不可用，请稍后再试') {
    super(message);
    this.name = 'SamplingUnavailableError';
  }
}

export function getDeepSeekRuntime() {
  const config = getConfig();
  const deepseekStatus: AiProviderStatus = {
    provider: 'deepseek',
    model: config.model,
    status: config.apiKey ? 'ready' : 'unavailable',
    promptCount: 0,
    successCount: 0,
    failureCount: 0,
    note: config.apiKey ? 'DeepSeek 官方 API key 已配置，可进行真实采样。' : 'DeepSeek 未配置。'
  };

  return {
    provider: 'deepseek' as const,
    model: config.model,
    hasApiKey: Boolean(config.apiKey),
    providers: [deepseekStatus, ...buildUnavailableProviderStatuses(['deepseek'], undefined, 0)]
  };
}

export async function sampleAiProviders(prompts: SamplePrompt[]): Promise<{ samples: AiSample[]; providerStatuses: AiProviderStatus[] }> {
  const samples = await sampleDeepSeekAnswers(prompts);
  const successCount = samples.filter((sample) => sample.status === 'success').length;
  const failureCount = samples.filter((sample) => sample.status === 'failed').length;
  const config = getConfig();
  const providerStatuses: AiProviderStatus[] = [
    {
      provider: 'deepseek',
      model: config.model,
      status: successCount > 0 && failureCount > 0 ? 'partial' : successCount > 0 ? 'sampled' : 'unavailable',
      promptCount: prompts.length,
      successCount,
      failureCount,
      note: successCount > 0 ? 'DeepSeek 官方 OpenAI-compatible API 已完成真实采样。' : 'DeepSeek 未返回可用采样。'
    },
    ...buildUnavailableProviderStatuses(['deepseek'], undefined, prompts.length)
  ];

  return { samples, providerStatuses };
}

async function sampleDeepSeekAnswers(prompts: SamplePrompt[]): Promise<AiSample[]> {
  const config = getConfig();
  if (!config.apiKey) {
    throw new SamplingUnavailableError('当前服务未配置 DeepSeek 采样 key，无法生成最终 GEO 分析报告');
  }

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    timeout: 18_000
  });

  const boundedPrompts = prompts.slice(0, 24);
  return runWithConcurrency(boundedPrompts, 3, (prompt) => sampleOne(client, config.model, prompt));
}

export async function polishFinalReportWithDeepSeek(input: DiagnosisInput, report: DiagnosisReport): Promise<DiagnosisReport> {
  const config = getConfig();
  if (!config.apiKey) return report;

  try {
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: 12_000
    });

    const completion = await client.chat.completions.create({
      model: config.model,
      temperature: 0.2,
      max_tokens: 900,
      response_format: { type: 'json_object' },
      thinking: { type: 'disabled' },
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

async function sampleOne(client: OpenAI, model: string, prompt: SamplePrompt): Promise<AiSample> {
  const startedAt = Date.now();
  const sampledAt = new Date().toISOString();

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: 650,
      thinking: { type: 'disabled' },
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
        provider: 'deepseek',
        model,
        status: 'failed',
        sampledAt,
        latencyMs: Date.now() - startedAt,
        error: 'empty_answer'
      };
    }

    return {
      prompt,
      provider: 'deepseek',
      model,
      status: 'success',
      sampledAt,
      latencyMs: Date.now() - startedAt,
      answer
    };
  } catch (error) {
    return {
      prompt,
      provider: 'deepseek',
      model,
      status: 'failed',
      sampledAt,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? safeError(error.message) : 'sampling_failed'
    };
  }
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
  return {
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro'
  };
}

function buildUnavailableProviderStatuses(exclude: AiProvider[] = [], model: string | undefined, promptCount: number): AiProviderStatus[] {
  const providers: AiProvider[] = ['deepseek', 'doubao', 'kimi', 'yuanbao', 'tongyi', 'wenxin'];
  return providers
    .filter((provider) => !exclude.includes(provider))
    .map((provider) => ({
      provider,
      model: provider === 'deepseek' ? model : undefined,
      status: 'unavailable',
      promptCount,
      successCount: 0,
      failureCount: 0,
      note: provider === 'deepseek' ? 'DeepSeek 未配置。' : `${provider} adapter 已预留，当前未配置官方采样接口；不生成模拟结果。`
    }));
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

function safeError(value: string) {
  return value
    .replace(/sk-[a-zA-Z0-9_-]+/gu, '[redacted_key]')
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gu, 'Bearer [redacted]')
    .slice(0, 180);
}
