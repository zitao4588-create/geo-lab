import type { AiProviderStatus, AiSample, DiagnosisInput, DiagnosisReport, PageAuditResult } from '../shared/types.js';

export function renderReportMarkdown(report: DiagnosisReport) {
  return `# ${report.brand} GEO 分析成果报告

- 报告 ID：${report.id}
- 生成时间：${report.generatedAt}
- 总分：${report.score}/100（${report.scoreLevel}）
- 真实采样：${report.aiMeta.successCount}/${report.aiMeta.promptCount}
- 品牌提及率：${toPercent(report.stages.aiSearch.mentionRate)}
- 公开页面审计：${report.stages.infrastructure.score}/100

## 摘要

${report.summary}

## 核心结论

${report.stages.overview.keyFinding}

## 评分拆解

| 维度 | 权重 | 得分 | 证据 | 依据 |
| --- | ---: | ---: | --- | --- |
${report.stages.score.dimensions.map((item) => `| ${item.name} | ${Math.round(item.weight * 100)}% | ${item.score} | ${item.evidenceLabel} | ${item.comment} |`).join('\n')}

## 平台采样状态

| 平台 | 状态 | 成功/总数 | 说明 |
| --- | --- | ---: | --- |
${report.aiMeta.providers.map((item) => `| ${item.provider} | ${item.status} | ${item.successCount}/${item.promptCount} | ${item.note} |`).join('\n')}

## 公开页面审计

| 页面 | 状态 | HTTP | URL | 命中事实 | 缺少事实 |
| --- | --- | ---: | --- | --- | --- |
${report.stages.infrastructure.pageAudit.targets.map((item) => `| ${item.name} | ${item.status} | ${item.httpStatus ?? '-'} | ${item.url} | ${item.matchedFacts.join('、') || '-'} | ${item.missingFacts.join('、') || '-'} |`).join('\n')}

## 主要问题

${report.issues.map((issue, index) => `${index + 1}. **${issue.title}**：${issue.detail}（${issue.evidenceLabel}）`).join('\n')}

## AI 采样答案摘录

${report.stages.aiSearch.answerSamples.map((item) => `- **${item.provider} / ${item.prompt}**：${item.answerExcerpt}（${item.mentionedBrand ? '提及品牌' : '未提及品牌'}）`).join('\n')}

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
  const dimensionRows = report.stages.score.dimensions
    .map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${Math.round(item.weight * 100)}%</td><td>${item.score}</td><td>${escapeHtml(item.evidenceLabel)}</td><td>${escapeHtml(item.comment)}</td></tr>`)
    .join('');
  const auditRows = report.stages.infrastructure.pageAudit.targets
    .map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.status)}</td><td>${item.httpStatus ?? '-'}</td><td>${escapeHtml(item.url)}</td><td>${escapeHtml(item.matchedFacts.join('、') || '-')}</td><td>${escapeHtml(item.missingFacts.join('、') || '-')}</td></tr>`)
    .join('');
  const providerRows = report.aiMeta.providers
    .map((item) => `<tr><td>${escapeHtml(item.provider)}</td><td>${escapeHtml(item.status)}</td><td>${item.successCount}/${item.promptCount}</td><td>${escapeHtml(item.note)}</td></tr>`)
    .join('');
  const answerRows = report.stages.aiSearch.answerSamples
    .map((item) => `<li><strong>${escapeHtml(item.provider)} / ${escapeHtml(item.prompt)}</strong><p>${escapeHtml(item.answerExcerpt)}</p><small>${item.mentionedBrand ? '提及品牌' : '未提及品牌'}</small></li>`)
    .join('');
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
    @media print { body { background: #fff; } main { padding: 0; } header, section { break-inside: avoid; border-color: #d6dde8; } }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(report.brand)} GEO 分析成果报告</h1>
      <div class="score">${report.score}<small>/100 · ${escapeHtml(report.scoreLevel)}</small></div>
      <p>${escapeHtml(report.summary)}</p>
      <div class="meta">
        <span>报告 ID：${escapeHtml(report.id)}</span>
        <span>生成时间：${escapeHtml(report.generatedAt)}</span>
        <span>真实采样：${report.aiMeta.successCount}/${report.aiMeta.promptCount} · 品牌提及率 ${toPercent(report.stages.aiSearch.mentionRate)}</span>
        <span>公开页面审计：${report.stages.infrastructure.score}/100</span>
      </div>
    </header>
    <section><h2>核心结论</h2><p>${escapeHtml(report.stages.overview.keyFinding)}</p></section>
    <section><h2>评分拆解</h2><table><thead><tr><th>维度</th><th>权重</th><th>得分</th><th>证据</th><th>依据</th></tr></thead><tbody>${dimensionRows}</tbody></table></section>
    <section><h2>平台采样状态</h2><table><thead><tr><th>平台</th><th>状态</th><th>成功/总数</th><th>说明</th></tr></thead><tbody>${providerRows}</tbody></table></section>
    <section><h2>公开页面审计</h2><table><thead><tr><th>页面</th><th>状态</th><th>HTTP</th><th>URL</th><th>命中事实</th><th>缺少事实</th></tr></thead><tbody>${auditRows}</tbody></table></section>
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
      scoreLevel: report.scoreLevel,
      summary: report.summary,
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

function escapeHtml(value: string) {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}
