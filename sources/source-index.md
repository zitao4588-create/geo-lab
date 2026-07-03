# Source Index

This file lists the initial source snapshot saved for GEO Lab.

## X / Twitter Sources

| Source | Original URL | Local JSON | Local Markdown | Role |
|---|---|---|---|---|
| 黄小木 GEO 入门文章 | https://x.com/ai_xiaomu/status/2068613828687085699 | `sources/x/ai_xiaomu-2068613828687085699.json` | `sources/x/ai_xiaomu-2068613828687085699.md` | GEO beginner framing, website/content hygiene, AI recommendation entry |
| 苍何 GEO 诊断专家文章 | https://x.com/canghe/status/2070091940260155651 | `sources/x/canghe-2070091940260155651.json` | `sources/x/canghe-2070091940260155651.md` | GEO diagnosis product shape and report modules |
| 姚金刚 GEO 资料清单 | https://x.com/yaojingang/status/2070878893582766223 | `sources/x/yaojingang-2070878893582766223.json` | `sources/x/yaojingang-2070878893582766223.md` | Full source map for documents, prompts, skills, GEOFlow |
| 姚金刚 GEO prompt/skill 引用推文 | https://x.com/yaojingang/status/2070798158339383579 | `sources/x/yaojingang-2070798158339383579-quote.json` | `sources/x/yaojingang-2070798158339383579-quote.md` | Article rewrite prompt and skill rationale |

## Documents And Papers

| Title | Original URL | Local File | Role |
|---|---|---|---|
| GEO 内容工程操作手册与评估标准 | https://doc.laoyao.cn/9fl0bc | `sources/docs/01-geo-content-engineering-manual.md` | Core operating manual, scoring, 12-step workflow |
| GEO 内容工程系统研究报告 | https://doc.laoyao.cn/t754wa | `sources/docs/02-geo-content-engineering-system-report.md` | System-level theory, engineering framing, 30/60/90 plan |
| GEO 内容工程方法体系与单篇内容实操教程 | https://doc.laoyao.cn/54yx5b | `sources/docs/03-geo-method-and-single-content-tutorial.md` | Global and single-page content method |
| GEO: Generative Engine Optimization | https://doc.laoyao.cn/0elhy1 | `sources/docs/04-geo-generative-engine-optimization-paper.md` | Foundational GEO paper, visibility metrics, content interventions |
| Generative Engine Optimization in digital repositories | https://doc.laoyao.cn/fnf30e | `sources/docs/05-geo-digital-repositories-paper.md` | Repository visibility, metadata, multilingual, reference rate |
| From Citation Selection to Citation Absorption | https://doc.laoyao.cn/ykiktr | `sources/docs/06-geo-selection-absorption-measurement-framework.md` | Selection vs absorption measurement scaffold |
| GEO 单篇内容 GEO 特征标注演示 | https://doc.laoyao.cn/00j3ps | `sources/docs/07-geo-feature-annotation-demo.md` | Annotated example of a GEO-friendly article |

Books mentioned but not locally stored:

- `系统之美`
- `人人都该懂的工程学`

These are reading references only in this snapshot because no files or direct book links were provided.

## GitHub / Tool Sources

| Source | Original URL | Local File | Role |
|---|---|---|---|
| GEO article AI-friendly transformation prompt | https://github.com/yaojingang/yao-open-prompts/blob/main/prompts/08-ai-marketing/geo-article-ai-friendly-transformation.md | `sources/github/yao-open-prompts-geo-article-ai-friendly-transformation.md` | Prompt-level article rewrite method |
| Yao Open Prompts README | https://github.com/yaojingang/yao-open-prompts | `sources/github/yao-open-prompts-README.md` | Prompt library context |
| Yao GEO Skills README | https://github.com/yaojingang/yao-geo-skills | `sources/github/yao-geo-skills-README.md` | Skill catalog and system map |
| Yao GEO Skills registry | https://github.com/yaojingang/yao-geo-skills/blob/main/registry/skills.json | `sources/github/yao-geo-skills-registry.json` | Machine-readable skill list |
| Yao GEO Article Friendly SKILL | https://github.com/yaojingang/yao-geo-skills/tree/main/skills/yao-geo-article-friendly | `sources/github/yao-geo-article-friendly-SKILL.md` | Skill entrypoint |
| Yao GEO Article Friendly method | same repo | `sources/github/yao-geo-article-friendly-method.md` | Method and scoring basis |
| Yao GEO Article Friendly output contract | same repo | `sources/github/yao-geo-article-friendly-output-contract.md` | Output format contract |
| GEOFlow README | https://github.com/yaojingang/GEOFlow | `sources/github/GEOFlow-README.md` | Heavy content engineering system reference |
| GEOFlow repo metadata | https://api.github.com/repos/yaojingang/GEOFlow | `sources/github/GEOFlow-repo-metadata.json` | Repository snapshot metadata |
| Yao GEO Skills repo metadata | https://api.github.com/repos/yaojingang/yao-geo-skills | `sources/github/yao-geo-skills-repo-metadata.json` | Repository snapshot metadata |
| Yao Meta Skill README | https://github.com/yaojingang/yao-meta-skill | `sources/github/yao-meta-skill-README.md` | Skill engineering and governance reference |

## Local Artifacts

| Artifact | Original Path | Local Copy | Role |
|---|---|---|---|
| 冰箱小雷达 GEO 诊断 HTML | `/Users/qzt/Developer/projects/fridge-app/diag-output/冰箱小雷达-GEO诊断报告.html` | `sources/local-artifacts/fridge-radar/冰箱小雷达-GEO诊断报告.html` | Report UI and delivery sample |
| 冰箱小雷达 diag JSON | `/Users/qzt/Developer/projects/fridge-app/diag-output/冰箱小雷达冰箱食材库存管理小程序-diag-report.json` | `sources/local-artifacts/fridge-radar/冰箱小雷达冰箱食材库存管理小程序-diag-report.json` | Structured diagnosis data sample |

## Suggested Reading Clusters

For learning GEO:

1. `sources/x/ai_xiaomu-2068613828687085699.md`
2. `sources/docs/04-geo-generative-engine-optimization-paper.md`
3. `sources/docs/01-geo-content-engineering-manual.md`

For productizing GEO diagnosis:

1. `sources/x/canghe-2070091940260155651.md`
2. `sources/local-artifacts/fridge-radar/冰箱小雷达冰箱食材库存管理小程序-diag-report.json`
3. `cases/fridge-radar/README.md`

For building reusable agents:

1. `sources/github/yao-geo-skills-README.md`
2. `sources/github/yao-geo-skills-registry.json`
3. `sources/github/yao-geo-article-friendly-SKILL.md`
4. `sources/github/yao-meta-skill-README.md`

