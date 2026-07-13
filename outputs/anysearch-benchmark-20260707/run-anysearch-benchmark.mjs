import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const cli = "/private/tmp/geo-lab-anysearch-verify-20260707/anysearch-skill-2.1.0/scripts/anysearch_cli.js";

const cases = [
  {
    id: "self-h5",
    label: "AI曝光体检自有 H5",
    query: "AI曝光体检 exposure.playgamelab.cn GEO",
    maxResults: 5,
    expectedUrl: "exposure.playgamelab.cn",
    extractUrl: "https://exposure.playgamelab.cn/",
    expectedTerms: ["AI曝光体检", "exposure.playgamelab.cn", "GEO"],
  },
  {
    id: "fridge-case",
    label: "冰箱小雷达案例站",
    query: "冰箱小雷达 fridge.playgamelab.cn 冰箱食材库存管理小程序",
    maxResults: 5,
    expectedUrl: "fridge.playgamelab.cn",
    extractUrl: "https://fridge.playgamelab.cn/",
    expectedTerms: ["冰箱小雷达", "fridge.playgamelab.cn", "冰箱食材库存管理"],
  },
  {
    id: "geo-market",
    label: "GEO 竞品/市场发现",
    query: "GEO 品牌体检 工具 多平台 DeepSeek Kimi ChatGPT",
    maxResults: 5,
    expectedUrl: null,
    extractUrl: null,
    expectedTerms: ["GEO", "品牌", "DeepSeek", "Kimi", "ChatGPT"],
  },
];

function runCli(args) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    execFile(
      "node",
      [cli, ...args],
      {
        env: { ...process.env, ANYSEARCH_API_KEY: "" },
        timeout: 45000,
        maxBuffer: 1024 * 1024 * 8,
      },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          code: error?.code ?? 0,
          signal: error?.signal ?? null,
          elapsedMs: Date.now() - startedAt,
          stdout,
          stderr,
          error: error ? String(error.message || error) : null,
        });
      },
    );
  });
}

function parseSearch(markdown) {
  const resultMatch = markdown.match(/Search Results \((\d+) results?,\s*(\d+)ms\)/);
  const urls = [...markdown.matchAll(/- \*\*URL\*\*: (.+)/g)].map((match) => match[1].trim());
  return {
    resultCount: resultMatch ? Number(resultMatch[1]) : urls.length,
    reportedMs: resultMatch ? Number(resultMatch[2]) : null,
    urls,
  };
}

function assessCase(testCase, searchText, extractText, searchParsed, searchRun, extractRun) {
  const expectedTermHits = testCase.expectedTerms.filter((term) => searchText.includes(term));
  const expectedUrlHit = testCase.expectedUrl
    ? searchParsed.urls.some((url) => url.includes(testCase.expectedUrl)) || searchText.includes(testCase.expectedUrl)
    : null;
  const extractHasUsefulBody =
    Boolean(extractText) &&
    extractText.length > 500 &&
    !extractText.includes("extract_fetch_failed") &&
    !extractText.includes("No information is available for this page");
  const topUrls = searchParsed.urls.slice(0, 5);

  let assessment = "mixed";
  if (testCase.id === "geo-market") {
    assessment = searchParsed.resultCount >= 3 && expectedTermHits.length >= 3 ? "useful_for_discovery" : "weak";
  } else if (expectedUrlHit && extractHasUsefulBody) {
    assessment = "useful_for_known_source_validation";
  } else if (!expectedUrlHit && extractHasUsefulBody) {
    assessment = "search_miss_extract_ok";
  } else if (expectedUrlHit && !extractHasUsefulBody) {
    assessment = "search_hit_extract_weak";
  } else {
    assessment = "weak_for_target_discovery";
  }

  return {
    id: testCase.id,
    label: testCase.label,
    query: testCase.query,
    search: {
      ok: searchRun.ok,
      elapsedMs: searchRun.elapsedMs,
      reportedMs: searchParsed.reportedMs,
      resultCount: searchParsed.resultCount,
      topUrls,
      expectedUrlHit,
      expectedTermHits,
      stderr: searchRun.stderr.trim(),
      error: searchRun.error,
    },
    extract: {
      url: testCase.extractUrl || topUrls[0] || null,
      ok: Boolean(extractRun?.ok),
      elapsedMs: extractRun?.elapsedMs ?? null,
      hasUsefulBody: extractHasUsefulBody,
      chars: extractText.length,
      stderr: extractRun?.stderr?.trim() ?? "",
      error: extractRun?.error ?? null,
    },
    assessment,
  };
}

function markdownEscape(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function renderAnalysis(summary) {
  const rows = summary.results
    .map((result) => {
      const urls = result.search.topUrls.slice(0, 3).join("<br>");
      const hit =
        result.search.expectedUrlHit === null
          ? "不适用"
          : result.search.expectedUrlHit
            ? "是"
            : "否";
      const extract = result.extract.hasUsefulBody ? "可用" : "弱/失败";
      return `| ${markdownEscape(result.label)} | ${markdownEscape(result.query)} | ${result.search.resultCount} | ${hit} | ${extract} | ${markdownEscape(result.assessment)} | ${markdownEscape(urls)} |`;
    })
    .join("\n");

  return `# AnySearch H5 接入前 3 查询 Benchmark

日期：${summary.generatedAt}

运行方式：临时 AnySearch Skill v2.1.0，Node CLI，匿名访问，不使用 API key。

## 测试结论

不建议现在直接接入 H5 生产诊断链路。

AnySearch 在“竞品/行业候选来源发现”和“已知 URL 的部分正文抽取”上有价值，但对新站、低收录站或站点限定查询不稳定；网页抽取也受页面类型影响。它可以进入 Agent 侧或后端受控实验的候选来源发现层，不能作为最终证据源或线上报告的唯一搜索能力。

## 结果对比

| 测试对象 | 查询 | 结果数 | 目标站命中 | 抽取正文 | 评估 | Top URLs |
|---|---:|---:|---:|---:|---:|---|
${rows}

## 分析

- 自有 H5 查询没有稳定命中 \`exposure.playgamelab.cn\`，说明它不能可靠证明新站/自有站是否被搜索收录。
- 冰箱小雷达案例站的 search 未稳定命中目标站，但 direct extract 对 \`fridge.playgamelab.cn\` 可抽出正文，适合验证已知页面事实。
- GEO 市场查询能发现相关竞品/工具页面，适合补充竞品池和素材来源池。
- Search snippet 可以作为线索，不应直接进入最终报告证据；最终证据仍要二次抓取、保存 URL、保存抽取时间和原始响应。

## 接入判断

当前结论：暂不接入 H5 线上 \`/api/diagnoses\` 主流程。

可接受的下一步是做一个后端 adapter spike，并默认关闭：

1. 只在本地或受控测试开启。
2. 使用服务器端 \`ANYSEARCH_API_KEY\`，不暴露给前端。
3. AnySearch 只产出候选 URL 和候选竞品，不直接产出最终判断。
4. 每个候选 URL 必须经过现有 crawler/page-audit 二次验证后，才进入 evidence package。
5. 再扩到 10 个固定查询，命中率、抽取成功率、耗时和错误率达标后再考虑上线。

## 原始文件

${summary.results
    .map(
      (result) =>
        `- \`${result.id}.search.md\`\n- \`${result.id}.extract.md\`\n- \`${result.id}.meta.json\``,
    )
    .join("\n")}

- \`summary.json\`
`;
}

async function main() {
  await mkdir(__dirname, { recursive: true });

  const results = [];
  for (const testCase of cases) {
    const searchRun = await runCli(["search", testCase.query, "--max_results", String(testCase.maxResults)]);
    const searchText = searchRun.stdout || "";
    const searchParsed = parseSearch(searchText);
    const extractUrl = testCase.extractUrl || searchParsed.urls[0] || null;
    const extractRun = extractUrl ? await runCli(["extract", extractUrl]) : null;
    const extractText = extractRun?.stdout || "";

    await writeFile(path.join(__dirname, `${testCase.id}.search.md`), searchText);
    await writeFile(path.join(__dirname, `${testCase.id}.extract.md`), extractText);

    const result = assessCase(testCase, searchText, extractText, searchParsed, searchRun, extractRun);
    await writeFile(path.join(__dirname, `${testCase.id}.meta.json`), JSON.stringify(result, null, 2));
    results.push(result);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    cli,
    auth: "anonymous",
    results,
    conclusion: "do_not_integrate_h5_production_yet",
  };

  await writeFile(path.join(__dirname, "summary.json"), JSON.stringify(summary, null, 2));
  await writeFile(path.join(__dirname, "analysis.md"), renderAnalysis(summary));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
