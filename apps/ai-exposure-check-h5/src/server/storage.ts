import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AiProviderStatus, AiSample, DiagnosisEvidenceIndex, DiagnosisInput, DiagnosisReport, PageAuditResult } from '../shared/types.js';
import { buildEvidencePackage, renderReportHtml, renderReportMarkdown } from './exporter.js';

interface StoredDiagnosis {
  report: DiagnosisReport;
  input: DiagnosisInput;
  savedAt: string;
}

const runtimeDir = path.resolve(process.cwd(), process.env.RUNTIME_DIR || 'runtime');
const diagnosisDir = path.join(runtimeDir, 'diagnoses');
const evidenceDir = path.join(runtimeDir, 'evidence');
const submissionsFile = path.join(runtimeDir, 'submissions.jsonl');

export async function saveDiagnosis(
  input: DiagnosisInput,
  report: DiagnosisReport,
  samples: AiSample[],
  pageAudit: PageAuditResult,
  providerStatuses: AiProviderStatus[]
) {
  await mkdir(diagnosisDir, { recursive: true });
  await mkdir(path.join(evidenceDir, report.id), { recursive: true });
  await mkdir(path.join(evidenceDir, report.id, 'exports'), { recursive: true });

  const savedAt = new Date().toISOString();
  const stored: StoredDiagnosis = {
    input,
    report,
    savedAt
  };

  const reportWithExports: DiagnosisReport = {
    ...report,
    exports: {
      markdown: `/api/diagnoses/${report.id}/export/markdown`,
      html: `/api/diagnoses/${report.id}/export/html`,
      evidencePackage: `/api/diagnoses/${report.id}/export/evidence-package`
    }
  };
  const evidenceIndex = buildEvidenceIndex(reportWithExports, samples, savedAt);

  await writeFile(path.join(diagnosisDir, `${report.id}.json`), `${JSON.stringify({ ...stored, report: reportWithExports }, null, 2)}\n`, 'utf8');
  await writeFile(path.join(evidenceDir, report.id, 'samples.json'), `${JSON.stringify(samples, null, 2)}\n`, 'utf8');
  await writeFile(path.join(evidenceDir, report.id, 'providers.json'), `${JSON.stringify(providerStatuses, null, 2)}\n`, 'utf8');
  await writeFile(path.join(evidenceDir, report.id, 'page-audit.json'), `${JSON.stringify(pageAudit, null, 2)}\n`, 'utf8');
  await writeFile(path.join(evidenceDir, report.id, 'source-map.json'), `${JSON.stringify(evidenceIndex, null, 2)}\n`, 'utf8');
  await writeFile(path.join(evidenceDir, report.id, 'source-map.md'), buildEvidenceMarkdown(reportWithExports, samples, evidenceIndex), 'utf8');
  await writeFile(path.join(evidenceDir, report.id, 'exports', 'report.md'), renderReportMarkdown(reportWithExports), 'utf8');
  await writeFile(path.join(evidenceDir, report.id, 'exports', 'report.html'), renderReportHtml(reportWithExports), 'utf8');
  await writeFile(
    path.join(evidenceDir, report.id, 'exports', 'evidence-package.json'),
    `${JSON.stringify(buildEvidencePackage(input, reportWithExports, samples, pageAudit, providerStatuses), null, 2)}\n`,
    'utf8'
  );

  await appendFile(
    submissionsFile,
    `${JSON.stringify({
      id: report.id,
      businessName: input.businessName,
      industry: input.industry,
      city: input.city,
      contact: input.contact,
      riskLevel: report.riskLevel,
      score: report.score,
      scoreLevel: report.scoreLevel,
      sampledPrompts: report.aiMeta.promptCount,
      successfulSamples: report.aiMeta.successCount,
      pageAuditScore: pageAudit.score,
      savedAt
    })}\n`,
    'utf8'
  );
}

export async function readDiagnosis(id: string): Promise<DiagnosisReport | null> {
  try {
    const file = await readFile(path.join(diagnosisDir, `${id}.json`), 'utf8');
    const stored = JSON.parse(file) as StoredDiagnosis;
    return stored.report;
  } catch {
    return null;
  }
}

export async function readEvidenceIndex(id: string): Promise<DiagnosisEvidenceIndex | null> {
  try {
    const file = await readFile(path.join(evidenceDir, id, 'source-map.json'), 'utf8');
    return JSON.parse(file) as DiagnosisEvidenceIndex;
  } catch {
    return null;
  }
}

export async function readExportFile(id: string, format: 'markdown' | 'html' | 'evidence-package'): Promise<string | null> {
  const fileByFormat = {
    markdown: 'report.md',
    html: 'report.html',
    'evidence-package': 'evidence-package.json'
  } satisfies Record<typeof format, string>;

  try {
    return await readFile(path.join(evidenceDir, id, 'exports', fileByFormat[format]), 'utf8');
  } catch {
    return null;
  }
}

function buildEvidenceIndex(report: DiagnosisReport, samples: AiSample[], generatedAt: string): DiagnosisEvidenceIndex {
  return {
    reportId: report.id,
    generatedAt,
    provider: 'multi',
    model: report.aiMeta.model,
    promptCount: samples.length,
    successCount: samples.filter((sample) => sample.status === 'success').length,
    files: [
      { type: 'samples', path: `runtime/evidence/${report.id}/samples.json` },
      { type: 'providers', path: `runtime/evidence/${report.id}/providers.json` },
      { type: 'page_audit', path: `runtime/evidence/${report.id}/page-audit.json` },
      { type: 'source_map', path: `runtime/evidence/${report.id}/source-map.json` },
      { type: 'markdown', path: `runtime/evidence/${report.id}/source-map.md` },
      { type: 'markdown', path: `runtime/evidence/${report.id}/exports/report.md` },
      { type: 'html', path: `runtime/evidence/${report.id}/exports/report.html` },
      { type: 'evidence_package', path: `runtime/evidence/${report.id}/exports/evidence-package.json` }
    ],
    notes: 'samples.json 保存本次 DeepSeek 采样 prompt、回答、时间和失败原因；providers.json 保存多平台适配状态；page-audit.json 保存公开 URL 审计结果；联系方式只保存在 submissions.jsonl，不进入公开报告。'
  };
}

function buildEvidenceMarkdown(report: DiagnosisReport, samples: AiSample[], evidenceIndex: DiagnosisEvidenceIndex) {
  const rows = samples
    .map((sample) => {
      const status = sample.status === 'success' ? '成功' : `失败：${sample.error ?? 'unknown'}`;
      const answer = sample.answer ? sample.answer.replace(/\n+/gu, ' ').slice(0, 180) : '';
      return `| ${sample.prompt.id} | ${sample.prompt.category} | ${escapePipe(sample.prompt.prompt)} | ${status} | ${escapePipe(answer)} |`;
    })
    .join('\n');

  return `# ${report.brand} GEO 报告证据索引

- 报告 ID：${report.id}
- 生成时间：${evidenceIndex.generatedAt}
- 采样模型：${evidenceIndex.model}
- 成功采样：${evidenceIndex.successCount}/${evidenceIndex.promptCount}
- 证据边界：本文件只记录本次 DeepSeek API 返回结果，不代表全网排名或长期稳定结果。

| ID | 分类 | Prompt | 状态 | 回答摘录 |
| --- | --- | --- | --- | --- |
${rows}
`;
}

function escapePipe(value: string) {
  return value.replace(/\|/gu, '\\|');
}
