/**
 * Step1: URLパターン推測による高速検索
 * 目的: 一般的な問い合わせページパターンを優先順位付きでテスト
 * 対象: /contact/, /inquiry/, /form/ 等の定型パターン
 */

import { ContactPageResult, SearchStrategy, UrlSearchStrategyResult, ValidUrlInfo } from '../types/interfaces';
import { Environment } from '../env';
import { UrlUtils } from '../utils/UrlUtils';
import { FormAnalyzer } from '../analyzers/FormAnalyzer';

// GAS専用インポート（ESBuildでは無視される）
declare const UrlFetchApp: any;

export class UrlPatternStrategy implements SearchStrategy {

  // 優先順位付きURLパターン（高確率順）
  private static readonly HIGH_PRIORITY_PATTERNS = [
    '/contact/', '/contact', '/inquiry/', '/inquiry',
    '/お問い合わせ/', '/問い合わせ/', '/form/', '/form',
    '/contact-us/', '/contact-us', '/contactus/', '/contactus',
    '/support/', '/support', '/help/', '/help'
  ];

  // SPA検出用のHTMLキャッシュ
  private static sameHtmlCache: { [url: string]: string } = {};

  // 有効URL管理（フォールバック用）
  private static validUrls: ValidUrlInfo[] = [];

  /**
   * 戦略名を取得
   */
  getStrategyName(): string {
    return 'URL Pattern Strategy (Step1)';
  }

  /**
   * URLパターン推測検索の実行
   */
  search(baseUrl: string): ContactPageResult | null {
    const result = this.searchDetailed(baseUrl);
    return result ? result.result : null;
  }

  /**
   * URLパターン推測検索の実行（詳細結果付き）
   */
  searchDetailed(baseUrl: string): UrlSearchStrategyResult | null {
    console.log(`=== ${this.getStrategyName()} Starting ===`);
    
    const startTime = Date.now();
    const maxTotalTime = Environment.getMaxTotalTime();
    const domainUrl = UrlUtils.extractDomain(baseUrl);

    const result = UrlPatternStrategy.searchWithPriorityPatterns(domainUrl, startTime, maxTotalTime);
    
    return {
      result,
      validUrls: [...UrlPatternStrategy.validUrls]
    };
  }

  /**
   * 優先順位付きURLパターンテスト
   * SPA検出と統合されたロジック
   */
  private static searchWithPriorityPatterns(domainUrl: string, startTime: number, maxTotalTime: number): ContactPageResult {
    console.log(`Testing priority patterns for domain: ${domainUrl}`);
    
    // validUrlsをリセット
    this.validUrls = [];
    let spaDetected = false;
    
    for (const pattern of this.HIGH_PRIORITY_PATTERNS) {
      // タイムアウトチェック
      if (Date.now() - startTime > maxTotalTime) {
        console.log('⏰ Maximum time exceeded during Step1 pattern testing');
        break;
      }

      const testUrl = UrlUtils.resolveUrl(pattern, domainUrl);
      console.log(`Testing pattern: ${pattern} -> ${testUrl}`);

      try {
        const response = this.fetchWithTimeout(testUrl, 7000);
        const statusCode = response.getResponseCode();

        if (statusCode === 200) {
          console.log(`✅ Pattern ${pattern} returned 200 OK`);
          const html = response.getContentText();
          
          // SPA検出（同一HTML判定）
          if (!spaDetected && UrlPatternStrategy.detectSameHtmlPattern(html, testUrl)) {
            console.log('🔄 SPA detected - executing specialized analysis');
            spaDetected = true;
            
            const spaResult = UrlPatternStrategy.executeSPAAnalysis(html, domainUrl);
            if (spaResult.contactUrl) {
              return spaResult;
            }
          }

          // 通常のフォーム検証
          const formResult = UrlPatternStrategy.validateContactPage(html, testUrl);
          if (formResult) {
            return formResult;
          }

          // 有効URLとして記録（フォールバック用）
          this.validUrls.push({ url: testUrl, pattern });
        } else {
          console.log(`❌ Pattern ${pattern} returned ${statusCode}`);
        }

      } catch (error) {
        const detailedError = this.getDetailedNetworkError(error);
        console.log(`Error testing ${pattern}: ${detailedError}`);
        continue;
      }
    }

    // Step1で成功せず、有効URLがある場合でも失敗として返す（Step2以降に委ねる）

    console.log('❌ Step1 failed - no valid patterns found');
    return {
      contactUrl: null,
      actualFormUrl: null,
      foundKeywords: ['step1_failed'],
      searchMethod: 'step1_pattern_search_failed'
    };
  }

  /**
   * 同一HTMLパターン検出（SPA判定）
   */
  private static detectSameHtmlPattern(html: string, currentUrl: string): boolean {
    if (!html || html.length < 100) return false;
    
    const htmlHash = this.hashString(html);
    
    // 過去のURLのハッシュと比較
    for (const [url, hash] of Object.entries(this.sameHtmlCache)) {
      if (hash === htmlHash && url !== currentUrl) {
        console.log(`Same HTML detected: ${currentUrl} matches ${url}`);
        return true;
      }
    }
    
    // 現在のHTMLをキャッシュ
    this.sameHtmlCache[currentUrl] = htmlHash;
    
    // キャッシュサイズ制限（メモリ節約）
    const cacheKeys = Object.keys(this.sameHtmlCache);
    if (cacheKeys.length > 10 && cacheKeys[0]) {
      delete this.sameHtmlCache[cacheKeys[0]];
    }
    
    return false;
  }

  /**
   * 文字列の簡単なハッシュ値計算
   */
  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < Math.min(str.length, 1000); i++) { // パフォーマンス最適化
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit integer変換
    }
    return hash.toString();
  }

  /**
   * SPA分析の実行
   */
  private static executeSPAAnalysis(html: string, baseUrl: string): ContactPageResult {
    console.log('Executing SPA analysis on detected single-page application');
    
    try {
      // アンカーリンク（#hash）を検索
      const anchorLinks = this.extractAnchorLinks(html);
      
      for (const anchor of anchorLinks) {
        console.log(`Analyzing anchor: ${anchor}`);
        
        const sectionResult = this.analyzeAnchorSection(html, anchor, baseUrl);
        if (sectionResult.contactUrl) {
          return sectionResult;
        }
      }
      
      console.log('No contact sections found in SPA analysis');
    } catch (error) {
      console.log(`SPA analysis error: ${error}`);
    }
    
    return {
      contactUrl: null,
      actualFormUrl: null,
      foundKeywords: ['spa_analysis_failed'],
      searchMethod: 'spa_analysis_failed'
    };
  }

  /**
   * HTMLからアンカーリンクを抽出
   */
  private static extractAnchorLinks(html: string): string[] {
    const anchorPattern = /href\s*=\s*['"]#([^'"]+)['"]/gi;
    const anchors: string[] = [];
    let match;
    
    while ((match = anchorPattern.exec(html)) !== null) {
      if (match && match[1]) {
        const anchor = match[1].toLowerCase();
        if (anchor.includes('contact') || anchor.includes('inquiry') || 
            anchor.includes('form') || anchor.includes('問い合わせ')) {
          anchors.push(anchor);
        }
      }
    }
    
    return anchors;
  }

  /**
   * アンカーセクション分析
   */
  private static analyzeAnchorSection(html: string, anchor: string, baseUrl: string): ContactPageResult {
    const sectionPattern = new RegExp(`id\\s*=\\s*['"]${anchor}['"][^>]*>([\\s\\S]*?)(?=<[^>]*id\\s*=|$)`, 'i');
    const match = html.match(sectionPattern);
    
    if (match && match[1]) {
      const sectionContent = match[1];
      console.log(`Found section content for #${anchor}, length: ${sectionContent.length}`);
      
      // セクション内でフォーム検証
      const hasForm = FormAnalyzer.isValidContactForm(sectionContent);
      if (hasForm) {
        const contactUrl = `${UrlUtils.extractDomain(baseUrl)}#${anchor}`;
        console.log(`✅ Contact form found in SPA section: ${contactUrl}`);
        
        return {
          contactUrl,
          actualFormUrl: contactUrl,
          foundKeywords: ['spa_section_form', anchor, 'valid_form'],
          searchMethod: 'spa_anchor_analysis'
        };
      }
    }
    
    return {
      contactUrl: null,
      actualFormUrl: null,
      foundKeywords: [],
      searchMethod: 'spa_section_analysis_failed'
    };
  }

  /**
   * 構造化フォーム検証
   * 条件: <form>要素 + 送信ボタン + contact関連フィールド
   */
  private static validateContactPage(html: string, contactPageUrl: string): ContactPageResult | null {
    console.log(`Validating contact page: ${contactPageUrl}`);
    
    // 統合フォーム検出を使用
    const formResult = FormAnalyzer.isValidContactForm(html);
    
    if (formResult) {
      console.log(`✅ Contact page validated: ${contactPageUrl} (contact form found)`);
      
      return {
        contactUrl: contactPageUrl,
        actualFormUrl: contactPageUrl,
        foundKeywords: ['validated_contact_page', 'contact_form', 'step1_validation'],
        searchMethod: 'step1_pattern_match'
      };
    }
    
    console.log(`❌ No valid forms found in: ${contactPageUrl}`);
    return null;
  }

  /**
   * SPA検出キャッシュをリセット
   */
  static resetSpaCache(): void {
    this.sameHtmlCache = {};
  }

  /**
   * 有効URLリストを取得
   */
  static getValidUrls(): ValidUrlInfo[] {
    return [...this.validUrls];
  }

  /**
   * HTTPリクエスト実行（タイムアウト管理）
   */
  private static fetchWithTimeout(url: string, _timeoutMs: number = 5000) {
    try {
      return UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        followRedirects: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
    } catch (error) {
      const detailedError = this.getDetailedNetworkError(error);
      console.error(`Error fetching ${url}: ${detailedError}`);
      throw error;
    }
  }

  /**
   * 詳細ネットワークエラー取得
   */
  private static getDetailedNetworkError(error: any): string {
    const errorString = error.toString().toLowerCase();
    
    // DNS関連エラー
    if (errorString.includes('dns') || errorString.includes('nxdomain') || errorString.includes('name or service not known')) {
      return 'DNS解決失敗: ドメインが存在しません';
    }
    
    // タイムアウトエラー
    if (errorString.includes('timeout') || errorString.includes('timeout')) {
      return 'タイムアウト: サーバーからの応答が遅すぎます';
    }
    
    // 接続拒否エラー
    if (errorString.includes('connection refused') || errorString.includes('econnrefused')) {
      return '接続拒否: サーバーが接続を拒否しました';
    }
    
    // その他のネットワークエラー
    if (errorString.includes('failed to fetch') || errorString.includes('network error')) {
      return 'ネットワークエラー: 通信に失敗しました';
    }
    
    // 不明なエラー
    return `不明なエラー: ${errorString}`;
  }
}