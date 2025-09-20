import { HIGH_CONFIDENCE_PATTERNS, MEDIUM_CONFIDENCE_PATTERNS } from '../01_urlPattern/constants';
import { FORM_CONTEXT_CONTACT_KEYWORDS } from '../02_htmlAnalysis/extractor/constants';

/**
 * フォールバックURLの品質評価（純粋関数）
 */
export const evaluateFallbackUrlQuality = (url: string, pattern: string): { confidence: number, keywords: string[] } => {
  let confidence = 0.5; // ベーススコア
  const keywords: string[] = [];

  // 高信頼度パターン
  if (HIGH_CONFIDENCE_PATTERNS.includes(pattern)) {
    confidence += 0.3;
    keywords.push('high_confidence_pattern');
  }

  // 中信頼度パターン
  if (MEDIUM_CONFIDENCE_PATTERNS.includes(pattern)) {
    confidence += 0.1;
    keywords.push('medium_confidence_pattern');
  }

  // URL内のcontactキーワードチェック（ドメイン除外）
  const urlPath = url.replace(/https?:\/\/[^/]+/, ''); // ドメインを除外
  const contactKeywords = [...FORM_CONTEXT_CONTACT_KEYWORDS, 'form'];

  for (const keyword of contactKeywords) {
    if (urlPath.toLowerCase().includes(keyword.toLowerCase())) {
      confidence += 0.1;
      keywords.push(`path_contains_${keyword}`);
    }
  }

  // 信頼度を上限で制限
  confidence = Math.min(confidence, 1.0);

  console.log(`URL quality evaluation for ${url}: confidence=${confidence.toFixed(2)}, keywords=[${keywords.join(', ')}]`);
  return { confidence, keywords };
};