/**
 * 候補ページ管理とスコア計算システム
 * 問い合わせページ候補の記録・評価・フォールバック処理を管理
 */

import { FormDetector } from '../detectors/FormDetector';
import { NavigationSearcher } from './navigation/NavigationSearcher';
import { NetworkUtils } from '../utils/NetworkUtils';
import type { ContactPageResult, FormAnalysisResult } from '../types/interfaces';

export class CandidateManager {
  
  /**
   * 候補ページ記録システム
   * Step1で発見されたが確定できなかった候補を保存
   */
  private static candidatePages: Array<{
    url: string,           // 候補URL
    reason: string,        // 候補理由
    score: number,         // 信頼度スコア
    structuredForms: number,  // 構造化フォーム数
    legacyScore: number    // 旧式スコア（互換性用）
  }> = [];

  /**
   * 200 OK URLリスト（フォールバック用）
   * Step1で200応答したがフォーム検証で失敗したURL群
   */
  private static validUrls: Array<{
    url: string,     // 有効URL
    pattern: string  // マッチしたパターン
  }> = [];

  /**
   * 成功したフォームURLリスト（Step2重複回避用）
   * 既に検証済みのURLを記録し重複処理を防止
   */
  private static successfulFormUrls: Array<string> = [];

  /**
   * 候補をリセット
   */
  static resetCandidates(): void {
    this.candidatePages = [];
    this.validUrls = [];
    this.successfulFormUrls = [];
  }

  /**
   * 候補ページの記録（index.tsから移植・最適版完全移植）
   */
  static logPotentialCandidate(url: string, reason: string, html: string): void {
    const formAnalysis = FormDetector.analyzeFormElements(html);

    const score = this.calculateCandidateScore(url, reason, formAnalysis);

    this.candidatePages.push({
      url,
      reason,
      score,
      structuredForms: 0, // FormDetectorで分析済み
      legacyScore: formAnalysis.isValidForm ? 1 : 0
    });

    console.log(`Candidate logged: ${url} (${reason}, score: ${score})`);
  }

  /**
   * 候補スコア計算（index.tsから移植・最適版完全移植）
   */
  static calculateCandidateScore(
    url: string,
    reason: string,
    formAnalysis: any // 互換性のためany型を使用
  ): number {
    let score = 0;

    // URL パターンベーススコア
    if (url.includes('/contact/') || url.includes('/contact')) score += 5;
    if (url.includes('/inquiry/') || url.includes('/inquiry')) score += 5;
    if (url.includes('/form/') || url.includes('/form')) score += 3;

    // 理由ベーススコア
    if (reason.includes('navigation')) score += 3;
    if (reason.includes('form_detected')) score += 4;
    if (reason.includes('google_forms')) score += 5;

    // フォーム分析ベーススコア
    if (formAnalysis.isValidForm) score += 3;
    score += Math.min(formAnalysis.keywords.length, 3); // キーワード数（最大3点）

    return score;
  }

  /**
   * 有効URLを記録
   */
  static addValidUrl(url: string, pattern: string): void {
    this.validUrls.push({ url, pattern });
  }

  /**
   * 成功フォームURLを記録
   */
  static addSuccessfulFormUrl(url: string): void {
    this.successfulFormUrls.push(url);
  }

  /**
   * Final Fallback処理（index.tsから移植・最適版完全移植）
   */
  static getFinalFallbackUrl(): ContactPageResult {
    console.log(`Checking final fallback from ${this.validUrls.length} valid URLs`);

    if (this.validUrls.length === 0) {
      console.log('No valid URLs available for final fallback');
      return {
        contactUrl: null,
        actualFormUrl: null,
        foundKeywords: [],
        searchMethod: 'no_fallback_available'
      };
    }

    // 優先度順にcontact関連URLを探す
    const contactPriorityPatterns = [
      '/contact/',
      '/contact',
      '/inquiry/',
      '/inquiry',
      '/form/',
      '/form'
    ];

    // 高優先度contact patternを探す
    for (const priorityPattern of contactPriorityPatterns) {
      const matchingUrl = this.validUrls.find(urlInfo =>
        urlInfo.pattern === priorityPattern
      );
      if (matchingUrl) {
        console.log(`Using priority fallback URL: ${matchingUrl.url} (pattern: ${priorityPattern})`);

        // 品質評価
        const evaluation = this.evaluateFallbackUrlQuality(matchingUrl.url, priorityPattern);

        return {
          contactUrl: matchingUrl.url,
          actualFormUrl: null,
          foundKeywords: evaluation.keywords,
          searchMethod: `final_fallback_priority_${priorityPattern.replace(/[\/]/g, '_')}`
        };
      }
    }

    // 優先度の高いパターンが見つからない場合は最初のURLを使用
    const firstUrl = this.validUrls[0];
    console.log(`Using first available fallback URL: ${firstUrl.url} (pattern: ${firstUrl.pattern})`);

    const evaluation = this.evaluateFallbackUrlQuality(firstUrl.url, firstUrl.pattern);

    return {
      contactUrl: firstUrl.url,
      actualFormUrl: null,
      foundKeywords: evaluation.keywords,
      searchMethod: 'final_fallback_first_available'
    };
  }

  /**
   * フォールバックURL品質評価（index.tsから移植・最適版完全移植）
   */
  private static evaluateFallbackUrlQuality(url: string, pattern: string): { confidence: number, keywords: string[] } {
    let confidence = 30; // 基本フォールバック信頼度
    const keywords: string[] = [];

    // パターン評価
    if (pattern.includes('contact')) {
      confidence += 15;
      keywords.push('contact_pattern');
    }
    if (pattern.includes('inquiry')) {
      confidence += 12;
      keywords.push('inquiry_pattern');
    }
    if (pattern.includes('form')) {
      confidence += 8;
      keywords.push('form_pattern');
    }

    // URL構造評価
    const pathSegments = url.split('/').length;
    if (pathSegments <= 4) { // シンプルな構造
      confidence += 5;
      keywords.push('simple_structure');
    }

    // エンコーディング確認
    if (url.includes('%E3%81%8A%E5%95%8F%E3%81%84')) { // お問い合わせエンコード
      confidence += 10;
      keywords.push('japanese_contact');
    }

    console.log(`Fallback URL quality: ${url} -> confidence: ${confidence}%, keywords: ${keywords.join(',')}`);

    return { confidence, keywords };
  }

  /**
   * 候補リストを取得
   */
  static getCandidates(): Array<{url: string, reason: string, score: number, structuredForms: number, legacyScore: number}> {
    return [...this.candidatePages];
  }

  /**
   * 有効URLリストを取得
   */
  static getValidUrls(): Array<{url: string, pattern: string}> {
    return [...this.validUrls];
  }

  /**
   * 成功フォームURLリストを取得
   */
  static getSuccessfulFormUrls(): string[] {
    return [...this.successfulFormUrls];
  }
}