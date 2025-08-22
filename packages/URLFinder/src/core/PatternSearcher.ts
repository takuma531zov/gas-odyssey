/**
 * URLパターン推測検索システム
 * Step1フロー: URLパターン推測による高速検索を管理
 */

import { Environment } from '../env';
import { SPAAnalyzer } from './spa/SPAAnalyzer';
import { FormDetector } from '../detectors/FormDetector';
import { NetworkUtils } from '../utils/NetworkUtils';
import { CandidateManager } from './CandidateManager';
import { HtmlAnalyzer } from '../analyzers/HtmlAnalyzer';
import type { ContactPageResult } from '../types/interfaces';

export class PatternSearcher {

  /**
   * 詳細エラーメッセージ取得（index.tsから移植・最適版完全移植）
   */
  static getDetailedErrorMessage(statusCode: number): string {
    const errorMessages: { [key: number]: string } = {
      400: 'Bad Request - 不正なリクエスト',
      401: 'Unauthorized - 認証が必要',
      403: 'Forbidden - アクセス拒否（Bot対策またはアクセス制限）',
      404: 'Not Found - ページが存在しません',
      405: 'Method Not Allowed - 許可されていないHTTPメソッド',
      408: 'Request Timeout - リクエストタイムアウト',
      429: 'Too Many Requests - レート制限（アクセス過多）',
      500: 'Internal Server Error - サーバー内部エラー',
      501: 'Not Implemented - Bot対策によりブロック',
      502: 'Bad Gateway - ゲートウェイエラー',
      503: 'Service Unavailable - サービス利用不可（メンテナンス中）',
      504: 'Gateway Timeout - ゲートウェイタイムアウト',
      520: 'Web Server Error - Webサーバーエラー（Cloudflare）',
      521: 'Web Server Down - Webサーバーダウン（Cloudflare）',
      522: 'Connection Timed Out - 接続タイムアウト（Cloudflare）',
      523: 'Origin Unreachable - オリジンサーバー到達不可（Cloudflare）',
      524: 'A Timeout Occurred - タイムアウト発生（Cloudflare）'
    };

    return errorMessages[statusCode] || `HTTP Error ${statusCode} - 不明なエラー`;
  }

  /**
   * Step1フロー: URLパターン推測による高速検索（index.tsから移植・最適版完全移植）
   *
   * 処理手順:
   * 1. 優先URLパターンテスト (/contact/ → /contact → /inquiry/ → ...)
   * 2. 各URLでHTTP通信実行（200 OK確認）
   * 3. SPA検出（同一HTML判定による単一ページアプリ識別）
   * 4. 構造化フォーム検証（<form>要素 + 送信ボタン検証）
   * 5. Google Forms検証（docs.google.com URLパターン）
   * 6. アンカー分析（SPA対応: #contact等の内部リンク解析）
   * 7. 成功時即座に結果返却、失敗時は200 OK URLを記録
   *
   * SPA対応機能:
   * - 同一HTMLハッシュ検出による動的ページ判定
   * - アンカーリンク（#hash）の内容分析
   * - セクション内フォーム検証
   *
   * パフォーマンス最適化:
   * - 高信頼度パターンから優先実行
   * - 成功時の早期終了
   * - タイムアウト管理による無限ループ防止
   */
  static searchWithPriorityPatterns(domainUrl: string, startTime: number): ContactPageResult {
    // 200 OK URLリストをリセット
    CandidateManager.resetCandidates();
    const maxTotalTime = Environment.getMaxTotalTime();
    console.log('Starting priority-based URL pattern search with integrated SPA detection');

    // 優先度順にパターンをテスト
    const allPatterns = [
      ...HtmlAnalyzer.HIGH_PRIORITY_PATTERNS,
    ];

    let testedPatterns = 0;
    let structuredFormPages = 0;
    const testedUrls: string[] = []; // For SPA detection
    const htmlResponses: string[] = []; // Store HTML for SPA analysis

    for (const pattern of allPatterns) {
      // タイムアウトチェック
      if (Date.now() - startTime > maxTotalTime) {
        console.log('Timeout during priority search');
        break;
      }

      try {
        const testUrl = domainUrl.replace(/\/$/, '') + pattern;
        console.log(`Testing: ${testUrl}`);
        testedPatterns++;

        const response = NetworkUtils.fetchWithTimeout(testUrl, 5000); // 5秒タイムアウト

        if (response.getResponseCode() === 200) {
          const html = response.getContentText();
          console.log(`Got HTML content for ${testUrl}, length: ${html.length}`);

          // **SPA OPTIMIZATION: Detect same HTML pattern and apply anchor analysis**
          testedUrls.push(testUrl);
          htmlResponses.push(html);

          // Check for SPA pattern after 2nd URL
          if (testedUrls.length >= 2 && SPAAnalyzer.detectSameHtmlPattern(testedUrls, html)) {
            console.log('Single Page Application detected: same HTML returned for multiple URLs');

            // **SPA MODE: Perform anchor-based analysis on current HTML**
            const spaResult = SPAAnalyzer.analyzeSPAContent(html, testedUrls, pattern);
            if (spaResult.contactUrl) {
              console.log(`SPA analysis successful: ${spaResult.contactUrl}`);
              return spaResult;
            } else {
              console.log('SPA analysis found no contact content, continuing...');
            }
          }

          // Step1でのページ内容検証を実行
          const pageValidation = this.validatePageContent(html, testUrl, pattern);

          if (pageValidation.success) {
            console.log(`✅ Step1 SUCCESS: ${testUrl} - ${pageValidation.reason}`);

            // 成功したURLを記録（重複処理回避用）
            CandidateManager.addSuccessfulFormUrl(testUrl);

            return {
              contactUrl: testUrl,
              actualFormUrl: pageValidation.actualFormUrl || testUrl,
              foundKeywords: pageValidation.keywords,
              searchMethod: `step1_pattern_${pattern.replace(/[\/\%]/g, '_')}`
            };
          } else {
            console.log(`${testUrl} failed validity check`);
          }
        } else {
          const statusCode = response.getResponseCode();
          const detailedError = this.getDetailedErrorMessage(statusCode);
          console.log(`${testUrl} returned status code: ${statusCode} - ${detailedError}`);

          // Bot対策エラー（403, 501）の場合は即座に処理を中断
          if (statusCode === 403 || statusCode === 501) {
            console.log(`Bot blocking detected (${statusCode}), breaking priority pattern search`);
            return {
              contactUrl: null,
              actualFormUrl: null,
              foundKeywords: [detailedError],
              searchMethod: 'bot_blocked'
            };
          }
        }
      } catch (error) {
        const detailedError = NetworkUtils.getDetailedNetworkError(error);
        console.log(`Error testing ${pattern}: ${detailedError}`);

        // DNS解決失敗の場合は即座に処理を中断
        if (detailedError.includes('DNS解決失敗')) {
          console.log('DNS resolution failed, breaking priority pattern search');
          return {
            contactUrl: null,
            actualFormUrl: null,
            foundKeywords: [detailedError],
            searchMethod: 'dns_failed'
          };
        }
      }
    }

    console.log(`Priority pattern search completed: tested ${testedPatterns} patterns, found ${structuredFormPages} structured form pages`);

    // フォールバック処理
    return CandidateManager.getFinalFallbackUrl();
  }

  /**
   * ページ内容検証（index.tsから移植・最適版完全移植）
   */
  private static validatePageContent(html: string, testUrl: string, pattern: string): {
    success: boolean,
    reason: string,
    actualFormUrl?: string,
    keywords: string[]
  } {
    const keywords: string[] = [];

    // 1. Google Forms最優先検出
    const googleFormUrl = NetworkUtils.findGoogleFormUrlsOnly(html);
    if (googleFormUrl && googleFormUrl.startsWith('http')) {
      console.log(`Google Forms detected: ${googleFormUrl}`);
      return {
        success: true,
        reason: 'google_forms_detected',
        actualFormUrl: googleFormUrl,
        keywords: ['google_forms', 'step1_validation']
      };
    }

    // 2. 有効な問い合わせページ判定
    if (!HtmlAnalyzer.isValidContactPage(html)) {
      console.log(`Page failed contact page validation: ${testUrl}`);
      return {
        success: false,
        reason: 'invalid_contact_page',
        keywords: []
      };
    }

    // 3. フォーム検証
    const formResult = FormDetector.detectAnyForm(html);
    if (formResult.found) {
      keywords.push('forms_detected');
      
      if (formResult.formUrl && formResult.formUrl.startsWith('http')) {
        return {
          success: true,
          reason: 'forms_detected_with_url',
          actualFormUrl: formResult.formUrl,
          keywords: [...keywords, 'external_form_url']
        };
      }

      return {
        success: true,
        reason: 'embedded_forms_detected',
        keywords: [...keywords, 'embedded_forms']
      };
    }

    // 4. 200 OK URLとして記録（フォールバック用）
    CandidateManager.addValidUrl(testUrl, pattern);

    return {
      success: false,
      reason: 'no_forms_detected',
      keywords: ['valid_url_recorded']
    };
  }
}