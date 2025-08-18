import { Environment } from './env';
import type { ContactPageResult } from './types/interfaces';
import { HIGH_PRIORITY_PATTERNS, EXCLUDED_KEYWORDS, HIGH_PRIORITY_CONTACT_KEYWORDS, MEDIUM_PRIORITY_CONTACT_KEYWORDS, SUBMIT_BUTTON_KEYWORDS, FORM_KEYWORDS } from './constants/ContactConstants';
import { SEARCH_PATTERNS, CONFIDENCE_LEVELS, NAVIGATION_SELECTORS, VALIDATION_PATTERNS, FORM_LINK_PATTERNS, FORM_TEXT_PATTERNS, NEGATIVE_KEYWORDS, HOMEPAGE_PATTERNS, CONTACT_LINK_KEYWORDS, GOOGLE_FORM_EXCLUDE_KEYWORDS, GOOGLE_FORM_CONTACT_KEYWORDS } from './constants/SearchConstants';
import { UrlUtils } from './utils/UrlUtils';
import { PurityUtils } from './utils/PurityUtils';
import { HtmlAnalyzer } from './analyzers/HtmlAnalyzer';
import { FormAnalyzer } from './analyzers/FormAnalyzer';
import { UrlPatternStrategy } from './strategies/UrlPatternStrategy';

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
class ContactPageFinder {

  // ==========================================
  // 状態管理・キャッシュシステム
  // ==========================================

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





  // ==========================================
  // SPA検出・同一HTML判定システム
  // ==========================================

  /**
   * 同一HTMLレスポンス検出キャッシュ
   * SPAサイトの効率的な検出用
   */
  private static sameHtmlCache: { [url: string]: string } = {};
  
  /**
   * 同一HTMLパターンの検出
   * 複数URLが同じHTMLを返す場合SPAと判定
   * @param urls 検証対象URL群
   * @param htmlContent HTML内容
   * @returns SPAの可能性がある場合true
   */
  private static detectSameHtmlPattern(urls: string[], htmlContent: string): boolean {
    const contentHash = UrlUtils.hashString(htmlContent);
    let sameCount = 0;
    
    for (const url of urls) {
      if (this.sameHtmlCache[url] === contentHash) {
        sameCount++;
      } else {
        this.sameHtmlCache[url] = contentHash;
      }
    }
    
    // 2つ以上のURLが同じHTMLを返す場合SPAと判定
    return sameCount >= 2;
  }

  // ==========================================
  // フォールバック検索システム
  // ==========================================

  /**
   * 最終フォールバック処理
   * Step1の200 OK URLを最終手段として返却
   * @returns 最終フォールバック結果
   */
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

    // 高優先度contact patternを探す
    for (const priorityPattern of SEARCH_PATTERNS.CONTACT_PRIORITY) {
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

  /**
   * フォールバックURL品質評価
   * URLパターンに基づく信頼度スコアリング
   * @param url 評価対象URL
   * @param pattern マッチしたパターン
   * @returns 信頼度とキーワード配列
   */
  private static evaluateFallbackUrlQuality(url: string, pattern: string): { confidence: number, keywords: string[] } {
    return PurityUtils.evaluateUrlQuality(url, pattern);
  }


  // ==========================================
  // SPA解析・アンカーリンク処理システム
  // ==========================================

  /**
   * SPA解析実行
   * Single Page Applicationで検出されたアンカーリンクを解析
   * @param html SPA HTML内容
   * @param baseUrl ベースURL
   * @returns SPA解析結果
   */
  private static executeSPAAnalysis(html: string, baseUrl: string): ContactPageResult {
    try {
      console.log('Executing SPA analysis on detected single-page application');
      
      // Navigation search for anchor links in the current HTML
      const navResult = this.searchInNavigation(html, baseUrl);
      if (navResult.url && UrlUtils.isAnchorLink(navResult.url)) {
        console.log(`Anchor link found in SPA navigation: ${navResult.url}`);
        
        // Analyze the corresponding section in the same HTML
        const anchorSectionResult = this.analyzeAnchorSection(html, navResult.url, baseUrl);
        if (anchorSectionResult.contactUrl) {
          // Update search method to reflect SPA detection
          anchorSectionResult.searchMethod = 'spa_anchor_analysis';
          anchorSectionResult.foundKeywords.push('spa_detected');
          return anchorSectionResult;
        }
      }

      // No anchor contact links found in SPA
      console.log('SPA analysis completed but no suitable anchor contact found');
      return {
        contactUrl: null,
        actualFormUrl: null,
        foundKeywords: ['spa_detected', 'anchor_analysis_failed'],
        searchMethod: 'spa_analysis_failed'
      };
    } catch (error) {
      console.log(`Error in SPA analysis: ${error}`);
      return {
        contactUrl: null,
        actualFormUrl: null,
        foundKeywords: ['spa_detected', 'spa_analysis_error'],
        searchMethod: 'spa_analysis_error'
      };
    }
  }

  /**
   * アンカーセクション解析
   * HTMLページ内の特定アンカーセクションを解析
   * @param html 対象HTML
   * @param anchorUrl アンカーURL（#contact等）
   * @param baseUrl ベースURL
   * @returns アンカーセクション解析結果
   */
  private static analyzeAnchorSection(html: string, anchorUrl: string, baseUrl: string): ContactPageResult {
    try {
      // Extract anchor name from URL (e.g., "#contact" -> "contact")
      const anchorMatch = anchorUrl.match(/#(.+)$/);
      if (!anchorMatch) {
        console.log('No anchor fragment found in URL');
        return { contactUrl: null, actualFormUrl: null, foundKeywords: [], searchMethod: 'anchor_parse_failed' };
      }

      const anchorId = anchorMatch[1];
      console.log(`Analyzing section for anchor: ${anchorId}`);

      // Look for the corresponding section with id or name
      const sectionPatterns = [
        new RegExp(`<[^>]+id=["']${anchorId}["'][^>]*>[\s\S]*?(?=<[^>]+id=["']|$)`, 'i'),
        new RegExp(`<[^>]+name=["']${anchorId}["'][^>]*>[\s\S]*?(?=<[^>]+name=["']|$)`, 'i'),
        new RegExp(`<section[^>]*>[\s\S]*?${anchorId}[\s\S]*?</section>`, 'i'),
        new RegExp(`<div[^>]*contact[^>]*>[\s\S]*?</div>`, 'i')
      ];

      let sectionContent = '';
      for (const pattern of sectionPatterns) {
        const match = html.match(pattern);
        if (match) {
          sectionContent = match[0];
          console.log(`Found section content: ${sectionContent.length} characters`);
          break;
        }
      }

      if (!sectionContent) {
        // Fallback: search around anchor keywords in the entire HTML
        for (const keyword of SEARCH_PATTERNS.CONTACT_KEYWORDS) {
          const keywordIndex = html.toLowerCase().indexOf(keyword);
          if (keywordIndex !== -1) {
            // Extract surrounding content (2000 characters)
            const start = Math.max(0, keywordIndex - 1000);
            const end = Math.min(html.length, keywordIndex + 1000);
            sectionContent = html.substring(start, end);
            console.log(`Found contact content around keyword '${keyword}': ${sectionContent.length} characters`);
            break;
          }
        }
      }

      if (sectionContent) {
        // Analyze section for contact information
        const contactInfo = HtmlAnalyzer.extractContactInfo(sectionContent);
        const hasForm = FormAnalyzer.isValidContactForm(sectionContent);
        const googleForms = FormAnalyzer.detectGoogleForms(sectionContent);

        // Calculate confidence score
        let score = 10; // Base score for having a contact section
        const keywords = ['anchor_section_detected'];

        if (contactInfo.phone) {
          score += 5;
          keywords.push('phone_number_found');
        }
        if (contactInfo.email) {
          score += 5;
          keywords.push('email_found');
        }
        if (contactInfo.contactForm) {
          score += 8;
          keywords.push('contact_form_mentioned');
        }
        if (hasForm) {
          score += 10;
          keywords.push('html_form_found');
        }
        if (googleForms.found) {
          score += 10;
          keywords.push('google_forms_found');
        }

        console.log(`Anchor section analysis complete. Score: ${score}, Keywords: ${keywords.join(', ')}`);

        // If sufficient contact information found, return the base URL
        if (score >= 15) {
          console.log(`✅ Sufficient contact information found in anchor section (score: ${score})`);
          return {
            contactUrl: baseUrl,
            actualFormUrl: googleForms.found ? googleForms.url : baseUrl,
            foundKeywords: keywords,
            searchMethod: 'anchor_section_analysis'
          };
        }
      }

      console.log('No sufficient contact information found in anchor section');
      return {
        contactUrl: null,
        actualFormUrl: null,
        foundKeywords: [],
        searchMethod: 'anchor_section_insufficient'
      };
    } catch (error) {
      console.log(`Error analyzing anchor section: ${error}`);
      return {
        contactUrl: null,
        actualFormUrl: null,
        foundKeywords: [],
        searchMethod: 'anchor_section_error'
      };
    }
  }

  // ==========================================
  // メイン検索エントリーポイント
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
      // 初期化・検証処理
      const initResult = this.initializeContactSearch(baseUrl);
      if (initResult) {
        return initResult; // 早期return（SNS/ドメイン無効の場合）
      }

      // Extract domain for subdirectory pattern support
      const domainUrl = UrlUtils.extractDomain(baseUrl);

      console.log(`Starting contact page search for: ${baseUrl}`);

      // STEP 1: URL pattern guessing with integrated SPA detection (HIGHEST PRIORITY - Fast & Accurate)
      console.log('Step 1: URL pattern guessing with SPA optimization (primary strategy)');
      const urlPatternStrategy = new UrlPatternStrategy();
      const strategyResult = urlPatternStrategy.searchDetailed(domainUrl);
      
      if (strategyResult) {
        const priorityResult = strategyResult.result;
        // 有効URLリストを更新
        this.validUrls = strategyResult.validUrls;
        
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

      // STEP 2: Homepage HTML analysis (FALLBACK for special cases like ye-p.co.jp)
      console.log('Step 2: Homepage HTML analysis as fallback for special cases');
      try {
        const response = this.fetchWithTimeout(baseUrl, 7000); // 7秒タイムアウト
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
        const detailedError = this.getDetailedNetworkError(homepageError);
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
      const detailedError = this.getDetailedNetworkError(error);
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
   * 初期化・検証処理
   * SNS判定とドメイン生存確認を実行
   * @param baseUrl 検証対象URL
   * @returns 早期終了の場合は結果、継続の場合はnull
   */
  private static initializeContactSearch(baseUrl: string): ContactPageResult | null {
    // 候補リストのリセット（新しい検索開始時）
    this.resetCandidates();

    // SNSページの検出
    if (UrlUtils.isSNSPage(baseUrl)) {
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
    const domainCheck = this.checkDomainAvailability(baseUrl);
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

    return null; // 継続処理
  }

  // ==========================================
  // HTML解析・フォールバック検索システム
  // ==========================================

  /**
   * Step2: ホームページHTML解析によるフォールバック検索
   * 
   * 【処理手順】
   * 1. Google Forms最優先検索（HTML内のdocs.google.com URL検出）
   * 2. 埋め込みフォーム検証（外部サービス: Form.run, HubSpot等）
   * 3. ナビゲーション内リンク解析（<nav>要素、メニュー系クラス解析）
   * 4. リンク先フォーム検証（発見したリンクの実際の内容確認）
   * 5. 重複回避処理（Step1成功URLとの重複チェック）
   * 
   * 【検索範囲】
   * - Navigation（<nav>、.menu、.navigation等）
   * - Header内のリスト構造（<header><ul>構造）
   * - グローバルナビゲーション（.global-nav、.site-nav等）
   * 
   * 【特別処理】
   * - アンカーリンク特別処理（#contact等の内部リンク）
   * - JavaScript無効環境でのフォーム検出
   * - 動的コンテンツの静的解析
   * 
   * 【品質保証】
   * - キーワードマッチング重み付けスコア
   * - コンテキストボーナス（navigation内 +5点）
   * - 早期終了による高信頼度結果優先
   * 
   * @param html 解析対象HTML
   * @param baseUrl ベースURL
   * @returns HTML解析結果
   */
  private static analyzeHtmlContent(html: string, baseUrl: string): ContactPageResult {
    console.log('=== Starting navigation-only HTML analysis ===');

    // Navigation search only
    console.log('Stage 1: Navigation search');
    const navResult = this.searchInNavigation(html, baseUrl);
    if (navResult.url && navResult.score > 0) {
      console.log(`Navigation search result: ${navResult.url} (score: ${navResult.score}, reasons: ${navResult.reasons.join(',')})`);

      // 重複回避チェック：Step1で成功したフォームURLのみスキップ（失敗したURLは再検証）
      const isSuccessfulFormDuplicate = this.successfulFormUrls.includes(navResult.url);
      if (isSuccessfulFormDuplicate) {
        console.log(`⏭ Skipping duplicate URL (already succeeded in Step1): ${navResult.url}`);
      } else {
        // Check if this is an anchor link for special processing
        if (UrlUtils.isAnchorLink(navResult.url)) {
          console.log(`🔍 Anchor link detected: ${navResult.url}, analyzing section content`);
          const anchorSectionResult = this.analyzeAnchorSection(html, navResult.url, baseUrl);
          if (anchorSectionResult.contactUrl) {
            console.log(`✅ Found contact info in anchor section: ${anchorSectionResult.contactUrl}`);
            return anchorSectionResult;
          }
        }

        // 新規URLの場合：実際にアクセスしてform検証+Google Forms検証
        console.log(`🔍 New URL found, performing detailed validation: ${navResult.url}`);

        try {
          const response = this.fetchWithTimeout(navResult.url, 5000);
          if (response.getResponseCode() === 200) {
            const candidateHtml = response.getContentText();

            // A. 標準フォーム検証
            const isValidForm = FormAnalyzer.isValidContactForm(candidateHtml);
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
            const googleFormsResult = FormAnalyzer.detectGoogleForms(candidateHtml);
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

  // ==========================================
  // ナビゲーション解析システム
  // ==========================================

  /**
   * ナビゲーション内検索
   * ページのナビゲーション要素から問い合わせリンクを検索
   * @param html 検索対象HTML
   * @param baseUrl ベースURL
   * @returns ナビゲーション検索結果
   */
  private static searchInNavigation(html: string, baseUrl: string): { url: string | null, keywords: string[], score: number, reasons: string[] } {
    // ナビゲーション要素の選択パターン

    console.log('Searching in navigation with 9 selectors (including #naviArea, .nav, .navigation, .menu)...');

    let totalMatches = 0;
    let allCandidates: Array<{ url: string, keywords: string[], score: number, reasons: string[] }> = [];

    for (let i = 0; i < NAVIGATION_SELECTORS.length; i++) {
      const regex = NAVIGATION_SELECTORS[i];
      if (!regex) continue;

      const matches = html.match(regex) || [];
      console.log(`Navigation selector ${i+1}: Found ${matches.length} matches`);
      totalMatches += matches.length;

      for (let j = 0; j < matches.length; j++) {
        const match = matches[j];
        if (!match) continue;

        console.log(`Analyzing navigation match ${j+1} (${match.length} chars): ${match.substring(0, 100)}...`);

        // 新フロー: 全リンクを抽出してキーワードフィルタリング
        const candidates = HtmlAnalyzer.extractAllContactLinks(match, baseUrl);
        allCandidates.push(...candidates);
        console.log(`Navigation match ${j+1} added ${candidates.length} candidates`);
      }
    }

    // 全リンクからキーワード含有リンクのみを選別
    const contactLinks = allCandidates.filter(candidate =>
      HIGH_PRIORITY_CONTACT_KEYWORDS.some(keyword =>
        candidate.url.toLowerCase().includes(keyword.toLowerCase()) ||
        candidate.keywords.some(k => k.toLowerCase().includes(keyword.toLowerCase()))
      )
    );

    console.log(`Found ${allCandidates.length} total candidates, ${contactLinks.length} with contact keywords`);

    // キーワード含有リンクがあれば最高スコアを選択
    if (contactLinks.length > 0) {
      const best = contactLinks.reduce((max, current) => current.score > max.score ? current : max);
      console.log(`Navigation search best result: ${best.url} (score: ${best.score})`);
      return best;
    }

    console.log(`Navigation search complete: processed ${totalMatches} matches, no contact-related candidates found`);
    return { url: null, keywords: [], score: 0, reasons: [] };
  }

  // ==========================================
  // リンク抽出・解析システム
  // ==========================================







  /**
   * 問い合わせリンク抽出
   * HTML内容から問い合わせ関連リンクを抽出・解析
   * @param content 解析対象HTML内容
   * @param baseUrl ベースURL
   * @param contextType コンテキストタイプ（general/navigation等）
   * @returns 抽出されたリンク情報
   */
  private static extractContactLinks(content: string, baseUrl: string, contextType: string = 'general'): { url: string | null, keywords: string[], score: number, reasons: string[], linkText: string } {
    const candidates: Array<{ url: string, keywords: string[], score: number, reasons: string[], linkText: string }> = [];
    const linkRegex = /<a[^>]*href=['"]([^'\"]*?)['"][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    let linksProcessed = 0;

    console.log(`Starting link extraction from HTML content (context: ${contextType})`);

    while ((match = linkRegex.exec(content)) !== null) {
      const url = match[1];
      const linkText = match[2];
      linksProcessed++;

      if (!url || !linkText) continue;

      const cleanLinkText = linkText.replace(/<[^>]*>/g, '').trim();
      console.log(`Processing link ${linksProcessed}: "${cleanLinkText}" -> ${url}`);

      // Special debug for /contact/ links
      if (url.includes('/contact') || cleanLinkText.toLowerCase().includes('contact')) {
        console.log(`🎯 CONTACT LINK DETECTED: "${cleanLinkText}" -> ${url}`);
      }

      // Skip non-web URLs
      if (url.startsWith('mailto:') || url.startsWith('javascript:') || url.startsWith('tel:')) {
        continue;
      }

      // Calculate contact purity score
      const purityResult = HtmlAnalyzer.calculateContactPurity(url, cleanLinkText);
      let totalScore = purityResult.score;
      let allReasons = [...purityResult.reasons];

      // Context bonus (expanded)
      if (contextType === 'navigation') {
        totalScore += 5;
        allReasons.push('navigation_context_bonus');
      } else if (contextType === 'footer') {
        totalScore += 3;
        allReasons.push('footer_context_bonus');
      } else if (contextType === 'sidebar') {
        totalScore += 2;
        allReasons.push('sidebar_context_bonus');
      } else if (contextType === 'mobile_menu') {
        totalScore += 4;
        allReasons.push('mobile_menu_context_bonus');
      }

      // Log all candidates for debugging (including negative scores)
      console.log(`Link candidate: "${cleanLinkText}" -> ${url} (score: ${totalScore}, reasons: ${allReasons.join(',')})`);

      // Only consider candidates with positive scores
      if (totalScore > 0) {
        const fullUrl = UrlUtils.resolveUrl(url, baseUrl);
        candidates.push({
          url: fullUrl,
          keywords: purityResult.reasons.map(r => r.split(':')[1] || r),
          score: totalScore,
          reasons: allReasons,
          linkText: cleanLinkText
        });

        console.log(`✓ Contact link candidate: "${cleanLinkText}" -> ${fullUrl} (score: ${totalScore}, reasons: ${allReasons.join(',')})`);

        // Early termination for high confidence candidates
        if (totalScore >= Environment.getHighConfidenceThreshold()) {
          console.log(`✅ HIGH CONFIDENCE contact link found: ${fullUrl} (score: ${totalScore}) - terminating search early`);
          return {
            url: fullUrl,
            keywords: purityResult.reasons.map(r => r.split(':')[1] || r),
            score: totalScore,
            reasons: allReasons,
            linkText: cleanLinkText
          };
        }
      } else {
        console.log(`✗ Link excluded: "${cleanLinkText}" -> ${url} (score: ${totalScore}, reasons: ${allReasons.join(',')})`);
      }
    }

    console.log(`Link extraction completed: processed ${linksProcessed} links, found ${candidates.length} candidates`);

    // Return best candidate if any
    if (candidates.length > 0) {
      const sortedCandidates = candidates.sort((a, b) => b.score - a.score);
      const bestCandidate = sortedCandidates[0];
      if (bestCandidate) {
        console.log(`Best candidate selected: ${bestCandidate.url} (score: ${bestCandidate.score})`);
        return {
          url: bestCandidate.url,
          keywords: bestCandidate.keywords,
          score: bestCandidate.score,
          reasons: bestCandidate.reasons,
          linkText: bestCandidate.linkText
        };
      }
    }

    return { url: null, keywords: [], score: 0, reasons: [], linkText: '' };
  }


  private static findActualForm(contactPageUrl: string): string | null {
    try {
      const response = this.fetchWithTimeout(contactPageUrl, 5000); // 5秒タイムアウト
      const html = response.getContentText();

      // 1. まず、Google Formsを最優先で検索
      const googleFormUrl = FormAnalyzer.findGoogleFormUrlsOnly(html);
      if (googleFormUrl && googleFormUrl.startsWith('http')) {
        console.log(`Found Google Form in contact page: ${googleFormUrl}`);
        return googleFormUrl;
      }

      // 2. 埋め込みフォームの検出
      const embeddedForm = FormAnalyzer.findEmbeddedHTMLForm(html);
      if (embeddedForm) {
        console.log(`Found embedded form in contact page`);
        return contactPageUrl; // Fix: Return actual contact page URL instead of placeholder
      }

      // 3. ２段階リンク検出: より詳細なフォームページへのリンクを探す
      const secondStageFormUrl = this.findSecondStageFormLink(html, contactPageUrl);
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

  // ２段階リンク検出の新メソッド
  private static findSecondStageFormLink(html: string, contactPageUrl: string): string | null {
    // フォームページを示唆するキーワードパターン（BtoB営業用途に特化）

    // より具体的なテキストパターン（一般問い合わせ限定）

    const linkRegex = /<a[^>]*href=['"]([^'\"]*?)['"][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    const candidateLinks: Array<{url: string, score: number, reason: string}> = [];

    while ((match = linkRegex.exec(html)) !== null) {
      const url = match[1];
      const linkText = match[2];

      if (!url || !linkText) continue;

      // 無効なURLをスキップ
      if (url.startsWith('mailto:') || url.startsWith('javascript:') || url.startsWith('tel:')) continue;

      const cleanLinkText = linkText.replace(/<[^>]*>/g, '').trim().toLowerCase();
      const lowerUrl = url.toLowerCase();

      let score = 0;
      const reasons: string[] = [];

      // ネガティブキーワードチェック（BtoB営業に不適切なページを除外）
      const hasNegativeKeyword = NEGATIVE_KEYWORDS.some(keyword =>
        lowerUrl.includes(keyword.toLowerCase()) || cleanLinkText.includes(keyword.toLowerCase())
      );

      if (hasNegativeKeyword) {
        console.log(`Skipping link due to negative keyword: ${url}`);
        continue; // このリンクをスキップ
      }

      // トップページ除外チェック（２段階リンク検出の精度向上）
      if (this.isHomepageUrl(url, contactPageUrl)) {
        console.log(`Skipping homepage URL: ${url}`);
        continue; // トップページリンクをスキップ
      }

      // URL内のフォームパターンをチェック
      for (const pattern of FORM_LINK_PATTERNS) {
        if (lowerUrl.includes(pattern.toLowerCase())) {
          score += 3; // URL内のパターンは高スコア
          reasons.push(`url_pattern:${pattern}`);
        }
      }

      // リンクテキスト内のフォームパターンをチェック
      for (const pattern of FORM_TEXT_PATTERNS) {
        if (cleanLinkText.includes(pattern.toLowerCase())) {
          score += 2; // テキストパターンは中スコア
          reasons.push(`text_pattern:${pattern}`);
        }
      }

      // 一般的なフォームキーワードもチェック（低スコア）
      for (const keyword of FORM_KEYWORDS) {
        if (cleanLinkText.includes(keyword.toLowerCase()) || lowerUrl.includes(keyword.toLowerCase())) {
          score += 1;
          reasons.push(`keyword:${keyword}`);
        }
      }

      // スコアが1以上の場合候補として追加
      if (score > 0) {
        const fullUrl = UrlUtils.resolveUrl(url, contactPageUrl);
        candidateLinks.push({
          url: fullUrl,
          score: score,
          reason: reasons.join(',')
        });
        console.log(`Form link candidate: ${fullUrl}, score: ${score}, reasons: ${reasons.join(',')}`);
      }
    }

    // 候補がない場合は終了
    if (candidateLinks.length === 0) {
      return null;
    }

    // スコア順でソート（降順）
    candidateLinks.sort((a, b) => b.score - a.score);

    // 最高スコアのリンクを検証
    for (const candidate of candidateLinks.slice(0, 3)) { // 上位3件まで検証
      try {
        console.log(`Validating form link candidate: ${candidate.url} (score: ${candidate.score})`);
        const response = this.fetchWithTimeout(candidate.url, 3000); // 3秒タイムアウト

        if (response.getResponseCode() === 200) {
          const candidateHtml = response.getContentText();

          // 実際にフォームが存在するかチェック
          const hasGoogleForm = FormAnalyzer.findGoogleFormUrlsOnly(candidateHtml);
          const hasEmbeddedForm = FormAnalyzer.findEmbeddedHTMLForm(candidateHtml);

          if (hasGoogleForm && hasGoogleForm.startsWith('http')) {
            console.log(`Validated: Google Form found at ${candidate.url} -> ${hasGoogleForm}`);
            return hasGoogleForm;
          }

          if (hasEmbeddedForm) {
            console.log(`Validated: Embedded form found at ${candidate.url}`);
            return candidate.url;
          }

          // より寛容な検証：フォーム関連コンテンツの存在確認
          const hasFormContent = FormAnalyzer.hasSignificantFormContent(candidateHtml);
          if (hasFormContent) {
            console.log(`Validated: Form content found at ${candidate.url}`);
            return candidate.url;
          }
        }
      } catch (error) {
        console.log(`Error validating candidate ${candidate.url}: ${error}`);
        continue;
      }
    }

    return null;
  }

  // ==========================================
  // ユーティリティ・補助機能システム
  // ==========================================

  /**
   * トップページURL判定
   * ２段階リンク検出での除外用判定
   * @param url 判定対象URL
   * @param baseUrl ベースURL
   * @returns トップページの場合true
   */
  private static isHomepageUrl(url: string, baseUrl: string): boolean {
    return PurityUtils.isHomepageUrl(url, baseUrl);
  }










  // ==========================================
  // 候補管理・スコアリングシステム
  // ==========================================

  /**
   * 潜在的候補ページの記録
   * Step1で発見されたが確定できなかった候補を記録・評価
   * @param url 候補URL
   * @param reason 候補理由
   * @param html ページHTML内容
   */
  private static logPotentialCandidate(url: string, reason: string, html: string) {
    const structuredAnalysis = FormAnalyzer.analyzeStructuredForms(html);
    const formAnalysis = FormAnalyzer.analyzeFormElements(html);

    const score = this.calculateCandidateScore(url, reason, structuredAnalysis, formAnalysis);

    this.candidatePages.push({
      url,
      reason,
      score,
      structuredForms: structuredAnalysis.formCount,
      legacyScore: formAnalysis.isValidForm ? 1 : 0
    });

    console.log(`Candidate logged: ${url} (${reason}, score: ${score})`);
  }

  /**
   * 候補スコア計算
   * 候補ページの品質をURL、フォーム分析結果に基づいて数値化
   * @param url 候補URL
   * @param reason 候補理由
   * @param structuredAnalysis 構造化フォーム解析結果
   * @param formAnalysis フォーム解析結果
   * @returns 計算されたスコア
   */
  private static calculateCandidateScore(
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
   * 候補リストのリセット
   * 新しい検索開始時に全候補データをクリア
   */
  private static resetCandidates() {
    this.candidatePages = [];
    this.validUrls = [];
    this.successfulFormUrls = [];
    this.sameHtmlCache = {}; // Reset SPA detection cache
  }

  /**
   * 問い合わせ関連リンク存在チェック
   * ページ内に問い合わせ関連のリンクが存在するかチェック（BtoB営業用途特化）
   * @param html 検索対象HTML
   * @returns リンク存在情報とリンクテキスト配列
   */
  private static hasContactRelatedLinks(html: string): { hasLinks: boolean, linkTexts: string[] } {

    const linkRegex = /<a[^>]*href=['"]([^'\"]*?)['"][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    const foundLinkTexts: string[] = [];

    while ((match = linkRegex.exec(html)) !== null) {
      const url = match[1];
      const linkText = match[2];

      if (!url || !linkText) continue;

      // 無効なURLをスキップ
      if (url.startsWith('mailto:') || url.startsWith('javascript:') || url.startsWith('tel:')) continue;

      const cleanLinkText = linkText.replace(/<[^>]*>/g, '').trim().toLowerCase();
      const lowerUrl = url.toLowerCase();

      // URLまたはリンクテキストに問い合わせ関連キーワードが含まれているかチェック
      for (const keyword of CONTACT_LINK_KEYWORDS) {
        if (cleanLinkText.includes(keyword.toLowerCase()) || lowerUrl.includes(keyword.toLowerCase())) {
          foundLinkTexts.push(cleanLinkText || url);
          console.log(`Contact link found: "${cleanLinkText}" -> ${url}`);
          break; // 同じリンクで複数キーワードがマッチしても1回だけカウント
        }
      }
    }

    return {
      hasLinks: foundLinkTexts.length > 0,
      linkTexts: foundLinkTexts
    };
  }


  // Google FormsのURLのみを検出（埋め込みフォーム検出は除外）



  // ==========================================
  // HTTP通信・エラーハンドリングシステム
  // ==========================================

  /**
   * タイムアウト付きHTTP取得
   * GAS環境でのHTTPリクエスト実行（タイムアウト管理）
   * @param url 取得対象URL
   * @param _timeoutMs タイムアウト時間（ms）※GASでは利用不可
   * @returns HTTPレスポンス
   */
  private static fetchWithTimeout(url: string, _timeoutMs: number = 5000) {
    try {
      // GASのUrlFetchAppはtimeoutオプションをサポートしていないため、
      // デフォルトのタイムアウト（約20-30秒）が適用される
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


  private static isValidContactPage(html: string): boolean {
    // 404ページや無効なページを除外（より厳密なパターンに変更）

    const lowerHtml = html.toLowerCase();
    const hasInvalidContent = VALIDATION_PATTERNS.INVALID_PAGE.some(pattern =>
      lowerHtml.includes(pattern.toLowerCase())
    );

    // 最低限のコンテンツ長チェック
    const hasMinimumContent = html.length > VALIDATION_PATTERNS.MINIMUM_CONTENT_LENGTH;

    console.log(`Validity check - hasInvalidContent: ${hasInvalidContent}, hasMinimumContent: ${hasMinimumContent}, length: ${html.length}`);
    if (hasInvalidContent) {
      const matchedPattern = VALIDATION_PATTERNS.INVALID_PAGE.find(pattern => lowerHtml.includes(pattern.toLowerCase()));
      console.log(`Invalid pattern found: ${matchedPattern}`);
    }

    return !hasInvalidContent && hasMinimumContent;
  }

  // ==========================================
  // フォーム検証・内容解析システム
  // ==========================================

  /**
   * 問い合わせページ内容検証
   * ページHTMLから実際のフォームURLを検出・検証
   * @param html ページHTML内容
   * @param pageUrl ページURL
   * @returns 検証結果（フォームURLとキーワード）
   */
  private static validateContactPageContent(html: string, pageUrl: string): { actualFormUrl: string | null, keywords: string[] } {
    // 1. 埋め込みHTMLフォーム検索（最優先）
    const embeddedForm = FormAnalyzer.findEmbeddedHTMLForm(html);
    if (embeddedForm) {
      return { actualFormUrl: pageUrl, keywords: ['embedded_form'] };
    }

    // 2. 統合検証：フォーム関連コンテンツ + キーワード + 送信要素
    const formAnalysis = FormAnalyzer.analyzeFormElements(html);
    if (formAnalysis.isValidForm) {
      console.log(`Integrated form validation successful: ${formAnalysis.reasons.join(',')}`);
      return { actualFormUrl: pageUrl, keywords: formAnalysis.keywords };
    }

    // 4. Google Forms検索（検証付き - 優先度を下げる）
    const googleFormUrl = FormAnalyzer.findGoogleFormUrlsOnly(html);
    if (googleFormUrl && googleFormUrl.startsWith('http')) {
      // Google Formの内容を検証して除外すべきフォームかチェック
      const isValidContactForm = this.validateGoogleFormContent(html, googleFormUrl);
      if (isValidContactForm) {
        console.log(`Valid Google Form found: ${googleFormUrl}`);
        return { actualFormUrl: googleFormUrl, keywords: ['google_form'] };
      } else {
        console.log(`Google Form found but excluded (likely recruitment/other): ${googleFormUrl}`);
      }
    }

    // 5. ２段階リンク検出（他ページ探索 - fallback）
    const secondStageFormUrl = this.findSecondStageFormLink(html, pageUrl);
    if (secondStageFormUrl) {
      return { actualFormUrl: secondStageFormUrl, keywords: ['second_stage_form'] };
    }

    // 6. ページ内リンク存在チェック（中間ページ判定）
    const hasContactLinks = this.hasContactRelatedLinks(html);
    if (hasContactLinks.hasLinks) {
      console.log(`Contact-related links found: ${hasContactLinks.linkTexts.join(',')}`);
      console.log('Page has contact links but no actual forms - suggesting this is an intermediate page');
      return { actualFormUrl: null, keywords: ['has_contact_links_but_no_forms'] };
    }

    return { actualFormUrl: null, keywords: [] };
  }

  /**
   * Google Form内容検証
   * Google Formが問い合わせフォームかどうか判定（採用・アンケート等を除外）
   * @param html ページHTML内容
   * @param googleFormUrl Google FormのURL
   * @returns 有効な問い合わせフォームの場合true
   */
  private static validateGoogleFormContent(html: string, googleFormUrl: string): boolean {
    // 除外すべきキーワード（BtoB営業用途に関係ないフォーム）

    // 問い合わせ関連キーワード

    const lowerHtml = html.toLowerCase();

    // Google Formの周辺コンテキストを抽出（フォームURLの前後1000文字）
    const formUrlIndex = html.indexOf(googleFormUrl);
    const contextStart = Math.max(0, formUrlIndex - 1000);
    const contextEnd = Math.min(html.length, formUrlIndex + googleFormUrl.length + 1000);
    const context = html.substring(contextStart, contextEnd).toLowerCase();

    // 除外キーワードが含まれているかチェック
    const hasExcludeKeyword = GOOGLE_FORM_EXCLUDE_KEYWORDS.some(keyword =>
      context.includes(keyword.toLowerCase())
    );

    if (hasExcludeKeyword) {
      console.log(`Google Form excluded due to keywords: ${GOOGLE_FORM_EXCLUDE_KEYWORDS.filter(k => context.includes(k.toLowerCase())).join(',')}`);
      return false;
    }

    // 問い合わせ関連キーワードの存在確認
    const hasContactKeyword = GOOGLE_FORM_CONTACT_KEYWORDS.some(keyword =>
      context.includes(keyword.toLowerCase())
    );

    if (hasContactKeyword) {
      console.log(`Google Form validated with contact keywords: ${GOOGLE_FORM_CONTACT_KEYWORDS.filter(k => context.includes(k.toLowerCase())).join(',')}`);
      return true;
    }

    // コンテキストが不明な場合は、より広範囲でチェック
    const hasPageLevelContactKeyword = GOOGLE_FORM_CONTACT_KEYWORDS.some(keyword =>
      lowerHtml.includes(keyword.toLowerCase())
    );

    if (hasPageLevelContactKeyword) {
      console.log(`Google Form validated with page-level contact keywords`);
      return true;
    }

    // 明確な問い合わせ関連キーワードがない場合は除外
    console.log(`Google Form excluded - no clear contact context found`);
    return false;
  }

  private static getDetailedErrorMessage(statusCode: number): string {
    return PurityUtils.getDetailedErrorMessage(statusCode);
  }

  /**
   * 詳細ネットワークエラー解析
   * エラーオブジェクトから詳細なエラー原因を特定
   * @param error エラーオブジェクト
   * @returns 詳細エラーメッセージ
   */
  private static getDetailedNetworkError(error: any): string {
    return PurityUtils.getDetailedNetworkError(error);
  }

  private static checkDomainAvailability(baseUrl: string): { available: boolean, error?: string } {
    try {
      console.log(`Testing domain availability: ${baseUrl}`);
      const response = this.fetchWithTimeout(baseUrl, 3000); // 3秒タイムアウト
      const statusCode = response.getResponseCode();

      console.log(`Domain check status: ${statusCode}`);

      // 200-399は正常、404は閉鎖
      if (statusCode >= 200 && statusCode < 400) {
        return { available: true };
      } else if (statusCode === 404) {
        return { available: false, error: 'サイトが見つかりません（404）' };
      } else {
        // その他のステータスコードは生存とみなす（後続処理で詳細エラー判定）
        return { available: true };
      }
    } catch (error) {
      const detailedError = this.getDetailedNetworkError(error);
      console.log(`Domain check error: ${detailedError}`);

      // 明確に閉鎖を示すエラーの場合は閉鎖とみなす
      if (detailedError.includes('DNS解決失敗') ||
          detailedError.includes('接続拒否') ||
          detailedError.includes('SSL/TLS証明書エラー') ||
          detailedError.includes('ホスト到達不可') ||
          detailedError.includes('GASエラー')) {
        return { available: false, error: detailedError };
      }

      // その他のエラー（タイムアウト等）は一時的な問題として処理続行
      return { available: true };
    }
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
 * テスト用関数
 * 任意のURLでContactPageFinderの動作をテスト
 */
function test() {
  // テスト用URL（任意に変更可能）
  const testUrl = 'https://www.alleyoop.co.jp/';

  console.log(`\n=== URLFinder テスト実行: ${testUrl} ===`);
  const result = findContactPage(testUrl);

  console.log('=== Contact Page Finder Results ===');
  console.log(`Target URL: ${testUrl}`);
  console.log(`Contact URL: ${result.contactUrl}`);
  console.log(`Actual Form URL: ${result.actualFormUrl}`);
  console.log(`Found Keywords: ${result.foundKeywords.join(',')}`);
  console.log(`Search Method: ${result.searchMethod}`);
  console.log('=====================================');
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

