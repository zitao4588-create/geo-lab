import type { DiagnosisInput, PageAuditResult } from '../shared/types.js';
import { normalizeIdentity } from './domain.js';

export { normalizeIdentity } from './domain.js';

const genericAliases = new Set([
  '官网', '首页', '产品', '服务', '工具', '软件', '应用', '平台', '小程序', '门店', '门店服务', '本地服务',
  '餐饮', '餐饮服务', '火锅', '火锅餐饮', '电动剃须刀', '剃须刀', '商品', '品牌'
]);
const removableSuffixes = [
  '火锅餐饮门店服务', '餐饮门店服务', '本地服务', '门店服务', '电动剃须刀', '微信小程序',
  '剃须刀', '小程序', '软件', '应用', '平台', '工具', '产品', '服务', '官网'
];
const modelTokenSource = '[A-Z][A-Z0-9-]{2,19}';

export function buildEntityAliases(input: DiagnosisInput) {
  const candidates = new Set<string>();
  const add = (value: string) => {
    const cleaned = value.trim();
    const normalized = normalizeIdentity(cleaned);
    if (normalized.length < 2 || genericAliases.has(normalized)) return;
    candidates.add(cleaned);
  };

  add(input.businessName);
  const withoutCity = removeAll(input.businessName, input.city);
  add(withoutCity);

  for (const initial of [input.businessName, withoutCity]) {
    let value = initial.trim();
    for (const suffix of removableSuffixes) {
      if (value.endsWith(suffix)) {
        value = value.slice(0, -suffix.length).trim();
        add(value);
      }
    }
    add(removeAll(value, input.city));
    add(value.replace(/\d+(?:\.\d+)?$/u, '').trim());
  }

  return [...candidates].sort((left, right) => normalizeIdentity(right).length - normalizeIdentity(left).length);
}

export function includesEntityAlias(value: string, input: DiagnosisInput) {
  const normalized = normalizeIdentity(value);
  return buildEntityAliases(input).some((alias) => normalized.includes(normalizeIdentity(alias)));
}

export function extractModelIdentifiers(value: string) {
  const candidates = value.match(new RegExp(`\\b${modelTokenSource}\\b`, 'giu')) ?? [];
  return unique(candidates
    .map((model) => model.toUpperCase())
    .filter((model) => /\d/u.test(model)));
}

export function extractClaimedPrimaryModels(value: string) {
  const patterns = [
    new RegExp(`(?:官方)?主型号(?:为|是|：|:)?\\s*(${modelTokenSource})`, 'giu'),
    new RegExp(`(?:官方|对应)?型号(?:为|是|：|:)?\\s*(${modelTokenSource})`, 'giu'),
    new RegExp(`对应(?:的)?(?:官方)?型号(?:为|是|：|:)?\\s*(${modelTokenSource})`, 'giu')
  ];
  const models = patterns.flatMap((pattern) => [...value.matchAll(pattern)]
    .map((match) => match[1]?.toUpperCase())
    .filter((model): model is string => typeof model === 'string' && /\d/u.test(model)));
  return unique(models as string[]);
}

export function extractVerifiedOfficialModels(pageAudit: PageAuditResult) {
  const hasSubmittedTarget = pageAudit.targets.some((target) => target.submitted);
  const verifiedTargets = pageAudit.targets.filter((target) => (!hasSubmittedTarget || target.submitted) && isScopeVerifiedTarget(target));
  const factModels = unique(verifiedTargets.flatMap((target) => target.matchedFacts.flatMap(extractModelIdentifiers)));
  if (factModels.length > 0) return factModels;
  return unique(verifiedTargets.flatMap((target) => [target.canonicalUrl ?? '', target.url, target.title ?? '', target.description ?? ''].flatMap(extractModelIdentifiers)));
}

export function findSubmittedModelConflict(input: DiagnosisInput, pageAudit: PageAuditResult) {
  const submittedModels = extractModelIdentifiers(`${input.businessName} ${input.description}`);
  const officialModels = extractVerifiedOfficialModels(pageAudit);
  if (submittedModels.length === 0 || officialModels.length === 0) return null;
  if (submittedModels.some((model) => officialModels.includes(model))) return null;
  return { submittedModels, officialModels };
}

export function isScopeVerifiedTarget(target: PageAuditResult['targets'][number]) {
  return target.status === 'ok'
    && target.sourceRelation !== 'unrelated'
    && target.scopeRelation !== 'partial'
    && target.scopeRelation !== 'mismatched';
}

function removeAll(value: string, term: string) {
  const cleaned = term.trim();
  return cleaned ? value.split(cleaned).join('') : value;
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}
