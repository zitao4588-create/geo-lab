import assert from 'node:assert/strict';
import test from 'node:test';
import { assessDiagnosisInput } from '../dist/server/server/credibility.js';
import { diagnosisInputSchema } from '../dist/server/server/validation.js';
import { batchCases } from './batch-instance-cases.mjs';

test('batch matrix contains the requested 20 unique cases', () => {
  assert.equal(batchCases.length, 20);
  assert.equal(new Set(batchCases.map((item) => item.id)).size, 20);
  assert.deepEqual(
    batchCases.map((item) => item.id),
    ['P01', 'P02', 'P03', 'P04', 'S01', 'S02', 'S03', 'S04', 'L01', 'L02', 'L03', 'L04', 'E01', 'E02', 'E03', 'E04', 'R01', 'R02', 'R03', 'R04']
  );
});

for (const item of batchCases) {
  test(`${item.id} ${item.title}`, () => {
    const input = diagnosisInputSchema.parse(item.input);
    const actual = assessDiagnosisInput(input);
    assert.equal(actual.businessType, item.businessType);
    assert.equal(actual.status, item.expectedStatus);
  });
}
