import type {
  AiProvider,
  BusinessType,
  DiagnosisInput,
  EntityRecognition,
  InputAssessment,
  PageAuditResult,
  ReportAnswerSample
} from '../shared/types.js';
import {
  buildEntityAliases,
  extractClaimedPrimaryModels,
  extractModelIdentifiers,
  extractVerifiedOfficialModels,
  findSubmittedModelConflict,
  includesEntityAlias,
  isScopeVerifiedTarget
} from './entityIdentity.js';
import { inferBusinessType, normalizeIdentity } from './domain.js';

const vagueIndustries = /^(工具|服务|产品|消费品|互联网|其他|男士清洁工具)$/u;
const uncertaintyTerms = /不确定|没有听说|没听说|无法确认|无法准确|可能是|似乎是|不太清楚|查不到|尚未收录|并非官方|不是官方/u;
const softwareIdentityTerms = /小程序|软件|应用|平台|网站|库存管理|提醒/u;
const softwareCoreTerms = /小程序|软件|应用|App|平台/u;
const softwareDomainTerms = /食材|库存|临期|保质期|提醒/u;
const physicalIdentityTerms = /剃须刀|刀头|马达|电器|设备|商品|五刀头|三刀头|防水/u;
const hardwareMisreadTerms = /智能冰箱|冰箱硬件|传感器|雷达感应|雷达传感|感应探测|装置|家电|冰箱管理功能/u;
const softwareTargetDefinition = /微信小程序|食材库存管理小程序|家庭食材库存.{0,12}小程序/u;

export { inferBusinessType } from './domain.js';

export function assessDiagnosisInput(input: DiagnosisInput): InputAssessment {
  const findings: string[] = [];
  const requiredActions: string[] = [];
  const businessType = inferBusinessType(input);
  const links = (input.links ?? '').trim();
  const competitors = (input.competitors ?? '').trim();
  const descriptionLength = countReadableCharacters(input.description);
  const targetLength = countReadableCharacters(input.targetCustomers);
  const hasHttpUrl = /https?:\/\//u.test(links);
  const hasPublicCandidate = hasHttpUrl || /官网|小程序|公众号|抖音|视频号/u.test(links);
  const missingLocalScope = businessType === 'local_service' && /^(|全国|不限|线上)$/u.test(input.city.trim());

  let score = 15;
  if (descriptionLength >= 12) score += 25;
  else if (descriptionLength >= 6) score += 12;
  else {
    findings.push('一句话介绍过短，无法稳定核对产品实体和功能边界。');
    requiredActions.push('补充具体产品类型、核心功能或型号。');
  }

  if (targetLength >= 6) score += 15;
  else {
    score += 7;
    findings.push('目标客户描述较宽，场景问题可能失真。');
    requiredActions.push('补充更具体的使用人群或决策场景。');
  }

  if (input.industry.trim().length >= 4 && !vagueIndustries.test(input.industry.trim())) score += 15;
  else {
    score += 5;
    findings.push('行业口径过宽，系统无法生成自然的品类问题。');
    requiredActions.push('把行业细化到具体品类，例如“电动剃须刀”而不是“清洁工具”。');
  }

  if (hasPublicCandidate) score += 15;
  else {
    findings.push('没有可核验的官方入口，正确实体识别只能标为待确认。');
    requiredActions.push('粘贴官网、官方产品页、小程序介绍页或公开账号入口。');
  }

  if (competitors) score += 8;
  else findings.push('未提供竞品，本次不能判断真实替代关系。');
  if (input.city.trim() && !missingLocalScope) score += 5;
  if (missingLocalScope) {
    findings.push('本地服务缺少可执行的城市、门店或服务半径。');
    requiredActions.push('补充具体服务城市、门店位置或覆盖半径。');
  }
  if ((input.samplePrompts ?? []).length > 0) score += 7;

  score = Math.min(100, score);
  const status = score >= 60 && businessType !== 'generic_or_unknown' && !missingLocalScope
    ? 'ready'
    : score >= 40
      ? 'needs_confirmation'
      : 'insufficient_evidence';

  if (businessType === 'generic_or_unknown') {
    findings.push('无法判断这是实体商品、软件/小程序还是本地服务。');
    requiredActions.push('确认业务类型，避免套用错误的检测模板。');
  }

  return {
    status,
    score,
    businessType,
    findings: unique(findings),
    requiredActions: unique(requiredActions),
    officialSourceStatus: hasHttpUrl ? 'candidate' : 'missing',
    note: status === 'ready'
      ? '资料足以进入完整采样；报告仍会区分已核验事实与模型推断。'
      : '资料不足时不会消耗完整多模型采样，也不会生成伪精确总分。'
  };
}

export function assessDiagnosisSource(input: DiagnosisInput, pageAudit: PageAuditResult): InputAssessment {
  const base = assessDiagnosisInput(input);
  const submitted = pageAudit.targets.find((target) => target.submitted);
  const officialSourceStatus = submitted?.sourceRelation === 'entity_matched' ? 'verified' : base.officialSourceStatus;
  const conflict = findSubmittedModelConflict(input, pageAudit);

  if (!conflict) return { ...base, officialSourceStatus };

  const finding = `用户填写型号 ${conflict.submittedModels.join('、')} 与已核验官方型号 ${conflict.officialModels.join('、')} 冲突。`;
  return {
    ...base,
    status: 'needs_confirmation',
    officialSourceStatus,
    findings: unique([...base.findings, finding]),
    requiredActions: unique([...base.requiredActions, '请先修正型号，或确认要以官方页面主型号继续。']),
    note: '已核验来源与提交事实冲突；确认前不会消耗多模型采样或诊断限额。'
  };
}

export function classifyAnswer(
  input: DiagnosisInput,
  businessType: BusinessType,
  prompt: string,
  answer: string,
  pageAudit: PageAuditResult
): Pick<ReportAnswerSample, 'mentionedBrand' | 'brandedPrompt' | 'naturalRecommendation' | 'entityRecognition' | 'recognitionReason'> {
  const brandedPrompt = includesEntityAlias(prompt, input);
  const mentionedBrand = includesEntityAlias(answer, input);
  const naturalRecommendation = !brandedPrompt && mentionedBrand;
  const hasVerifiedSource = pageAudit.targets.some(isScopeVerifiedTarget);
  const factTerms = extractFactTerms(input, pageAudit);
  const matchedTerms = factTerms.filter((term) => includesNormalized(answer, term));
  const identityMatchesType = businessType === 'physical_product'
    ? physicalIdentityTerms.test(answer)
    : businessType === 'software_or_miniprogram'
      ? softwareCoreTerms.test(answer) && softwareDomainTerms.test(answer)
      : true;

  const officialModels = extractVerifiedOfficialModels(pageAudit);
  const answerModels = extractModelIdentifiers(answer);
  const claimedPrimaryModels = extractClaimedPrimaryModels(answer);
  const conflictingModel = officialModels.length > 0 && (
    claimedPrimaryModels.length > 0
      ? claimedPrimaryModels.some((model) => !officialModels.includes(model))
      : answerModels.length > 0 && answerModels.every((model) => !officialModels.includes(model))
  );

  if (conflictingModel) {
    return {
      brandedPrompt,
      mentionedBrand,
      naturalRecommendation: false,
      entityRecognition: 'misrecognized',
      recognitionReason: `答案型号 ${answerModels.join('、')} 与已核验型号 ${officialModels.join('、')} 冲突。`
    };
  }

  if (businessType === 'software_or_miniprogram' && hardwareMisreadTerms.test(answer) && !softwareTargetDefinition.test(answer)) {
    return {
      brandedPrompt,
      mentionedBrand,
      naturalRecommendation: false,
      entityRecognition: 'misrecognized',
      recognitionReason: '软件/小程序被回答成硬件、传感器或家电功能。'
    };
  }

  if (businessType === 'physical_product' && softwareIdentityTerms.test(answer) && !physicalIdentityTerms.test(answer)) {
    return {
      brandedPrompt,
      mentionedBrand,
      naturalRecommendation: false,
      entityRecognition: 'misrecognized',
      recognitionReason: '实体商品被回答成软件、小程序或数字平台。'
    };
  }

  if (uncertaintyTerms.test(answer)) {
    return {
      brandedPrompt,
      mentionedBrand,
      naturalRecommendation: false,
      entityRecognition: 'uncertain',
      recognitionReason: '答案包含不确定、非官方或无法确认等表述。'
    };
  }

  if (!mentionedBrand) {
    const officialModelAnchor = answerModels.some((model) => officialModels.includes(model));
    const claimedVerifiedPrimaryModel = claimedPrimaryModels.some((model) => officialModels.includes(model));
    if (hasVerifiedSource && officialModelAnchor && matchedTerms.length >= 1 && (identityMatchesType || claimedVerifiedPrimaryModel)) {
      return {
        brandedPrompt,
        mentionedBrand,
        naturalRecommendation,
        entityRecognition: 'supported',
        recognitionReason: `答案未复述完整品牌名，但与官方实体事实一致：${matchedTerms.slice(0, 3).join('、')}。`
      };
    }
    return {
      brandedPrompt,
      mentionedBrand,
      naturalRecommendation: false,
      entityRecognition: 'not_verifiable',
      recognitionReason: '答案未提及目标实体。'
    };
  }

  const enoughFacts = matchedTerms.length >= 1 && identityMatchesType;

  if (hasVerifiedSource && enoughFacts) {
    return {
      brandedPrompt,
      mentionedBrand,
      naturalRecommendation,
      entityRecognition: 'supported',
      recognitionReason: `答案与已核验实体事实一致：${matchedTerms.slice(0, 3).join('、')}。`
    };
  }

  return {
    brandedPrompt,
    mentionedBrand,
    naturalRecommendation: false,
    entityRecognition: 'not_verifiable',
    recognitionReason: hasVerifiedSource
      ? '答案提到品牌，但与已核验实体事实的匹配不足。'
      : '没有已核验官方来源，不能把字符串复述认定为正确实体识别。'
  };
}

export function buildProviderConflicts(answers: ReportAnswerSample[]) {
  const byPrompt = new Map<string, ReportAnswerSample[]>();
  for (const answer of answers) {
    const group = byPrompt.get(answer.promptId) ?? [];
    group.push(answer);
    byPrompt.set(answer.promptId, group);
  }

  const conflicts: string[] = [];
  for (const group of byPrompt.values()) {
    const statuses = unique(group.map((answer) => answer.entityRecognition));
    if (statuses.length <= 1) continue;
    const providers = group.map((answer) => `${providerName(answer.provider)}=${recognitionName(answer.entityRecognition)}`);
    conflicts.push(`${group[0]?.prompt ?? '同一问题'}：${providers.join('，')}`);
  }
  return conflicts;
}

export function calculateProviderAgreement(answers: ReportAnswerSample[]) {
  const primary = answers.filter((answer) => answer.promptId === 'P001');
  if (primary.length < 2) return null;
  const counts = new Map<EntityRecognition, number>();
  for (const answer of primary) counts.set(answer.entityRecognition, (counts.get(answer.entityRecognition) ?? 0) + 1);
  return Math.max(...counts.values()) / primary.length;
}

function extractFactTerms(input: DiagnosisInput, pageAudit: PageAuditResult) {
  const text = [
    ...buildEntityAliases(input),
    input.description,
    input.industry,
    ...pageAudit.targets.flatMap((target) => [target.title ?? '', target.description ?? '', ...target.matchedFacts])
  ].join(' ');
  const candidates = text.match(/[A-Za-z][A-Za-z0-9-]{2,}|[\p{Script=Han}]{2,8}/gu) ?? [];
  const stop = new Set(['这是', '一个', '帮助', '适合', '用户', '产品', '服务', '工具', '全国', '官方', '介绍']);
  return unique(candidates.map((item) => item.toLowerCase()).filter((item) => !stop.has(item))).slice(0, 16);
}

function countReadableCharacters(value: string) {
  return value.replace(/\s+/gu, '').length;
}

function includesNormalized(value: string, term: string) {
  const normalizedValue = normalizeIdentity(value);
  const normalizedTerm = normalizeIdentity(term);
  return normalizedTerm.length > 0 && normalizedValue.includes(normalizedTerm);
}

function providerName(provider: AiProvider) {
  return ({ deepseek: 'DeepSeek', hy3: '混元', qwen: '千问', doubao: '豆包' } as Partial<Record<AiProvider, string>>)[provider] ?? provider;
}

function recognitionName(value: EntityRecognition) {
  return {
    supported: '识别有据',
    uncertain: '不确定',
    misrecognized: '错误认知',
    not_verifiable: '无法核验'
  }[value];
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}
