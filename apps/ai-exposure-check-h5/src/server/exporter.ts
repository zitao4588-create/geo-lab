import type { AiProviderStatus, AiSample, DiagnosisInput, DiagnosisReport, PageAuditResult } from '../shared/types.js';

export function renderReportMarkdown(report: DiagnosisReport) {
  const credibility = report.stages.credibility;
  const scoreLabel = credibility?.scoreStatus === 'withheld' ? '暂不评分（证据不足）' : `${report.score}/100（${report.scoreLevel}）`;
  const sourceLabel = pageAuditLabel(report.stages.infrastructure.pageAudit, 'source');
  const infrastructureLabel = pageAuditLabel(report.stages.infrastructure.pageAudit, 'infrastructure');
  return `# ${report.brand} GEO 分析成果报告

- 报告 ID：${report.id}
- 生成时间：${report.generatedAt}
- 总分：${scoreLabel}
- 真实采样：${report.aiMeta.successCount}/${report.aiMeta.promptCount}
- 字符串出现率：${toPercent(credibility?.stringMentionRate ?? report.stages.aiSearch.mentionRate)}
- 正确实体识别率：${credibility?.correctEntityRecognitionRate == null ? '无法判断' : toPercent(credibility.correctEntityRecognitionRate)}
- 无品牌词自然推荐率：${toPercent(credibility?.naturalRecommendationRate ?? 0)}
- 提交来源可信度：${sourceLabel}
- 站点基建完整度：${infrastructureLabel}

## 摘要

${report.summary}

## 核心结论

${report.stages.overview.keyFinding}

## 报告可信度

- 置信度：${credibility ? confidenceLabel(credibility.confidence) : '旧版报告未计算'}
- 业务类型：${credibility?.businessType ?? '旧版未分类'}
- 模型一致度：${credibility?.providerAgreementRate == null ? '无法判断' : toPercent(credibility.providerAgreementRate)}
- 错误认知率：${toPercent(credibility?.misrecognitionRate ?? 0)}

### 已确认

${credibility?.confirmedFacts.map((item) => `- ${item}`).join('\n') || '- 旧版报告未拆分'}

### 仍待核验

${credibility?.unverifiedFacts.map((item) => `- ${item}`).join('\n') || '- 无'}

### 模型冲突

${credibility?.modelConflicts.map((item) => `- ${item}`).join('\n') || '- 本次未发现可确认的模型冲突'}

## 评分拆解

| 维度 | 权重 | 得分 | 证据 | 依据 |
| --- | ---: | ---: | --- | --- |
${report.stages.score.dimensions.map((item) => `| ${item.name} | ${Math.round(item.weight * 100)}% | ${item.score} | ${item.evidenceLabel} | ${item.comment} |`).join('\n')}

## 平台采样状态

| 平台 | 状态 | 成功/总数 | 说明 |
| --- | --- | ---: | --- |
${report.aiMeta.providers.map((item) => `| ${item.provider} | ${item.status} | ${item.successCount}/${item.promptCount} | ${item.note} |`).join('\n')}

## 公开页面审计

| 页面 | 状态 | 范围 | 时效 | 抓取方式 | URL / canonical | 命中事实 | 内容哈希 |
| --- | --- | --- | --- | --- | --- | --- | --- |
${report.stages.infrastructure.pageAudit.targets.map((item) => `| ${item.name} | ${item.status} | ${scopeLabel(item.scopeRelation)} | ${freshnessLabel(item.freshness)} | ${renderModeLabel(item.renderMode)} | ${item.url}${item.canonicalUrl && item.canonicalUrl !== item.url ? `<br>${item.canonicalUrl}` : ''} | ${item.matchedFacts.join('、') || '-'} | ${item.contentHash?.slice(0, 12) ?? '-'} |`).join('\n')}

## 主要问题

${report.issues.map((issue, index) => `${index + 1}. **${issue.title}**：${issue.detail}（${issue.evidenceLabel}）`).join('\n')}

## AI 采样答案摘录

${report.stages.aiSearch.answerSamples.map((item) => `- **${item.provider} / ${item.prompt}**：${item.answerExcerpt}（${recognitionLabel(item.entityRecognition)}；${item.brandedPrompt ? '问题已含品牌名' : item.naturalRecommendation ? '无品牌词自然推荐' : '无品牌词未推荐'}）`).join('\n')}

## 竞品分析

${report.stages.competitors.mentionStats.map((item) => `### ${item.name}

- 提及次数：${item.mentionedCount}
- 提及率：${toPercent(item.mentionRate)}
- 相关问题：${item.mentionedPrompts.join('；') || '本次未提及'}
- 误读点：${item.modelMisreadings.join('；') || '本次未发现明显误读'}
- 建议内容：${item.suggestedContent.join('；')}
`).join('\n')}

## 优先优化项

${report.stages.recommendations.map((item, index) => `${index + 1}. **${item.priority} ${item.title}**：${item.detail}（${item.evidenceLabel}）`).join('\n')}

## 执行路线

${report.stages.roadmap.map((item) => `- **${item.phase} ${item.title}（${item.timeline}）**：${item.detail}`).join('\n')}

## 证据边界

${report.evidencePolicy.notes}
`;
}

export function renderReportHtml(report: DiagnosisReport) {
  const credibility = report.stages.credibility;
  const scoreWithheld = credibility?.scoreStatus === 'withheld';
  const sourceLabel = pageAuditLabel(report.stages.infrastructure.pageAudit, 'source');
  const infrastructureLabel = pageAuditLabel(report.stages.infrastructure.pageAudit, 'infrastructure');
  const dimensionRows = report.stages.score.dimensions
    .map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${Math.round(item.weight * 100)}%</td><td>${item.score}</td><td>${escapeHtml(item.evidenceLabel)}</td><td>${escapeHtml(item.comment)}</td></tr>`)
    .join('');
  const auditRows = report.stages.infrastructure.pageAudit.targets
    .map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.status)}</td><td>${escapeHtml(scopeLabel(item.scopeRelation))}</td><td>${escapeHtml(freshnessLabel(item.freshness))}</td><td>${escapeHtml(renderModeLabel(item.renderMode))}</td><td>${escapeHtml(item.url)}${item.canonicalUrl && item.canonicalUrl !== item.url ? `<br><small>canonical: ${escapeHtml(item.canonicalUrl)}</small>` : ''}</td><td>${escapeHtml(item.matchedFacts.join('、') || '-')}</td><td>${escapeHtml(item.contentHash?.slice(0, 12) ?? '-')}</td></tr>`)
    .join('');
  const providerRows = report.aiMeta.providers
    .map((item) => `<tr><td>${escapeHtml(item.provider)}</td><td>${escapeHtml(item.status)}</td><td>${item.successCount}/${item.promptCount}</td><td>${escapeHtml(item.note)}</td></tr>`)
    .join('');
  const answerRows = report.stages.aiSearch.answerSamples
    .map((item) => `<li><strong>${escapeHtml(item.provider)} / ${escapeHtml(item.prompt)}</strong><p>${escapeHtml(item.answerExcerpt)}</p><small>${escapeHtml(recognitionLabel(item.entityRecognition))} · ${item.brandedPrompt ? '问题已含品牌名' : item.naturalRecommendation ? '无品牌词自然推荐' : '无品牌词未推荐'} · ${escapeHtml(item.recognitionReason ?? '旧版报告未计算')}</small></li>`)
    .join('');
  const credibilityHtml = credibility ? `
    <section><h2>报告可信度</h2>
      <p><strong>${confidenceLabel(credibility.confidence)}</strong> · ${escapeHtml(credibility.inputAssessment.note)}</p>
      <div class="metrics">
        <span>字符串出现率 ${toPercent(credibility.stringMentionRate)}</span>
        <span>正确实体识别 ${credibility.correctEntityRecognitionRate == null ? '无法判断' : toPercent(credibility.correctEntityRecognitionRate)}</span>
        <span>无品牌词自然推荐 ${toPercent(credibility.naturalRecommendationRate)}</span>
        <span>错误认知 ${toPercent(credibility.misrecognitionRate)}</span>
        <span>模型一致度 ${credibility.providerAgreementRate == null ? '无法判断' : toPercent(credibility.providerAgreementRate)}</span>
      </div>
      <h3>已确认</h3><ul>${credibility.confirmedFacts.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      <h3>仍待核验</h3><ul>${credibility.unverifiedFacts.map((item) => `<li>${escapeHtml(item)}</li>`).join('') || '<li>无</li>'}</ul>
      <h3>模型冲突</h3><ul>${credibility.modelConflicts.map((item) => `<li>${escapeHtml(item)}</li>`).join('') || '<li>本次未发现可确认的模型冲突</li>'}</ul>
    </section>` : '';
  const competitorRows = report.stages.competitors.mentionStats
    .map(
      (item) => `<li><strong>${escapeHtml(item.name)} · ${item.mentionedCount} 次 · ${toPercent(item.mentionRate)}</strong><p>${escapeHtml(item.suggestedContent.join('；'))}</p><small>${escapeHtml(item.mentionedPrompts.join('；') || '本次未提及')}</small></li>`
    )
    .join('');
  const recRows = report.stages.recommendations
    .map((item) => `<li><strong>${escapeHtml(item.priority)} ${escapeHtml(item.title)}</strong><p>${escapeHtml(item.detail)}</p><small>${escapeHtml(item.evidenceLabel)}</small></li>`)
    .join('');

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(report.brand)} GEO 分析成果报告</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif; color: #151b24; background: #f5f7fa; }
    main { max-width: 920px; margin: 0 auto; padding: 42px 24px 72px; }
    header, section { background: #fff; border: 1px solid #e4e9f0; border-radius: 12px; padding: 24px; margin-bottom: 16px; }
    h1 { margin: 0 0 12px; font-size: 30px; }
    h2 { margin: 0 0 14px; font-size: 20px; }
    p, li { line-height: 1.7; }
    .score { display: inline-flex; align-items: baseline; gap: 8px; color: #f26b21; font-size: 44px; font-weight: 800; }
    .meta { color: #637083; display: grid; gap: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    td, th { border-top: 1px solid #e8edf4; padding: 10px 8px; text-align: left; vertical-align: top; }
    ul { padding-left: 20px; }
    small { color: #7b8491; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; margin: 14px 0; }
    .metrics span { padding: 10px; border-radius: 8px; background: #f1f5fb; font-size: 13px; }
    @media print { body { background: #fff; } main { padding: 0; } header, section { break-inside: avoid; border-color: #d6dde8; } }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(report.brand)} GEO 分析成果报告</h1>
      <div class="score">${scoreWithheld ? '暂不评分' : report.score}<small>${scoreWithheld ? ' · 证据不足' : `/100 · ${escapeHtml(report.scoreLevel)}`}</small></div>
      <p>${escapeHtml(report.summary)}</p>
      <div class="meta">
        <span>报告 ID：${escapeHtml(report.id)}</span>
        <span>生成时间：${escapeHtml(report.generatedAt)}</span>
        <span>真实采样：${report.aiMeta.successCount}/${report.aiMeta.promptCount} · 字符串出现率 ${toPercent(credibility?.stringMentionRate ?? report.stages.aiSearch.mentionRate)}</span>
        <span>提交来源可信度：${sourceLabel}</span>
        <span>站点基建完整度：${infrastructureLabel}</span>
      </div>
    </header>
    <section><h2>核心结论</h2><p>${escapeHtml(report.stages.overview.keyFinding)}</p></section>
    ${credibilityHtml}
    <section><h2>评分拆解</h2><table><thead><tr><th>维度</th><th>权重</th><th>得分</th><th>证据</th><th>依据</th></tr></thead><tbody>${dimensionRows}</tbody></table></section>
    <section><h2>平台采样状态</h2><table><thead><tr><th>平台</th><th>状态</th><th>成功/总数</th><th>说明</th></tr></thead><tbody>${providerRows}</tbody></table></section>
    <section><h2>公开页面审计</h2><table><thead><tr><th>页面</th><th>状态</th><th>范围</th><th>时效</th><th>抓取</th><th>URL / canonical</th><th>命中事实</th><th>哈希</th></tr></thead><tbody>${auditRows}</tbody></table></section>
    <section><h2>主要问题</h2><ul>${report.issues.map((item) => `<li><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.detail)}</p><small>${escapeHtml(item.evidenceLabel)}</small></li>`).join('')}</ul></section>
    <section><h2>AI 采样答案摘录</h2><ul>${answerRows}</ul></section>
    <section><h2>竞品分析</h2><ul>${competitorRows}</ul></section>
    <section><h2>优先优化项</h2><ul>${recRows}</ul></section>
    <section><h2>证据边界</h2><p>${escapeHtml(report.evidencePolicy.notes)}</p></section>
  </main>
</body>
</html>
`;
}

export function buildEvidencePackage(
  input: DiagnosisInput,
  report: DiagnosisReport,
  samples: AiSample[],
  pageAudit: PageAuditResult,
  providerStatuses: AiProviderStatus[]
) {
  return {
    reportId: report.id,
    generatedAt: new Date().toISOString(),
    input: {
      businessName: input.businessName,
      description: input.description,
      links: input.links,
      industry: input.industry,
      city: input.city,
      targetCustomers: input.targetCustomers,
      competitors: input.competitors
    },
    report: {
      score: report.score,
      displayedScore: report.stages.credibility?.scoreStatus === 'withheld' ? null : report.score,
      scoreLevel: report.scoreLevel,
      summary: report.summary,
      credibility: report.stages.credibility,
      dimensions: report.stages.score.dimensions,
      issues: report.issues,
      recommendations: report.stages.recommendations
    },
    providerStatuses,
    pageAudit,
    samples,
    evidencePolicy: report.evidencePolicy
  };
}

function toPercent(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

function confidenceLabel(value: 'high' | 'medium' | 'low') {
  return value === 'high' ? '高置信度' : value === 'medium' ? '中等置信度' : '低置信度';
}

function pageAuditLabel(pageAudit: PageAuditResult, kind: 'source' | 'infrastructure') {
  if (pageAudit.targets.length === 0) return '未检测';
  const score = kind === 'source'
    ? pageAudit.submittedSourceScore ?? (pageAudit.targets.some((target) => target.submitted && target.status === 'ok') ? 100 : 0)
    : pageAudit.siteInfrastructureScore ?? pageAudit.score;
  return `${score}/100`;
}

function recognitionLabel(value: 'supported' | 'uncertain' | 'misrecognized' | 'not_verifiable' | undefined) {
  if (value === 'supported') return '识别有据';
  if (value === 'uncertain') return '不确定';
  if (value === 'misrecognized') return '错误认知';
  return '无法核验';
}

function scopeLabel(value: PageAuditResult['targets'][number]['scopeRelation']) {
  if (value === 'matched') return '匹配';
  if (value === 'partial') return '部分匹配';
  if (value === 'mismatched') return '不匹配';
  return '未知';
}

function freshnessLabel(value: PageAuditResult['targets'][number]['freshness']) {
  if (value === 'current') return '当前';
  if (value === 'possibly_stale') return '可能过期';
  if (value === 'invalid') return '失效';
  return '未记录';
}

function renderModeLabel(value: PageAuditResult['targets'][number]['renderMode']) {
  if (value === 'controlled_dynamic') return '受控动态渲染';
  if (value === 'static') return '静态抓取';
  return '未记录';
}

function escapeHtml(value: string) {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}
