import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Textarea, Toast } from 'tdesign-mobile-react';
import type { DiagnosisInput, DiagnosisReport, EvidenceLabel, RiskLevel, ScoreDimension } from '../shared/types';
import { ApiError, createDiagnosis, getDiagnosis } from './api';

type Screen = 'start' | 'form' | 'loading' | 'result';

const DEFAULT_CONSULT_WECHAT_TEXT = '请扫码添加微信';
const CONSULT_WECHAT_ID = import.meta.env.VITE_CONSULT_WECHAT_ID?.trim() || DEFAULT_CONSULT_WECHAT_TEXT;
const CONSULT_QR_PATH = '/wechat-qr.jpg';
const FORM_DRAFT_KEY = 'aiec_form_draft';
const industryTags = ['本地餐饮', '小程序工具', '家政服务', '教育培训', '医美健康', 'SaaS软件'];

const emptyForm: DiagnosisInput = {
  businessName: '',
  description: '',
  links: '',
  industry: '',
  city: '',
  targetCustomers: '',
  competitors: '',
  contact: ''
};

const requiredFields: Array<keyof DiagnosisInput> = [
  'businessName',
  'description',
  'industry',
  'city',
  'targetCustomers'
];

function readDraft(): DiagnosisInput {
  try {
    const raw = sessionStorage.getItem(FORM_DRAFT_KEY);
    if (raw) return { ...emptyForm, ...(JSON.parse(raw) as Partial<DiagnosisInput>) };
  } catch {
    /* 草稿损坏时直接用空表单 */
  }
  return emptyForm;
}

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function App() {
  const [screen, setScreen] = useState<Screen>('start');
  const [form, setForm] = useState<DiagnosisInput>(readDraft);
  const [report, setReport] = useState<DiagnosisReport | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const id = search.get('report');
    if (!id) return;
    setScreen('loading');
    getDiagnosis(id)
      .then(({ report: loadedReport }) => {
        setReport(loadedReport);
        setScreen('result');
      })
      .catch(() => {
        setScreen('start');
        Toast('没有找到这份 GEO 报告');
      });
  }, []);

  useEffect(() => {
    if (screen !== 'loading') return undefined;
    const timer = window.setInterval(() => {
      setLoadingStep((current) => Math.min(current + 1, 3));
    }, 1100);
    return () => window.clearInterval(timer);
  }, [screen]);

  useEffect(() => {
    if (screen !== 'loading') return undefined;
    setLoadingSeconds(0);
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setLoadingSeconds(Math.round((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [screen]);

  useEffect(() => {
    if (screen !== 'loading') return undefined;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [screen]);

  useEffect(() => {
    try {
      sessionStorage.setItem(FORM_DRAFT_KEY, JSON.stringify(form));
    } catch {
      /* 隐私模式等场景下忽略 */
    }
  }, [form]);

  const canSubmit = useMemo(
    () => requiredFields.every((field) => typeof form[field] === 'string' && form[field].trim().length > 0),
    [form]
  );

  const updateForm = (field: keyof DiagnosisInput, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async () => {
    if (!canSubmit) {
      Toast('请先补齐必填信息');
      return;
    }

    setError('');
    setErrorCode('');
    setLoadingStep(0);
    setScreen('loading');

    try {
      const result = await createDiagnosis(form);
      setReport(result.report);
      try {
        sessionStorage.removeItem(FORM_DRAFT_KEY);
      } catch {
        /* ignore */
      }
      window.history.replaceState(null, '', `?report=${result.report.id}`);
      setScreen('result');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '生成失败，请稍后再试');
      setErrorCode(submitError instanceof ApiError ? submitError.code : '');
      setScreen('form');
    }
  };

  return (
    <main className="app-shell">
      <div className={`phone-frame is-${screen}`}>
        <Header screen={screen} onBack={() => setScreen(screen === 'result' ? 'form' : 'start')} />
        {screen === 'start' && <StartScreen onStart={() => setScreen('form')} />}
        {screen === 'form' && (
          <FormScreen
            form={form}
            error={error}
            errorCode={errorCode}
            canSubmit={canSubmit}
            onChange={updateForm}
            onSubmit={submit}
          />
        )}
        {screen === 'loading' && <LoadingScreen step={loadingStep} seconds={loadingSeconds} />}
        {screen === 'result' && report && <ResultScreen report={report} onRestart={() => {
          setReport(null);
          setForm(emptyForm);
          try {
            sessionStorage.removeItem(FORM_DRAFT_KEY);
          } catch {
            /* ignore */
          }
          window.history.replaceState(null, '', window.location.pathname);
          setScreen('start');
        }} />}
      </div>
      <DesktopPreview report={report} />
    </main>
  );
}

function Header({ screen, onBack }: { screen: Screen; onBack: () => void }) {
  const showBack = screen !== 'start';
  return (
    <header className="top-bar">
      <button className={`back-button ${showBack ? '' : 'is-hidden'}`} type="button" onClick={onBack} aria-label="返回">
        <span aria-hidden="true">‹</span>
      </button>
      <strong>AI曝光体检</strong>
      <span className="top-spacer" aria-hidden="true" />
    </header>
  );
}

function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <section className="screen start-screen">
      <div className="hero-copy">
        <h1>顾客问 AI 时<br />会提到你吗？</h1>
        <p className="hero-sub">30 秒生成你的 AI 曝光体检报告</p>
      </div>

      <div className="chat-demo" aria-hidden="true">
        <div className="chat-user"><span>这类产品，哪家值得选？</span></div>
        <div className="chat-ai">
          <span className="chat-avatar">AI</span>
          <div className="chat-answer">
            <p>大家常提到这几家：</p>
            <div className="chat-brands">
              <span>竞品 A</span>
              <span>竞品 B</span>
              <em>你的品牌？</em>
            </div>
          </div>
        </div>
      </div>

      <p className="trust-line">DeepSeek 真实采样 · 9 大报告模块 · 证据可追溯</p>

      <Button block size="large" theme="primary" className="primary-action" onClick={onStart}>
        免费测一次
      </Button>
      <p className="privacy-note">无需注册 · 无需留联系方式</p>

      <ComplianceLinks />
    </section>
  );
}

function FormScreen({
  form,
  error,
  errorCode,
  canSubmit,
  onChange,
  onSubmit
}: {
  form: DiagnosisInput;
  error: string;
  errorCode: string;
  canSubmit: boolean;
  onChange: (field: keyof DiagnosisInput, value: string) => void;
  onSubmit: () => void;
}) {
  const [consultOpen, setConsultOpen] = useState(false);
  const missingFields = requiredFields.filter((field) => {
    const value = form[field];
    return typeof value !== 'string' || value.trim().length === 0;
  });
  const rateLimited = errorCode === 'rate_limited';

  const handleSubmit = () => {
    if (missingFields.length > 0) {
      const target = document.getElementById(`field-${missingFields[0]}`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.remove('field-flash');
        void target.getBoundingClientRect();
        target.classList.add('field-flash');
        window.setTimeout(() => target.classList.remove('field-flash'), 1400);
      }
      Toast('请先补齐必填信息');
      return;
    }
    onSubmit();
  };

  return (
    <section className="screen form-screen">
      <StepHeader current={1} />
      <div className="section-title">
        <h2>填写业务资料</h2>
        <p>系统会据此生成采样问题，并调用 DeepSeek 生成最终 GEO 报告</p>
      </div>

      <div className="form-stack">
        <p className="group-label">基础信息</p>
        <Field id="field-businessName" label="产品/门店名称" required>
          <Input value={form.businessName} placeholder="例如：冰箱小雷达" onChange={(value) => onChange('businessName', String(value))} />
        </Field>
        <Field id="field-description" label="一句话介绍" required>
          <Textarea
            value={form.description}
            placeholder="例如：帮家庭管理冰箱食材、提醒临期食品的小程序"
            autosize={{ minRows: 2, maxRows: 4 }}
            onChange={(value) => onChange('description', String(value))}
          />
        </Field>
        <Field id="field-industry" label="所在行业" required>
          <Input value={form.industry} placeholder="例如：小程序工具" onChange={(value) => onChange('industry', String(value))} />
          <div className="industry-tags" aria-label="常见行业快捷选择">
            {industryTags.map((tag) => (
              <button
                type="button"
                className={form.industry === tag ? 'active' : ''}
                key={tag}
                onClick={() => onChange('industry', tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </Field>
        <Field id="field-city" label="所在城市" required>
          <Input value={form.city} placeholder="例如：西安 / 全国" onChange={(value) => onChange('city', String(value))} />
        </Field>
        <Field id="field-targetCustomers" label="目标客户" required>
          <Textarea
            value={form.targetCustomers}
            placeholder="例如：家庭主厨、上班族、小店老板"
            autosize={{ minRows: 2, maxRows: 4 }}
            onChange={(value) => onChange('targetCustomers', String(value))}
          />
        </Field>

        <p className="group-label">补充信息<span>选填 · 填得越全，采样和审计越准</span></p>
        <Field label="公开入口（官网/小程序/公众号等）">
          <Textarea
            value={form.links}
            placeholder="例如：https://xxx.com、小程序「冰箱小雷达」"
            autosize={{ minRows: 2, maxRows: 5 }}
            onChange={(value) => onChange('links', String(value))}
          />
        </Field>
        <Field label="竞品名称">
          <Textarea
            value={form.competitors}
            placeholder="例如：大众点评、美团"
            autosize={{ minRows: 2, maxRows: 4 }}
            onChange={(value) => onChange('competitors', String(value))}
          />
        </Field>
      </div>

      {rateLimited ? (
        <div className="rate-card">
          <strong>免费名额暂时用完了</strong>
          <p>{error}</p>
          <Button block theme="primary" className="cta-button" onClick={() => setConsultOpen(true)}>
            扫码预约人工解读
          </Button>
          <small>每天 30 个免费名额 · 每份报告都是真实采样</small>
        </div>
      ) : (
        error && <p className="error-text">{error}</p>
      )}

      <Button
        block
        size="large"
        theme="primary"
        className={`primary-action ${canSubmit ? '' : 'is-not-ready'}`}
        onClick={handleSubmit}
      >
        生成 GEO 分析报告
      </Button>
      {missingFields.length > 0 && <p className="missing-hint">还差 {missingFields.length} 项必填</p>}
      <p className="form-hint">真实采样通常需要 20-60 秒。若模型服务暂不可用，系统会明确提示，不会返回伪报告。</p>
      {consultOpen && <ConsultModal onClose={() => setConsultOpen(false)} />}
    </section>
  );
}

function Field({
  id,
  label,
  required = false,
  children
}: {
  id?: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="field" id={id}>
      <span>
        {label}
        {required && <em>*</em>}
      </span>
      {children}
    </label>
  );
}

function LoadingScreen({ step, seconds }: { step: number; seconds: number }) {
  const tasks = ['生成采样问题', '调用 DeepSeek 回答', '计算 GEO 成果得分', '整理证据边界', '生成行动路线'];
  const tips = [
    '本报告使用 DeepSeek 本次返回答案作为采样证据，不把它包装成全网确定排名。',
    'GEO 小知识：AI 更容易引用有明确定义、适用人群和边界说明的页面。',
    'GEO 小知识：品牌页、FAQ 和隐私说明，是 AI 理解你的三块基石。',
    'GEO 小知识：竞品对比页能帮 AI 在「怎么选」的问题里想起你。'
  ];
  const tipIndex = Math.floor(seconds / 7) % tips.length;
  const statusCopy =
    seconds >= 150
      ? '仍在生成中，最长可能需要 3-4 分钟，请保持页面打开'
      : seconds >= 60
        ? '大模型采样偶尔较慢，报告生成后不会丢失，请再等一会儿'
        : '系统正在做真实问答采样，请不要关闭页面';
  return (
    <section className="screen loading-screen">
      <StepHeader current={2} />
      <div className="loading-copy">
        <h2>正在生成 GEO 报告</h2>
        <p>{statusCopy}</p>
      </div>
      <div className="scan-ring" role="status" aria-label="正在采样">
        <span className="ring-track" aria-hidden="true" />
        <span className="ring-arc" aria-hidden="true" />
        <div className="ring-core">
          <strong>{Math.min(step + 1, tasks.length)}<small>/{tasks.length}</small></strong>
          <span>采样中</span>
        </div>
      </div>
      <div className="task-card">
        {tasks.map((task, index) => {
          const state = index <= step ? 'done' : index === step + 1 ? 'active' : '';
          return (
            <div className={`task-row ${state}`} key={task}>
              <span className={`task-dot ${state}`}>{index <= step ? '✓' : ''}</span>
              <span>{task}</span>
            </div>
          );
        })}
      </div>
      <p className="loading-note" key={tipIndex}>{tips[tipIndex]}</p>
    </section>
  );
}

function ResultScreen({ report, onRestart }: { report: DiagnosisReport; onRestart: () => void }) {
  const [consultOpen, setConsultOpen] = useState(false);
  const [showBar, setShowBar] = useState(false);
  const [displayScore, setDisplayScore] = useState(() => (prefersReducedMotion() ? report.score : 0));
  const coverRef = useRef<HTMLDivElement | null>(null);
  const ctaRef = useRef<HTMLDivElement | null>(null);
  const risk = riskMeta(report.riskLevel);
  const scoreDeg = Math.round((report.score / 100) * 360);
  const sampledProviders = report.stages.aiSearch.providerBreakdown.filter(
    (provider) => provider.status === 'sampled' || provider.status === 'partial'
  );
  const unavailableProviders = report.stages.aiSearch.providerBreakdown.filter(
    (provider) => provider.status !== 'sampled' && provider.status !== 'partial'
  );
  const answerSamples = report.stages.aiSearch.answerSamples.slice(0, 4);
  const auditTargets = report.stages.infrastructure.pageAudit.targets.slice(0, 8);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplayScore(report.score);
      return undefined;
    }
    let raf = 0;
    const started = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * report.score));
      if (progress < 1) raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [report.score]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    let coverVisible = true;
    let ctaVisible = false;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === coverRef.current) coverVisible = entry.isIntersecting;
        if (entry.target === ctaRef.current) ctaVisible = entry.isIntersecting;
      }
      setShowBar(!coverVisible && !ctaVisible);
    });
    if (coverRef.current) observer.observe(coverRef.current);
    if (ctaRef.current) observer.observe(ctaRef.current);
    return () => observer.disconnect();
  }, []);

  const copyReportLink = async () => {
    if (!navigator.clipboard) {
      Toast('当前浏览器不支持一键复制，请手动复制地址栏链接');
      return;
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      Toast('已复制报告链接');
    } catch {
      Toast('复制失败，请手动复制地址栏链接');
    }
  };

  return (
    <section className="screen result-screen">
      <StepHeader current={3} />
      <h2 className="result-heading">GEO 分析成果报告</h2>
      <div className="report-meta">
        <span>编号 {report.id}</span>
        <button type="button" className="copy-link" onClick={copyReportLink}>复制报告链接</button>
      </div>

      <div
        ref={coverRef}
        className={`report-cover ${report.riskLevel}`}
        style={{ '--score-deg': `${scoreDeg}deg` } as React.CSSProperties}
      >
        <span className="cover-kicker">GEO 分析成果得分</span>
        <div className="cover-ring">
          <div>
            <strong>{displayScore}</strong>
            <small>/ 100</small>
          </div>
        </div>
        <span className="cover-chip">{report.scoreLevel} · {risk.label}</span>
        <p className="cover-summary">{report.summary}</p>
        <div className="cover-foot">
          <span>DeepSeek 真实采样 {report.aiMeta.successCount}/{report.aiMeta.promptCount}</span>
          <span>{formatDate(report.generatedAt)}</span>
        </div>
      </div>

      <section className="evidence-card">
        <strong>证据边界</strong>
        <p>{report.evidencePolicy.notes}</p>
        <div className="label-list">
          {report.evidencePolicy.labels.map((label) => (
            <EvidenceBadge key={label} label={label} />
          ))}
        </div>
      </section>

      <ResultBlock title="核心结论">
        <p className="block-summary">{report.stages.overview.keyFinding}</p>
        <div className="mini-list">
          {report.stages.overview.highlights.map((item) => <span key={item}>{item}</span>)}
        </div>
      </ResultBlock>

      <ResultBlock title="评分拆解">
        <div className="dimension-list">
          {report.stages.score.dimensions.map((dimension) => (
            <DimensionRow key={dimension.code} dimension={dimension} />
          ))}
        </div>
      </ResultBlock>

      <ResultBlock title="AI 采样结果">
        <div className="metric-grid">
          <Metric label="成功采样" value={`${report.aiMeta.successCount}/${report.aiMeta.promptCount}`} />
          <Metric label="品牌提及率" value={`${Math.round(report.stages.aiSearch.mentionRate * 1000) / 10}%`} />
          <Metric label="提及问题数" value={`${report.stages.aiSearch.mentionedCount}`} />
        </div>
        {sampledProviders.length > 0 && (
          <div className="provider-strip">
            {sampledProviders.map((provider) => (
              <span className={provider.status} key={provider.provider}>
                {provider.provider} · {provider.successCount}/{provider.promptCount}
              </span>
            ))}
          </div>
        )}
        {unavailableProviders.length > 0 && (
          <p className="provider-note">
            {unavailableProviders.map((provider) => provider.provider).join(' / ')} 未配置，不生成模拟结果
          </p>
        )}
        {answerSamples.length > 0 && (
          <Collapse summary={`查看 ${answerSamples.length} 条采样答案原文`}>
            <div className="answer-list">
              {answerSamples.map((answer) => (
                <article className="answer-card" key={answer.promptId}>
                  <div>
                    <strong>{answer.prompt}</strong>
                    <EvidenceBadge label={answer.evidenceLabel} />
                  </div>
                  <p>{answer.answerExcerpt}</p>
                  <small className={answer.mentionedBrand ? 'hit' : 'miss'}>
                    {answer.mentionedBrand ? '已提及品牌' : '未提及品牌'}
                    {answer.mentionedCompetitors.length ? ` · 竞品：${answer.mentionedCompetitors.join('、')}` : ''}
                  </small>
                </article>
              ))}
            </div>
          </Collapse>
        )}
      </ResultBlock>

      <ResultBlock title="公开基建">
        <div className="metric-grid">
          <Metric label="页面审计分" value={`${report.stages.infrastructure.score}`} />
          <Metric label="通过页面" value={`${report.stages.infrastructure.pageAudit.summary.ok}`} />
          <Metric label="需补强" value={`${report.stages.infrastructure.pageAudit.summary.warn}`} />
        </div>
        <div className="check-grid">
          {report.stages.infrastructure.checks.map((check) => (
            <div className={`check-item ${check.status}`} key={`${check.name}-${check.note}`}>
              <strong>{check.name}</strong>
              <p>{check.note}</p>
            </div>
          ))}
        </div>
        {auditTargets.length > 0 && (
          <Collapse summary={`查看 ${auditTargets.length} 个页面审计明细`}>
            <div className="audit-list">
              {auditTargets.map((target) => (
                <div className={`audit-row ${target.status}`} key={target.id}>
                  <strong>{target.name}</strong>
                  <span>{target.status} · HTTP {target.httpStatus ?? '-'}</span>
                  <p>{target.title || target.url}</p>
                </div>
              ))}
            </div>
          </Collapse>
        )}
      </ResultBlock>

      <ResultBlock title="竞品与信任风险">
        <p className="block-summary">{report.stages.competitors.note}</p>
        <div className="competitor-list">
          {report.stages.competitors.mentionStats.map((item) => (
            <div className="competitor-row" key={item.name}>
              <strong>{item.name}</strong>
              <span>{item.mentionedCount} 次 · {Math.round(item.mentionRate * 1000) / 10}%</span>
              <p>{item.suggestedContent[0]}</p>
            </div>
          ))}
        </div>
        {report.stages.sentimentRisk.flags.length > 0 ? (
          <div className="mini-list danger">
            {report.stages.sentimentRisk.flags.map((flag) => <span key={flag}>{flag}</span>)}
          </div>
        ) : (
          <p className="muted-line">{report.stages.sentimentRisk.note}</p>
        )}
      </ResultBlock>

      <ResultBlock title="优先优化项">
        {report.stages.recommendations.slice(0, 5).map((suggestion) => (
          <div className="suggestion-row" key={suggestion.id}>
            <span className={`pri ${suggestion.priority}`}>{suggestion.priority}</span>
            <div>
              <div className="row-title">
                <strong>{suggestion.title}</strong>
                <EvidenceBadge label={suggestion.evidenceLabel} />
              </div>
              <p>{suggestion.detail}</p>
            </div>
          </div>
        ))}
      </ResultBlock>

      <ResultBlock title="执行路线">
        <div className="roadmap-list">
          {report.stages.roadmap.map((item) => (
            <div className="roadmap-item" key={item.phase}>
              <span>{item.phase}</span>
              <div>
                <strong>{item.title}</strong>
                <small>{item.timeline}</small>
                <p>{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </ResultBlock>

      {report.exports && (
        <ResultBlock title="报告导出">
          <p className="export-notice">可先查看报告；如需 PDF 或人工解读，请扫码联系后确认交付范围。</p>
          <div className="export-grid">
            <a href={report.exports.html} target="_blank" rel="noreferrer">HTML报告</a>
            <a href={report.exports.markdown} target="_blank" rel="noreferrer">Markdown</a>
            <a href={report.exports.evidencePackage} target="_blank" rel="noreferrer">证据包</a>
          </div>
        </ResultBlock>
      )}

      <div className="cta-card" ref={ctaRef}>
        <h3>需要把报告落成内容和页面？</h3>
        <p>下一步可以人工核验多平台答案、补品牌页 / FAQ / 隐私页，并建立月度复测。</p>
        <Button block theme="primary" className="cta-button" onClick={() => setConsultOpen(true)}>
          添加微信 · 预约完整体检
        </Button>
      </div>

      <Button block theme="default" variant="text" className="restart-button" onClick={onRestart}>重新分析</Button>
      <ComplianceLinks />

      <div className={`consult-bar ${showBar ? 'show' : ''}`} aria-hidden={!showBar}>
        <span>需要人工解读这份报告？</span>
        <button type="button" tabIndex={showBar ? 0 : -1} onClick={() => setConsultOpen(true)}>添加微信</button>
      </div>

      {consultOpen && <ConsultModal onClose={() => setConsultOpen(false)} />}
    </section>
  );
}

function Collapse({ summary, children }: { summary: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="collapse">
      <button type="button" className="collapse-toggle" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span>{open ? '收起' : summary}</span>
        <em aria-hidden="true" className={open ? 'up' : ''}>▾</em>
      </button>
      {open && <div className="collapse-body">{children}</div>}
    </div>
  );
}

function ConsultModal({ onClose }: { onClose: () => void }) {
  const hasWechatId = CONSULT_WECHAT_ID !== DEFAULT_CONSULT_WECHAT_TEXT;

  const copyWechat = async () => {
    if (!navigator.clipboard) {
      Toast('当前浏览器不支持一键复制，请长按二维码添加');
      return;
    }

    try {
      await navigator.clipboard.writeText(CONSULT_WECHAT_ID);
      Toast(hasWechatId ? '已复制微信号' : '已复制添加说明');
    } catch {
      Toast('复制失败，请长按二维码添加');
    }
  };

  return (
    <div className="consult-modal" role="dialog" aria-modal="true" aria-label="添加微信咨询">
      <button className="consult-backdrop" type="button" aria-label="关闭咨询弹层" onClick={onClose} />
      <div className="consult-panel">
        <button className="consult-close" type="button" aria-label="关闭" onClick={onClose}>×</button>
        <h3>扫码添加微信</h3>
        <p>发送报告 ID，可预约人工完整体检和页面优化建议。</p>
        <img src={CONSULT_QR_PATH} alt="微信咨询二维码" />
        <div className="consult-code">
          <span>微信号</span>
          <strong>{CONSULT_WECHAT_ID}</strong>
        </div>
        <Button block theme="primary" className="cta-button" onClick={copyWechat}>
          {hasWechatId ? '复制微信号' : '复制添加说明'}
        </Button>
      </div>
    </div>
  );
}

function DimensionRow({ dimension }: { dimension: ScoreDimension }) {
  return (
    <div className="dimension-row">
      <div>
        <strong>{dimension.name}</strong>
        <EvidenceBadge label={dimension.evidenceLabel} />
      </div>
      <div className="score-bar" aria-hidden="true">
        <span style={{ width: `${dimension.score}%` }} />
      </div>
      <p><b>{dimension.score}分</b>{dimension.comment}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function ResultBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="result-block">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function StepHeader({ current }: { current: 1 | 2 | 3 }) {
  const steps = ['填写信息', '真实采样', '查看报告'];
  return (
    <div className="steps" aria-label="分析步骤">
      {steps.map((label, index) => {
        const step = index + 1;
        const active = step === current;
        const done = step < current;
        return (
          <div className={`step ${active ? 'active' : ''} ${done ? 'done' : ''}`} key={label}>
            <span>{done ? '✓' : step}</span>
            <small>{label}</small>
          </div>
        );
      })}
    </div>
  );
}

function DesktopPreview({ report }: { report: DiagnosisReport | null }) {
  return (
    <aside className="desktop-preview" aria-hidden="true">
      <div>
        <strong>让 AI 主动提到你的品牌</strong>
        <p>基于真实问答采样的 GEO 分析报告：评分拆解、竞品对比、证据留档、行动路线。</p>
      </div>
      <div className="preview-panel">
        <span>AI曝光体检</span>
        <h2>{report ? `${report.score}分 · ${report.scoreLevel}` : '提交业务资料，生成 GEO 分析报告'}</h2>
        <p>{report?.summary ?? '报告会保留采样证据、评分拆解、竞品风险和下一步执行路线。'}</p>
        <small>exposure.playgamelab.cn · GEO 分析成果报告</small>
      </div>
    </aside>
  );
}

function EvidenceBadge({ label }: { label: EvidenceLabel }) {
  const text: Record<EvidenceLabel, string> = {
    raw_source: '用户资料',
    verified_external: '已验证',
    sampled_ai_answer: '采样答案',
    model_inference: '模型推断',
    suggested_supplement: '建议补充'
  };
  return <em className={`evidence-badge ${label}`}>{text[label]}</em>;
}

function ComplianceLinks() {
  return (
    <nav className="compliance-links" aria-label="合规链接">
      <a href="/privacy.html">隐私政策</a>
      <a href="/terms.html">用户协议</a>
      <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">陕ICP备2026012759号-2</a>
      <a href="https://www.beian.gov.cn/" target="_blank" rel="noreferrer">陕公网安备61010202000523号</a>
      <span>备案展示以 exposure 子域名最终核验为准</span>
    </nav>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '刚刚生成';
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function riskMeta(level: RiskLevel) {
  if (level === 'low') return { label: '低风险', color: '#19a15f' };
  if (level === 'medium') return { label: '中等风险', color: '#ed7b2f' };
  return { label: '高风险', color: '#d54941' };
}
