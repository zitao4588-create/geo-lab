import type { DiagnosisReport } from './types.js';

export type ReportScorePresentation = {
  scoreStatus: 'available';
  displayedScore: number;
  scoreLevel: DiagnosisReport['scoreLevel'];
  riskLevel: DiagnosisReport['riskLevel'];
} | {
  scoreStatus: 'withheld';
  displayedScore: null;
  scoreLevel: DiagnosisReport['scoreLevel'];
  riskLevel: DiagnosisReport['riskLevel'];
};

export function getReportScorePresentation(report: DiagnosisReport): ReportScorePresentation {
  const base = {
    scoreLevel: report.scoreLevel,
    riskLevel: report.riskLevel
  };

  if (report.stages.credibility?.scoreStatus === 'withheld') {
    return {
      ...base,
      scoreStatus: 'withheld',
      displayedScore: null
    };
  }

  return {
    ...base,
    scoreStatus: 'available',
    displayedScore: report.score
  };
}
