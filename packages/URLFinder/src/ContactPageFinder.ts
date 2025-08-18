// ==========================================
// 【ContactPageFinderクラス】
// BtoB営業用問い合わせページ自動検索システムのメインクラス
// 企業サイトから問い合わせページを自動発見する機能を提供
// ==========================================

import { Environment } from './env';
import type { ContactPageResult } from './types/interfaces';
import { UrlUtils } from './utils/UrlUtils';
import { HtmlAnalyzer } from './analyzers/HtmlAnalyzer';
import { FormAnalyzer } from './analyzers/FormAnalyzer';
import { UrlPatternStrategy } from './strategies/UrlPatternStrategy';

// === 機能モジュール群インポート ===
import { 
  initializeContactSearch as moduleInitializeContactSearch,
  type InitializationState 
} from './modules/initialization';  // 初期化・検証機能 (modules/initialization/index.ts)

import {
  analyzeHtmlContent as moduleAnalyzeHtmlContent,
  findActualForm as moduleFindActualForm,
  type Step2AnalysisState
} from './modules/step2Analysis';  // Step2解析機能 (modules/step2Analysis/index.ts)

import {
  getFinalFallbackUrl as moduleGetFinalFallbackUrl,
  type FallbackState
} from './modules/fallbackSystem';  // フォールバック機能 (modules/fallbackSystem/index.ts)

import {
  fetchWithTimeout as moduleFetchWithTimeout,
  getDetailedNetworkError as moduleGetDetailedNetworkError
} from './modules/httpUtils';  // HTTP通信機能 (modules/httpUtils/index.ts)

/**
 * ContactPageFinder - BtoB営業用問い合わせページ自動検索システム
 *
 * 【目的】
 * - 企業サイトから問い合わせページを自動発見
 * - Google Apps Script環境での安定動作
 * - BtoB営業活動の効率化支援
 *
 * 【検索戦略】
 * Step1: URLパターン推測（高速・高精度）
 * Step2: HTML解析によるフォールバック検索
 * Final: 最終フォールバック（Step1の200 OKページ使用）
 *
 * 【対応機能】
 * - SPA（Single Page Application）対応
 * - Google Forms検出
 * - 埋め込みフォーム対応
 * - JavaScript動的フォーム検出
 * - タイムアウト管理による安定性確保
 */
export class ContactPageFinder {

  // ==========================================
  // 【状態管理・キャッシュシステム】
  // モジュール化統合による状態変数群の管理
  // ==========================================

  /**
   * 初期化状態管理
   * modules/initialization で管理される状態変数群
   */
  private static initState: InitializationState = {
    candidatePages: [],
    validUrls: [],
    successfulFormUrls: [],
    sameHtmlCache: {}
  };

  // ==========================================
  // 【メイン検索エンジン】
  // Step1: URLパターン推測検索（高速・高精度）
  // Step2: HTML解析フォールバック検索
  // Final: 最終フォールバック処理
  // ==========================================

  /**
   * 問い合わせページ検索のメインエントリーポイント
   *
   * @param baseUrl 検索対象のベースURL（企業サイトのトップページ等）
   * @returns ContactPageResult 検索結果（URL、フォーム情報、検索手法等）
   *
   * 【処理フロー】
   * 1. 初期化処理（候補リセット、タイマー開始）
   * 2. SNSページ判定（Facebook、Twitter等は除外）
   * 3. ドメイン生存確認（サイト閉鎖チェック）
   * 4. Step1: URLパターン推測検索
   * 5. Step2: HTML解析フォールバック検索
   * 6. 最終フォールバック: Step1の200 OKページ使用
   */
  static findContactPage(baseUrl: string): ContactPageResult {
    const startTime = Date.now();
    const maxTotalTime = Environment.getMaxTotalTime();

    try {
      // ==========================================
      // 【初期化・検証処理】
      // SNS判定、ドメイン生存確認、候補リセット
      // ==========================================
      const initResult = this.initializeContactSearch(baseUrl);
      if (initResult) {
        return initResult; // 早期return（SNS/ドメイン無効の場合）
      }

      // Extract domain for subdirectory pattern support
      const domainUrl = UrlUtils.extractDomain(baseUrl);
      console.log(`Starting contact page search for: ${baseUrl}`);

      // ==========================================
      // 【STEP 1: URLパターン推測検索】
      // 高速・高精度のURL推測による優先検索
      // SPA検出機能統合済み
      // ==========================================
      console.log('Step 1: URL pattern guessing with SPA optimization (primary strategy)');
      const urlPatternStrategy = new UrlPatternStrategy();
      const strategyResult = urlPatternStrategy.searchDetailed(domainUrl);

      if (strategyResult) {
        const priorityResult = strategyResult.result;
        // 有効URLリストを更新
        this.initState.validUrls = strategyResult.validUrls;

        if (priorityResult.contactUrl) {
          console.log(`✅ Found via URL pattern search: ${priorityResult.contactUrl}`);
          return priorityResult;
        }

        // エラーの場合は即座に返す（fallback処理をスキップ）
        if (priorityResult.searchMethod === 'dns_error' || priorityResult.searchMethod === 'bot_blocked') {
          console.log(`URL pattern search returned error: ${priorityResult.searchMethod}, stopping here`);
          return priorityResult;
        }
      }

      // Check remaining time
      if (Date.now() - startTime > maxTotalTime) {
        console.log('Timeout reached during URL pattern search');
        return {
          contactUrl: null,
          actualFormUrl: null,
          foundKeywords: ['timeout'],
          searchMethod: 'timeout'
        };
      }

      // ==========================================
      // 【STEP 2: HTML解析フォールバック検索】
      // 特殊ケース対応のためのホームページ解析
      // Google Forms検出、埋め込みフォーム対応
      // ==========================================
      console.log('Step 2: Homepage HTML analysis as fallback for special cases');
      try {
        const response = moduleFetchWithTimeout(baseUrl, 7000); // 7秒タイムアウト
        const html = HtmlAnalyzer.getContentWithEncoding(response); // 🔥 文字化け解決

        // Check for Google Forms URLs first
        const googleFormUrls = FormAnalyzer.findGoogleFormUrlsOnly(html);
        if (googleFormUrls) {
          console.log(`✅ Found Google Form URL on homepage: ${googleFormUrls}`);
          return {
            contactUrl: baseUrl,
            actualFormUrl: googleFormUrls,
            foundKeywords: ['homepage_google_form'],
            searchMethod: 'homepage_google_form_fallback'
          };
        }

        // Analyze HTML content for contact links
        const step2State: Step2AnalysisState = { successfulFormUrls: this.initState.successfulFormUrls };
        const result = moduleAnalyzeHtmlContent(html, baseUrl, step2State, moduleFetchWithTimeout);

        // If we found a contact page, try to find the actual form within it
        if (result.contactUrl) {
          console.log(`Found contact link on homepage: ${result.contactUrl}`);
          const formUrl = moduleFindActualForm(result.contactUrl, moduleFetchWithTimeout);
          result.actualFormUrl = formUrl;
          result.searchMethod = 'homepage_link_fallback';

          // If actual form found, return it
          if (result.actualFormUrl && result.actualFormUrl.startsWith('http')) {
            console.log(`✅ Verified actual form at: ${result.actualFormUrl}`);
            return result;
          } else if (result.actualFormUrl === 'embedded_contact_form_on_page') {
            console.log(`✅ Verified embedded form at: ${result.contactUrl}`);
            // Fix: Return actual contact URL instead of placeholder
            result.actualFormUrl = result.contactUrl;
            return result;
          } else {
            console.log(`Contact page found but no form verified: ${result.contactUrl}`);
            return result;
          }
        }

        // Check for embedded forms as last resort
        const embeddedFormResult = FormAnalyzer.findEmbeddedHTMLForm(html);
        if (embeddedFormResult) {
          console.log(`✅ Found embedded form on homepage as last resort`);
          return {
            contactUrl: baseUrl,
            actualFormUrl: baseUrl, // Fix: Return actual URL instead of placeholder
            foundKeywords: ['homepage_embedded_form'],
            searchMethod: 'homepage_embedded_fallback'
          };
        }

        console.log('HTML analysis fallback found nothing');

      } catch (homepageError) {
        const detailedError = moduleGetDetailedNetworkError(homepageError);
        console.log(`Error in homepage analysis fallback: ${detailedError}`);
      }

      // ==========================================
      // 【最終フォールバック処理】
      // 全検索手法失敗時のStep1有効URL使用
      // 優先度順による最適候補選択
      // ==========================================
      console.log('All search methods failed, checking final fallback...');
      const fallbackState: FallbackState = { 
        validUrls: this.initState.validUrls, 
        candidatePages: this.initState.candidatePages 
      };
      const fallbackResult = moduleGetFinalFallbackUrl(fallbackState);
      if (fallbackResult.contactUrl) {
        console.log(`✅ Final fallback successful: ${fallbackResult.contactUrl}`);
        return fallbackResult;
      }

      console.log('All search methods failed, including final fallback');
      return {
        contactUrl: null,
        actualFormUrl: null,
        foundKeywords: [],
        searchMethod: 'not_found'
      };
    } catch (error) {
      const detailedError = moduleGetDetailedNetworkError(error);
      console.error(`Error fetching ${baseUrl}: ${detailedError}`);
      return {
        contactUrl: null,
        actualFormUrl: null,
        foundKeywords: [detailedError],
        searchMethod: 'error'
      };
    }
  }

  // ==========================================
  // 【初期化・検証システム】
  // 企業サイトの基本検証とSNS判定を実行
  // ==========================================

  /**
   * 初期化・検証処理（プロキシ）
   * modules/initialization/index.ts の機能を呼び出し
   * @param baseUrl 検証対象URL
   * @returns 早期終了の場合は結果、継続の場合はnull
   */
  private static initializeContactSearch(baseUrl: string): ContactPageResult | null {
    return moduleInitializeContactSearch(baseUrl, this.initState);
  }
}