import { Environment } from './env';
import type { ContactPageResult } from './types/interfaces';
import { NavigationSearcher } from './core/navigation/NavigationSearcher';
import { SPAAnalyzer } from './core/spa/SPAAnalyzer';
import { FormDetector } from './detectors/FormDetector';
import { NetworkUtils } from './utils/NetworkUtils';

/**
 * ContactPageFinder - BtoB営業用問い合わせページ自動検索システム
 *
 * 目的:
 * - 企業サイトから問い合わせページを自動発見
 * - Google Apps Script環境での安定動作
 * - BtoB営業活動の効率化支援
 *
 * 検索戦略:
 * Step1: URLパターン推測（高速・高精度）
 * Step2: HTML解析によるフォールバック検索
 * Final: 最終フォールバック（Step1の200 OKページ使用）
 *
 * 特徴:
 * - SPA（Single Page Application）対応
 * - Google Forms検出
 * - 埋め込みフォーム対応
 * - JavaScript動的フォーム検出
 * - タイムアウト管理による安定性確保
 */
class ContactPageFinder {
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



  // URL推測専用パターン（URL推測でテストするパス）
  private static readonly HIGH_PRIORITY_PATTERNS = [

    '/contact/', '/contact',  '/contact.php', '/inquiry/','/inquiry', '/inquiry.php',  '/form','/form/',  '/form.php','/contact-us/', '/contact-us',
    '/%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B/', // お問い合わせ
    '/%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B/', // 問い合わせ

  ];





  // **NEW: Final Fallback** - Step1の最初の200 OK URLを最終手段として返却
  private static getFinalFallbackUrl(): ContactPageResult {
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
    const qualityScore = this.evaluateFallbackUrlQuality(firstValidUrl.url, firstValidUrl.pattern);

    return {
      contactUrl: firstValidUrl.url,
      actualFormUrl: firstValidUrl.url,
      foundKeywords: ['final_fallback', 'first_valid_url', firstValidUrl.pattern.replace(/\//g, ''), ...qualityScore.keywords],
      searchMethod: qualityScore.confidence >= 0.7 ? 'final_fallback_high_confidence' : 'final_fallback_low_confidence'
    };
  }

  // **NEW: Fallback URL Quality Evaluation** - フォールバックURLの品質評価
  private static evaluateFallbackUrlQuality(url: string, pattern: string): { confidence: number, keywords: string[] } {
    let confidence = 0.5; // ベーススコア
    const keywords: string[] = [];

    // 高信頼度パターン
    const highConfidencePatterns = ['/contact/', '/contact', '/inquiry/', '/inquiry'];
    if (highConfidencePatterns.includes(pattern)) {
      confidence += 0.3;
      keywords.push('high_confidence_pattern');
    }

    // 中信頼度パターン
    const mediumConfidencePatterns = ['/form/', '/form'];
    if (mediumConfidencePatterns.includes(pattern)) {
      confidence += 0.1;
      keywords.push('medium_confidence_pattern');
    }

    // URL内のcontactキーワードチェック（ドメイン除外）
    const urlPath = url.replace(/https?:\/\/[^/]+/, ''); // ドメインを除外
    const contactKeywords = ['contact', 'inquiry', 'form', 'お問い合わせ', '問い合わせ'];

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
  }


  // 早期終了用の閾値定義とタイムアウト設定は env.ts で管理





  private static readonly FORM_KEYWORDS = [
    'フォーム', 'form', '入力', '送信',
    'googleフォーム', 'google form', 'submit'
  ];



  /**
   * 問い合わせページ検索のメインエントリーポイント
   *
   * @param baseUrl 検索対象のベースURL（企業サイトのトップページ等）
   * @returns ContactPageResult 検索結果（URL、フォーム情報、検索手法等）
   *
   * 処理フロー:
   * 1. 初期化処理（候補リセット、タイマー開始）
   * 2. SNSページ判定（Facebook、Twitter等は除外）
   * 3. ドメイン生存確認（サイト閉鎖チェック）
   * 4. Step1: URLパターン推測検索
   * 5. Step2: HTML解析フォールバック検索
   * 6. 最終フォールバック: Step1の200 OKページ使用
   *
   * 実装注意事項:
   * - GAS環境でのタイムアウト管理（デフォルト80秒）
   * - メモリ効率を考慮したキャッシュ管理
   * - BtoB営業用途に特化したキーワード重み付け
   * - SPA（Single Page Application）対応
   */
  static findContactPage(baseUrl: string): ContactPageResult {
    const startTime = Date.now();
    const maxTotalTime = Environment.getMaxTotalTime();

    try {
      // 候補リストのリセット（新しい検索開始時）
      this.resetCandidates();

      // SNSページの検出
      if (NetworkUtils.isSNSPage(baseUrl)) {
        console.log(`SNS page detected: ${baseUrl}, returning not found`);
        return {
          contactUrl: null,
          actualFormUrl: null,
          foundKeywords: ['sns_page'],
          searchMethod: 'sns_not_supported'
        };
      }

      // ドメイン生存確認
      console.log(`Checking domain availability for: ${baseUrl}`);
      const domainCheck = NetworkUtils.checkDomainAvailability(baseUrl);
      if (!domainCheck.available) {
        console.log(`Domain unavailable: ${domainCheck.error}`);
        return {
          contactUrl: null,
          actualFormUrl: null,
          foundKeywords: [domainCheck.error || 'サイトが閉鎖されています'],
          searchMethod: 'site_closed'
        };
      }
      console.log(`Domain is available, proceeding with contact search`);

      // Extract domain for subdirectory pattern support
      const domainUrl = NetworkUtils.extractDomain(baseUrl);

      console.log(`Starting contact page search for: ${baseUrl}`);

      // STEP 1: URL pattern guessing with integrated SPA detection (HIGHEST PRIORITY - Fast & Accurate)
      console.log('Step 1: URL pattern guessing with SPA optimization (primary strategy)');
      const priorityResult = this.searchWithPriorityPatterns(domainUrl, startTime);
      if (priorityResult.contactUrl) {
        console.log(`✅ Found via URL pattern search: ${priorityResult.contactUrl}`);
        return priorityResult;
      }

      // エラーの場合は即座に返す（fallback処理をスキップ）
      if (priorityResult.searchMethod === 'dns_error' || priorityResult.searchMethod === 'bot_blocked') {
        console.log(`URL pattern search returned error: ${priorityResult.searchMethod}, stopping here`);
        return priorityResult;
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

      // STEP 2: Homepage HTML analysis (FALLBACK for special cases like ye-p.co.jp)
      console.log('Step 2: Homepage HTML analysis as fallback for special cases');
      try {
        const response = NetworkUtils.fetchWithTimeout(baseUrl, 7000); // 7秒タイムアウト
        const html = NetworkUtils.getContentWithEncoding(response); // 🔥 文字化け解決

        // Check for Google Forms URLs first
        const googleFormUrls = NetworkUtils.findGoogleFormUrlsOnly(html);
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
        const result = this.analyzeHtmlContent(html, baseUrl);

        // If we found a contact page, try to find the actual form within it
        if (result.contactUrl) {
          console.log(`Found contact link on homepage: ${result.contactUrl}`);
          const formUrl = this.findActualForm(result.contactUrl);
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
        const embeddedFormResult = NetworkUtils.findEmbeddedHTMLForm(html);
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
        const detailedError = NetworkUtils.getDetailedNetworkError(homepageError);
        console.log(`Error in homepage analysis fallback: ${detailedError}`);
      }

      // FINAL FALLBACK: Return first valid contact URL from Step1 if available
      console.log('All search methods failed, checking final fallback...');
      const fallbackResult = this.getFinalFallbackUrl();
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
      const detailedError = NetworkUtils.getDetailedNetworkError(error);
      console.error(`Error fetching ${baseUrl}: ${detailedError}`);
      return {
        contactUrl: null,
        actualFormUrl: null,
        foundKeywords: [detailedError],
        searchMethod: 'error'
      };
    }
  }

  /**
   * Step2フロー: ホームページHTML解析によるフォールバック検索
   *
   * 処理手順:
   * 1. Google Forms最優先検索（HTML内のdocs.google.com URL検出）
   * 2. 埋め込みフォーム検証（外部サービス: Form.run, HubSpot等）
   * 3. ナビゲーション内リンク解析（<nav>要素、メニュー系クラス解析）
   * 4. リンク先フォーム検証（発見したリンクの実際の内容確認）
   * 5. 重複回避処理（Step1成功URLとの重複チェック）
   *
   * 検索範囲:
   * - Navigation（<nav>、.menu、.navigation等）
   * - Header内のリスト構造（<header><ul>構造）
   * - グローバルナビゲーション（.global-nav、.site-nav等）
   *
   * 特別処理:
   * - アンカーリンク特別処理（#contact等の内部リンク）
   * - JavaScript無効環境でのフォーム検出
   * - 動的コンテンツの静的解析
   *
   * 品質保証:
   * - キーワードマッチング重み付けスコア
   * - コンテキストボーナス（navigation内 +5点）
   * - 早期終了による高信頼度結果優先
   */
  private static analyzeHtmlContent(html: string, baseUrl: string): ContactPageResult {
    console.log('=== Starting navigation-only HTML analysis ===');

    // Navigation search only
    console.log('Stage 1: Navigation search');
    const navResult = NavigationSearcher.searchInNavigation(html, baseUrl);
    if (navResult.url && navResult.score > 0) {
      console.log(`Navigation search result: ${navResult.url} (score: ${navResult.score}, reasons: ${navResult.reasons.join(',')})`);

      // 重複回避チェック：Step1で成功したフォームURLのみスキップ（失敗したURLは再検証）
      const isSuccessfulFormDuplicate = this.successfulFormUrls.includes(navResult.url);
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
            const googleFormsResult = this.detectGoogleForms(candidateHtml);
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





    // Stage 2 removed: evaluateValidUrls discontinued (Step3 廃止)

    console.log('=== HTML content analysis completed - no viable candidates found ===');
    return {
      contactUrl: null,
      actualFormUrl: null,
      foundKeywords: [],
      searchMethod: 'not_found'
    };
  }


  // 200 OK URLsの評価（キーワード検出による問い合わせページ判定）








  // 🔥 文字化け解決: 複数エンコーディング試行


  // 動的サイト用厳格キーワード検証


  private static findActualForm(contactPageUrl: string): string | null {
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
      console.error(`Error fetching contact page ${contactPageUrl}:`, error);
      return null;
    }
  }


  // トップページURLかどうかを判定（２段階リンク検出での除外用）






  // Google Forms検証（2段階リンク検証）
  private static detectGoogleForms(html: string): { found: boolean; url: string | null; type: string } {
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


  // 候補ページの記録
  private static logPotentialCandidate(url: string, reason: string, html: string) {
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

  // 候補スコア計算
  private static calculateCandidateScore(
    url: string,
    reason: string,
    formAnalysis: { isValidForm: boolean, reasons: string[] }
  ): number {
    let score = 0;

    // URL具体性スコア
    if (url.includes('/contact-form/')) score += 15;
    else if (url.includes('/inquiry/')) score += 12;
    else if (url.includes('/contact/')) score += 8;
    else if (url.includes('/form/')) score += 10;

    // フォーム解析スコア
    if (formAnalysis.isValidForm) score += 15; // 構造化フォームスコアを統合
    score += formAnalysis.reasons.length * 2; // 理由の数に基づくスコア

    // 理由による調整
    if (reason === 'no_structured_form') score -= 10; // ペナルティ

    return score;
  }

  // 候補リストのリセット（新しい検索開始時）
  private static resetCandidates() {
    this.candidatePages = [];
    this.validUrls = [];
    this.successfulFormUrls = [];
  }

  // 候補を活用したfallback処理








  /**
   * Step1フロー: URLパターン推測による高速検索
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
  private static searchWithPriorityPatterns(domainUrl: string, startTime: number): ContactPageResult {
    // 200 OK URLリストをリセット
    this.validUrls = [];
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
            console.log('Executing anchor-based analysis to optimize remaining URL tests');

            // Try anchor analysis on the current HTML (represents the homepage content)
            const anchorResult = SPAAnalyzer.executeSPAAnalysis(html, domainUrl);
            if (anchorResult.contactUrl) {
              console.log(`✅ SPA optimization successful: ${anchorResult.contactUrl}`);
              console.log(`Skipping remaining ${allPatterns.length - testedPatterns} URL pattern tests`);
              return anchorResult;
            }

            console.log('SPA detected but anchor analysis unsuccessful, continuing with remaining URL tests');
          }

          // ページの有効性を確認
          if (this.isValidContactPage(html)) {
            console.log(`${testUrl} passed validity check`);

            // 200 OK URLを記録（フォールバック用）
            this.validUrls.push({ url: testUrl, pattern: pattern });

            // シンプルな2段階問い合わせフォーム判定
            const isContactForm = FormDetector.isValidContactForm(html);
            console.log(`Pattern ${pattern}: 200 OK, contact form: ${isContactForm}`);

            if (isContactForm) {
              structuredFormPages++;
              console.log(`✅ Contact form confirmed at ${testUrl} - form elements + contact submit confirmed`);

              // 成功したURLを記録（Step2重複回避用）
              this.successfulFormUrls.push(testUrl);

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

              const googleFormsResult = this.detectGoogleForms(html);
              if (googleFormsResult.found && googleFormsResult.url) {
                console.log(`✅ Google Forms found at ${testUrl} -> ${googleFormsResult.url}`);

                // 成功したURLを記録（Step2重複回避用）
                this.successfulFormUrls.push(testUrl);

                return {
                  contactUrl: testUrl,
                  actualFormUrl: googleFormsResult.url,
                  foundKeywords: [pattern.replace(/\//g, ''), 'google_forms', googleFormsResult.type],
                  searchMethod: 'google_forms_priority_search'
                };
              }

              // Google Formsも見つからない → 候補として記録して継続
              console.log(`No contact forms found at ${testUrl}, logging as candidate and continuing`);
              this.logPotentialCandidate(testUrl, 'no_contact_form', html);
              continue; // 次のパターンへ
            }
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
    console.log(`Candidate pages: ${this.candidatePages.length}`);

    return {
      contactUrl: null,
      actualFormUrl: null,
      foundKeywords: ['priority_search_no_structured_forms'],
      searchMethod: 'priority_search_failed'
    };
  }

  private static isValidContactPage(html: string): boolean {
    // 404ページや無効なページを除外（より厳密なパターンに変更）
    const invalidPatterns = [
      'page not found', 'ページが見つかりません', '404 not found',
      'under construction', '工事中', 'site under construction',
      'coming soon'
    ];

    const lowerHtml = html.toLowerCase();
    const hasInvalidContent = invalidPatterns.some(pattern =>
      lowerHtml.includes(pattern.toLowerCase())
    );

    // 最低限のコンテンツ長チェック
    const hasMinimumContent = html.length > 500;

    console.log(`Validity check - hasInvalidContent: ${hasInvalidContent}, hasMinimumContent: ${hasMinimumContent}, length: ${html.length}`);
    if (hasInvalidContent) {
      const matchedPattern = invalidPatterns.find(pattern => lowerHtml.includes(pattern.toLowerCase()));
      console.log(`Invalid pattern found: ${matchedPattern}`);
    }

    return !hasInvalidContent && hasMinimumContent;
  }

  private static getDetailedErrorMessage(statusCode: number): string {
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
}

/**
 * 後方互換性維持のためのラッパー関数
 * 既存の呼び出し元コードを変更せずに新しいアーキテクチャを使用可能
 *
 * @param url 検索対象URL
 * @returns ContactPageResult 検索結果
 *
 * 使用例:
 * const result = findContactPage('https://example.com');
 * console.log(result.contactUrl); // 問い合わせページURL
 * console.log(result.searchMethod); // 使用された検索手法
 */
function findContactPage(url: string): ContactPageResult {
  return ContactPageFinder.findContactPage(url);
}

/**
 * スプレッドシートUI付きURLFinder実行関数
 * GAS上のスプレッドシートボタンから実行される
 */
function executeUrlFinderWithUI(): void {
  console.log('=== URLFinder UI 開始 ===');

  try {
    // チェック行数を取得
    const checkedCount = getCheckedRowsCount();
    const maxCount = getMaxCountSetting();

    // 実行オプション選択ダイアログを表示
    const htmlTemplate = HtmlService.createTemplateFromFile('simple-options');
    htmlTemplate.checkedCount = checkedCount;
    htmlTemplate.maxCount = maxCount;

    const htmlOutput = htmlTemplate.evaluate()
      .setWidth(450)
      .setHeight(320)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

    SpreadsheetApp.getUi()
      .showModalDialog(htmlOutput, 'URLFinder - 実行オプション');

  } catch (error) {
    console.error('UI実行エラー:', error);
    const err = error as Error;
    SpreadsheetApp.getUi().alert('エラー', `実行中にエラーが発生しました: ${err.message}`, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * 選択されたオプションに基づいて処理を実行
 * @param mode 'normal' | 'checked'
 */
function executeSelectedMode(mode: string): void {
  console.log(`選択されたモード: ${mode}`);

  if (mode === 'normal') {
    executeNormalProcessing();
  } else if (mode === 'checked') {
    executeCheckedRowsProcessing();
  } else {
    throw new Error(`不明な実行モード: ${mode}`);
  }
}

function processContactPageFinder() {
  try {
    // スクリプトプロパティから設定値を取得
    const properties = PropertiesService.getScriptProperties();
    const sheetName = properties.getProperty('SHEET');
    const maxCountStr = properties.getProperty('MAX_COUNT');
    const headerRowStr = properties.getProperty('HEADER_ROW');

    if (!sheetName) {
      throw new Error('スクリプトプロパティ「SHEET」が設定されていません');
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`シート「${sheetName}」が見つかりません`);
    }

    // MAX_COUNTの処理（未設定の場合は制限なし）
    const maxCount = maxCountStr ? parseInt(maxCountStr, 10) : null;
    if (maxCountStr && isNaN(maxCount!)) {
      throw new Error('スクリプトプロパティ「MAX_COUNT」は数値で設定してください');
    }

    // HEADER_ROWの処理（未設定の場合は1行目）
    const headerRow = headerRowStr ? parseInt(headerRowStr, 10) : 1;
    if (headerRowStr && isNaN(headerRow!)) {
      throw new Error('スクリプトプロパティ「HEADER_ROW」は数値で設定してください');
    }

    console.log(`処理上限: ${maxCount ? `${maxCount}行` : '制限なし'}`);
    console.log(`ヘッダー行: ${headerRow}行目（処理対象から除外）`);

    // L列の最終行を取得
    const lastRowL = sheet.getLastRow();

    // AP列の最終行を取得（データがある行）
    const apRange = sheet.getRange('AP:AP');
    const apValues = apRange.getValues();
    let lastRowAP = 0;
    for (let i = apValues.length - 1; i >= 0; i--) {
      const row = apValues[i];
      if (row && row[0] !== '') {
        lastRowAP = i + 1;
        break;
      }
    }

    // 処理対象行の範囲を決定
    const startRow = lastRowAP + 1;
    let endRow = lastRowL;

    if (startRow > endRow) {
      console.log('処理対象のURLがありません');
      return;
    }

    // MAX_COUNTによる上限制御
    if (maxCount && (endRow - startRow + 1) > maxCount) {
      endRow = startRow + maxCount - 1;
      console.log(`MAX_COUNT制限により処理行数を${maxCount}行に制限します`);
    }

    console.log(`処理対象行: ${startRow}行目から${endRow}行目まで（${endRow - startRow + 1}行）`);

    // L列のURLを一括取得
    const urlRange = sheet.getRange(startRow, 12, endRow - startRow + 1, 1); // L列は12列目
    const urls = urlRange.getValues();

    // 結果配列を準備
    const results = [];

    // 各URLを処理
    for (let i = 0; i < urls.length; i++) {
      const urlRow = urls[i];
      const url = urlRow && urlRow[0];
      const currentRow = startRow + i;

      if (!url || url.toString().trim() === '') {
        results.push(['']);
        continue;
      }

      // ヘッダー行の場合はスキップ
      if (currentRow === headerRow) {
        console.log(`${currentRow}行目: ヘッダー行のためスキップ`);
        results.push(['']);
        continue;
      }

      console.log(`${currentRow}行目: ${url} を処理中...`);

      try {
        const result = findContactPage(url.toString().trim());

        console.log(`Result for ${currentRow}行目: searchMethod=${result.searchMethod}, foundKeywords=${result.foundKeywords ? result.foundKeywords.join(',') : 'none'}`);

        // actualFormURLをチェックして出力値を決定
        let outputValue = '';

        // エラーの場合はエラーメッセージを出力
        if (result.searchMethod === 'error' || result.searchMethod === 'dns_error' || result.searchMethod === 'bot_blocked' || result.searchMethod === 'site_closed') {
          if (result.foundKeywords && result.foundKeywords.length > 0) {
            outputValue = result.foundKeywords[0] || 'エラーが発生しました'; // 詳細エラーメッセージ
            console.log(`Using error message: ${outputValue}`);
          } else {
            outputValue = 'エラーが発生しました';
            console.log(`Using default error message: ${outputValue}`);
          }
        } else if (result.actualFormUrl) {
          // 実際のURLの場合はそのURL、識別子の場合はフォームが存在するページのURLを出力
          if (result.actualFormUrl.startsWith('http')) {
            outputValue = result.actualFormUrl;
          } else {
            // 識別子の場合、フォームが存在するページのURLを出力
            outputValue = result.contactUrl || url.toString().trim();
          }
        } else if (result.contactUrl) {
          // actualFormUrlはないが、contactUrlがある場合
          outputValue = result.contactUrl;
        } else {
          // SNSページや見つからない場合
          outputValue = '問い合わせフォームが見つかりませんでした';
        }

        results.push([outputValue]);
        console.log(`${currentRow}行目: 完了 - ${outputValue}`);

      } catch (error) {
        const errorMessage = `エラー: ${error instanceof Error ? error.message : String(error)}`;
        results.push([errorMessage]);
        console.error(`${currentRow}行目: ${errorMessage}`);
      }
    }

    // AP列に結果を一括書き込み
    const outputRange = sheet.getRange(startRow, 42, results.length, 1); // AP列は42列目
    outputRange.setValues(results);

    console.log(`処理完了: ${results.length}行の結果をAP列に出力しました`);

    // MAX_COUNT制限で処理が打ち切られた場合の通知
    if (maxCount && results.length === maxCount && startRow + maxCount - 1 < lastRowL) {
      console.log(`注意: MAX_COUNT(${maxCount})制限により処理を制限しました。残り${lastRowL - (startRow + maxCount - 1)}行のデータが未処理です。`);
    }

  } catch (error) {
    console.error('処理中にエラーが発生しました:', error);
    throw error;
  }
}





/**
 * 通常処理（既存ロジックをそのまま使用）
 */
function executeNormalProcessing(): void {
  console.log('=== 通常処理開始 ===');

  try {
    // 既存のprocessContactPageFinder関数をそのまま呼び出し
    processContactPageFinder();

    console.log('通常処理が完了しました');

  } catch (error) {
    console.error('通常処理エラー:', error);
    SpreadsheetApp.getUi().alert('エラー', `通常処理中にエラーが発生しました: ${error}`, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * チェック行のみ処理（新機能）
 */
function executeCheckedRowsProcessing(): void {
  console.log('=== チェック行処理開始 ===');

  try {
    const checkedRows = getCheckedRows();

    if (checkedRows.length === 0) {
      SpreadsheetApp.getUi().alert('チェックされた行がありません。');
      return;
    }

    // 各チェック行を順次処理
    let successCount = 0;
    let failureCount = 0;

    for (const rowNumber of checkedRows) {
      try {
        // L列からURL取得
        const url = getUrlFromRow(rowNumber!);

        if (!url || typeof url !== 'string' || url.trim() === '') {
          console.log(`${rowNumber}行目: URLが空です`);
          continue;
        }

        console.log(`${rowNumber}行目を処理中: ${url}`);

        // 既存のfindContactPage関数を使用
        const result: ContactPageResult = findContactPage(url);

        // AP列に結果を書き込み
        writeResultToSheet(rowNumber!, result);

        if (result.contactUrl) {
          successCount++;
        } else {
          failureCount++;
        }

      } catch (error) {
        console.error(`${rowNumber}行目の処理でエラー:`, error);
        failureCount++;
      }
    }

    // 完了メッセージ
    SpreadsheetApp.getUi().alert('処理完了', `チェック行処理が完了しました。成功: ${successCount}件、失敗: ${failureCount}件`, SpreadsheetApp.getUi().ButtonSet.OK);

  } catch (error) {
    console.error('チェック行処理エラー:', error);
    SpreadsheetApp.getUi().alert('エラー', `チェック行処理中にエラーが発生しました: ${error}`, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * 指定行のL列からURLを取得
 */
function getUrlFromRow(rowNumber: number): string {
  const sheet = SpreadsheetApp.getActiveSheet();
  const lColumn = 12; // L列

  const cellValue = sheet.getRange(rowNumber, lColumn).getValue();
  return cellValue ? cellValue.toString().trim() : '';
}

/**
 * 結果をAP列に書き込み（既存ロジックと完全に一致）
 */
function writeResultToSheet(rowNumber: number, result: ContactPageResult): void {
  const sheet = SpreadsheetApp.getActiveSheet();
  const apColumn = 42; // AP列

  // 既存のprocessContactPageFinderと完全に同じロジック
  let outputValue = '';

  // エラーの場合はエラーメッセージを出力
  if (result.searchMethod === 'error' || result.searchMethod === 'dns_error' || result.searchMethod === 'bot_blocked' || result.searchMethod === 'site_closed') {
    if (result.foundKeywords && result.foundKeywords.length > 0) {
      outputValue = result.foundKeywords[0] || 'エラーが発生しました'; // 詳細エラーメッセージ
    } else {
      outputValue = 'エラーが発生しました';
    }
  } else if (result.actualFormUrl) {
    // 実際のURLの場合はそのURL、識別子の場合はフォームが存在するページのURLを出力
    if (result.actualFormUrl.startsWith('http')) {
      outputValue = result.actualFormUrl;
    } else {
      // 識別子の場合、フォームが存在するページのURLを出力
      outputValue = result.contactUrl || '問い合わせフォームが見つかりませんでした';
    }
  } else if (result.contactUrl) {
    // actualFormUrlはないが、contactUrlがある場合
    outputValue = result.contactUrl;
  } else {
    // SNSページや見つからない場合
    outputValue = '問い合わせフォームが見つかりませんでした';
  }

  sheet.getRange(rowNumber, apColumn).setValue(outputValue);
}

/**
 * AQ列でチェックされた行番号一覧を取得
 */
function getCheckedRows(): number[] {
  try {
    console.log('SpreadsheetApp.getActiveSheet()実行中...');
    const sheet = SpreadsheetApp.getActiveSheet();
    console.log('アクティブシート取得完了');

    console.log('sheet.getLastRow()実行中...');
    const lastRow = sheet.getLastRow();
    console.log(`最終行: ${lastRow}`);

    // 処理行数を制限（パフォーマンス対策）
    const maxRowsToCheck = Math.min(lastRow, 1000);
    console.log(`チェック対象行数: ${maxRowsToCheck}`);

    const aqColumn = 43; // AQ列
    const checkedRows: number[] = [];

    console.log('チェックボックス値の確認開始...');
    for (let row = 2; row <= maxRowsToCheck; row++) {
      try {
        const checkboxValue = sheet.getRange(row, aqColumn).getValue();
        if (checkboxValue === true) {
          checkedRows.push(row);
        }
      } catch (error) {
        console.warn(`${row}行目のチェックボックス読み取りエラー:`, error);
        // 個別行のエラーは無視して続行
      }
    }

    console.log(`チェック済み行: ${checkedRows.length}行`, checkedRows);
    return checkedRows.filter((row): row is number => typeof row === 'number');
  } catch (error) {
    console.error('getCheckedRows()全体エラー:', error);
    return []; // 空配列を返す
  }
}

/**
 * チェックされた行数を取得
 */
function getCheckedRowsCount(): number {
  try {
    console.log('getCheckedRows()実行中...');
    const rows = getCheckedRows();
    console.log(`getCheckedRows()完了: ${rows.length}行`);
    return rows.length;
  } catch (error) {
    console.error('getCheckedRows()エラー:', error);
    return 0;
  }
}

/**
 * MAX_COUNT設定値を取得
 */
function getMaxCountSetting(): number {
  try {
    console.log('PropertiesService.getScriptProperties()実行中...');
    const properties = PropertiesService.getScriptProperties();
    console.log('プロパティサービス取得完了');

    console.log('MAX_COUNTプロパティ取得中...');
    const maxCountStr = properties.getProperty('MAX_COUNT');
    console.log(`MAX_COUNTプロパティ値: "${maxCountStr}"`);

    if (!maxCountStr) {
      console.log('MAX_COUNTが未設定、デフォルト値10を使用');
      return 10;
    }

    const parsed = parseInt(maxCountStr, 10);
    if (isNaN(parsed) || parsed <= 0) {
      console.log(`MAX_COUNTの値が無効: "${maxCountStr}", デフォルト値10を使用`);
      return 10;
    }

    console.log(`MAX_COUNT設定値: ${parsed}`);
    return parsed;
  } catch (error) {
    console.error('getMaxCountSetting()エラー:', error);
    return 10; // デフォルト値
  }
}

declare const global: any;

global.executeUrlFinderWithUI = executeUrlFinderWithUI;

