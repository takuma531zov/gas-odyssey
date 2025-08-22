/**
 * HTML分析・コンテンツ検証ユーティリティ
 * HTML解析とページ品質判定を管理
 */

import { FormDetector } from '../detectors/FormDetector';
import { NavigationSearcher } from '../core/navigation/NavigationSearcher';
import { SPAAnalyzer } from '../core/spa/SPAAnalyzer';
import { CandidateManager } from '../core/CandidateManager';
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
   * Step2フロー: ホームページHTML解析によるフォールバック検索
   * (元のindex.tsのanalyzeHtmlContent関数を完全移植)
   */
  static analyzeHtmlContent(html: string, baseUrl: string): ContactPageResult {
    console.log('=== Starting navigation-only HTML analysis ===');

    // Navigation search only
    console.log('Stage 1: Navigation search');
    const navResult = NavigationSearcher.searchInNavigation(html, baseUrl);
    if (navResult.url && navResult.score > 0) {
      console.log(`Navigation search result: ${navResult.url} (score: ${navResult.score}, reasons: ${navResult.reasons.join(',')})`);

      // 重複回避チェック：Step1で成功したフォームURLのみスキップ（失敗したURLは再検証）
      const isSuccessfulFormDuplicate = CandidateManager.getSuccessfulFormUrls().includes(navResult.url);
      if (isSuccessfulFormDuplicate) {
        console.log(`⏭ Skipping duplicate URL (already succeeded in Step1): ${navResult.url}`);
      } else {
        // Check if this is an anchor link for special processing
        if (SPAAnalyzer.isAnchorLink(navResult.url)) {
          console.log(`🔍 Anchor link detected: ${navResult.url}, analyzing section content`);
          const anchorSectionResult = SPAAnalyzer.analyzeAnchorSection(html, navResult.url, baseUrl);
          if (anchorSectionResult.contactUrl) {
            console.log(`✅ Found contact info in anchor section: ${anchorSectionResult.contactUrl}`);
            return anchorSectionResult;
          }
        }

        // 新規URLの場合：実際にアクセスしてform検証+Google Forms検証
        console.log(`🔍 New URL found, performing detailed validation: ${navResult.url}`);

        try {
          const response = NetworkUtils.fetchWithTimeout(navResult.url, 5000);
          if (response.getResponseCode() === 200) {
            const candidateHtml = response.getContentText();

            // A. 標準フォーム検証
            const isValidForm = FormDetector.isValidContactForm(candidateHtml);
            if (isValidForm) {
              console.log(`✅ Standard form confirmed at ${navResult.url}`);
              return {
                contactUrl: navResult.url,
                actualFormUrl: navResult.url,
                foundKeywords: [...navResult.keywords, 'form_validation_success'],
                searchMethod: 'homepage_navigation_form'
              };
            }

            // B. Google Forms検証
            const googleFormsResult = HtmlAnalyzer.detectGoogleForms(candidateHtml);
            if (googleFormsResult.found && googleFormsResult.url) {
              console.log(`✅ Google Forms confirmed at ${navResult.url} -> ${googleFormsResult.url}`);
              return {
                contactUrl: navResult.url,
                actualFormUrl: googleFormsResult.url,
                foundKeywords: [...navResult.keywords, 'google_forms', googleFormsResult.type],
                searchMethod: 'homepage_navigation_google_forms'
              };
            }

            // C. キーワードベース判定（Step2の高信頼度fallback）
            console.log(`No forms detected at ${navResult.url}, checking keyword-based validation...`);
            if (navResult.score >= 15) { // Navigation + contact keyword = 高信頼度
              console.log(`✅ Keyword-based validation: Navigation detection + contact keywords (score: ${navResult.score})`);
              return {
                contactUrl: navResult.url,
                actualFormUrl: navResult.url,
                foundKeywords: [...navResult.keywords, 'keyword_based_validation'],
                searchMethod: 'homepage_navigation_keyword_based'
              };
            }

            console.log(`❌ No valid forms or sufficient keywords at ${navResult.url}`);
          } else {
            console.log(`❌ Navigation result returned non-200 status: ${response.getResponseCode()}`);
          }
        } catch (error) {
          console.log(`❌ Error accessing navigation result: ${error}`);
        }
      }
    }

    console.log('Navigation search found no candidates');

    console.log('=== HTML content analysis completed - no viable candidates found ===');
    return {
      contactUrl: null,
      actualFormUrl: null,
      foundKeywords: [],
      searchMethod: 'not_found'
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