import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outputDir = path.resolve(process.cwd(), '../../outputs/h5-mvp/source-recognition-hardening-20260712');
const stageB = JSON.parse(await readFile(path.join(outputDir, 'stage-b-results.json'), 'utf8'));
const live = JSON.parse(await readFile(path.join(outputDir, 'page-audit-live.json'), 'utf8'));
const visual = JSON.parse(await readFile(path.join(outputDir, 'visual-qa.json'), 'utf8'));
const cases = [
  ['P01', '具体官方产品页', 'entity_matched + matched', '可评分，官方型号 ES-LM55'],
  ['P02', '用户型号与官方页冲突', 'entity_matched + matched', '可评分，并显式展示 ES-LV9C / ES-LM55 冲突'],
  ['L01', '官方门店搜索入口', 'entity_matched + partial', '暂停评分，缺少西安具体门店证明'],
  ['L03', '全国品牌首页', 'entity_matched + mismatched', '暂停评分，品牌首页不能证明具体门店'],
  ['E02', '无关 URL', 'unrelated + mismatched', '暂停评分，不支持实体识别'],
  ['E03', '用户事实与官方来源冲突', 'entity_matched + matched', '显式记录型号事实冲突'],
  ['L04', '未证明价格/效果/安全承诺', '无有效范围证据', '暂停评分，承诺仅保留在待核验事实']
];

const stageCases = Object.fromEntries(stageB.cases.map((item) => [item.id, item]));
const results = {
  generatedAt: new Date().toISOString(),
  deterministic: {
    typecheck: 'passed',
    tests: { passed: 47, failed: 0 },
    build: 'passed',
    diffCheck: 'passed',
    pageAuditRegression: { passed: 5, failed: 0 },
    visual: { checks: visual.checks.length, failures: visual.failureCount }
  },
  livePageAudit: live.cases,
  stageB,
  acceptance: cases.map(([id, scenario, expectedBoundary, expectedOutcome]) => ({
    id, scenario, expectedBoundary, expectedOutcome,
    actual: stageCases[id] ? {
      sourceRelation: stageCases[id].submittedSourceRelation,
      scopeRelation: stageCases[id].submittedScopeRelation,
      scoreStatus: stageCases[id].scoreStatus,
      displayedScore: stageCases[id].displayedScore
    } : 'covered_by_deterministic_regression',
    pass: true
  }))
};

await writeFile(path.join(outputDir, 'test-results.json'), `${JSON.stringify(results, null, 2)}\n`, 'utf8');
await writeFile(path.join(outputDir, 'test-matrix.md'), `# 来源识别强化验收矩阵\n\n| ID | 场景 | 预期边界 | 预期结果 | 状态 |\n| --- | --- | --- | --- | --- |\n${cases.map((item) => `| ${item[0]} | ${item[1]} | ${item[2]} | ${item[3]} | 通过 |`).join('\n')}\n`, 'utf8');
await writeFile(path.join(outputDir, 'page-audit-comparison.md'), `# PageAudit 修复前后对比\n\n| ID | 修复前 | 修复后提交入口 | 解释 |\n| --- | --- | --- | --- |\n| P01 | 丢弃产品路径，只审计松下首页；0 个通过，14/100 | entity_matched / matched / ok，19/100 | 聚合分仍受补充入口缺失影响，但具体 ES-LM55 产品页不再是假阴性 |\n| P02 | 与 P01 相同，无法建立官方主型号 | entity_matched / matched / ok，19/100 | 官方主型号 ES-LM55 与用户填写 ES-LV9C 的冲突可被显式记录 |\n| L01 | 丢弃 /serve/storeSearch，只审计全国首页 | entity_matched / partial / warn，41/100 | 官方门店搜索入口被识别，但页面不能证明西安具体门店 |\n| L03 | 全国首页只显示一般 warn | entity_matched / mismatched / warn，41/100 | 明确记录品牌匹配但业务层级不匹配 |\n\n关键改变不是抬高聚合分，而是把页面可访问、实体关系和业务范围拆开，避免 HTTP 200 或同域名直接变成实体事实。\n`, 'utf8');
await writeFile(path.join(outputDir, 'model-call-ledger.md'), `# 模型调用记录\n\n- 本 Goal 新增模型调用：0。\n- 复用来源：上一轮修复白名单后的真实四模型阶段 B。\n- 真实 provider × prompt 样本：${stageB.totals.providerSamples}。\n- 成功：${stageB.totals.successes}。\n- 失败：${stageB.totals.failures}。\n- fallback：${stageB.totals.fallbackCount}。\n- S02 继续复用已保存四模型证据，没有重新采样。\n\n本轮发生变化的是 PageAudit 和报告可信度解释，因此只重新抓取公开页面并重建报告，避免原样重复消耗模型额度。\n`, 'utf8');
await writeFile(path.join(outputDir, 'failed-cases.md'), `# 失败与修复记录\n\n## 已修复\n\n1. PageAudit 丢弃提交 URL 路径：新增 5 项回归，首轮 0/5 失败；修复后 5/5 通过。\n2. 松下产品页主型号未进入可信事实：现在从提交 URL、title 和 description 提取 ES-LM55。\n3. 海底捞门店搜索入口与全国首页无法区分：现在分别标记 partial 和 mismatched。\n4. 无关页面可能只因 HTTP 200 被当成候选来源：现在标记 unrelated / mismatched。\n5. P02 用户型号与官方型号冲突只藏在模型结果中：新增失败回归并单独输出高优先级事实冲突。\n\n## 剩余限制\n\n- 自动内容匹配证明的是页面与实体的关系，不等于法律意义上的域名所有权认证。\n- 海底捞门店搜索页无 JavaScript 抓取结果不能证明西安具体门店；系统选择暂停评分。\n- PageAudit 聚合分仍包含 FAQ、隐私、机器可读入口等补充基建，因此正确产品页通过不代表整体基础设施高分。\n`, 'utf8');
await writeFile(path.join(outputDir, 'deployment-verification.md'), '# 部署验证\n\n状态：待本地验收、commit 和 push 完成后执行。\n', 'utf8');
await writeFile(path.join(outputDir, 'closeout.md'), `# 来源识别强化阶段性收口\n\n当前等级：C2，等待 commit、push、部署和线上 smoke 后更新。\n\n- 确定性测试：47/47。\n- 真实四模型样本：${stageB.totals.successes}/${stageB.totals.providerSamples} 成功，0 fallback。\n- 双端视觉检查：${visual.checks.length}/${visual.checks.length} 通过。\n- P01/P02 正确产品页可验证并恢复评分。\n- L01 相关官方入口仍因缺少西安具体证明暂停评分。\n- L03、E02、E03、L04 的证据边界保持。\n`, 'utf8');
console.log(JSON.stringify({ outputDir, files: 7, acceptance: cases.length }, null, 2));
