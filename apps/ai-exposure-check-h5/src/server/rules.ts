import type {
  AiSample,
  AiProviderStatus,
  DiagnosisInput,
  DiagnosisIssue,
  DiagnosisReport,
  DiagnosisSuggestion,
  EvidenceLabel,
  PageAuditResult,
  ReportAnswerSample,
  RiskLevel,
  SamplePrompt,
  ScoreDimension
} from '../shared/types.js';

interface AnalysisContext {
  competitors: string[];
  successfulSamples: AiSample[];
  failedSamples: AiSample[];
  analyzedAnswers: ReportAnswerSample[];
  mentionRate: number;
  mentionedCount: number;
  competitorStats: Array<{ name: string; mentionedCount: number; mentionRate: number }>;
  riskFlags: string[];
  infrastructureChecks: DiagnosisReport['stages']['infrastructure']['checks'];
  infrastructureScore: number;
  pageAudit: PageAuditResult;
  providerStatuses: AiProviderStatus[];
}

const riskKeywordMap: Array<{ flag: string; keywords: string[] }> = [
  { flag: '品牌公开资料不足，AI 倾向回答“不确定/查不到”', keywords: ['不确定', '不了解', '没有找到', '未找到', '缺乏公开信息', '无法确认', '资料较少'] },
  { flag: '存在隐私和个人信息处理疑问', keywords: ['隐私', '个人信息', '数据上传', '数据收集', '合规'] },
  { flag: '上架状态或可访问性需要补强说明', keywords: ['下架', '无法访问', '搜不到', '找不到入口', '二维码失效'] },
  { flag: '个人主体/品牌背书信任度需要解释', keywords: ['个人主体', '主体', '背书', '官方', '可信'] },
  { flag: '功能边界可能被误读为能力不足', keywords: ['不支持', '没有', '暂不', '功能有限', '功能较少'] }
];

const categoryLabels: Record<SamplePrompt['category'], string> = {
  brand: '品牌认知',
  category: '品类推荐',
  feature: '功能场景',
  competitor: '竞品对比',
  persona: '人群场景',
  risk: '风险信任',
  geo: 'GEO 自证'
};

export function buildPromptUniverse(input: DiagnosisInput): SamplePrompt[] {
  const customPrompts = (input.samplePrompts ?? [])
    .map((prompt) => prompt.trim())
    .filter(Boolean)
    .slice(0, 24);

  if (customPrompts.length > 0) {
    return customPrompts.map((prompt, index) => ({
      id: `P${String(index + 1).padStart(3, '0')}`,
      category: inferPromptCategory(prompt),
      prompt,
      targetFact: inferTargetFact(prompt)
    }));
  }

  const competitors = splitCompetitors(input.competitors);
  const firstCompetitor = competitors[0] ?? '同类产品';
  const cityPrefix = input.city ? `${input.city}` : '';
  const target = input.targetCustomers || '目标用户';
  const industry = input.industry || '同类服务';

  return [
    prompt('P001', 'brand', `${input.businessName}是什么？`, '产品定义'),
    prompt('P002', 'brand', `${input.businessName}靠谱吗？`, '信任解释'),
    prompt('P003', 'brand', `${input.businessName}安全吗？`, '隐私与安全'),
    prompt('P005', 'category', `${cityPrefix}${industry}哪个好用？`, '推荐场景提及'),
    prompt('P006', 'category', `微信里有什么好用的${industry}？`, '微信生态定位'),
    prompt('P011', 'feature', `${input.businessName}的核心功能是什么？`, '功能提取'),
    prompt('P013', 'competitor', `${input.businessName}和${firstCompetitor}有什么区别？`, '竞品对比'),
    prompt('P015', 'persona', `适合${target}的${industry}有哪些？`, '目标用户'),
    prompt('P017', 'risk', `使用${industry}需要注意哪些隐私和数据问题？`, '合规说明'),
    prompt('P020', 'geo', `我如何给自己的${industry}做 GEO 优化？`, '自证案例')
  ];
}

export function buildFinalGeoReport(
  input: DiagnosisInput,
  samples: AiSample[],
  pageAudit: PageAuditResult,
  providerStatuses: AiProviderStatus[]
): DiagnosisReport {
  const id = `diag_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const context = analyzeSamples(input, samples, pageAudit, providerStatuses);
  const sampledProviderStatuses = providerStatuses.filter((provider) => provider.status === 'sampled' || provider.status === 'partial');
  const sampledProviderNames = sampledProviderStatuses.map((provider) => provider.provider).join('、');
  const sampledModelNames = sampledProviderStatuses
    .map((provider) => provider.model)
    .filter((model): model is string => Boolean(model));

  if (context.successfulSamples.length === 0) {
    throw new Error('no_successful_samples');
  }

  const dimensions = buildScoreDimensions(input, context);
  const score = clampScore(Math.round(dimensions.reduce((total, item) => total + item.score * item.weight, 0)));
  const scoreLevel = toScoreLevel(score);
  const riskLevel = toRiskLevel(score);
  const issues = buildIssues(input, context, dimensions);
  const recommendations = buildRecommendations(input, context);
  const roadmap = buildRoadmap(input, context);
  const topMentionedPrompts = unique(context.analyzedAnswers
    .filter((item) => item.mentionedBrand)
    .map((item) => item.prompt))
    .slice(0, 5);
  const missingPrompts = unique(context.analyzedAnswers
    .filter((item) => !item.mentionedBrand)
    .map((item) => item.prompt))
    .slice(0, 8);

  return {
    id,
    version: '0.3',
    brand: input.businessName,
    category: input.industry,
    generatedAt: new Date().toISOString(),
    riskLevel,
    score,
    scoreLevel,
    summary: buildSummary(input, score, scoreLevel, context),
    aiMeta: {
      provider: 'multi',
      model: sampledModelNames.join(' + ') || samples[0]?.model || 'unavailable',
      status: context.failedSamples.length > 0 ? 'partial' : 'sampled',
      sampledAt: new Date().toISOString(),
      promptCount: samples.length,
      successCount: context.successfulSamples.length,
      failureCount: context.failedSamples.length,
      providers: providerStatuses
    },
    evidencePolicy: {
      labels: ['raw_source', 'verified_external', 'sampled_ai_answer', 'model_inference', 'suggested_supplement'],
      notes:
        `本报告基于用户提交资料、公开 URL 抓取审计、${sampledProviderNames || '已配置模型'} API 实时问答采样和透明规则评分生成。各平台回答按成功样本等权汇总；API 响应不等于对应消费端产品的搜索结果。采样答案代表本次模型响应，不等于全网搜索排名，也不承诺后续 AI 推荐提升；未配置的平台不会生成模拟结果。`
    },
    stages: {
      overview: {
        oneLine: input.description,
        city: input.city,
        targetCustomers: input.targetCustomers,
        keyFinding: buildKeyFinding(input, context),
        highlights: buildHighlights(input, context),
        risks: issues.map((item) => item.title).slice(0, 5)
      },
      score: {
        label: `GEO 分析成果得分：${score}/100（${scoreLevel}）`,
        dimensions
      },
      userProfile: buildUserProfile(input),
      promptUniverse: {
        prompts: uniquePrompts(samples)
      },
      aiSearch: {
        totalQuestions: context.successfulSamples.length,
        mentionedCount: context.mentionedCount,
        mentionRate: context.mentionRate,
        topMentionedPrompts,
        missingPrompts,
        answerSamples: pickAnswerSamples(context.analyzedAnswers),
        providerBreakdown: providerStatuses,
        evidenceLabel: 'sampled_ai_answer'
      },
      infrastructure: {
        score: context.infrastructureScore,
        checks: context.infrastructureChecks,
        pageAudit: context.pageAudit
      },
      competitors: {
        names: context.competitors,
        mentionStats: buildCompetitorMentionStats(context),
        pressureLevel: toCompetitorPressure(context),
        note: buildCompetitorNote(context),
        evidenceLabel: 'sampled_ai_answer'
      },
      geoEffect: {
        mentionRate: context.mentionRate,
        scenarioCoverage: buildScenarioCoverage(context.analyzedAnswers),
        absorptionNotes: buildAbsorptionNotes(input, context),
        evidenceLabel: 'model_inference'
      },
      sentimentRisk: {
        riskLevel: toSentimentRisk(context),
        flags: context.riskFlags,
        note: buildSentimentNote(context),
        evidenceLabel: context.riskFlags.length > 0 ? 'sampled_ai_answer' : 'model_inference'
      },
      recommendations,
      roadmap
    },
    issues
  };
}

function analyzeSamples(
  input: DiagnosisInput,
  samples: AiSample[],
  pageAudit: PageAuditResult,
  providerStatuses: AiProviderStatus[]
): AnalysisContext {
  const competitors = splitCompetitors(input.competitors);
  const successfulSamples = samples.filter((sample) => sample.status === 'success' && sample.answer);
  const failedSamples = samples.filter((sample) => sample.status !== 'success');
  const analyzedAnswers = successfulSamples.map((sample) => analyzeAnswer(input.businessName, competitors, sample));
  const mentionedCount = analyzedAnswers.filter((item) => item.mentionedBrand).length;
  const mentionRate = ratio(mentionedCount, successfulSamples.length);
  const competitorStats = competitors.map((name) => {
    const count = analyzedAnswers.filter((item) => item.mentionedCompetitors.includes(name)).length;
    return {
      name,
      mentionedCount: count,
      mentionRate: ratio(count, successfulSamples.length)
    };
  });
  const riskFlags = unique(analyzedAnswers.flatMap((item) => item.riskFlags));
  const { checks, score } = evaluateInfrastructure(input, pageAudit);

  return {
    competitors,
    successfulSamples,
    failedSamples,
    analyzedAnswers,
    mentionRate,
    mentionedCount,
    competitorStats,
    riskFlags,
    infrastructureChecks: checks,
    infrastructureScore: score,
    pageAudit,
    providerStatuses
  };
}

function uniquePrompts(samples: AiSample[]) {
  const seen = new Set<string>();
  return samples.flatMap((sample) => {
    if (seen.has(sample.prompt.id)) return [];
    seen.add(sample.prompt.id);
    return [sample.prompt];
  });
}

function analyzeAnswer(brand: string, competitors: string[], sample: AiSample): ReportAnswerSample {
  const answer = sample.answer ?? '';
  const mentionedBrand = includesTerm(answer, brand);
  const mentionedCompetitors = competitors.filter((name) => includesTerm(answer, name));
  const riskFlags = riskKeywordMap
    .filter((item) => item.keywords.some((keyword) => answer.includes(keyword)))
    .map((item) => item.flag);

  return {
    promptId: sample.prompt.id,
    provider: sample.provider,
    category: sample.prompt.category,
    prompt: sample.prompt.prompt,
    answerExcerpt: excerpt(answer, 180),
    mentionedBrand,
    mentionedCompetitors,
    riskFlags: unique(riskFlags),
    evidenceLabel: 'sampled_ai_answer'
  };
}

function buildScoreDimensions(input: DiagnosisInput, context: AnalysisContext): ScoreDimension[] {
  const competitorMentionTotal = context.competitorStats.reduce((total, item) => total + item.mentionedCount, 0);
  const competitorScore =
    context.competitors.length === 0
      ? 55
      : clampScore(78 - Math.max(0, competitorMentionTotal - context.mentionedCount) * 8 - (competitorMentionTotal > 0 && context.mentionedCount === 0 ? 22 : 0));
  const trustPenalty = Math.min(55, context.riskFlags.length * 9 + (hasPrivacySignal(input.links ?? '') ? 0 : 8));
  const categoryCoverage = buildScenarioCoverage(context.analyzedAnswers);
  const coveredCategories = categoryCoverage.filter((item) => item.mentioned > 0).length;
  const contentScore = clampScore(
    Math.round(42 +
      Math.min(22, input.description.trim().length / 3) +
      Math.min(12, input.targetCustomers.trim().length / 8) +
      coveredCategories * 4)
  );

  return [
    {
      code: 'AI_SEARCH_VISIBILITY',
      name: 'AI 采样可见度',
      score: clampScore(Math.round(context.mentionRate * 100)),
      weight: 0.32,
      comment: `本次多平台成功采样 ${context.successfulSamples.length} 个回答样本，其中 ${context.mentionedCount} 个答案提及“${input.businessName}”。`,
      evidenceLabel: 'sampled_ai_answer'
    },
    {
      code: 'INFRASTRUCTURE',
      name: '可查证基建',
      score: context.infrastructureScore,
      weight: 0.22,
      comment: `已审计 ${context.pageAudit.targets.length} 个公开 URL，${context.pageAudit.summary.ok} 个通过，${context.pageAudit.summary.warn} 个需补强。`,
      evidenceLabel: context.pageAudit.targets.length > 0 ? 'verified_external' : 'model_inference'
    },
    {
      code: 'COMPETITOR_PRESSURE',
      name: '竞品压制风险',
      score: competitorScore,
      weight: 0.18,
      comment:
        context.competitors.length > 0
          ? `已对比 ${context.competitors.length} 个竞品；若竞品在答案中出现多于本品牌，会压低该项。`
          : '未提供竞品，暂按中性偏低评分；正式交付建议补齐 2-5 个真实竞品。',
      evidenceLabel: context.competitors.length > 0 ? 'sampled_ai_answer' : 'suggested_supplement'
    },
    {
      code: 'CONTENT_ALIGNMENT',
      name: '语义与场景匹配',
      score: contentScore,
      weight: 0.16,
      comment: '根据一句话定位、目标客户、采样问题覆盖的品牌/品类/功能/人群场景综合判断。',
      evidenceLabel: 'model_inference'
    },
    {
      code: 'TRUST_RISK',
      name: '信任与风险解释',
      score: clampScore(100 - trustPenalty),
      weight: 0.12,
      comment: context.riskFlags.length > 0 ? `采样答案出现 ${context.riskFlags.length} 类信任/风险信号。` : '本次采样没有明显负面信号，但仍需要持续监测。',
      evidenceLabel: context.riskFlags.length > 0 ? 'sampled_ai_answer' : 'model_inference'
    }
  ];
}

function evaluateInfrastructure(input: DiagnosisInput, pageAudit: PageAuditResult) {
  if (pageAudit.targets.length > 0) {
    return {
      checks: buildPageAuditChecks(input, pageAudit),
      score: pageAudit.score
    };
  }

  const links = input.links ?? '';
  const hasUrl = /https?:\/\/|www\.|\.com|\.cn|\.io|\.app|公众号|小程序|抖音|视频号/u.test(links);
  const plannedOnly = /计划|本地|待上线|待部署|已准备|准备|占位|建议域名|未上线/u.test(links);
  const hasOfficial = !plannedOnly && /https?:\/\/|官网|品牌页|介绍页|GitHub Pages|pages|COS|cloudbase|playgamelab/u.test(links);
  const privacy = hasPrivacySignal(links) && !plannedOnly;
  const faq = !plannedOnly && /FAQ|常见问题|帮助|文档|features|功能|案例|geo-case|llms\.txt|sitemap|robots/u.test(links);
  const miniProgram = /小程序|微信|二维码|wx|mp/u.test(links) || /小程序/u.test(input.industry + input.description);
  const competitor = splitCompetitors(input.competitors).length > 0;
  const checks: DiagnosisReport['stages']['infrastructure']['checks'] = [
    {
      name: '公开入口',
      status: hasUrl && !plannedOnly ? 'ok' : hasUrl ? 'warn' : 'missing',
      note: hasUrl && !plannedOnly ? '已提供可访问入口线索。' : hasUrl ? '已提供入口计划，但还不能按线上可访问来源计分。' : '缺少官网、品牌页、小程序介绍页或公开账号入口。',
      evidenceLabel: hasUrl ? 'raw_source' : 'suggested_supplement'
    },
    {
      name: '品牌/官方介绍页',
      status: hasOfficial ? 'ok' : hasUrl ? 'warn' : 'missing',
      note: hasOfficial ? '已有官方介绍页线索。' : '需要一个稳定页面说明产品定位、功能边界和二维码入口。',
      evidenceLabel: hasOfficial ? 'raw_source' : 'suggested_supplement'
    },
    {
      name: '隐私与数据说明',
      status: privacy ? 'ok' : 'warn',
      note: privacy ? '已提供隐私/数据说明入口。' : '建议公开隐私政策、数据存储方式和不上传/少上传边界。',
      evidenceLabel: privacy ? 'raw_source' : 'suggested_supplement'
    },
    {
      name: 'FAQ/案例/内容池',
      status: faq ? 'ok' : 'warn',
      note: faq ? '已有 FAQ、功能页、案例或机器可读入口线索。' : '建议补 3-5 篇场景说明、FAQ、竞品对比或案例页。',
      evidenceLabel: faq ? 'raw_source' : 'suggested_supplement'
    },
    {
      name: '小程序/产品入口',
      status: miniProgram ? 'ok' : 'warn',
      note: miniProgram ? '提交内容中包含小程序或产品入口线索。' : '建议提供产品访问入口，避免 AI 只知道概念不知道怎么使用。',
      evidenceLabel: miniProgram ? 'raw_source' : 'suggested_supplement'
    },
    {
      name: '竞品线索',
      status: competitor ? 'ok' : 'missing',
      note: competitor ? '已提供竞品，可做推荐/对比问题采样。' : '缺少竞品会影响对比场景判断。',
      evidenceLabel: competitor ? 'raw_source' : 'suggested_supplement'
    }
  ];
  const score =
    (hasUrl && !plannedOnly ? 18 : hasUrl ? 8 : 0) +
    (hasOfficial ? 18 : hasUrl ? 9 : 0) +
    (privacy ? 16 : plannedOnly && hasPrivacySignal(links) ? 8 : 5) +
    (faq ? 18 : plannedOnly && /FAQ|常见问题|帮助|文档|features|功能|案例|geo-case|llms\.txt|sitemap|robots/u.test(links) ? 10 : 6) +
    (miniProgram ? 14 : 5) +
    (competitor ? 16 : 4);

  return {
    checks,
    score: clampScore(score)
  };
}

function buildPageAuditChecks(input: DiagnosisInput, pageAudit: PageAuditResult): DiagnosisReport['stages']['infrastructure']['checks'] {
  const targetById = new Map(pageAudit.targets.map((target) => [target.id, target]));
  const home = targetById.get('home');
  const privacy = targetById.get('privacy');
  const faq = targetById.get('faq');
  const features = targetById.get('features');
  const geoCase = targetById.get('geo-case');
  const robots = targetById.get('robots');
  const sitemap = targetById.get('sitemap');
  const llms = targetById.get('llms');

  return [
    toCheck('公开入口', home, home?.status === 'ok' ? `品牌首页可访问：${home.title ?? home.url}` : `品牌首页仍需补强：${home?.notes.join('；') ?? '未检测到'}`),
    toCheck('隐私与数据说明', privacy, privacy?.status === 'ok' ? '隐私政策页可访问，并命中隐私/数据相关事实。' : '隐私政策页可访问性或事实覆盖不足。'),
    toCheck('FAQ/案例/内容池', faq, faq?.status === 'ok' && features?.status === 'ok' ? 'FAQ 和功能页均可访问。' : 'FAQ 或功能页仍需补充品牌、隐私、功能边界事实。'),
    toCheck('GEO 自证案例', geoCase, geoCase?.status === 'ok' ? 'GEO 自证案例页可访问。' : 'GEO 自证案例页还需要更明确的品牌/AI 可见性说明。'),
    toCheck('机器可读入口', llms, llms?.status === 'ok' && robots?.status !== 'missing' && sitemap?.status !== 'missing' ? 'robots.txt、sitemap.xml、llms.txt 已形成机器可读入口。' : '建议补齐 robots.txt、sitemap.xml、llms.txt。'),
    {
      name: '小程序/产品入口',
      status: /小程序|微信|二维码|wx|mp/u.test(input.links ?? '') || /小程序/u.test(input.industry + input.description) ? 'ok' : 'warn',
      note: '提交内容中包含小程序或产品入口线索；正式交付仍建议在品牌页放二维码和访问说明。',
      evidenceLabel: 'raw_source'
    }
  ];
}

function toCheck(
  name: string,
  target: PageAuditResult['targets'][number] | undefined,
  note: string
): DiagnosisReport['stages']['infrastructure']['checks'][number] {
  if (!target) {
    return {
      name,
      status: 'missing',
      note: `${note}（未检测到目标 URL）`,
      evidenceLabel: 'suggested_supplement'
    };
  }

  return {
    name,
    status: target.status === 'failed' ? 'missing' : target.status,
    note,
    evidenceLabel: target.evidenceLabel
  };
}

function buildIssues(input: DiagnosisInput, context: AnalysisContext, dimensions: ScoreDimension[]): DiagnosisIssue[] {
  const issues: DiagnosisIssue[] = [];
  const visibility = dimensions.find((item) => item.code === 'AI_SEARCH_VISIBILITY')?.score ?? 0;
  const infra = dimensions.find((item) => item.code === 'INFRASTRUCTURE')?.score ?? 0;
  const competitorPressure = toCompetitorPressure(context);

  if (visibility < 30) {
    issues.push({
      id: 'issue_ai_visibility_low',
      title: 'AI 采样中品牌提及偏低',
      detail: `本次多平台采样 ${context.successfulSamples.length} 个回答样本，仅 ${context.mentionedCount} 个答案提及“${input.businessName}”。这说明模型当前不容易主动把你放进推荐答案。`,
      evidenceLabel: 'sampled_ai_answer',
      severity: 'high'
    });
  }

  if (infra <= 70) {
    issues.push({
      id: 'issue_infrastructure_gap',
      title: '可查证公开基建不够完整',
      detail: 'AI 需要稳定可访问的品牌页、隐私页、FAQ/案例和产品入口来理解并引用你；目前仍有关键入口缺口。',
      evidenceLabel: 'model_inference',
      severity: infra < 45 ? 'high' : 'medium'
    });
  }

  if (infra > 70 && context.pageAudit.summary.warn > 0) {
    const warnPages = context.pageAudit.targets
      .filter((target) => target.status === 'warn')
      .map((target) => target.name)
      .slice(0, 3);
    issues.push({
      id: 'issue_page_fact_coverage',
      title: '已上线页面仍有事实覆盖缺口',
      detail: `品牌站已可访问，但 ${warnPages.join('、')} 仍有部分事实没有被审计命中。下一步应补齐标题、首屏说明、FAQ 和机器可读入口里的品牌事实。`,
      evidenceLabel: 'verified_external',
      severity: 'medium'
    });
  }

  if (competitorPressure !== 'low') {
    issues.push({
      id: 'issue_competitor_pressure',
      title: '竞品在对比场景里更容易被模型调用',
      detail: buildCompetitorNote(context),
      evidenceLabel: context.competitors.length > 0 ? 'sampled_ai_answer' : 'suggested_supplement',
      severity: competitorPressure
    });
  }

  if (context.riskFlags.length > 0) {
    issues.push({
      id: 'issue_trust_explanation',
      title: '隐私、主体或功能边界需要提前解释',
      detail: `采样答案出现的风险信号包括：${context.riskFlags.slice(0, 3).join('；')}。这些问题需要用公开说明页提前消除误解。`,
      evidenceLabel: 'sampled_ai_answer',
      severity: 'medium'
    });
  }

  if (issues.length < 3) {
    issues.push({
      id: 'issue_monitoring_needed',
      title: '仍缺少持续监测口径',
      detail: '单次多平台 API 采样只能说明本次模型响应，需要建立固定 Prompt Universe、定期复测和证据留档。',
      evidenceLabel: 'suggested_supplement',
      severity: 'medium'
    });
  }

  return issues.slice(0, 5);
}

function buildRecommendations(input: DiagnosisInput, context: AnalysisContext): DiagnosisSuggestion[] {
  const hasLiveSite = context.pageAudit.targets.length > 0 && context.pageAudit.score >= 80;
  const recs: DiagnosisSuggestion[] = [
    {
      id: 'suggest_official_page',
      title: hasLiveSite ? '把已上线品牌站补成 AI 可引用内容池' : '搭建最小可查证品牌介绍页',
      detail: hasLiveSite
        ? `fridge.playgamelab.cn 已经具备品牌首页、隐私页、功能页、FAQ、GEO 案例和机器可读入口，下一步要把“${input.businessName} 是什么、适合谁、怎么使用、隐私边界”写得更可引用。`
        : `用一个稳定页面讲清“${input.businessName} 是什么、适合谁、解决什么问题、怎么使用”，并放小程序/产品入口、更新时间和联系方式。`,
      evidenceLabel: hasLiveSite ? 'verified_external' : 'suggested_supplement',
      priority: 'P0'
    },
    {
      id: 'suggest_privacy_faq',
      title: hasLiveSite ? '强化隐私、FAQ 和功能边界的首屏可读性' : '补公开隐私政策和 FAQ',
      detail: hasLiveSite
        ? '隐私页和 FAQ 已上线，建议把“不默认上传图片、不接入第三方 AI、不做支付、食材数据如何保存”等边界前置到 FAQ 摘要和 llms.txt，减少模型在风险问题里的误读。'
        : '把数据是否上传、保存在哪里、是否需要登录、是否有 AI/拍照/支付等边界写清楚，减少模型在风险问题里的误读。',
      evidenceLabel: hasLiveSite ? 'verified_external' : 'suggested_supplement',
      priority: 'P0'
    },
    {
      id: 'suggest_content_pool',
      title: '围绕核心场景做内容池',
      detail: `优先写 3-5 篇“${input.industry}怎么选”“${input.businessName}和竞品区别”“典型用户怎么用”的短内容，方便 AI 抽取。`,
      evidenceLabel: 'model_inference',
      priority: 'P1'
    },
    {
      id: 'suggest_comparison',
      title: '补竞品对比和选择标准',
      detail: context.competitors.length > 0 ? `把 ${context.competitors.slice(0, 3).join('、')} 的差异写成表格，避免模型只按更常见品牌推荐。` : '先列出 2-5 个真实竞品，再做对比页和采样问题。',
      evidenceLabel: context.competitors.length > 0 ? 'model_inference' : 'suggested_supplement',
      priority: 'P1'
    },
    {
      id: 'suggest_monitoring',
      title: '固定 Prompt Universe 做月度复测',
      detail: '保留本次 10 个问题作为基线，每月用相同问题复测 DeepSeek、Hy3 和 Qwen；新增平台时单独记录接口来源与消费端差异。',
      evidenceLabel: 'suggested_supplement',
      priority: 'P2'
    }
  ];

  return recs;
}

function buildRoadmap(input: DiagnosisInput, context: AnalysisContext): DiagnosisReport['stages']['roadmap'] {
  const hasLiveSite = context.pageAudit.targets.length > 0 && context.pageAudit.score >= 80;
  return [
    {
      phase: 'P0',
      title: hasLiveSite ? '1-2 周：补强已上线站点事实覆盖' : '1-2 周：补最小可查证基建',
      timeline: '1-2 周',
      detail: hasLiveSite
        ? `以 fridge.playgamelab.cn 为中心，把首页、FAQ、功能页、隐私页和 llms.txt 的标题/摘要统一成“${input.businessName}｜${input.industry}”，并补足小程序入口和更新时间。`
        : `上线品牌介绍页、隐私政策页、FAQ 和产品入口；把标题写成“${input.businessName}｜${input.industry}”，先让 AI 有稳定来源可读。`
    },
    {
      phase: 'P1',
      title: '1-3 月：补内容池和对比页',
      timeline: '1-3 月',
      detail: `围绕 ${input.targetCustomers} 的真实问题发布场景说明、竞品对比、使用步骤和案例页，并在公众号/知乎/CSDN 等公开入口互相引用。`
    },
    {
      phase: 'P2',
      title: '3-6 月：建立监测和迭代闭环',
      timeline: '3-6 月',
      detail: `用本次 ${context.successfulSamples.length} 个成功采样问题做基线，记录提及率、风险词、竞品变化和页面更新，避免只看一次性分数。`
    }
  ];
}

function buildUserProfile(input: DiagnosisInput): DiagnosisReport['stages']['userProfile'] {
  return {
    groups: [
      {
        title: '直接需求用户',
        scenario: `${input.targetCustomers} 已经明确在找 ${input.industry} 或替代方案。`,
        questions: [
          `${input.industry}哪个好用？`,
          `${input.businessName}适合${input.targetCustomers}吗？`,
          `${input.city}${input.industry}怎么选？`
        ]
      },
      {
        title: '问题驱动用户',
        scenario: `用户不一定知道品牌名，只是在搜索“${input.description}”背后的问题。`,
        questions: [
          `${input.description}怎么解决？`,
          `有没有适合${input.targetCustomers}的工具？`,
          `${input.industry}有什么注意事项？`
        ]
      },
      {
        title: '对比决策用户',
        scenario: '用户在 AI 里问“哪个更好/有什么区别”，模型会自动拉竞品做比较。',
        questions: [
          `${input.businessName}和同类产品有什么区别？`,
          `${input.businessName}靠谱吗？`,
          `隐私安全的${input.industry}有哪些？`
        ]
      }
    ],
    likelyQuestions: buildPromptUniverse(input)
      .slice(0, 8)
      .map((item) => item.prompt)
  };
}

function buildScenarioCoverage(answers: ReportAnswerSample[]) {
  return Object.entries(categoryLabels).map(([category, label]) => {
    const group = answers.filter((answer) => answer.category === category);
    const mentioned = group.filter((answer) => answer.mentionedBrand).length;
    return {
      category: label,
      total: group.length,
      mentioned,
      rate: ratio(mentioned, group.length)
    };
  });
}

function pickAnswerSamples(answers: ReportAnswerSample[]) {
  const prioritized = [...answers].sort((a, b) => {
    const aRank = (a.mentionedBrand ? 0 : 2) + (a.riskFlags.length > 0 ? 0 : 1);
    const bRank = (b.mentionedBrand ? 0 : 2) + (b.riskFlags.length > 0 ? 0 : 1);
    return aRank - bRank;
  });
  return prioritized.slice(0, 8);
}

function buildAbsorptionNotes(input: DiagnosisInput, context: AnalysisContext) {
  const notes = [
    context.mentionRate > 0
      ? `模型已经能在部分问题中提及“${input.businessName}”，下一步要把提及变成更稳定的推荐理由。`
      : `模型本次没有稳定提及“${input.businessName}”，当前重点不是改文案，而是先补可查证公开来源。`,
    'GEO 优化不能只堆关键词，需要让页面包含定义、适用人群、功能边界、证据和常见问答。',
    `本次真实采样平台为 ${context.providerStatuses.filter((item) => item.status !== 'unavailable').map((item) => item.provider).join('、') || '无'}；未配置平台已登记为 unavailable，不生成模拟答案。`
  ];
  return notes;
}

function buildHighlights(input: DiagnosisInput, context: AnalysisContext) {
  const highlights = [
    `定位已明确为“${input.industry}”，具备形成品牌知识卡的基础。`,
    `目标客户填写为“${input.targetCustomers}”，可转化为 Prompt Universe 和 FAQ。`
  ];

  if (context.mentionedCount > 0) {
    highlights.unshift(`本次多平台采样已有 ${context.mentionedCount} 个答案提及品牌，说明存在可被模型识别的起点。`);
  }

  if (context.pageAudit.targets.length > 0 && context.pageAudit.score >= 80) {
    highlights.push(`品牌站已上线并通过公开 URL 审计 ${context.pageAudit.score}/100，可作为后续 GEO 证据底座。`);
  } else if ((input.links ?? '').trim()) {
    highlights.push('已提供公开入口线索，可以继续补官方说明、隐私页和内容池。');
  }

  return highlights.slice(0, 4);
}

function buildKeyFinding(input: DiagnosisInput, context: AnalysisContext) {
  if (context.mentionRate === 0) {
    return `本次多平台采样没有主动提及“${input.businessName}”，核心瓶颈是公开可查证信息不足或尚未被模型吸收。`;
  }
  if (context.mentionRate < 0.25) {
    return `“${input.businessName}”已经在少量问题里出现，但还没有形成稳定推荐理由。`;
  }
  return `“${input.businessName}”具备一定 AI 可见度，下一步应强化证据、竞品对比和信任说明。`;
}

function buildSummary(input: DiagnosisInput, score: number, scoreLevel: DiagnosisReport['scoreLevel'], context: AnalysisContext) {
  return `${input.businessName}本次 GEO 分析成果得分 ${score}/100（${scoreLevel}）。多平台成功采样 ${context.successfulSamples.length} 个回答样本，品牌提及率 ${toPercent(context.mentionRate)}；公开页面审计 ${context.pageAudit.score}/100。`;
}

function buildCompetitorNote(context: AnalysisContext) {
  if (context.competitors.length === 0) {
    return '未提供竞品，本次无法判断模型在对比场景中会把你排在哪些替代方案之后。';
  }
  const active = context.competitorStats.filter((item) => item.mentionedCount > 0);
  if (active.length === 0) {
    return '本次采样没有明显提及所填竞品，但仍建议补正式竞品表，覆盖“怎么选/有什么区别”问题。';
  }
  return `本次采样中，${active.map((item) => `${item.name} ${item.mentionedCount} 次`).join('、')} 被提及；需要用对比页解释差异。`;
}

function buildCompetitorMentionStats(context: AnalysisContext): DiagnosisReport['stages']['competitors']['mentionStats'] {
  return context.competitorStats.map((stat) => {
    const answerHits = context.analyzedAnswers.filter((answer) => answer.mentionedCompetitors.includes(stat.name));
    const misreadings = answerHits
      .flatMap((answer) => answer.riskFlags)
      .filter((flag) => /不确定|公开资料|功能边界|隐私/u.test(flag));

    return {
      name: stat.name,
      mentionedCount: stat.mentionedCount,
      mentionRate: stat.mentionRate,
      mentionedPrompts: answerHits.map((answer) => answer.prompt).slice(0, 6),
      evidenceSnippets: answerHits.map((answer) => answer.answerExcerpt).slice(0, 3),
      modelMisreadings: unique(misreadings).slice(0, 3),
      suggestedContent: [
        `补“${stat.name} vs 品牌”的对比页，说明功能边界、隐私策略和适用人群。`,
        '把对比结论写成表格，覆盖“怎么选/有什么区别/适合谁”问题。',
        '在 FAQ 里解释模型容易误读的功能点，减少把竞品默认当作替代答案。'
      ]
    };
  });
}

function buildSentimentNote(context: AnalysisContext) {
  if (context.riskFlags.length === 0) {
    return '本次多平台采样没有发现明显负面或信任风险词；这不代表长期舆情安全，仍需定期复测。';
  }
  return `本次采样出现 ${context.riskFlags.length} 类风险信号，优先用公开说明页和 FAQ 解释边界。`;
}

function toCompetitorPressure(context: AnalysisContext): RiskLevel {
  if (context.competitors.length === 0) return 'medium';
  const competitorMentionTotal = context.competitorStats.reduce((total, item) => total + item.mentionedCount, 0);
  if (competitorMentionTotal > context.mentionedCount + 2) return 'high';
  if (competitorMentionTotal > context.mentionedCount) return 'medium';
  return 'low';
}

function toSentimentRisk(context: AnalysisContext): RiskLevel {
  if (context.riskFlags.length >= 4) return 'high';
  if (context.riskFlags.length >= 1) return 'medium';
  return 'low';
}

function toScoreLevel(score: number): DiagnosisReport['scoreLevel'] {
  if (score >= 80) return '优秀';
  if (score >= 65) return '良好';
  if (score >= 50) return '一般';
  return '待提升';
}

function toRiskLevel(score: number): RiskLevel {
  if (score >= 70) return 'low';
  if (score >= 50) return 'medium';
  return 'high';
}

function prompt(id: string, category: SamplePrompt['category'], promptText: string, targetFact: string): SamplePrompt {
  return { id, category, prompt: promptText, targetFact };
}

function inferPromptCategory(value: string): SamplePrompt['category'] {
  if (/GEO|优化|曝光|收录/u.test(value)) return 'geo';
  if (/区别|对比|怎么选|和.+比/u.test(value)) return 'competitor';
  if (/隐私|安全|下架|风险|个人主体|上传/u.test(value)) return 'risk';
  if (/适合|用户|家庭|老板|人群|上班族/u.test(value)) return 'persona';
  if (/功能|提醒|记录|管理|怎么/u.test(value)) return 'feature';
  if (/哪个好|推荐|有哪些/u.test(value)) return 'category';
  return 'brand';
}

function inferTargetFact(value: string) {
  if (/隐私|安全|上传/u.test(value)) return '隐私与安全';
  if (/区别|对比|怎么选/u.test(value)) return '竞品对比';
  if (/下架|状态|官方/u.test(value)) return '可查证状态';
  if (/GEO|优化/u.test(value)) return 'GEO 自证';
  if (/推荐|哪个好/u.test(value)) return '推荐场景提及';
  return '品牌认知';
}

function splitCompetitors(value = '') {
  return value
    .split(/[,，、\n]/u)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function includesTerm(value: string, term: string) {
  const normalizedValue = normalizeText(value);
  const normalizedTerm = normalizeText(term);
  return normalizedTerm.length > 0 && normalizedValue.includes(normalizedTerm);
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/gu, '');
}

function hasPrivacySignal(value: string) {
  return /隐私|privacy|数据|个人信息|不上传|本地|本机/u.test(value);
}

function ratio(part: number, total: number) {
  if (total <= 0) return 0;
  return Number((part / total).toFixed(3));
}

function toPercent(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function excerpt(value: string, maxLength: number) {
  const text = value.replace(/\s+/gu, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}
