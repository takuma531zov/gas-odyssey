/**
 * HTML分析・コンテンツ検証ユーティリティ
 * HTML解析とページ品質判定を管理
 */

import { FormDetector } from '../detectors/FormDetector';
import { NavigationSearcher } from '../core/navigation/NavigationSearcher';
import { NetworkUtils } from '../utils/NetworkUtils';
import type { ContactPageResult } from '../types/interfaces';

export class HtmlAnalyzer {
  
  // URL推測専用パターン（URL推測でテストするパス）
  static readonly HIGH_PRIORITY_PATTERNS = [
    '/contact/', '/contact',  '/contact.php', '/inquiry/','/inquiry', '/inquiry.php',  '/form','/form/',  '/form.php','/contact-us/', '/contact-us',
    '/%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B/', // お問い合わせ
    '/%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B/', // 問い合わせ
  ];

  static readonly FORM_KEYWORDS = [
    'フォーム', 'form', '入力', '送信',
    'googleフォーム', 'google form', 'submit'
  ];

  /**
   * HTML解析によるコンテンツ分析（index.tsから移植・最適版完全移植）
   */
  static analyzeHtmlContent(html: string, baseUrl: string): ContactPageResult {
    console.log('=== HTML Content Analysis ===');
    console.log(`HTML length: ${html.length}`);
    console.log(`Base URL: ${baseUrl}`);

    // **Phase 1: Google Forms 最優先検索**
    console.log('Phase 1: Google Forms detection');
    const googleFormUrl = NetworkUtils.findGoogleFormUrlsOnly(html);
    if (googleFormUrl && googleFormUrl.startsWith('http')) {
      console.log(`✅ Google Form URL found: ${googleFormUrl}`);
      return {
        contactUrl: googleFormUrl,
        actualFormUrl: googleFormUrl,
        foundKeywords: ['google_forms', 'html_analysis'],
        searchMethod: 'html_analysis_google_forms'
      };
    }

    // **Phase 2: Navigation-based URL discovery**
    console.log('Phase 2: Navigation-based URL discovery');
    const navSearchResult = NavigationSearcher.searchInNavigation(html, baseUrl);
    if (navSearchResult.url) {
      console.log(`✅ Navigation search found URL: ${navSearchResult.url}`);
      
      // 🔥 新URL発見時の詳細検証: 実際にアクセスして検証
      try {
        console.log(`🔍 New URL found, performing detailed validation: ${navSearchResult.url}`);

        const response = NetworkUtils.fetchWithTimeout(navSearchResult.url, 5000);
        if (response.getResponseCode() === 200) {
          const candidateHtml = response.getContentText();

          // フォーム検証: FormDetectorで統合検証
          const formResult = FormDetector.detectAnyForm(candidateHtml);

          if (formResult.found) {
            console.log(`✅ Navigation URL validated with forms: ${navSearchResult.url}`);

            // Google Formsが見つかった場合は実際のGoogle FormsのURLを返す
            if (formResult.formUrl && formResult.formUrl.startsWith('http')) {
              return {
                contactUrl: navSearchResult.url,
                actualFormUrl: formResult.formUrl,
                foundKeywords: [...navSearchResult.keywords, 'validated_navigation'],
                searchMethod: 'html_analysis_navigation_validated'
              };
            }

            return {
              contactUrl: navSearchResult.url,
              actualFormUrl: navSearchResult.url,
              foundKeywords: [...navSearchResult.keywords, 'validated_navigation'],
              searchMethod: 'html_analysis_navigation_validated'
            };
          } else {
            console.log(`❌ Navigation URL failed form validation: ${navSearchResult.url}`);
          }
        }
      } catch (validationError) {
        console.log(`❌ Navigation URL validation failed: ${validationError}`);
      }
    }

    // **Phase 3: Direct embedded form analysis**
    console.log('Phase 3: Direct embedded form analysis');
    const embeddedForm = NetworkUtils.findEmbeddedHTMLForm(html);
    if (embeddedForm) {
      console.log(`✅ Embedded HTML form found in page`);
      return {
        contactUrl: baseUrl,
        actualFormUrl: baseUrl,
        foundKeywords: ['embedded_forms', 'html_analysis'],
        searchMethod: 'html_analysis_embedded_forms'
      };
    }

    console.log('❌ HTML analysis found no contact pages');
    return {
      contactUrl: null,
      actualFormUrl: null,
      foundKeywords: [],
      searchMethod: 'html_analysis_failed'
    };
  }

  /**
   * 実際のフォーム発見（index.tsから移植・最適版完全移植）
   */
  static findActualForm(contactPageUrl: string): string | null {
    try {
      const response = NetworkUtils.fetchWithTimeout(contactPageUrl, 5000); // 5秒タイムアウト
      const html = response.getContentText();

      // 1. まず、Google Formsを最優先で検索
      const googleFormUrl = NetworkUtils.findGoogleFormUrlsOnly(html);
      if (googleFormUrl && googleFormUrl.startsWith('http')) {
        console.log(`Found Google Form in contact page: ${googleFormUrl}`);
        return googleFormUrl;
      }

      // 2. 埋め込みフォームの検出
      const embeddedForm = NetworkUtils.findEmbeddedHTMLForm(html);
      if (embeddedForm) {
        console.log(`Found embedded form in contact page`);
        return contactPageUrl; // Fix: Return actual contact page URL instead of placeholder
      }

      // 3. ２段階リンク検出: より詳細なフォームページへのリンクを探す
      const secondStageFormUrl = NetworkUtils.findSecondStageFormLink(html, contactPageUrl);
      if (secondStageFormUrl) {
        console.log(`Found second-stage form link: ${secondStageFormUrl}`);
        return secondStageFormUrl;
      }

      return null;
    } catch (error) {
      console.log(`Error in findActualForm for ${contactPageUrl}: ${error}`);
      return null;
    }
  }

  /**
   * Google Forms検証（index.tsから移植・最適版完全移植）
   */
  static detectGoogleForms(html: string): { found: boolean; url: string | null; type: string } {
    console.log('Starting Google Forms detection...');

    // Google Forms URLパターン
    const googleFormsPatterns = [
      // 直接リンク
      /<a[^>]*href=['"]([^'\"]*docs\.google\.com\/forms\/d\/[a-zA-Z0-9-_]+\/?[^"'\s)]*)['"][^>]*>/gi,
      // iframe埋め込み
      /<iframe[^>]*src=['"]([^'\"]*docs\.google\.com\/forms\/d\/[a-zA-Z0-9-_]+\/?[^"'\s)]*)['"][^>]*>/gi
    ];

    for (let i = 0; i < googleFormsPatterns.length; i++) {
      const pattern = googleFormsPatterns[i];
      if (!pattern) continue;
      const matches = html.match(pattern);

      if (matches && matches.length > 0) {
        for (const match of matches) {
          const urlMatch = match.match(/(['"])(.*docs\.google\.com\/forms\/d\/[a-zA-Z0-9-_]+\/?[^"'\s)]*?)\1/);
          if (urlMatch && urlMatch[2]) {
            const googleFormUrl = urlMatch[2];
            const detectionType = i === 0 ? 'direct_link' : 'iframe_embed';

            console.log(`✓ Google Forms detected (${detectionType}): ${googleFormUrl}`);
            return {
              found: true,
              url: googleFormUrl,
              type: detectionType
            };
          }
        }
      }
    }

    console.log('No Google Forms detected');
    return { found: false, url: null, type: 'none' };
  }

  /**
   * 有効な問い合わせページ判定（index.tsから移植・最適版完全移植）
   */
  static isValidContactPage(html: string): boolean {
    // 除外パターン（確実に問い合わせページではないコンテンツ）
    const invalidPatterns = [
      'ご利用規約', 'terms of service', 'terms and conditions', 'privacy policy', 'プライバシーポリシー',
      'not found', '404', 'error', 'ページが見つかりません',
      '採用', 'recruit', 'career', 'job', 'hiring',
      'ニュース', 'news', 'press release', 'プレスリリース',
      'よくある質問', 'faq', 'frequently asked questions'
    ];

    const lowerHtml = html.toLowerCase();

    // Phase 1: 除外パターンチェック（優先度高）
    for (const pattern of invalidPatterns) {
      if (lowerHtml.includes(pattern.toLowerCase())) {
        console.log(`Page excluded due to pattern: ${pattern}`);
        return false;
      }
    }

    // Phase 2: フォーム検証（FormDetectorを活用）
    const analysis = FormDetector.analyzeFormElements(html);
    return analysis.isValidForm;
  }
}