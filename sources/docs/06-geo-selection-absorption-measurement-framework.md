From Citation Selection to Citation Absorption: A
Measurement Framework for Generative Engine
Optimization Across AI Search Platforms
An empirical study of 602 prompts, 21,143 valid search-layer citations, and 23,745 citation-level

feature records

ZHANG KAI∗, Independent Researcher, China
HE XINYUE†, Independent Researcher, China
YAO JINGANG‡, Independent Researcher, China

Generative search engines increasingly determine whether online information is merely discoverable, cited
as a source, or actually absorbed into generated answers. This paper proposes and evaluates a two-stage
measurement framework for Generative Engine Optimization (GEO): citation selection, where a platform
triggers search and chooses sources, and citation absorption, where a cited page contributes language,
evidence, structure, or factual support to the final answer. We analyze the public geo-citation-lab dataset,
which documents 602 controlled prompts across ChatGPT, Google AI Overview/Gemini, and Perplexity; 21,143
valid search-layer citations; 23,745 citation-level feature records; 18,151 successfully fetched pages; and 72
extracted features. The main descriptive result is a sharp divergence between citation breadth and citation
depth. Perplexity cites the most sources on average per prompt, Google also cites broadly, while ChatGPT cites
fewer sources but shows substantially higher average citation influence among fetched pages. High-influence
pages are longer, more modular, more semantically aligned with the generated answer, and more likely to
contain extractable evidence genres such as definitions, numerical facts, comparisons, and procedural steps.
A particularly important negative finding is that Q&A formatting alone does not improve absorption. The
empirical pattern supports a view of GEO as evidence-container design: a page must first be eligible for
source selection through authority, recognizability, language, and domain context, then useful for absorption
through semantic alignment, structural legibility, and evidence density. To preserve scientific validity, this
manuscript separates documented descriptive statistics from proposed confirmatory models, avoids causal
claims that cannot be supported by the current static snapshot, and includes a claim-level self-audit. The paper
contributes a vocabulary and measurement scaffold for studying AI-mediated visibility beyond classical SEO
rankings and beyond simple citation counting.

Additional Key Words and Phrases: Generative Engine Optimization, AI search, information retrieval, citation
behavior, answer synthesis, source attribution, retrieval-augmented generation, content structure

Author and data note. Author order: Zhang Kai first, He Xinyue second, and Yao Jingang third.
Yao Jingang public homepage information: GitHub https://github.com/yaojingang; X https:
//x.com/yaojingang. The public project repository used as the empirical source is https://github.c
om/yaojingang/geo-citation-lab. The repository and public report are cited for source traceability.

1 Counter-Intuitive Findings Placed Before the Main Argument
The dataset produces several results that challenge ordinary GEO intuition. These are placed at the
beginning because they determine the correct scientific framing of the paper.

6
2
0
2

r
p
A
9
2

]

R

I
.
s
c
[

2
v
7
0
7
5
2
.
4
0
6
2
:
v
i
X
r
a

∗First author.
†Second author.
‡Third author. Public homepage: https://github.com/yaojingang; X profile: https://x.com/yaojingang.

Authors’ Contact Information: Zhang Kai, Independent Researcher, China; He Xinyue, Independent Researcher, China; Yao
Jingang, Independent Researcher, China.

2

Finding

Citation breadth and
citation depth diverge.

Q&A formatting alone is
weak.

News is selected often, yet
news_media is not the
deepest absorbed domain
type.

English does not universally
increase citation breadth.

More constraints can
reduce citation breadth on
one platform.

Zhang Kai, He Xinyue, and Yao Jingang

Observed evidence

Interpretation discipline

Mean citations per prompt: ChatGPT
6.88, Google 12.06, Perplexity 16.35.
Mean fetched-page influence:
ChatGPT 0.2713, Google 0.0584,
Perplexity 0.0646.
Q&A pages show mean influence
0.0947 versus 0.1005 for non-Q&A
pages, a -5.74% relative difference.

News appears frequently in source
selection, while news_media pages
average 0.0726 influence and
encyclopedia pages average 0.2144 in
the reported domain-type table.
In the C-layer language contrast,
ChatGPT has higher average citation
count for Chinese prompts, 7.77
versus 7.03 for English. Google
shows the opposite, 11.57 English
versus 7.53 Chinese.
For D-layer multi-constraint tasks,
ChatGPT averages 3.4 citations while
Google averages 12.6 and Perplexity
17.7.

Optimize and measure
exposure separately from
answer-level contribution.

Question-answer packaging
is insufficient without
evidence density and
semantic fit.
Selection probability and
absorption intensity are
separate outcomes.

Language effects should be
modeled with platform
interactions.

Complexity can trigger
compression and internal
synthesis rather than
broader retrieval.

Evidence standard. This manuscript avoids fabricated p-values, confidence intervals, or regres-
sion coefficients. All numerical claims in the results section are descriptive and traceable to the
public geo-citation-lab report and repository. Confirmatory inference specifications are reported as
a transparent analysis plan for future raw-CSV reruns under an explicit analysis script.

2 Introduction
Search visibility used to be modeled primarily as a ranked-list problem. A user issued a query,
a search engine returned links, and the publisher sought high placement, click-through, and
conversion. Generative engines modify every step of this loop. They retrieve or consult sources,
synthesize an answer, attach citations, and often satisfy the user before any source is opened. This
changes the unit of measurement from ranking position to answer participation.

The practical question for GEO is therefore not limited to whether a source appears in a citation
list. A page can be cited as a weak navigational reference while another page supplies definitions,
numerical evidence, comparisons, or procedural steps that shape multiple paragraphs of the gen-
erated answer. This paper names the first outcome citation selection and the second outcome
citation absorption.

The distinction is theoretically important because the same observed citation can play different
epistemic roles. It can serve as background, a factual basis, a paraphrase source, a structural guide,
a direct quote, or a low-impact reference. It is also practically important because publishers and
researchers need to know whether optimization should target authority and indexability, content
structure and semantic alignment, or both.

From Citation Selection to Citation Absorption

3

The public geo-citation-lab dataset creates an unusually useful research object for this question.
It contains controlled prompts, multiple generative search platforms, cleaned search-layer citation
records, fetched-page status, and citation-level features. Its design allows the study of search
triggering, source selection, and source absorption under one pipeline.

This paper is framed as an empirical measurement study. It does not claim access to hidden model
internals, and it does not claim that observed content features causally force a generative engine to
cite or use a page. It establishes a descriptive framework, documents reproducible patterns, and
specifies the inferential models required for a causal or quasi-causal extension.

2.1 Contributions

1. A two-stage formalization of GEO that separates citation selection from citation absorption.
2. A cross-platform empirical summary of ChatGPT, Google AI Overview/Gemini, and Per-

plexity using the public geo-citation-lab dataset.

3. A measurement interpretation of influence_score as an answer-level absorption proxy,
including its mathematical components and the modeling restrictions that follow from its
construction.

4. A set of counter-intuitive empirical findings that challenge shallow GEO heuristics such as

maximizing citation count or converting all content into Q&A pages.

5. A scientific self-audit and reproducibility checklist designed to support independent review

and replication.

3 Related Work

3.1 Generative Engine Optimization
GEO was formalized by Aggarwal et al. as a framework for improving content visibility in generative
engine responses [1]. That work introduced GEO-bench and showed that black-box content inter-
ventions could improve visibility under specific benchmark conditions. The present paper differs in
its measurement target: it studies observed cross-platform citation behavior and differentiates a
source being selected from a source being deeply used.

Recent work has extended GEO toward AI search benchmarking, document-centric optimization,
and diagnosis of citation failures [2,3,4,5,6]. Citation-repair work emphasizes that failures can occur
across retrieval, fetching, parsing, attribution, and generation [3]. Agentic and structural GEO work
further supports the premise that citation outcomes should be studied as a pipeline rather than as a
single ranking event [5,6].

3.2 Generative Search, RAG, and Source Attribution
Generative search inherits elements from retrieval-augmented generation: retrieve candidate mate-
rial, ground a response, and provide attribution [12,13,14,15]. Deployed answer engines introduce
additional uncertainty because source selection, answer generation, and citation rendering are often
black-box platform decisions. Studies of answer engines and source-cited responses document limi-
tations such as hallucination, inaccurate citation, and mismatch between evidence and generated
claims [7,8,9]. Citation-evaluation papers further show that citation quality needs sentence-level or
claim-level analysis, since a source link can be present while failing to support the statement it is
attached to [9].

This paper is complementary to attribution-quality research. It does not evaluate whether every
generated claim is fully supported. Its unit of analysis is the source page: how often it is selected,
how it is characterized, and how much it appears to influence the answer text and structure.

4

Zhang Kai, He Xinyue, and Yao Jingang

3.3 Why GEO Needs a New Dependent Variable
Classical SEO metrics emphasize ranking, click-through, backlinks, domain strength, and user
engagement. In generative search, those variables can still influence whether a source enters the
retrieval pool, yet they do not directly measure whether the answer depends on that source. A
generative engine can cite a high-authority page as a reference while extracting substantive facts
from a lower-frequency but more structured page.

The conceptual move in this paper is to define answer-level source influence as a second de-
pendent variable. It is imperfect, because the engine’s internal attention and retrieval traces are
unavailable, but it can be approximated through observable properties such as repeated references,
position, paragraph coverage, text overlap, and semantic alignment.

4 Dataset and Provenance

4.1 Project Scope
The geo-citation-lab repository describes itself as a dataset and analysis pipeline for studying how
AI search engines select and use citations [16]. The repository README identifies the original
research author as Zhang Kai and the secondary report/open-source organization role as Yao
Jingang [16]. This manuscript lists Zhang Kai as first author, He Xinyue as second author, and Yao
Jingang as third author. Yao Jingang’s public GitHub and X pages are included in the author note
and references [18,19]. Repository-maintainer attribution is retained in the data-source references.
The public snapshot includes 602 prompts, three platforms, 21,181 cleaned search-layer rows,
21,143 valid search-layer citations, 23,745 citation-level feature rows, 72 feature dimensions, and
18,151 successfully fetched citation pages. The reported overall fetch success rate is 76.44% [16,17].

Asset

Prompts

Reported quantity Analytical role

602 total Controlled inputs for search

triggering and source
selection.

Prompt layers

A/B/C/D = 432/60/60/50 Main experiment, style

Platforms

Cleaned search-layer rows

Valid search-layer citations

Citation-level feature rows

Fetch-ok pages
Feature dimensions

contrast, language contrast,
and realistic/extreme
scenarios.

3 ChatGPT, Google AI

Overview/Gemini, and
Perplexity.
Search-trigger and
citation-domain evidence.
21,143 Primary source-selection

21,181

23,745

sample.
Feature table used for
influence analysis.
18,151 Primary absorption sample.
72 Page structure, genre,

semantic alignment, LLM
ratings, and outcome
features.

From Citation Selection to Citation Absorption

5

4.2 Prompt Architecture

Layer

A

B

C

D

N Purpose

432 Main experimental

layer

60

Style contrast

60 Language contrast

50 Realistic and

extreme scenarios

Controlled or
observed factors

Task type, trigger
strength, time
sensitivity, industry,
subtask.
Natural phrasing,
explicit source
request, expert-role
prompt.
Chinese-English pair
design.
High-risk,
ambiguous,
multi-constraint,
long-decision,
macro-trend cases.

This design is stronger than an uncontrolled scrape because it creates repeated conditions under
which prompt type, phrasing, language, and scenario complexity can be compared. At the same
time, the sample is not a probability sample of all real user traffic. All external validity claims must
therefore be bounded to the prompt distribution used here.

4.3 Cleaning and Caveats
The public repository and report document several cleaning caveats: repeated header rows in
the ChatGPT CSV, normalization issues for ChatGPT A_news and A_technology naming, 15
missing ChatGPT prompt outputs after cleaning, noisy website-type values, and unknown values
in country and language fields [16,17]. These details matter because cross-platform comparisons
can be distorted if denominators are silently changed.

The analysis in this manuscript uses the report’s cleaned denominators: 587 observed ChatGPT
prompts, 602 Google prompts, and 602 Perplexity prompts for search-layer platform summaries.
Citation absorption is restricted to fetch_ok pages where page content was successfully retrieved.

5 Measurement Framework

5.1 Citation Selection
For prompt 𝑝 and platform 𝑒, define a search-trigger variable 𝑆𝑝,𝑒 and a citation count 𝐶𝑝,𝑒 . The
public report computes prompt-level triggering by treating a prompt as triggered if any cleaned row
under the prompt indicates search was triggered. Citation count is the count of valid citation-domain
rows under the same prompt-platform observation.

𝑆𝑝,𝑒 = ⊮{any cleaned row for prompt 𝑝 on platform 𝑒 indicates search triggered}

𝐶𝑝,𝑒 =

∑︁

𝑖

𝑉 𝑎𝑙𝑖𝑑𝐶𝑖𝑡𝑎𝑡𝑖𝑜𝑛𝑖,𝑝,𝑒

6

Zhang Kai, He Xinyue, and Yao Jingang

Fig. 1. The GEO measurement problem decomposes into citation selection and citation absorption. Source:
author synthesis from the geo-citation-lab pipeline design.

Equation (1) defines selection outcomes. The citation count is a breadth measure and should not

be interpreted as an absorption measure.

5.2 Citation Absorption
Citation absorption is measured at the citation-page level. The public feature table computes an
influence_score as a weighted proxy for how deeply a cited page appears to shape a generated
answer. The score rewards repeated reference, early appearance, coverage across answer paragraphs,
TF-IDF similarity, and n-gram overlap [17].

𝐼𝑛𝑓 𝑙𝑢𝑒𝑛𝑐𝑒𝑖 = 0.20 · min(𝑟𝑒 𝑓 _𝑐𝑜𝑢𝑛𝑡𝑖 /3, 1)

+ 0.15 · (1 − 𝑓 𝑖𝑟𝑠𝑡_𝑝𝑜𝑠𝑖𝑡𝑖𝑜𝑛_𝑟𝑎𝑡𝑖𝑜𝑖 )
+ 0.20 · 𝑝𝑎𝑟𝑎𝑔𝑟𝑎𝑝ℎ_𝑐𝑜𝑣𝑒𝑟𝑎𝑔𝑒_𝑟𝑎𝑡𝑖𝑜𝑖
+ 0.25 · 𝑡 𝑓 𝑖𝑑 𝑓 _𝑐𝑜𝑠𝑖𝑛𝑒𝑖

+ 0.20 ·

𝑏𝑖𝑔𝑟𝑎𝑚_𝑜𝑣𝑒𝑟𝑙𝑎𝑝𝑖 + 𝑡𝑟𝑖𝑔𝑟𝑎𝑚_𝑜𝑣𝑒𝑟𝑙𝑎𝑝𝑖
2

.

Equation (2) is the absorption proxy used in the public report. Since these components define

the outcome, they must not be reused as independent causal predictors of the same score.

5.3 Scientific Interpretation of the Influence Score
The influence score is a constructed observational proxy rather than a direct measure of hidden
model attention, retrieval ranking, or causal dependence. It is useful because it connects source-page
content to answer-level textual evidence, but it must be interpreted with discipline.

The most important modeling rule is outcome-component separation. Variables used inside
Equation (2), such as ref_count, first_position_ratio, paragraph_coverage_ratio, TF-IDF

From Citation Selection to Citation Absorption

7

similarity, and n-gram overlap, can be described as parts of influence. They should not be claimed
as independent drivers of influence in a regression that uses influence_score as the dependent
variable.

Cleaner explanatory variables include page structure, evidence genre, title-question match,
embedding similarity measures that are not directly used in the score, LLM relevance score, LLM
quality score, domain type, source type, language, and platform interactions. Even these variables
remain observational unless manipulated experimentally.

5.4 Estimands and Model Specifications for a Raw CSV Rerun
This manuscript reports descriptive estimands and specifies confirmatory models for an expanded
microdata analysis. The confirmatory models should be populated only after re-running the raw
CSVs with a locked script, exporting model diagnostics, and documenting missingness.

For selection breadth:

𝐶𝑝,𝑒 ∼ 𝑁 𝑒𝑔𝑎𝑡𝑖𝑣𝑒𝐵𝑖𝑛𝑜𝑚𝑖𝑎𝑙 (𝜇𝑝,𝑒, 𝛼)

log 𝜇𝑝,𝑒 = 𝛽0 + 𝛽𝑝𝑙𝑎𝑡 𝑓 𝑜𝑟𝑚[𝑒 ] + 𝛽𝑙𝑎𝑦𝑒𝑟 [𝑝 ] + 𝛽𝑠𝑡 𝑦𝑙𝑒 [𝑝 ] + 𝛽𝑙𝑎𝑛𝑔𝑢𝑎𝑔𝑒 [𝑝 ] + 𝛽𝑖𝑛𝑑𝑢𝑠𝑡𝑟 𝑦 [𝑝 ] + 𝛽𝑖𝑛𝑡𝑒𝑟𝑎𝑐𝑡𝑖𝑜𝑛𝑠 + 𝑢𝑝 .

For absorption:

logit(E[𝐼𝑛𝑓 𝑙𝑢𝑒𝑛𝑐𝑒𝑖 ]) = 𝛾0 +𝛾𝑝𝑙𝑎𝑡 𝑓 𝑜𝑟𝑚[𝑒𝑖 ] +𝛾𝑑𝑜𝑚𝑎𝑖𝑛_𝑡 𝑦𝑝𝑒 [𝑑𝑖 ] +𝛾𝑇

𝑠𝑡𝑟𝑢𝑐𝑡𝑢𝑟𝑒𝑋𝑖 +𝛾𝑇

𝑔𝑒𝑛𝑟𝑒𝐺𝑖 +𝛾𝑇

𝑠𝑒𝑚𝑎𝑛𝑡𝑖𝑐𝑍𝑖 +𝜖𝑖 .

For the absorption model, fractional logit or beta regression can be used, with two-way clustered
standard errors by prompt and domain. Variables that are direct components of Equation (2) should
be excluded from the primary explanatory specification.

5.5 Identification Map: What Can and Cannot Be Claimed
A rigorous GEO paper should make the identification status of every claim explicit. The present
dataset supports strong descriptive claims about observed platform behavior under the prompt
design. It supports structured hypotheses about mechanisms, because multiple independent de-
scriptive patterns point in the same direction. It does not, by itself, support universal causal claims
about how changing one page feature will necessarily change citation outcomes on a live platform.
The identification map has four levels. Level 1 claims are direct counts: number of prompts,
number of citations, trigger rates, and platform-level means. Level 2 claims are descriptive contrasts:
differences in citation breadth across platforms, differences in influence by domain type, and
top-versus-bottom quartile comparisons. Level 3 claims are mechanistic interpretations: evidence-
container design, platform compression, and selection-absorption separation. Level 4 claims are
causal optimization prescriptions: for example, a statement that adding definitions will increase
future AI citations for a specific page. This paper only treats Levels 1 and 2 as empirical findings.
Level 3 is presented as an explanation consistent with the data. Level 4 is reserved for future
intervention experiments.

This hierarchy is essential because GEO research is likely to be commercially sensitive. It is
tempting to translate every correlation into a content tactic. That translation can be useful as a
hypothesis-generation tool, yet it should not be marketed as a scientific law unless the feature
has been manipulated under controlled conditions. The dataset strongly suggests that semantic
alignment and extractable evidence matter, but it cannot isolate whether headings cause absorption,
whether high-quality pages simply tend to have more headings, or whether both are downstream
of a latent editorial-quality variable.

8

Zhang Kai, He Xinyue, and Yao Jingang

Claim level

Example

Supported by this
manuscript?

Level 1: direct count

Level 2: descriptive
contrast

Level 3: mechanism

Level 4: causal
optimization

Perplexity has 602
triggered prompts in
the cleaned report.
ChatGPT has lower
citation breadth and
higher fetched-page
mean influence.
High-influence pages
function as evidence
containers.
Adding comparison
sections will increase
future absorption.

Yes.

Yes.

Plausible
interpretation.

Not established here.

6 Results: Search Triggering and Citation Breadth

Recommended
evidence for stronger
claim

Exact CSV
reproduction and
timestamp logging.
Bootstrap confidence
intervals and
denominator audit.

Multivariate controls
and qualitative page
inspection.
Randomized page
rewrites and repeated
platform querying.

Fig. 2. Search triggering is near universal, but citation breadth differs sharply by platform. Source: geo-
citation-lab public report.

Platform

ChatGPT

Observed
prompts

Triggered

prompts Trigger rate

587

579

98.64%

Mean
citations

6.88

Median
citations

Max
citations

6

21

From Citation Selection to Citation Absorption

9

Platform

Google
AIO
Perplexity

Observed
prompts

Triggered

prompts Trigger rate

Mean
citations

Median
citations

Max
citations

602

602

600

602

99.67%

100.00%

12.06

16.35

12

17

37

27

The near-ceiling search-trigger rates imply that the primary frontier in this dataset is no longer
whether generative engines search. The main differences lie in how many sources are selected and
how those sources are used. Perplexity is the broadest citing platform, Google is also broad, and
ChatGPT is citation-sparser.

A naive GEO strategy might treat broader citation as better. That conclusion would be premature
because the absorption results below show that fewer citations can coexist with deeper use of each
citation. The correct unit of analysis depends on the objective: traffic attribution, source exposure,
claim support, or answer influence.

6.1 Prompt Style and Language Effects

Platform

Natural Explicit source request Expert-role prompt

ChatGPT
Google
Perplexity

7.30
14.05
15.70

6.15
15.90
17.15

7.95
10.40
16.70

Platform

Chinese prompt English prompt Observed pattern

ChatGPT
Google
Perplexity

7.77
7.53
15.93

7.03 Chinese higher in this sample.
11.57 English substantially higher.
16.43 English slightly higher.

Prompt style effects are platform-specific. Google and Perplexity respond strongly to explicit
source requests, while ChatGPT shows higher average citation count under expert-role prompts in
this layer. This pattern argues against a universal prompt-engineering rule for GEO measurement.
The language contrast is equally important. English prompts increase citation breadth on Google
and slightly on Perplexity, but ChatGPT shows higher average citation count for Chinese prompts
in the reported C-layer sample. Language should therefore be modeled with platform interactions
rather than as a global treatment.

6.2 Realistic and Extreme Scenarios

Scenario

ChatGPT Google Perplexity

High-risk
Ambiguous
Multi-constraint
Long-decision
Macro-trend

6.0
7.9
3.4
9.2
8.6

13.9
8.9
12.6
14.5
13.4

16.0
13.1
17.7
17.4
15.1

The strongest scenario contrast is multi-constraint behavior. ChatGPT cites only 3.4 sources
on average, while Perplexity cites 17.7. One interpretation is that ChatGPT compresses complex

10

Zhang Kai, He Xinyue, and Yao Jingang

constraints into internal synthesis after selecting fewer sources, while Perplexity decomposes the
task into broader retrieval. This remains an interpretation, not a causal claim, until the prompt-level
outputs are inspected and modeled.

7 Results: Source Selection

Fig. 3. Source-type composition indicates that official, news, and vertical sources form the default candidate
pool. Source: geo-citation-lab public report.

Platform

Official

News Vertical Official + News + Vertical

ChatGPT
Google
Perplexity

34.22% 31.17%
46.35% 18.99%
44.07% 16.07%

22.13%
22.00%
18.99%

87.52%
87.34%
79.12%

The source-selection layer is highly concentrated. Official, news, and vertical sources account
for 79.12% to 87.52% of citations across platforms. This concentration suggests that source identity
remains a strong entry condition. However, identity does not determine absorption intensity, as
shown later by the lower average influence for news_media relative to encyclopedia pages in the
reported domain-type table.

Platform

ChatGPT
Google
Perplexity

US share

English share

Mean Final_DR Median Final_DR

85.89%
86.76%
82.70%

95.07%
91.98%
82.90%

584.60
541.15
558.33

592
526
542

From Citation Selection to Citation Absorption

11

The identified country and language samples are dominated by US and English sources. The
report warns that country and language fields contain unknown values, so these percentages
should be read as identifiable-sample shares. Final_DR medians between 526 and 592 indicate that
authority-like signals remain important for entering the candidate pool.

Rank Domain

Count

Interpretive category

1 youtube.com
2
en.wikipedia.org
3
reddit.com
4
reuters.com
linkedin.com
5
6 nytimes.com
7 pmc.ncbi.nlm.nih.gov
8
9
10 finance.yahoo.com
11 deloitte.com
12
13 wsj.com
14
15 weforum.org

facebook.com
forbes.com

investopedia.com

theguardian.com

560 Platform / video aggregation
352 Encyclopedic explanation
315 Community / forum
287 Wire service
187 Professional platform
174 News media
167 Biomedical literature
151
Social platform
146 Business media
146
Finance portal
134 Professional services
124 News media
122 News media
121
121

Finance explainer
Institutional thought leadership

High-frequency domains reveal which sources are repeatedly eligible for selection. They do not
prove which domains most strongly shape answers. This distinction is central to the selection-
absorption separation.

8 Results: Citation Absorption

Platform

Fetch-ok citations Mean influence Median influence

ChatGPT
Google
Perplexity

3,323
6,385
8,443

0.2713
0.0584
0.0646

0.2611
0.0515
0.0333

This result is the core empirical motivation for this paper. ChatGPT cites fewer sources but uses
the sources it cites more deeply according to the influence proxy. Perplexity cites the most sources,
yet its mean influence is much lower. Google sits between the two in citation breadth but closer to
Perplexity in citation absorption.

This finding changes the GEO objective function. For traffic-oriented attribution, a broad citation
list may be valuable. For answer-shaping power, a smaller number of high-absorption citations
may matter more. Any single metric of visibility collapses these objectives and loses important
information.

8.1 Page Structure and Length

Metric

Word count
Heading total

Top 25% Bottom 25%

Ratio

1,943.30
10.59

169.82
0.85

11.44x
12.50x

12

Zhang Kai, He Xinyue, and Yao Jingang

Metric

Top 25% Bottom 25%

Ratio

Paragraph count
List density
Answer-citation semantic similarity
LLM relevance score
LLM content quality

47.49
0.428
0.570
3.535
3.404

8.34
0.048
0.247
1.856
2.289

5.69x
8.94x
2.31x
1.90x
1.49x

High-influence pages are not merely longer. They contain more headings, more paragraphs,
denser list structures, higher semantic similarity, and higher LLM-rated relevance and quality. The
observed pattern is consistent with the evidence-container hypothesis: pages that package multiple
extractable units can be reused across more answer segments.

The word-count bin analysis shows monotonic improvement in mean influence from very short
pages to pages longer than 3,000 words, with a modest local plateau around 301 to 1,000 words.
This should not be reduced to a rule that longer content always wins. Length appears beneficial
when it is coupled with usable structure, semantic alignment, and evidence density.

8.2 Semantic Alignment and Evidence Genres
The strongest reported independent correlation is LLM relevance score (𝑟 = 0.4322), followed by
answer-citation embedding similarity (𝑟 = 0.3561), LLM content quality (𝑟 = 0.2917), and question-
citation embedding similarity (𝑟 = 0.2548). Page word count and structural markers matter, but
semantic fit is stronger than a simple length signal.

Feature

True mean False mean Relative difference

Contains code
Contains numbers/statistics
Contains definition markers
Contains comparison content
Contains how-to content
Q&A format

0.1747
0.1171
0.1252
0.1389
0.1296
0.0947

0.0988
0.0725
0.0795
0.0894
0.0918
0.1005

+76.88%
+61.55%
+57.33%
+55.28%
+41.20%
-5.74%

The evidence-genre table provides one of the paper’s most actionable findings. Pages containing
code, numbers, definitions, comparisons, or how-to content show higher mean influence. Q&A
format shows the opposite direction. The likely mechanism is that evidence genres create reusable
support units, while Q&A formatting is only a surface wrapper.

8.3 Semantic Role and Usage Style

Semantic role

N Mean influence

definition
comparison
evidence
statistical_data
example
opinion
background
procedure
reference

1,663
1,719
6,216
504
1,468
846
5,582
497
1,298

0.1531
0.1524
0.1235
0.1120
0.1047
0.0938
0.0801
0.0717
0.0529

From Citation Selection to Citation Absorption

13

Semantic role

N Mean influence

Semantic role analysis reveals that the highest influence roles are definition and comparison.
Reference-only citations are much weaker. This supports the absorption concept: a source gains
answer-level importance when it supplies the form of information that the answer needs.

Usage style

N Mean influence

5,411
fact_source
3,967
synthesized
5,305
paraphrased
background_only 5,100

0.1241
0.0964
0.0955
0.0775

The usage-style table suggests that direct factual support carries higher influence than
background-only use. This is consistent with source attribution research: citation presence alone is
too weak as an evaluation target.

8.4 Domain Type and Platform-Specific Correlations

Domain type

N Mean influence

encyclopedia
academic_publishing
commercial
nonprofit
academic
government
news_media

527
86
11,779
2,009
1,024
892
1,546

0.2144
0.1118
0.1028
0.0971
0.0815
0.0769
0.0726

This table creates another selection-absorption split. News appears frequently in the candidate
pool, yet news_media has lower mean influence than encyclopedia and several other domain types
in the absorption table. This suggests that answer engines often need explanatory pages after they
have identified timely sources.

ChatGPT’s strongest reported signal is LLM relevance. Google’s strongest reported signals
are answer-citation and question-citation embedding similarities, along with definition markers.
Perplexity combines relevance with heading count and length. These patterns should be treated as
platform-specific descriptive profiles, not permanent platform laws.

8.5 Platform Strategy Profiles as Descriptive Archetypes
The three platforms can be summarized as descriptive archetypes, while preserving the warning
that product behavior may change. ChatGPT appears citation-sparse and absorption-heavy in this
snapshot. This means that the platform tends to cite fewer sources per prompt, but the selected
sources receive higher average influence under the constructed proxy. This pattern may reflect
answer synthesis that uses a smaller evidence base more intensively. It may also reflect differences
in citation rendering, answer length, browsing implementation, or the way the answer HTML is
parsed by the pipeline.

Google AI Overview/Gemini appears broader in citation selection and lower in average citation
absorption. It also shows strong response to explicit source-request prompts in the B layer and a
pronounced English advantage in the C layer. This may reflect a search-product heritage where

14

Zhang Kai, He Xinyue, and Yao Jingang

Fig. 4. ChatGPT has substantially higher mean citation influence among fetched pages. Source: geo-citation-
lab public report.

Fig. 5. Ratio of top-quartile to bottom-quartile page attributes by influence score. Source: geo-citation-lab
public report.

From Citation Selection to Citation Absorption

15

Fig. 6. Mean and median influence by word-count bin. Source: geo-citation-lab public report.

Fig. 7. Reported correlations between independent features and influence_score. Variables used directly in
the score definition are intentionally omitted from this figure. Source: geo-citation-lab public report.

16

Zhang Kai, He Xinyue, and Yao Jingang

Fig. 8. Mean influence uplift associated with evidence genres. Q&A format is the important negative case.
Source: geo-citation-lab public report.

Fig. 9. Semantic role determines how much a citation matters. Source: geo-citation-lab public report.

From Citation Selection to Citation Absorption

17

Fig. 10. Platform-specific correlations indicate that each engine weights semantic and structural features
differently. Source: geo-citation-lab public report.

broad source exposure and snippet-like support are important. It may also reflect a citation interface
that attaches more sources to a generated response, reducing average influence per source.

Perplexity appears citation-rich and coverage-oriented. It reaches the highest mean citations per
prompt and triggers search for every observed prompt in the cleaned report. Its average absorption
is closer to Google than to ChatGPT. This suggests a retrieval style that favors breadth, source
diversity, and visible provenance. For GEO measurement, Perplexity-like behavior is useful because
it exposes many candidate sources; for answer influence, it may require additional metrics to
distinguish central sources from peripheral ones.

These archetypes should not be converted into permanent claims about vendor strategies. They
are empirical profiles of the available snapshot. A longitudinal replication should report model
version, data-collection window, prompt execution order, and UI mode where possible. If those
details cannot be reconstructed, the limitation should remain visible in the paper rather than hidden
in a footnote.

8.6 Why the Negative Q&A Result Matters
The Q&A result is especially important because many practical GEO guides recommend FAQ-style
content as a general solution. In the reported means, Q&A pages have slightly lower influence than
non-Q&A pages. This does not prove that FAQ content is harmful. It shows that the surface format
alone is not a sufficient signal of answer usefulness.

A plausible explanation is that Q&A formatting often creates short, isolated responses. Such
pages may answer narrow questions but fail to provide the evidence density needed for synthesis
across a more complex user prompt. Another explanation is taxonomy noise: some FAQ pages are
thin support pages, and some non-Q&A pages are detailed explainers, government documents, or

18

Zhang Kai, He Xinyue, and Yao Jingang

encyclopedic resources. A follow-up regression should control for word count, structure, quality,
relevance, and domain type before drawing a sharper conclusion.

The conservative scientific conclusion is therefore narrow and useful: do not treat FAQ conversion
as a universal GEO intervention. If Q&A content is used, it should contain substantive definitions,
quantitative evidence, comparison logic, and clear section structure. The value comes from the
evidence inside the page, not from the presence of question marks in headings.

8.7 Industry and Question Type

Fig. 11. Mean influence by question type. Source: geo-citation-lab public report.

Industry

N Mean influence

A_technology 2,252
2,379
A_healthcare
2,243
A_commerce
1,831
A_finance
2,204
A_news
2,223
A_local

0.1272
0.1021
0.0994
0.0965
0.0948
0.0916

Technology has the highest reported average influence among industries, followed by healthcare
and commerce. Comparison questions have the highest reported average influence among question
types. These categories naturally demand definitions, criteria, contrastive evidence, and structured
explanation, which align with the evidence-container model.

From Citation Selection to Citation Absorption

19

9 Mechanistic Interpretation: The Evidence-Container Hypothesis
The evidence-container hypothesis states that a page becomes valuable to a generative engine
when it can be decomposed into reusable, semantically aligned information units. A high-quality
evidence container has clear topical scope, section headings that mirror likely user subquestions,
paragraphs that each carry a distinct claim, and extractable evidence such as definitions, statistics,
comparisons, examples, and step sequences.

This hypothesis explains why word count alone is an incomplete proxy. A long page full of
boilerplate, navigation, repetition, or unrelated material may not be useful. A long page with
modular structure gives the engine multiple chances to map user intent to specific answer segments.
The evidence-container frame also explains why Q&A formatting does not automatically help. A
Q&A page can be shallow, sparse, redundant, or poorly aligned with the generated answer.

The selection layer still matters. A page that is never retrieved or never selected cannot be
absorbed. Authority, language, region, source type, and platform-specific preferences shape the
gateway. Once inside the gateway, absorption depends more heavily on semantic alignment and
usable evidence structure.

9.1 Evidence-Container Design: Operational Criteria
The evidence-container hypothesis can be translated into operational criteria for future measure-
ment. A page should be scored on topical scope, section modularity, evidence density, source
transparency, and semantic alignment. Topical scope asks whether the page has a clearly bounded
subject rather than a diffuse collection of loosely related claims. Section modularity asks whether
headings divide the page into reusable answer units. Evidence density asks whether the page
contains definitions, statistics, examples, comparisons, procedural steps, caveats, and source links.
Source transparency asks whether facts are traceable to primary or reputable references. Semantic
alignment asks whether the page maps to the likely user tasks implied by the prompt set.

These criteria can be measured manually in a small validation sample and automatically in
the full dataset. Manual annotation is valuable because automatic features may miss context. For
example, a page can contain many numbers without providing useful statistics, or it can contain
many headings that repeat generic marketing claims. A high-quality validation protocol would
sample pages from each influence quartile, each platform, and each domain type. Annotators would
label whether each page contains answer-ready definitions, decision criteria, comparative evidence,
and numerical support.

A second validation layer should examine answer sentences. For each generated answer, sentence-
level support can be linked to cited pages. This would distinguish a page that merely appears in
the citation list from a page that supports multiple answer claims. The current influence score
approximates this distinction through paragraph coverage and text similarity. Sentence-level
annotation would provide an independent benchmark for evaluating and improving the influence
proxy.

9.2 Practical GEO Metrics Derived From the Framework
A publisher-facing GEO dashboard should avoid a single visibility number. A more robust dashboard
would include at least five metrics. Selection rate measures whether a page or domain appears
in citation pools for target prompts. Citation breadth measures how many citations appear per
prompt and how frequently the domain recurs. Absorption score measures answer-level influence.
Support quality measures whether cited pages actually substantiate generated claims. Coverage
equity measures whether visibility is concentrated among a small set of domains or distributed
across credible long-tail sources.

20

Zhang Kai, He Xinyue, and Yao Jingang

The same dashboard should separate prompt families. A page that performs well for “what is”
prompts may not perform well for comparison, how-to, or high-risk prompts. The question-type
results show that comparison prompts have relatively high mean influence. This suggests that
comparison-oriented content should be evaluated under comparison prompts rather than under
generic brand or definition prompts.

Finally, the dashboard should include time. Generative engines evolve quickly. A one-time GEO
audit is informative but incomplete. Longitudinal measurement should repeat prompt panels at
fixed intervals, log model and UI context, and track whether citation pools, influence scores, and
source-type distributions drift over time.

9.3 Practical Implication Under Scientific Constraints
For selection, build credibility, make pages fetchable, align metadata and titles with likely query
intent, and publish in environments that engines already treat as reliable. For absorption, write
pages as modular evidence containers with definitions, numbers, comparisons, and procedures. Use
headings to expose the semantic skeleton of the page. For evaluation, track both citation occurrence
and answer-level influence. A dashboard that counts citations alone will miss the central pattern of
this dataset.

9.4 Why This Differs From Classical SEO Advice
Classical SEO is still relevant because source authority and domain recognizability influence the
gateway into citation pools. The new layer is answer participation. GEO content must be easy to
index, easy to retrieve, easy to quote or paraphrase, and easy to map into the user’s actual task.
These requirements make content design closer to information architecture and evidence packaging
than to keyword density.

The data also discourages a single universal optimization recipe. ChatGPT, Google, and Perplexity
behave differently. The same prompt style or language condition can increase citation breadth
on one engine and fail to do so on another. A high-level GEO theory therefore needs platform
interactions, not only global ranking factors.

10 Threats to Validity
10.1 Internal Validity
Construct validity of influence_score is the central threat. The score is a plausible absorption
proxy, but it is not direct model attention or a causal trace. It combines observable text and citation-
position features into a single number. This gives the study a measurable outcome, yet it also means
that outcome interpretation must remain tied to the formula.

Outcome-component leakage is another risk. Any model that predicts influence_score using
its own components would be circular. This manuscript explicitly avoids that error by distinguishing
outcome components from permissible explanatory variables.

Fetch-ok selection is also important. Absorption analysis excludes failed fetches. If failed pages
systematically differ from successful pages, absorption estimates are conditional on fetchability. A
follow-up analysis should model fetch_ok as an intermediate selection outcome.

The lack of unified record-level timestamps limits temporal interpretation. AI search products
change quickly. Without aligned timestamps, the dataset should be interpreted as a static research
snapshot rather than a live platform-monitoring source.

From Citation Selection to Citation Absorption

21

10.2 External Validity
The 602 prompts are designed, not randomly sampled from all user behavior. The language contrast
focuses on Chinese and English; results should not be generalized to all non-English contexts.
The source-type taxonomy contains unknown and noisy values. Country and language shares are
reported only after excluding unknown values. AI search products may change retrieval policies,
citation rendering, browsing integrations, and model backends after the data snapshot.

10.3 Statistical Validity
The current manuscript uses descriptive statistics from the public report. A confirmatory microdata
analysis should compute uncertainty intervals, correct for multiple comparisons, cluster errors by
prompt and domain, and conduct robustness checks under alternative influence-score weights. The
absence of these inferential quantities is a deliberate scientific choice in the current manuscript,
not an omission hidden as certainty.

11 Robustness and Validation Plan

Check

Purpose

Expected output

Alternative influence weights

Content-only influence proxy

Domain-level deduplication

Remove mega-domains

Fetch-failure model

Two-way clustered inference

Test whether main absorption
findings depend on the
0.20/0.15/0.20/0.25/0.20
weighting scheme.
Remove ref_count and
first_position components
to test whether results survive
without citation-display
features.
Prevent high-frequency
domains from dominating
citation-level records.
Test sensitivity to Wikipedia,
YouTube, Reddit, and major
news/platform domains.
Predict fetch_ok from source
type, platform, and domain to
diagnose selection into the
absorption sample.
Account for repeated prompts
and repeated domains.

Rank stability, platform means,
quartile comparisons.

Correlation and platform
comparison tables.

Prompt-domain and
domain-level summaries.

Recomputed selection and
absorption summaries.

Logistic model and
missingness report.

Robust standard errors and
confidence intervals.

A fully reproducible research release should attach a notebook or script that starts from the
repository CSV files and exports every table and figure. The manuscript should also include a prove-
nance table indicating which claims are direct observations, which are descriptive aggregations,
and which are interpretive hypotheses.

11.1 Confirmatory Analysis Plan
The confirmatory analysis should be specified at the level of code and model design before inferential
claims are reported. The primary selection outcome should be prompt-platform citation count.

22

Zhang Kai, He Xinyue, and Yao Jingang

The primary absorption outcome should be influence score restricted to fetch-ok pages. Secondary
outcomes should include selection trigger, domain-type category, semantic role, usage style, and
content-genre indicators.

The first confirmatory table should estimate platform differences in citation count using a negative
binomial model, because citation counts are non-negative integers and likely overdispersed. The
second confirmatory table should estimate absorption differences using fractional logit or beta
regression, because influence score is bounded between 0 and 1. The third table should test whether
structural and semantic features remain associated with absorption after controlling for platform,
domain type, industry, question type, and language. Standard errors should be clustered at minimum
by prompt, and ideally by both prompt and domain.

The primary robustness family should alter the outcome definition. One version should remove
citation-display components from the influence score and retain only content-overlap or semantic-
coverage components. Another version should use a top-quartile binary absorption outcome. A third
version should aggregate to prompt-domain level so that repeated citations from the same prompt
do not dominate. A fourth version should remove mega-domains such as Wikipedia, YouTube,
Reddit, and large news portals.

The pre-registration should also define exclusion rules. Failed fetches should be retained for
selection analysis and excluded only for absorption analysis. Unknown country and language values
should not be silently dropped; tables should state the identifiable denominator. No variable that
directly appears inside the influence-score formula should be used as an independent explanatory
variable in the primary absorption model.

12 Responsible GEO and Ethics
GEO can be used to improve the discoverability of accurate, well-structured information. It can also
be misused to manipulate generated answers, flood engines with low-quality synthetic content, or
exploit citation mechanisms. This paper recommends responsible GEO: make content more accurate,
transparent, fetchable, and useful for verification rather than designing hidden instructions or
deceptive artifacts.

The evidence-container strategy is ethically acceptable when it improves clarity, citation trace-
ability, and user understanding. It becomes harmful when it fabricates authority, injects misleading
numbers, hides prompt-injection text, or attempts to steer models away from competing evidence.
Future GEO benchmarks should include abuse-resistance and citation-quality dimensions, not only
visibility.

Because generative engines mediate public access to information, source-selection concentration
also raises fairness questions. High authority and US-English dominance may disadvantage smaller,
local, multilingual, or long-tail sources. Measurement frameworks should therefore evaluate both
accuracy and equitable visibility.

13 Reproducibility and Data Availability
This study is based on the public geo-citation-lab repository and its associated public report. The
repository provides the dataset and analysis pipeline used to study how AI search engines select
and use citations. The present manuscript reports descriptive quantities that are traceable to that
public source and distinguishes them from confirmatory models that require a fresh raw-CSV rerun.
A fully reproducible research release should include a version-pinned analysis script that starts
from the repository CSV files, regenerates all descriptive tables and figures, records model versions
for embedding and LLM-scoring steps, and exports the confirmatory inference tables described in
the methodology section. Failed fetches should remain in the selection analysis and be excluded
only for absorption analysis, with denominators reported explicitly.

From Citation Selection to Citation Absorption

23

The project repository is https://github.com/yaojingang/geo-citation-lab. Repository and

public-report links are retained for source traceability.

14 Conclusion
This paper argues that GEO should be measured as a two-stage process: source selection followed by
source absorption. The geo-citation-lab dataset supports this distinction. Search triggering is near
universal across the studied platforms, yet citation breadth differs substantially. More importantly,
breadth and absorption diverge: ChatGPT cites fewer sources but has much higher mean influence
among fetched citations, while Perplexity and Google cite broader source sets with lower mean
per-source absorption.

The strongest descriptive evidence points toward semantic alignment and evidence structure.
High-influence pages are longer, more modular, and more semantically aligned with generated
answers. Pages containing definitions, numerical information, comparison content, code, and
procedural content show higher mean influence. Q&A format alone does not help in the reported
means.

The paper’s main scientific contribution is a measurement scaffold that separates exposure
from answer influence. The main practical implication is evidence-container design. The main
methodological warning is that descriptive GEO findings should not be prematurely converted
into universal causal rules. Follow-up work should rerun the raw CSV pipeline, add uncertainty
estimates, and test whether controlled content rewrites can causally improve both selection and
absorption.

A Claim-Level Self-Audit

Claim

Evidence status

Limitation

Three platforms
nearly always trigger
search.
Citation breadth
differs by platform.

Direct public report
table.

Direct public report
table.

ChatGPT has higher
mean absorption
among fetched pages.

High-influence pages
are longer and more
structured.

Semantic relevance is
the strongest
independent reported
correlation.

Direct public report
absorption summary.

Direct top/bottom
quartile comparison.

Direct correlation
table.

Near-ceiling rates
limit logistic-model
variation.
Citation count is
sensitive to platform
UI and deduplication
rules.
influence_score is a
constructed proxy and
conditional on
fetch_ok.
Length and structure
may be correlated
with domain type and
industry.
LLM scoring model
and embedding model
details should be
versioned.

Recommended
follow-up action

Report exact
denominators and
treat as descriptive.
Add prompt-domain
deduplication
robustness.

Run alternative
influence definitions
and fetch-ok selection
model.
Add multivariate
fractional model with
controls.

Document scoring
prompts/models and
rerun if possible.

24

Zhang Kai, He Xinyue, and Yao Jingang

Claim

Evidence status

Limitation

Q&A format does not
improve absorption.

Direct boolean-feature
mean comparison.

News is frequent but
not deepest absorbed.

Evidence-container
hypothesis explains
patterns.

Combination of
source-type frequency
and domain-type
influence table.
Interpretive synthesis
from multiple
descriptive results.

Q&A definition may
be broad; possible
confounding with
low-quality FAQ
pages.
Domain taxonomy
may contain noise and
platform composition
effects.
Hypothesis is not
causally proven.

Recommended
follow-up action

Inspect examples and
add controls for
quality and relevance.

Rerun with
standardized
taxonomy and
platform fixed effects.
Test with controlled
page rewrites and
randomized
intervention study.

B Proposed Experimental Extension
A natural research extension is a controlled intervention study. Select a stratified sample of pages
across industries and generate matched rewrites that vary only one feature family at a time:
structure, evidence density, semantic alignment, source transparency, and page length. Submit
matched prompts to the same platforms at the same timestamp window and compare selection and
absorption outcomes.

A minimal randomized design would use five arms: original page, structured headings only,
evidence blocks only, semantic-intent alignment only, and full evidence-container rewrite. Outcomes
would include citation probability, influence score, citation role, sentence-level support quality, and
user-visible citation placement. This design would convert the present descriptive paper into a
causal GEO study.

C Compact Data Dictionary for the Reproduction Script

Field family

Example fields

Role in analysis

Caution

Prompt metadata

Platform metadata

Search-layer citation

layer, industry,
question type,
language, style
platform, prompt id,
response id
citation domain,
citation URL, search
triggered

Independent design
variables.

Stratification and fixed
effects.
Selection outcomes
and source pool.

Source metadata

website type, country,
language, Final_DR

Source-selection
covariates.

Prompt taxonomy
must be normalized
across platform files.
Platform behavior is
time-sensitive.
Deduplication should
be tested at URL,
domain, and
prompt-domain levels.
Unknown values
require explicit
denominator
reporting.

From Citation Selection to Citation Absorption

25

Field family

Fetch status

Page structure

Evidence genre

Semantic alignment

Influence components

Example fields

Role in analysis

Caution

fetch_ok,
fetched_html, error
state
word count, headings,
paragraphs, list
density
definitions, numbers,
comparisons, how-to,
code, Q&A
embedding similarity,
LLM relevance, LLM
quality
ref_count,
first_position_ratio,
coverage, TF-IDF,
n-gram overlap

Absorption-sample
inclusion and
missingness.
Candidate absorption
predictors.

Failed fetches may be
non-random.

Structure may proxy
for editorial quality.

Evidence-container
features.

Core absorption
predictors.

Binary detectors need
validation on
examples.
Model and prompt
versions should be
logged.

Outcome construction. Avoid using these as

predictors of the same
outcome.

D Reproducibility and Release Checklist
This checklist summarizes the manuscript’s reproducibility posture. It is written as a release-oriented
research checklist rather than as a platform-specific filing checklist.

Item

Author metadata

Public dataset attribution

Evidence boundaries

Denominator discipline

Circularity control

Microdata inference

Temporal replication

Current handling

Author order is Zhang Kai first, He
Xinyue second, and Yao Jingang third;
Yao public profile links and repository
links are retained for traceability.
The geo-citation-lab repository and
public report are cited as the data source.
Descriptive claims, interpretive
hypotheses, and proposed confirmatory
models are separated in the text.
Search-layer and fetch-ok denominators
are reported separately.
Influence-score components are excluded
from primary explanatory language.
Bootstrap intervals, clustered standard
errors, and multivariate models are
specified as a follow-up microdata
analysis.
Repeating the prompt battery over time
is specified as a longitudinal robustness
extension.

Status

Included

Included

Included

Included

Included

Recommended
extension

Recommended
extension

26

Zhang Kai, He Xinyue, and Yao Jingang

E Additional Claim-Level Notes
The paper’s central empirical contrast can be independently checked from two tables in the public
report: the search-layer platform summary and the fetch-ok absorption summary. The search-layer
table establishes citation breadth. The absorption table establishes mean and median influence
among successfully fetched citations. The contrast between these two tables motivates the selection-
absorption framework.

The evidence-container hypothesis can be checked from three additional descriptive blocks: the
top-versus-bottom quartile profile, the independent feature correlations, and the evidence-genre
mean differences. The hypothesis gains credibility because the same direction appears across
length, headings, paragraphs, list density, semantic similarity, LLM relevance, definitions, numbers,
comparisons, and how-to indicators. The Q&A exception prevents over-simplified format advice
and strengthens the argument that evidence density is more important than surface layout.

The strongest remaining weakness is causal identification. A reviewer could reasonably ask
whether high-influence pages are selected because they are high-quality, because they belong
to favored domains, because they are longer, because they have better semantic alignment, or
because the platform’s retrieval component surfaced them earlier. Follow-up work should answer
this with multivariate controls and controlled rewrites. Until then, the manuscript should be read
as a rigorous measurement paper and hypothesis generator.

F References
[1] Aggarwal, P., Murahari, V., Rajpurohit, T., Kalyan, A., Narasimhan, K., and Deshpande, A. (2024).
GEO: Generative Engine Optimization. arXiv:2311.09735. Accepted to KDD 2024.

[2] Chen, M., Wang, X., Chen, K., and Koudas, N. (2025). Generative Engine Optimization: How to

Dominate AI Search. arXiv:2509.08919.

[3] Tian, Z., Chen, Y., Tang, Y., Liu, J., and Jia, R. (2026). Diagnosing and Repairing Citation Failures

in Generative Engine Optimization. arXiv:2603.09296.

[4] Liu, Z., and Xu, P. (2026). Think Before Writing: Feature-Level Multi-Objective Optimization for

Generative Citation Visibility. arXiv:2604.19113.

[5] Yuan, J., Wang, J., Wang, Z., Sun, Q., Wang, R., and Li, J. (2026). AgenticGEO: A Self-Evolving

Agentic System for Generative Engine Optimization. arXiv:2603.20213.

[6] Yu, J., Yang, M., Ding, Y., and Sato, H. (2026). Structural Feature Engineering for Generative

Engine Optimization: How Content Structure Shapes Citation Behavior. arXiv:2603.29979.

[7] Narayanan Venkit, P., Laban, P., Zhou, Y., Mao, Y., and Wu, C.-S. (2024). Search Engines in an

AI Era: The False Promise of Factual and Verifiable Source-Cited Responses. arXiv:2410.22349.
[8] Yang, K.-C. (2025). News Source Citing Patterns in AI Search Systems. arXiv:2507.05301.
[9] Xu, Y., Qi, P., Chen, J., Liu, K., Han, R., Liu, L., Min, B., Castelli, V., Gupta, A., and Wang, Z.

(2025). CiteEval: Principle-Driven Citation Evaluation for Source Attribution. arXiv:2506.01829.

[10] Qian, H., Fan, Y., Zhang, R., and Guo, J. (2024). On the Capacity of Citation Generation by

Large Language Models. arXiv:2410.11217.

[11] Kirsten, E., Grosse Perdekamp, J., Upadhyay, M., Gummadi, K. P., and Zafar, M. B. (2025).

Characterizing Web Search in The Age of Generative AI. arXiv:2510.11560.

[12] Lewis, P., Perez, E., Piktus, A., Petroni, F., Karpukhin, V., Goyal, N., et al. (2020). Retrieval-
Augmented Generation for Knowledge-Intensive NLP Tasks. Advances in Neural Information Process-
ing Systems.

[13] Karpukhin, V., Oguz, B., Min, S., Lewis, P., Wu, L., Edunov, S., Chen, D., and Yih, W.-t. (2020).

Dense Passage Retrieval for Open-Domain Question Answering. EMNLP.

From Citation Selection to Citation Absorption

27

[14] Nakano, R., et al. (2021). WebGPT: Browser-assisted question-answering with human feedback.

arXiv:2112.09332.

[15] Menick, J., et al. (2022). Teaching language models to support answers with verified quotes.

arXiv:2203.11147.

[16] geo-citation-lab repository. (2026). A dataset and analysis pipeline for studying how AI search
engines select and use citations. GitHub: https://github.com/yaojingang/geo-citation-lab. Accessed
April 28, 2026.

[17] geo-citation-lab final report. (2026). Overseas GEO Research Long Report, recalculated version.
https://yaojingang.github.io/geo-citation-lab/04-repet/final_report.html. Accessed April 28, 2026.
[18] Yao Jingang. (2026). GitHub profile. https://github.com/yaojingang. Accessed April 29, 2026.
[19] Yao Jingang. (2026). X profile. https://x.com/yaojingang. Accessed April 29, 2026.
