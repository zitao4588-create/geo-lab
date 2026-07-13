import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const entities = JSON.parse(await readFile(path.join(here, 'entities.json'), 'utf8'));
const prompts = JSON.parse(await readFile(path.join(here, 'prompts.json'), 'utf8'));
const apiSamples = JSON.parse(await readFile(path.join(here, 'raw/api/all-samples.json'), 'utf8'));
const entityByName = new Map(entities.map((item) => [item.entity_name, item]));
const providerPlatform = { deepseek: 'DeepSeek', qwen: '通义', hy3: '腾讯元宝', doubao: '豆包' };
const consumerDirs = { deepseek: 'DeepSeek', qwen: '通义', yuanbao: '腾讯元宝', doubao: '豆包' };
const aliases = {
  flomo: ['flomo', '浮墨'],
  dreame_x50_ultra: ['x50 ultra'],
  alipay: ['支付宝'],
  qizhan_checklist: ['栖栈清单']
};

function csv(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function hasUrl(answer = '') {
  return /https?:\/\/|\b[a-z0-9-]+\.(?:com|cn|org|net|app)\b/i.test(answer);
}

function spontaneous(entityId, answer = '') {
  const normalized = answer.toLowerCase();
  return aliases[entityId].some((alias) => normalized.includes(alias.toLowerCase()));
}

const mentionPositions = {
  'api|flomo|hy3': 3,
  'api|alipay|deepseek': 1,
  'api|alipay|hy3': 2,
  'api|alipay|qwen': 1,
  'api|alipay|doubao': 2,
  'consumer|flomo|qwen': 1,
  'consumer|flomo|yuanbao': 2,
  'consumer|flomo|doubao': 5
};

function apiRecognition(entityId, promptId, provider) {
  if (promptId === 'P2') return 'unknown';
  if (entityId === 'alipay') return 'correct';
  if (entityId === 'qizhan_checklist') return promptId === 'P3' && provider === 'doubao' ? 'wrong' : 'unknown';
  if (entityId === 'flomo') {
    if (promptId === 'P1') return provider === 'deepseek' ? 'unknown' : provider === 'hy3' ? 'partial' : 'correct';
    if (promptId === 'P3') return 'correct';
    return provider === 'doubao' ? 'unknown' : provider === 'deepseek' ? 'partial' : 'correct';
  }
  if (entityId === 'dreame_x50_ultra') {
    if (promptId === 'P1') return 'unknown';
    if (promptId === 'P3') return provider === 'hy3' ? 'partial' : ['qwen', 'doubao'].includes(provider) ? 'wrong' : 'unknown';
    return provider === 'hy3' ? 'partial' : provider === 'qwen' ? 'wrong' : 'unknown';
  }
  return 'unknown';
}

function apiAccuracy(entityId, promptId, provider, status) {
  if (status !== 'success') return 'unverifiable';
  if (promptId === 'P2') return 'unverifiable';
  if (entityId === 'alipay') return promptId === 'P3' ? 'mixed' : provider === 'qwen' && promptId === 'P4' ? 'mixed' : 'correct';
  if (entityId === 'qizhan_checklist') return provider === 'doubao' && promptId === 'P3' ? 'wrong' : 'correct';
  if (entityId === 'flomo') {
    if (promptId === 'P1') return 'correct';
    if (promptId === 'P3') return 'mixed';
    if (provider === 'qwen') return 'wrong';
    if (provider === 'hy3') return 'mixed';
    return 'correct';
  }
  if (entityId === 'dreame_x50_ultra') {
    if (promptId === 'P1') return 'unverifiable';
    if (promptId === 'P3') return provider === 'deepseek' ? 'correct' : provider === 'hy3' ? 'mixed' : 'wrong';
    return provider === 'qwen' ? 'wrong' : provider === 'hy3' || provider === 'deepseek' ? 'mixed' : 'correct';
  }
  return 'unverifiable';
}

function apiMajorHallucination(entityId, promptId, provider) {
  return (
    (entityId === 'qizhan_checklist' && promptId === 'P3' && provider === 'doubao') ||
    (entityId === 'dreame_x50_ultra' && ['P3', 'P4'].includes(promptId) && provider === 'qwen') ||
    (entityId === 'dreame_x50_ultra' && promptId === 'P3' && provider === 'doubao') ||
    (entityId === 'flomo' && promptId === 'P4' && provider === 'qwen')
  );
}

function apiCitationValid(entityId, promptId, provider) {
  if (promptId !== 'P4') return false;
  if (entityId === 'flomo') return provider === 'hy3';
  if (entityId === 'dreame_x50_ultra') return provider === 'hy3';
  if (entityId === 'alipay') return ['hy3', 'qwen', 'doubao'].includes(provider);
  return false;
}

function apiOfficialSource(entityId, promptId, provider) {
  if (promptId !== 'P4' || entityId === 'qizhan_checklist') return false;
  if (entityId === 'flomo') return ['deepseek', 'hy3', 'qwen'].includes(provider);
  if (entityId === 'dreame_x50_ultra') return ['hy3', 'qwen'].includes(provider);
  return true;
}

function apiNote(entityId, promptId, provider, sample) {
  if (sample.status !== 'success') return `API failure: ${sample.error || 'unknown error'}`;
  if (entityId === 'qizhan_checklist' && promptId === 'P3' && provider === 'doubao') return '严重编造：把不存在实体写成国内行李清单工具，并虚构受众、下载渠道和榜单依据。';
  if (entityId === 'dreame_x50_ultra' && ['P3', 'P4'].includes(promptId) && provider === 'qwen') return '与官方事实相反：断言 X50 Ultra / X8 PRO OMNI 不存在或未发布。';
  if (entityId === 'dreame_x50_ultra' && promptId === 'P3' && provider === 'doubao') return '严重编造或混淆多项核心规格，不能作为产品比较依据。';
  if (entityId === 'flomo' && promptId === 'P4' && provider === 'qwen') return '把未实时核验内容标为已核验，并给出错误或不支持主张的官方/App Store 链接。';
  if (promptId === 'P2') return spontaneous(entityId, sample.answer) ? '自然推荐中提及被测实体。' : '自然推荐中未提及被测实体。';
  return '按完整原始回答与官方基准资料人工评分。';
}

const rows = [];
for (const sample of apiSamples) {
  const entity = entityByName.get(sample.entity);
  const answer = sample.answer || '';
  const isP2 = sample.promptId === 'P2';
  const mentioned = sample.status === 'success' && isP2 ? spontaneous(entity.id, answer) : false;
  rows.push({
    entity: sample.entity,
    entity_role: sample.entityRole,
    prompt_id: sample.promptId,
    channel: 'api',
    platform: providerPlatform[sample.provider],
    model_or_mode: sample.model,
    searched_web: 'false',
    entity_recognition: sample.status === 'success' ? apiRecognition(entity.id, sample.promptId, sample.provider) : 'unknown',
    spontaneous_mention: isP2 && sample.status === 'success' ? (mentioned ? 'yes' : 'no') : 'not_applicable',
    mention_position: mentioned ? mentionPositions[`api|${entity.id}|${sample.provider}`] || '' : '',
    factual_accuracy: apiAccuracy(entity.id, sample.promptId, sample.provider, sample.status),
    major_hallucination: apiMajorHallucination(entity.id, sample.promptId, sample.provider) ? 'yes' : 'no',
    citations_present: hasUrl(answer) ? 'yes' : 'no',
    citations_valid: apiCitationValid(entity.id, sample.promptId, sample.provider) ? 'yes' : 'no',
    official_source_present: apiOfficialSource(entity.id, sample.promptId, sample.provider) ? 'yes' : 'no',
    raw_evidence_path: `raw/api/${sample.provider}/${entity.id}__${sample.promptId}.md`,
    evaluator_note: apiNote(entity.id, sample.promptId, sample.provider, sample)
  });
}

function consumerInvalid(entityId, promptId, platformKey, payload) {
  if (payload.status === 'missing') return `缺失：${payload.missing_reason || '未取得回答'}`;
  if (payload.status === 'generation_stuck') return '生成卡住，停止后只保留到内部生成过程，未取得最终回答。';
  if (platformKey === 'yuanbao' && entityId === 'dreame_x50_ultra' && ['P1', 'P3'].includes(promptId)) return '仅显示“正在搜索商品”，未取得最终回答。';
  if (platformKey === 'yuanbao' && entityId === 'dreame_x50_ultra' && promptId === 'P4') return '页面返回“请求失败”，未取得最终回答。';
  if (platformKey === 'doubao' && entityId === 'alipay' && promptId === 'P2') return '页面只回显原提示词，未取得推荐回答。';
  if (platformKey === 'doubao' && entityId === 'alipay' && promptId === 'P3') return '仅显示“正在收集 PPT 素材”，未取得最终比较回答。';
  if (platformKey === 'doubao' && entityId === 'qizhan_checklist' && promptId === 'P2') return '页面只回显原提示词，未取得推荐回答。';
  return '';
}

function consumerRecognition(entityId, promptId, platformKey, invalid) {
  if (invalid || promptId === 'P2') return 'unknown';
  if (entityId === 'qizhan_checklist') return 'unknown';
  if (entityId === 'alipay') return 'correct';
  if (entityId === 'flomo') return 'correct';
  if (entityId === 'dreame_x50_ultra') return ['deepseek', 'qwen', 'doubao'].includes(platformKey) ? 'correct' : 'unknown';
  return 'unknown';
}

function consumerAccuracy(entityId, promptId, platformKey, invalid) {
  if (invalid) return 'unverifiable';
  if (promptId === 'P2') return 'unverifiable';
  if (platformKey === 'qwen' && entityId === 'flomo' && promptId === 'P1') return 'mixed';
  if (platformKey === 'doubao' && entityId === 'alipay' && promptId === 'P1') return 'mixed';
  if (entityId === 'flomo' && promptId === 'P3') return 'mixed';
  if (entityId === 'dreame_x50_ultra') return platformKey === 'qwen' && promptId === 'P1' ? 'correct' : 'mixed';
  if (entityId === 'qizhan_checklist' && platformKey === 'yuanbao' && promptId === 'P3') return 'mixed';
  if (entityId === 'qizhan_checklist' && ['qwen', 'doubao'].includes(platformKey) && promptId === 'P4') return 'mixed';
  return entityId === 'qizhan_checklist' ? 'correct' : promptId === 'P3' || promptId === 'P4' ? 'mixed' : 'correct';
}

function consumerCitationValid(entityId, promptId, platformKey, invalid, citationsPresent) {
  if (invalid || !citationsPresent) return false;
  if (promptId !== 'P4') return false;
  if (entityId === 'qizhan_checklist') return false;
  return true;
}

function consumerOfficialSource(entityId, promptId, platformKey, invalid) {
  if (invalid || promptId !== 'P4' || entityId === 'qizhan_checklist') return false;
  if (entityId === 'flomo') return true;
  if (entityId === 'dreame_x50_ultra') return platformKey === 'doubao';
  return entityId === 'alipay';
}

function consumerNote(entityId, promptId, platformKey, payload, invalid) {
  if (invalid) return invalid;
  if (platformKey === 'qwen' && entityId === 'flomo' && promptId === 'P1') return '自动搜索但把运营公司“上海仙蒂”错写为“上海鲜淡”，并混入多项未被引用充分支持的细节。';
  if (platformKey === 'qwen' && entityId === 'dreame_x50_ultra' && promptId === 'P1') return '未显示搜索，但正确识别 X50 Ultra 及 ProLeap 越障等核心特征；与 Qwen API 的“不确认/可能不存在”方向冲突。';
  if (platformKey === 'deepseek' && entityId === 'flomo' && promptId === 'P1') return '联网后正确识别 flomo；与 DeepSeek API 明确无法确认的方向冲突。';
  if (platformKey === 'deepseek' && entityId === 'dreame_x50_ultra' && ['P1', 'P3'].includes(promptId)) return '联网后正确识别并比较 X50 Ultra；与离线 DeepSeek API 的不认识方向冲突。';
  if (platformKey === 'doubao' && entityId === 'dreame_x50_ultra' && ['P1', 'P3'].includes(promptId)) return '联网后正确识别产品方向，但混合中国增强版与海外标准版规格；与豆包 API 的不认识/错误比较方向冲突。';
  if (platformKey === 'deepseek' && entityId === 'dreame_x50_ultra' && promptId === 'P4') return '提供第三方来源，但称未找到官网产品页；实际存在品牌官方产品页。';
  if (platformKey === 'doubao' && entityId === 'alipay' && promptId === 'P1') return '核心定义正确，但把支付牌照/运营主体写成支付宝（杭州）信息技术有限公司，主体信息混淆。';
  if (platformKey === 'yuanbao' && entityId === 'qizhan_checklist' && promptId === 'P3') return '明确表示实体无法核验，但仍按名称作有限推测；未把推测写成事实。';
  if (promptId === 'P2') return spontaneous(entityId, payload.answer || '') ? '自然推荐中提及被测实体。' : '自然推荐中未提及被测实体。';
  return '按完整原始回答与官方基准资料人工评分。';
}

for (const [platformKey, platformName] of Object.entries(consumerDirs)) {
  const dir = path.join(here, 'raw/consumer', platformKey);
  const files = (await readdir(dir)).filter((name) => name.endsWith('.json')).sort();
  for (const file of files) {
    const payload = JSON.parse(await readFile(path.join(dir, file), 'utf8'));
    const promptRow = prompts.find((item) => item.entity === payload.entity && item.prompt_id === payload.prompt_id);
    const entity = entities.find((item) => item.id === promptRow.entity_id);
    const invalid = consumerInvalid(entity.id, payload.prompt_id, platformKey, payload);
    const isP2 = payload.prompt_id === 'P2';
    const mentioned = !invalid && isP2 ? spontaneous(entity.id, payload.answer || '') : false;
    const links = Array.isArray(payload.links) ? payload.links : [];
    const citationsPresent = !invalid && (links.length > 0 || hasUrl(payload.answer || ''));
    const citationValid = consumerCitationValid(entity.id, payload.prompt_id, platformKey, invalid, citationsPresent);
    rows.push({
      entity: payload.entity,
      entity_role: payload.entity_role,
      prompt_id: payload.prompt_id,
      channel: 'consumer',
      platform: platformName,
      model_or_mode: payload.model_or_mode,
      searched_web: invalid ? '' : String(Boolean(payload.searched_web)),
      entity_recognition: consumerRecognition(entity.id, payload.prompt_id, platformKey, invalid),
      spontaneous_mention: isP2 && !invalid ? (mentioned ? 'yes' : 'no') : 'not_applicable',
      mention_position: mentioned ? mentionPositions[`consumer|${entity.id}|${platformKey}`] || '' : '',
      factual_accuracy: consumerAccuracy(entity.id, payload.prompt_id, platformKey, invalid),
      major_hallucination: platformKey === 'qwen' && entity.id === 'flomo' && payload.prompt_id === 'P1' ? 'yes' : 'no',
      citations_present: citationsPresent ? 'yes' : 'no',
      citations_valid: citationValid ? 'yes' : 'no',
      official_source_present: consumerOfficialSource(entity.id, payload.prompt_id, platformKey, invalid) ? 'yes' : 'no',
      raw_evidence_path: `raw/consumer/${platformKey}/${file}`,
      evaluator_note: consumerNote(entity.id, payload.prompt_id, platformKey, payload, invalid)
    });
  }
}

const headers = [
  'entity', 'entity_role', 'prompt_id', 'channel', 'platform', 'model_or_mode', 'searched_web',
  'entity_recognition', 'spontaneous_mention', 'mention_position', 'factual_accuracy',
  'major_hallucination', 'citations_present', 'citations_valid', 'official_source_present',
  'raw_evidence_path', 'evaluator_note'
];
const output = [headers.join(','), ...rows.map((row) => headers.map((key) => csv(row[key])).join(','))].join('\n') + '\n';
await writeFile(path.join(here, 'scores.csv'), output, 'utf8');
console.log(JSON.stringify({ rows: rows.length, api: rows.filter((r) => r.channel === 'api').length, consumer: rows.filter((r) => r.channel === 'consumer').length, majorHallucinations: rows.filter((r) => r.major_hallucination === 'yes').length }, null, 2));
