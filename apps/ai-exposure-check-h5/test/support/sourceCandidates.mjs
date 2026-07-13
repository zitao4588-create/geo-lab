/**
 * Creates a local review queue from URLs already supplied by the user.
 * This helper performs no discovery request and never promotes a URL to verified.
 */
export function buildSourceCandidates(input) {
  const urls = input.links?.match(/https?:\/\/[^\s，,；;]+/giu) ?? [];
  return [...new Set(urls.map(normalizeCandidateUrl).filter(Boolean))].map((url) => ({
    url,
    entityName: input.businessName,
    discoveryMethod: 'user_submitted',
    reviewStatus: 'pending_review',
    verified: false,
    note: '候选来源仅供本地人工审核；通过 PageAudit 的实体与范围核验前不能作为官方事实。'
  }));
}

function normalizeCandidateUrl(value) {
  try {
    const url = new URL(value.replace(/[。.!?）)]+$/gu, ''));
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    url.hash = '';
    return url.toString();
  } catch {
    return undefined;
  }
}
