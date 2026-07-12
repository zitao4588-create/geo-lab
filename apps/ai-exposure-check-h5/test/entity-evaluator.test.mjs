import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { assessDiagnosisSource, classifyAnswer } from '../dist/server/server/credibility.js';
import { extractClaimedPrimaryModels, extractModelIdentifiers } from '../dist/server/server/entityIdentity.js';

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const benchmark = JSON.parse(await readFile(path.join(fixtureDir, 'entity-evaluator-benchmark.json'), 'utf8'));
const hierarchyGroundTruth = JSON.parse(await readFile(path.join(fixtureDir, 'entity-hierarchy-ground-truth.json'), 'utf8'));

test('manual hierarchy ground truth labels brand, marketing name, product, model, city, and store levels', () => {
  assert.deepEqual(hierarchyGroundTruth.map((item) => item.id), benchmark.map((item) => item.id));
  for (const item of hierarchyGroundTruth) {
    for (const field of ['brand', 'marketingName', 'productOrService', 'primaryModel', 'city', 'store']) {
      assert.ok(Object.hasOwn(item, field), `${item.id} is missing ${field}`);
    }
  }
});

test('model identifiers are generic rather than Panasonic-specific', () => {
  assert.deepEqual(extractModelIdentifiers('ES-LM55、S9000 和 X-PRO3；2026 不是型号'), ['ES-LM55', 'S9000', 'X-PRO3']);
  assert.deepEqual(extractClaimedPrimaryModels('官方主型号是 X-PRO3，S9000 是对比产品'), ['X-PRO3']);
});

test('entity evaluator benchmark keeps aliases, generic terms, and primary-model claims distinct', async (context) => {
  for (const item of benchmark) {
    await context.test(`${item.id} ${item.title}`, () => {
      const result = classifyAnswer(item.input, item.businessType, item.prompt, item.answer, auditFor(item));
      assert.deepEqual({
        brandedPrompt: result.brandedPrompt,
        mentionedBrand: result.mentionedBrand,
        naturalRecommendation: result.naturalRecommendation,
        entityRecognition: result.entityRecognition
      }, item.expected);
    });
  }
});

test('source assessment stops a submitted model conflict before sampling', () => {
  const input = benchmark.find((item) => item.id === 'A01').input;
  const conflictInput = { ...input, description: '用户填写型号 ES-LV9C 的五刀头电动剃须刀' };
  const assessment = assessDiagnosisSource(conflictInput, auditFor({ businessType: 'physical_product', input: conflictInput }));
  assert.equal(assessment.status, 'needs_confirmation');
  assert.equal(assessment.officialSourceStatus, 'verified');
  assert.ok(assessment.findings.some((finding) => /ES-LV9C.*ES-LM55.*冲突/u.test(finding)));
  assert.ok(assessment.requiredActions.some((action) => /修正|确认/u.test(action)));
});

function auditFor(item) {
  if (item.businessType === 'local_service') {
    return auditResult('海底捞西安门店', ['brand', 'entry', '西安', '海底捞']);
  }
  return auditResult('松下大锤子2.0剃须刀 ES-LM55', ['brand', 'category', 'model', 'ES-LM55', '五刀头', '电动剃须刀']);
}

function auditResult(title, matchedFacts) {
  return {
    generatedAt: new Date().toISOString(), score: 19, submittedSourceScore: 100, siteInfrastructureScore: 0,
    targets: [{
      id: 'submitted', name: '用户提交入口', url: 'https://example.com/entity', status: 'ok', httpStatus: 200,
      title, description: title, matchedFacts, missingFacts: [], notes: [], fetchedAt: new Date().toISOString(),
      evidenceLabel: 'verified_external', sourceRelation: 'entity_matched', scopeRelation: 'matched', submitted: true
    }],
    summary: { ok: 1, warn: 0, missing: 0, failed: 0, note: 'controlled' }
  };
}
