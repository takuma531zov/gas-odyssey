/**
 * Step1検索処理クラス
 * 44ac0de最適版から分離：優先度ベースのURLパターン検索を専門管理
 */

import type { ContactPageResult } from '../types/interfaces';
import { SearchState } from './SearchState';
import { Environment } from '../env';
import { NetworkUtils } from '../utils/NetworkUtils';

export class Step1Searcher {
  // 44ac0de最適版から完全移植したHIGH_PRIORITY_PATTERNS
  private readonly HIGH_PRIORITY_PATTERNS = [
    '/contact/', '/contact',  '/contact.php', '/inquiry/','/inquiry', '/inquiry.php',  '/form','/form/',  '/form.php','/contact-us/', '/contact-us',
    '/%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B/', // お問い合わせ
    '/%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B/', // 問い合わせ
  ];

  constructor(
    private searchState: SearchState,
    private contactPageFinderClass: any // ContactPageFinderクラスの参照（循環import回避）
  ) {}

  /**
   * 優先度ベースのURLパターン検索（44ac0de最適版移植）
   * SPA検出統合で効率的な検索を実行
   * @param domainUrl ドメインURL
   * @param startTime 開始時刻
   * @returns 検索結果
   */
  searchWithPriorityPatterns(domainUrl: string, startTime: number): ContactPageResult {
    const maxTotalTime = Environment.getMaxTotalTime();
    console.log('Starting priority-based URL pattern search with integrated SPA detection');

    // 優先度順にパターンをテスト
    const allPatterns = [
      ...this.HIGH_PRIORITY_PATTERNS,
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

        const response = this.contactPageFinderClass.fetchWithTimeout(testUrl, 5000); // 5秒タイムアウト

        if (response.getResponseCode() === 200) {
          const html = response.getContentText();
          console.log(`Got HTML content for ${testUrl}, length: ${html.length}`);
          
          // **SPA OPTIMIZATION: Detect same HTML pattern and apply anchor analysis**
          testedUrls.push(testUrl);
          htmlResponses.push(html);
          
          // Check for SPA pattern after 2nd URL
          if (testedUrls.length >= 2 && this.contactPageFinderClass.detectSameHtmlPattern(testedUrls, html)) {
            console.log('Single Page Application detected: same HTML returned for multiple URLs');
            console.log('Executing anchor-based analysis to optimize remaining URL tests');
            
            // Try anchor analysis on the current HTML (represents the homepage content)
            const anchorResult = this.contactPageFinderClass.executeSPAAnalysis(html, domainUrl);
            if (anchorResult.contactUrl) {
              console.log(`✅ SPA optimization successful: ${anchorResult.contactUrl}`);
              console.log(`Skipping remaining ${allPatterns.length - testedPatterns} URL pattern tests`);
              return anchorResult;
            }
            
            console.log('SPA detected but anchor analysis unsuccessful, continuing with remaining URL tests');
          }

          // ページの有効性を確認
          if (this.contactPageFinderClass.isValidContactPage(html)) {
            console.log(`${testUrl} passed validity check`);

            // 200 OK URLを記録（フォールバック用）
            this.searchState.addValidUrl(testUrl, pattern);

            // シンプルな2段階問い合わせフォーム判定
            const isContactForm = this.contactPageFinderClass.isValidContactForm(html);
            console.log(`Pattern ${pattern}: 200 OK, contact form: ${isContactForm}`);

            if (isContactForm) {
              structuredFormPages++;
              console.log(`✅ Contact form confirmed at ${testUrl} - form elements + contact submit confirmed`);

              // 成功したURLを記録（Step2重複回避用）
              this.searchState.addSuccessfulFormUrl(testUrl);

              // 問い合わせフォーム確認済み → 即座に成功
              return {
                contactUrl: testUrl,
                actualFormUrl: testUrl, // シンプルに同じURLを返す
                foundKeywords: [pattern.replace(/\//g, ''), 'contact_form_confirmed'],
                searchMethod: 'contact_form_priority_search'
              };
            } else {
              // フォーム検証失敗 → Google Forms検証を実行
              console.log(`No standard form found at ${testUrl}, checking for Google Forms...`);

              const googleFormsResult = this.contactPageFinderClass.detectGoogleForms(html);
              if (googleFormsResult.found && googleFormsResult.url) {
                console.log(`✅ Google Forms found at ${testUrl} -> ${googleFormsResult.url}`);
                
                // 成功したURLを記録（Step2重複回避用）
                this.searchState.addSuccessfulFormUrl(testUrl);
                
                return {
                  contactUrl: testUrl,
                  actualFormUrl: googleFormsResult.url,
                  foundKeywords: [pattern.replace(/\//g, ''), 'google_forms', googleFormsResult.type],
                  searchMethod: 'google_forms_priority_search'
                };
              }

              // Google Formsも見つからない → 候補として記録して継続
              console.log(`No contact forms found at ${testUrl}, logging as candidate and continuing`);
              this.searchState.addCandidate(testUrl, 'no_contact_form', html);
              continue; // 次のパターンへ
            }
          } else {
            console.log(`${testUrl} failed validity check`);
          }
        } else {
          const statusCode = response.getResponseCode();
          const detailedError = NetworkUtils.getDetailedErrorMessage(statusCode);
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
        const detailedError = this.contactPageFinderClass.getDetailedNetworkError(error);
        console.log(`Error testing ${pattern}: ${detailedError}`);

        // DNS解決失敗の場合は即座に処理を中断
        if (detailedError.includes('DNS解決失敗')) {
          console.log('DNS resolution failed, breaking priority pattern search');
          return {
            contactUrl: null,
            actualFormUrl: null,
            foundKeywords: [detailedError],
            searchMethod: 'dns_error'
          };
        }

        continue;
      }
    }

    // パターン検索完了のサマリー
    console.log(`=== Pattern Search Summary ===`);
    console.log(`Tested patterns: ${testedPatterns}`);
    console.log(`Structured form pages: ${structuredFormPages}`);
    console.log(`Candidate pages: ${this.searchState.getCandidateCount()}`);

    return {
      contactUrl: null,
      actualFormUrl: null,
      foundKeywords: ['priority_search_no_structured_forms'],
      searchMethod: 'priority_search_failed'
    };
  }
}