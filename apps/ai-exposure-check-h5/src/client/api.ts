import type { DiagnosisInput, DiagnosisResponse, HealthResponse, InputAssessment } from '../shared/types';

export class ApiError extends Error {
  code: string;
  assessment?: InputAssessment;

  constructor(message: string, code: string, assessment?: InputAssessment) {
    super(message);
    this.code = code;
    this.assessment = assessment;
  }
}

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch('/api/health');
  return parseResponse<HealthResponse>(response);
}

export async function createDiagnosis(input: DiagnosisInput): Promise<DiagnosisResponse> {
  const response = await fetch('/api/diagnoses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(input)
  });

  return parseResponse(response);
}

export async function getDiagnosis(id: string): Promise<DiagnosisResponse> {
  const response = await fetch(`/api/diagnoses/${encodeURIComponent(id)}`);
  return parseResponse<DiagnosisResponse>(response);
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as
    | DiagnosisResponse
    | { error?: string; message?: string; assessment?: InputAssessment }
    | null;
  if (!response.ok) {
    const message = (data && 'message' in data && data.message) || '请求失败，请稍后再试';
    const code = (data && 'error' in data && data.error) || 'request_failed';
    const assessment = data && 'assessment' in data ? data.assessment : undefined;
    throw new ApiError(message, code, assessment);
  }
  return data as T;
}
