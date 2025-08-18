/**
 * フォールバック検索システムモジュール
 * 最終手段として200 OK URLを評価・選択する機能
 * 
 * 【処理内容】
 * - Step1で収集した有効URLから最適な候補を選択
 * - URL品質評価による信頼度判定
 * - 候補スコア計算による順位付け
 */

import { ContactPageResult } from '../../types/interfaces';
import { SEARCH_PATTERNS } from '../../constants/SearchConstants';
import { PurityUtils } from '../../utils/PurityUtils';

/**
 * 有効URLオブジェクト
 */
interface ValidUrlInfo {
  url: string;
  pattern: string;
}

/**
 * フォールバック状態管理用インターフェース
 */
export interface FallbackState {
  validUrls: ValidUrlInfo[];
  candidatePages: Array<{
    url: string;
    reason: string;
    score: number;
    structuredForms: number;
    legacyScore: number;
  }>;
}

/**
 * 最終フォールバック処理
 * Step1の200 OK URLを最終手段として返却
 * @param state フォールバック状態
 * @returns 最終フォールバック結果
 */
export function getFinalFallbackUrl(state: FallbackState): ContactPageResult {
  console.log(`Checking final fallback from ${state.validUrls.length} valid URLs`);

  if (state.validUrls.length === 0) {
    console.log('No valid URLs available for final fallback');
    return {
      contactUrl: null,
      actualFormUrl: null,
      foundKeywords: [],
      searchMethod: 'no_fallback_available'
    };
  }

  // 優先度順にcontact関連URLを探す

  // 高優先度contact patternを探す
  for (const priorityPattern of SEARCH_PATTERNS.CONTACT_PRIORITY) {
    const matchingUrl = state.validUrls.find(urlInfo =>
      urlInfo.pattern === priorityPattern
    );
    if (matchingUrl) {
      console.log(`Final fallback: Using high-priority contact URL ${matchingUrl.url} (pattern: ${matchingUrl.pattern})`);
      return {
        contactUrl: matchingUrl.url,
        actualFormUrl: matchingUrl.url,
        foundKeywords: ['final_fallback', 'high_priority_contact_pattern', matchingUrl.pattern.replace(/\//g, '')],
        searchMethod: 'final_fallback_priority_contact'
      };
    }
  }

  // 高優先度がない場合、最初の200 OK URLを使用
  const firstValidUrl = state.validUrls[0];
  if (!firstValidUrl) {
    console.log('No valid URLs available in array');
    return {
      contactUrl: null,
      actualFormUrl: null,
      foundKeywords: [],
      searchMethod: 'no_valid_urls'
    };
  }

  console.log(`Final fallback: Using first valid URL ${firstValidUrl.url} (pattern: ${firstValidUrl.pattern})`);

  // URLの品質を評価
  const qualityScore = evaluateFallbackUrlQuality(firstValidUrl.url, firstValidUrl.pattern);

  return {
    contactUrl: firstValidUrl.url,
    actualFormUrl: firstValidUrl.url,
    foundKeywords: ['final_fallback', 'first_valid_url', firstValidUrl.pattern.replace(/\//g, ''), ...qualityScore.keywords],
    searchMethod: qualityScore.confidence >= 0.7 ? 'final_fallback_high_confidence' : 'final_fallback_low_confidence'
  };
}

/**
 * フォールバックURL品質評価
 * URLパターンに基づく信頼度スコアリング
 * @param url 評価対象URL
 * @param pattern マッチしたパターン
 * @returns 信頼度とキーワード配列
 */
export function evaluateFallbackUrlQuality(url: string, pattern: string): { confidence: number, keywords: string[] } {
  return PurityUtils.evaluateUrlQuality(url, pattern);
}

/**
 * 候補スコア計算
 * 複数要因を総合してスコアを算出
 * @param url 候補URL
 * @param reason 候補理由
 * @param structuredAnalysis 構造化フォーム解析結果
 * @param formAnalysis フォーム解析結果
 * @returns 算出スコア
 */
export function calculateCandidateScore(
  url: string,
  reason: string,
  structuredAnalysis: { formCount: number, totalFields: number, hasContactFields: boolean },
  formAnalysis: { isValidForm: boolean, reasons: string[] }
): number {
  let score = 0;

  // URL具体性スコア
  if (url.includes('/contact-form/')) score += 15;
  else if (url.includes('/inquiry/')) score += 12;
  else if (url.includes('/contact/')) score += 8;
  else if (url.includes('/form/')) score += 10;

  // 構造化フォームスコア
  score += structuredAnalysis.formCount * 5;
  score += structuredAnalysis.totalFields * 2;
  if (structuredAnalysis.hasContactFields) score += 10;

  // 従来フォーム解析スコア
  if (formAnalysis.isValidForm) score += 5;

  // 理由による調整
  if (reason === 'no_structured_form') score -= 10; // ペナルティ

  return score;
}

/**
 * 潜在的候補ページの記録
 * Step1で発見されたが確定できなかった候補を記録・評価
 * @param url 候補URL
 * @param reason 候補理由
 * @param html ページHTML内容
 * @param candidatePages 候補ページ配列（参照渡し）
 * @param FormAnalyzer フォーム解析クラス
 */
export function logPotentialCandidate(
  url: string, 
  reason: string, 
  html: string,
  candidatePages: Array<{
    url: string;
    reason: string;
    score: number;
    structuredForms: number;
    legacyScore: number;
  }>,
  FormAnalyzer: any
) {
  const structuredAnalysis = FormAnalyzer.analyzeStructuredForms(html);
  const formAnalysis = FormAnalyzer.analyzeFormElements(html);

  const score = calculateCandidateScore(url, reason, structuredAnalysis, formAnalysis);

  candidatePages.push({
    url,
    reason,
    score,
    structuredForms: structuredAnalysis.formCount,
    legacyScore: formAnalysis.isValidForm ? 1 : 0
  });

  console.log(`Candidate logged: ${url} (${reason}, score: ${score})`);
}