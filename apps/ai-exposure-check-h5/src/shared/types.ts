export type EvidenceLabel =
  | 'raw_source'
  | 'verified_external'
  | 'sampled_ai_answer'
  | 'model_inference'
  | 'suggested_supplement';

export type RiskLevel = 'high' | 'medium' | 'low';

export type AiProvider = 'deepseek' | 'hy3' | 'qwen' | 'doubao' | 'kimi' | 'yuanbao' | 'tongyi' | 'wenxin';

export type AiSamplingStatus = 'ready' | 'sampled' | 'partial' | 'unavailable';

export type GeoScoreLevel = '优秀' | '良好' | '一般' | '待提升';

export type BusinessType = 'physical_product' | 'software_or_miniprogram' | 'local_service' | 'generic_or_unknown';

export type InputReadiness = 'ready' | 'needs_confirmation' | 'insufficient_evidence';

export type ReportConfidence = 'high' | 'medium' | 'low';

export type EntityRecognition = 'supported' | 'uncertain' | 'misrecognized' | 'not_verifiable';

export interface InputAssessment {
  status: InputReadiness;
  score: number;
  businessType: BusinessType;
  findings: string[];
  requiredActions: string[];
  officialSourceStatus: 'verified' | 'candidate' | 'missing';
  note: string;
}

export interface DiagnosisInput {
  businessName: string;
  description: string;
  links?: string;
  industry: string;
  city: string;
  targetCustomers: string;
  competitors?: string;
  contact?: string;
  source?: string;
  clientRequestId?: string;
  samplePrompts?: string[];
  confirmedBusinessType?: BusinessType;
}

export interface DiagnosisIssue {
  id: string;
  title: string;
  detail: string;
  evidenceLabel: EvidenceLabel;
  severity: RiskLevel;
}

export interface DiagnosisSuggestion {
  id: string;
  title: string;
  detail: string;
  evidenceLabel: EvidenceLabel;
  priority: 'P0' | 'P1' | 'P2';
}

export interface SamplePrompt {
  id: string;
  category: 'brand' | 'category' | 'feature' | 'competitor' | 'persona' | 'risk' | 'geo';
  prompt: string;
  targetFact: string;
}

export interface AiProviderStatus {
  provider: AiProvider;
  model?: string;
  status: AiSamplingStatus;
  promptCount: number;
  successCount: number;
  failureCount: number;
  note: string;
}

export interface AiSample {
  prompt: SamplePrompt;
  provider: AiProvider;
  model: string;
  status: 'success' | 'failed' | 'unavailable';
  sampledAt: string;
  latencyMs: number;
  answer?: string;
  error?: string;
}

export interface PageAuditTarget {
  id: string;
  name: string;
  url: string;
  status: 'ok' | 'warn' | 'missing' | 'failed';
  httpStatus?: number;
  contentType?: string;
  title?: string;
  description?: string;
  matchedFacts: string[];
  missingFacts: string[];
  notes: string[];
  fetchedAt: string;
  evidenceLabel: EvidenceLabel;
  sourceRelation?: 'entity_matched' | 'unrelated' | 'unknown';
  scopeRelation?: 'matched' | 'partial' | 'mismatched' | 'unknown';
  submitted?: boolean;
  canonicalUrl?: string;
}

export interface PageAuditResult {
  baseUrl?: string;
  generatedAt: string;
  score: number;
  targets: PageAuditTarget[];
  summary: {
    ok: number;
    warn: number;
    missing: number;
    failed: number;
    note: string;
  };
}

export interface ReportAnswerSample {
  promptId: string;
  provider: AiProvider;
  category: SamplePrompt['category'];
  prompt: string;
  answerExcerpt: string;
  mentionedBrand: boolean;
  brandedPrompt: boolean;
  naturalRecommendation: boolean;
  entityRecognition: EntityRecognition;
  recognitionReason: string;
  mentionedCompetitors: string[];
  riskFlags: string[];
  evidenceLabel: 'sampled_ai_answer';
}

export interface CompetitorMentionStat {
  name: string;
  mentionedCount: number;
  mentionRate: number;
  mentionedPrompts: string[];
  evidenceSnippets: string[];
  modelMisreadings: string[];
  suggestedContent: string[];
}

export interface ScoreDimension {
  code: string;
  name: string;
  score: number;
  weight: number;
  comment: string;
  evidenceLabel: EvidenceLabel;
}

export interface DiagnosisReport {
  id: string;
  version: '0.3' | '0.4';
  brand: string;
  category: string;
  generatedAt: string;
  riskLevel: RiskLevel;
  score: number;
  scoreLevel: GeoScoreLevel;
  summary: string;
  aiMeta: {
    provider: 'multi';
    model: string;
    status: AiSamplingStatus;
    sampledAt: string;
    promptCount: number;
    successCount: number;
    failureCount: number;
    providers: AiProviderStatus[];
  };
  evidencePolicy: {
    labels: EvidenceLabel[];
    notes: string;
  };
  stages: {
    overview: {
      oneLine: string;
      city: string;
      targetCustomers: string;
      keyFinding: string;
      highlights: string[];
      risks: string[];
    };
    credibility?: {
      inputAssessment: InputAssessment;
      businessType: BusinessType;
      confidence: ReportConfidence;
      scoreStatus: 'available' | 'withheld';
      stringMentionRate: number;
      correctEntityRecognitionRate: number | null;
      naturalRecommendationRate: number;
      misrecognitionRate: number;
      providerAgreementRate: number | null;
      modelConflicts: string[];
      confirmedFacts: string[];
      unverifiedFacts: string[];
      nextActions: string[];
    };
    score: {
      label: string;
      dimensions: ScoreDimension[];
    };
    userProfile: {
      groups: Array<{ title: string; scenario: string; questions: string[] }>;
      likelyQuestions: string[];
    };
    promptUniverse: {
      prompts: SamplePrompt[];
    };
    aiSearch: {
      totalQuestions: number;
      mentionedCount: number;
      mentionRate: number;
      topMentionedPrompts: string[];
      missingPrompts: string[];
      answerSamples: ReportAnswerSample[];
      providerBreakdown: AiProviderStatus[];
      evidenceLabel: 'sampled_ai_answer';
    };
    infrastructure: {
      score: number;
      checks: Array<{ name: string; status: 'ok' | 'warn' | 'missing'; note: string; evidenceLabel: EvidenceLabel }>;
      pageAudit: PageAuditResult;
    };
    competitors: {
      names: string[];
      mentionStats: CompetitorMentionStat[];
      pressureLevel: RiskLevel;
      note: string;
      evidenceLabel: EvidenceLabel;
    };
    geoEffect: {
      mentionRate: number;
      scenarioCoverage: Array<{ category: string; total: number; mentioned: number; rate: number }>;
      absorptionNotes: string[];
      evidenceLabel: EvidenceLabel;
    };
    sentimentRisk: {
      riskLevel: RiskLevel;
      flags: string[];
      note: string;
      evidenceLabel: EvidenceLabel;
    };
    recommendations: DiagnosisSuggestion[];
    roadmap: Array<{ phase: string; title: string; timeline: string; detail: string }>;
  };
  issues: DiagnosisIssue[];
  exports?: {
    markdown: string;
    html: string;
    evidencePackage: string;
  };
}

export interface DiagnosisEvidenceIndex {
  reportId: string;
  generatedAt: string;
  provider: 'multi';
  model: string;
  promptCount: number;
  successCount: number;
  files: Array<{
    type:
      | 'samples'
      | 'providers'
      | 'page_audit'
      | 'source_map'
      | 'markdown'
      | 'html'
      | 'evidence_package'
      | 'pdf';
    path: string;
  }>;
  notes: string;
}

export interface DiagnosisResponse {
  report: DiagnosisReport;
}

export interface DiagnosisPreflightResponse {
  assessment: InputAssessment;
}

export interface DiagnosisEvidenceResponse {
  evidence: DiagnosisEvidenceIndex;
}
