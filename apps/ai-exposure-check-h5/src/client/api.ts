import type { DiagnosisInput, DiagnosisResponse } from '../shared/types';

export class ApiError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
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
  return parseResponse(response);
}

async function parseResponse(response: Response): Promise<DiagnosisResponse> {
  const data = (await response.json().catch(() => null)) as
    | DiagnosisResponse
    | { error?: string; message?: string }
    | null;
  if (!response.ok) {
    const message = (data && 'message' in data && data.message) || '请求失败，请稍后再试';
    const code = (data && 'error' in data && data.error) || 'request_failed';
    throw new ApiError(message, code);
  }
  return data as DiagnosisResponse;
}
