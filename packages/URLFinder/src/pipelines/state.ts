/**
 * 検索状態管理クラス
 * 44ac0de最適版から分離：全検索フローで共有される状態を一元管理
 * 関数型実装への移行中
 */

import type { ContactPageResult } from '../data/types/interfaces';
import { evaluateFallbackUrlQuality } from '../functions/network/fetch';

export class SearchState {
  /**
   * 候補ページ記録システム
   * Step1で発見されたが確定できなかった候補を保存
   */
  private candidatePages: Array<{
    url: string;           // 候補URL
    reason: string;        // 候補理由
    score: number;         // 信頼度スコア
    structuredForms: number;  // 構造化フォーム数
    legacyScore: number;   // 旧式スコア（互換性用）
  }> = [];

  /**
   * 200 OK URLリスト（フォールバック用）
   * Step1で200応答したがフォーム検証で失敗したURL群
   */
  private validUrls: Array<{ 
    url: string;     // 有効URL
    pattern: string; // マッチしたパターン
  }> = [];

  /**
   * 成功したフォームURLリスト（Step2重複回避用）
   * 既に検証済みのURLを記録し重複処理を防止
   */
  private successfulFormUrls: Array<string> = [];

  /**
   * SPA検出用HTMLキャッシュ
   * 同一HTML応答の効率検出
   */
  private sameHtmlCache: { [url: string]: string } = {};

  /**
   * 候補を記録（logPotentialCandidate移植）
   * @param url 候補URL
   * @param reason 候補理由
   * @param html HTMLコンテンツ（分析用）
   */
  addCandidate(url: string, reason: string, html: string): void {
    console.log(`Recording potential candidate: ${url} (reason: ${reason})`);
    
    const structuredAnalysis = this.analyzeStructuredForms(html);
    const formAnalysis = this.analyzeFormElements(html);
    const score = this.calculateCandidateScore(url, reason, structuredAnalysis, formAnalysis);

    this.candidatePages.push({
      url,
      reason,
      score,
      structuredForms: structuredAnalysis.formCount,
      legacyScore: formAnalysis.score
    });

    console.log(`Candidate added: score=${score}, structured forms=${structuredAnalysis.formCount}`);
  }

  /**
   * 有効URL（200 OK）を記録
   * @param url URL
   * @param pattern マッチしたパターン
   */
  addValidUrl(url: string, pattern: string): void {
    this.validUrls.push({ url, pattern });
    console.log(`Valid URL recorded: ${url} (pattern: ${pattern})`);
  }

  /**
   * 成功したフォームURLを記録
   * @param url 成功したURL
   */
  addSuccessfulFormUrl(url: string): void {
    this.successfulFormUrls.push(url);
    console.log(`Successful form URL recorded: ${url}`);
  }

  /**
   * 成功したフォームURLの重複チェック
   * @param url チェック対象URL
   * @returns 重複しているかどうか
   */
  isSuccessfulFormUrl(url: string): boolean {
    return this.successfulFormUrls.includes(url);
  }

  /**
   * HTMLキャッシュを追加/取得
   * @param url URL
   * @param contentHash HTMLハッシュ
   */
  setHtmlCache(url: string, contentHash: string): void {
    this.sameHtmlCache[url] = contentHash;
  }

  /**
   * HTMLキャッシュを取得
   * @param url URL
   * @returns HTMLハッシュまたはundefined
   */
  getHtmlCache(url: string): string | undefined {
    return this.sameHtmlCache[url];
  }

  /**
   * 有効URLリストの取得
   * @returns 有効URLリスト
   */
  getValidUrls(): Array<{ url: string; pattern: string }> {
    return [...this.validUrls];
  }

  /**
   * 候補数の取得
   * @returns 候補数
   */
  getCandidateCount(): number {
    return this.candidatePages.length;
  }

  /**
   * 全状態のリセット（新しい検索開始時）
   */
  resetState(): void {
    this.candidatePages = [];
    this.validUrls = [];
    this.successfulFormUrls = [];
    this.sameHtmlCache = {}; // Reset SPA detection cache
    console.log('Search state reset completed');
  }

  /**
   * 最終フォールバックURL取得（getFinalFallbackUrl移植）
   * Step1の最初の200 OK URLを最終手段として返却
   */
  getFinalResult(): ContactPageResult {
    console.log(`Checking final fallback from ${this.validUrls.length} valid URLs`);
    
    if (this.validUrls.length === 0) {
      console.log('No valid URLs available for final fallback');
      return {
        contactUrl: null,
        actualFormUrl: null,
        foundKeywords: [],
        searchMethod: 'no_valid_urls'
      };
    }

    // 高優先度contactパターンを優先的に探す
    const contactPriorityPatterns = [
      '/contact/', '/contact', '/inquiry/', '/inquiry', 
      '/form/', '/form'
    ];

    // 高優先度contact patternを探す
    for (const priorityPattern of contactPriorityPatterns) {
      const matchingUrl = this.validUrls.find(urlInfo => 
        urlInfo.pattern === priorityPattern
      );
      
      if (matchingUrl) {
        console.log(`Priority contact pattern found: ${matchingUrl.url} (${priorityPattern})`);
        const qualityScore = evaluateFallbackUrlQuality(matchingUrl.url, matchingUrl.pattern);
        
        return {
          contactUrl: matchingUrl.url,
          actualFormUrl: matchingUrl.url,
          foundKeywords: ['priority_fallback', priorityPattern.replace(/\//g, ''), ...qualityScore.keywords],
          searchMethod: 'priority_fallback_contact'
        };
      }
    }

    // 高優先度がない場合、最初の200 OK URLを使用
    const firstValidUrl = this.validUrls[0];
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
   * 候補スコア計算（calculateCandidateScore移植）
   * @param url URL
   * @param reason 理由
   * @param structuredAnalysis 構造化フォーム分析
   * @param formAnalysis フォーム分析
   * @returns スコア
   */
  private calculateCandidateScore(
    url: string, 
    reason: string, 
    structuredAnalysis: { formCount: number; totalFields: number; hasContactFields: boolean },
    formAnalysis: { isValidForm: boolean; score: number; reasons: string[] }
  ): number {
    let score = 0;

    // Base score from form analysis
    score += formAnalysis.score;

    // Structured forms bonus
    score += structuredAnalysis.formCount * 5;
    score += structuredAnalysis.totalFields * 2;

    if (structuredAnalysis.hasContactFields) {
      score += 10;
    }

    // URL pattern bonus
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('/contact')) score += 15;
    if (lowerUrl.includes('/inquiry')) score += 12;
    if (lowerUrl.includes('/form')) score += 8;

    // Reason-based bonus
    if (reason.includes('structured_forms')) score += 10;
    if (reason.includes('google_forms')) score += 8;

    return Math.max(0, score);
  }

  /**
   * 構造化フォーム分析（簡略版）
   * @param html HTML文字列
   * @returns 構造化フォーム分析結果
   */
  private analyzeStructuredForms(html: string): { formCount: number; totalFields: number; hasContactFields: boolean } {
    const formMatches = html.match(/<form[^>]*>[\s\S]*?<\/form>/gi) || [];
    let totalFields = 0;
    let hasContactFields = false;

    for (const form of formMatches) {
      const inputMatches = form.match(/<input[^>]*>/gi) || [];
      const textareaMatches = form.match(/<textarea[^>]*>/gi) || [];
      const selectMatches = form.match(/<select[^>]*>/gi) || [];
      
      totalFields += inputMatches.length + textareaMatches.length + selectMatches.length;

      const contactPatterns = [
        /name/i, /email/i, /phone/i, /tel/i, /message/i, /inquiry/i,
        /お名前/i, /メール/i, /電話/i, /問い合わせ/i, /メッセージ/i
      ];

      for (const pattern of contactPatterns) {
        if (pattern.test(form)) {
          hasContactFields = true;
          break;
        }
      }
    }

    return {
      formCount: formMatches.length,
      totalFields,
      hasContactFields
    };
  }

  /**
   * フォーム要素分析（簡略版）
   * @param html HTML文字列
   * @returns フォーム分析結果
   */
  private analyzeFormElements(html: string): { isValidForm: boolean; score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    const formMatches = html.match(/<form[^>]*>[\s\S]*?<\/form>/gis) || [];
    if (formMatches.length > 0) {
      score += 10;
      reasons.push(`found_${formMatches.length}_forms`);
    }

    const inputMatches = html.match(/<input[^>]*>/gi) || [];
    if (inputMatches.length > 0) {
      score += Math.min(inputMatches.length * 2, 10);
      reasons.push(`found_${inputMatches.length}_inputs`);
    }

    const isValidForm = score >= 10 && formMatches.length > 0;

    return {
      isValidForm,
      score,
      reasons
    };
  }
}