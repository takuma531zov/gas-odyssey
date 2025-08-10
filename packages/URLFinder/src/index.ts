interface ContactPageResult {
  contactUrl: string | null;
  actualFormUrl: string | null;
  foundKeywords: string[];
  searchMethod: string;
}

class ContactPageFinder {
// 候補ページ記録システム
private static candidatePages: Array<{
  url: string,
  reason: string,
  score: number,
  structuredForms: number,
  legacyScore: number
}> = [];

// 200 OK URLリスト（フォールバック用）
private static validUrls: Array<{ url: string, pattern: string }> = [];

// 成功したフォームURLリスト（Step2重複回避用）
private static successfulFormUrls: Array<string> = [];

// BtoB問い合わせ特化：純粋な問い合わせキーワードのみ
private static readonly HIGH_PRIORITY_CONTACT_KEYWORDS = [
  // 直接的問い合わせ（最高優先度）
  'contact', 'contact us', 'contact form', 'inquiry', 'enquiry',
  'get in touch', 'reach out', 'send message', 'message us',
  'お問い合わせ', '問い合わせ', 'お問合せ', '問合せ',
  'ご相談', '相談', 'お客様窓口', 'お問い合わせフォーム',
  'お問い合わせはこちら', '問い合わせフォーム',
  // フォーム関連を追加
  'form', 'フォーム',
  // URL内検索用（日本語エンコード版）
  '%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B', // お問い合わせ
  '%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B', // 問い合わせ
  '%E3%81%8A%E5%95%8F%E5%90%88%E3%81%9B', // お問合せ
  '%E5%95%8F%E5%90%88%E3%81%9B' // 問合せ
];

private static readonly MEDIUM_PRIORITY_CONTACT_KEYWORDS = [
  // 間接的問い合わせ（中優先度） - 営業系削除済み
  'form', 'フォーム', 'submit', 'send', 'mail form',
  'feedback'
];

private static readonly EXCLUDED_KEYWORDS = [
  // 精度の妨げになる明確な除外キーワードのみ（最小限）
  'download', 'recruit', 'career'
];

// 後方互換性のため従来のキーワードも保持
private static readonly CONTACT_KEYWORDS = [
  ...this.HIGH_PRIORITY_CONTACT_KEYWORDS,
  ...this.MEDIUM_PRIORITY_CONTACT_KEYWORDS
];
  // URL推測専用パターン（URL推測でテストするパス）
  private static readonly HIGH_PRIORITY_PATTERNS = [

    '/contact/', '/contact',  '/contact.php', '/inquiry/','/inquiry', '/inquiry.php',  '/form','/form/',  '/form.php','/contact-us/', '/contact-us',
    '/%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B/', // お問い合わせ
    '/%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B/', // 問い合わせ

  ];



  // **OPTIMIZED: Same HTML response detection for SPA efficiency**
  private static sameHtmlCache: { [url: string]: string } = {};
  
  private static detectSameHtmlPattern(urls: string[], htmlContent: string): boolean {
    const contentHash = this.hashString(htmlContent);
    let sameCount = 0;
    
    for (const url of urls) {
      if (this.sameHtmlCache[url] === contentHash) {
        sameCount++;
      } else {
        this.sameHtmlCache[url] = contentHash;
      }
    }
    
    // If 2 or more URLs return the same HTML, likely SPA
    return sameCount >= 2;
  }

  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

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

  // 問い合わせ純度スコア計算（BtoB営業特化・重複防止版）
  private static calculateContactPurity(url: string, linkText: string, context: string = ''): { score: number, reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];
    const foundKeywords = new Set<string>(); // 重複防止用

    const lowerUrl = url.toLowerCase();
    const lowerLinkText = linkText.toLowerCase();

    // 除外キーワードチェック（即座に低スコア）
    for (const excludedKeyword of this.EXCLUDED_KEYWORDS) {
      if (lowerUrl.includes(excludedKeyword.toLowerCase()) ||
          lowerLinkText.includes(excludedKeyword.toLowerCase())) {
        score -= 15;
        reasons.push(`excluded:${excludedKeyword}`);
        break; // 1つでも除外キーワードがあれば大幅減点
      }
    }

    // 高優先度キーワード（「含む」判定で柔軟マッチング・重複防止）
    for (const keyword of this.HIGH_PRIORITY_CONTACT_KEYWORDS) {
      const normalizedKeyword = keyword.toLowerCase();

      // リンクテキストに含まれる場合（例: "お問い合わせフォーム" に "お問い合わせ" が含まれる）
      if (lowerLinkText.includes(normalizedKeyword) && !foundKeywords.has(normalizedKeyword)) {
        score += 10;
        reasons.push(`high_priority_text:${keyword}`);
        foundKeywords.add(normalizedKeyword);
        console.log(`✓ Text match found: "${keyword}" in "${linkText}"`);
      }
      // URLに含まれる場合（例: "/contact-form" に "contact" が含まれる）
      else if (lowerUrl.includes(normalizedKeyword) && !foundKeywords.has(normalizedKeyword)) {
        score += 8;
        reasons.push(`high_priority_url:${keyword}`);
        foundKeywords.add(normalizedKeyword);
        console.log(`✓ URL match found: "${keyword}" in "${url}"`);
      }

      // テキストとURLの両方にある場合の重複防止ログ
      if (lowerLinkText.includes(normalizedKeyword) && lowerUrl.includes(normalizedKeyword) && foundKeywords.has(normalizedKeyword)) {
        console.log(`Prevented duplicate counting for keyword: ${keyword}`);
      }
    }

    // 中優先度キーワード（中純度・重複防止）
    for (const keyword of this.MEDIUM_PRIORITY_CONTACT_KEYWORDS) {
      const normalizedKeyword = keyword.toLowerCase();

      if (lowerLinkText.includes(normalizedKeyword) && !foundKeywords.has(normalizedKeyword)) {
        score += 3;
        reasons.push(`medium_priority_text:${keyword}`);
        foundKeywords.add(normalizedKeyword);
      } else if (lowerUrl.includes(normalizedKeyword) && !foundKeywords.has(normalizedKeyword)) {
        score += 2;
        reasons.push(`medium_priority_url:${keyword}`);
        foundKeywords.add(normalizedKeyword);
      }
    }

    // URL構造による純度ボーナス（強化版）
    const contactUrlPatterns = [
      '/contact/', '/inquiry/', '/sales-contact/', '/business-contact/',
      '/contact-us/', '/get-in-touch/', '/reach-out/', '/問い合わせ/', '/お問い合わせ/'
    ];

    for (const pattern of contactUrlPatterns) {
      if (lowerUrl.includes(pattern)) {
        score += 15; // 5点から15点に強化
        reasons.push(`strong_contact_url_structure:${pattern}`);
        break; // 1つでもマッチすれば十分
      }
    }

    // 不純物による減点（サービス系URL・強化版）
    if (lowerUrl.includes('/service/')) {
      score -= 10; // 5点から10点に強化
      reasons.push('service_url_penalty');
    } else if (lowerUrl.includes('/about/') || lowerUrl.includes('/company/') || lowerUrl.includes('/info/')) {
      score -= 5;
      reasons.push('impure_url_structure');
    }

    return { score, reasons };
  }

  // 早期終了用の閾値定義
  private static readonly HIGH_CONFIDENCE_THRESHOLD = 15; // 高優先度 + コンテキストボーナス
  private static readonly MEDIUM_CONFIDENCE_THRESHOLD = 10; // 高優先度キーワードのみ
  private static readonly MINIMUM_ACCEPTABLE_THRESHOLD = 5; // 受容可能な最低スコア

  // タイムアウト設定（ミリ秒）- スクリプトプロパティから動的取得
  private static getMaxTotalTime(): number {
    const properties = PropertiesService.getScriptProperties();
    const maxTimeStr = properties.getProperty('MAX_TOTAL_TIME');

    if (maxTimeStr) {
      const maxTime = parseInt(maxTimeStr, 10);
      if (!isNaN(maxTime) && maxTime > 0) {
        console.log(`Using MAX_TOTAL_TIME from script properties: ${maxTime}ms`);
        return maxTime;
      } else {
        console.log(`Invalid MAX_TOTAL_TIME value: ${maxTimeStr}, using default 30000ms`);
      }
    }

    console.log('MAX_TOTAL_TIME not set in script properties, using default 30000ms');
    return 30000; // デフォルト30秒
  }

  // **NEW: SPA Analysis Execution** - Step1内でのSPA検出時に実行
  private static executeSPAAnalysis(html: string, baseUrl: string): ContactPageResult {
    try {
      console.log('Executing SPA analysis on detected single-page application');
      
      // Navigation search for anchor links in the current HTML
      const navResult = this.searchInNavigation(html, baseUrl);
      if (navResult.url && this.isAnchorLink(navResult.url)) {
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

  // **NEW: Check if URL is an anchor link**
  private static isAnchorLink(url: string): boolean {
    return url.includes('#');
  }

  // **NEW: Analyze anchor section content**
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
        const contactKeywords = ['contact', 'お問い合わせ', '問い合わせ'];
        for (const keyword of contactKeywords) {
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
        const contactInfo = this.extractContactInfo(sectionContent);
        const hasForm = this.isValidContactForm(sectionContent);
        const googleForms = this.detectGoogleForms(sectionContent);

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

  // **NEW: Extract contact information from HTML content**
  private static extractContactInfo(html: string): { phone: boolean, email: boolean, contactForm: boolean } {
    const phonePatterns = [
      /\d{2,4}[-\s]?\d{2,4}[-\s]?\d{3,4}/,
      /\(?\d{3}\)?[-\s]?\d{3,4}[-\s]?\d{3,4}/,
      /TEL[\s:：]*\d/i,
      /電話[\s:：]*\d/
    ];

    const emailPatterns = [
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
      /mail[\s:：]*@/i,
      /メール[\s:：]*@/
    ];

    const contactFormPatterns = [
      /お問い合わせフォーム/i,
      /問い合わせフォーム/i,
      /contact\s+form/i,
      /フォーム.*承/i,
      /form.*contact/i
    ];

    const phone = phonePatterns.some(pattern => pattern.test(html));
    const email = emailPatterns.some(pattern => pattern.test(html));
    const contactForm = contactFormPatterns.some(pattern => pattern.test(html));

    console.log(`Contact info extraction: phone=${phone}, email=${email}, contactForm=${contactForm}`);
    return { phone, email, contactForm };
  }

  private static readonly FORM_KEYWORDS = [
    'フォーム', 'form', '入力', '送信',
    'googleフォーム', 'google form', 'submit'
  ];

  // 送信系ボタンキーワード（BtoB問い合わせ特化）
  private static readonly SUBMIT_BUTTON_KEYWORDS = [
    // 基本送信キーワード
    '送信', '送る', 'submit', 'send',

    // 問い合わせ関連のみ（営業系削除）
    'お問い合わせ', '問い合わせ', 'お問合せ', '問合せ',
    'ご相談', '相談', 'contact', 'inquiry'
  ];


  static findContactPage(baseUrl: string): ContactPageResult {
    const startTime = Date.now();
    const maxTotalTime = this.getMaxTotalTime();

    try {
      // 候補リストのリセット（新しい検索開始時）
      this.resetCandidates();

      // SNSページの検出
      if (this.isSNSPage(baseUrl)) {
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

      // Extract domain for subdirectory pattern support
      const domainUrl = this.extractDomain(baseUrl);

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
        const response = this.fetchWithTimeout(baseUrl, 7000); // 7秒タイムアウト
        const html = this.getContentWithEncoding(response); // 🔥 文字化け解決

        // Check for Google Forms URLs first
        const googleFormUrls = this.findGoogleFormUrlsOnly(html);
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
        const embeddedFormResult = this.findEmbeddedHTMLForm(html);
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
        if (this.isAnchorLink(navResult.url)) {
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
            const isValidForm = this.isValidContactForm(candidateHtml);
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

  private static searchInNavigation(html: string, baseUrl: string): { url: string | null, keywords: string[], score: number, reasons: string[] } {
    const navigationSelectors = [
      // 主要ナビゲーション要素（icube-inc.co.jp等に対応）
      /<nav[\s\S]*?<\/nav>/gi,                    // <nav>タグ
      /<[^>]*id=['"]menu['"][^>]*>[\s\S]*?<\/[^>]+>/gi,  // #menu ID
      /<footer[\s\S]*?<\/footer>/gi,              // <footer>タグ
      // 追加セレクター（既存サイト対応）
      /<ul[^>]*id=['"]naviArea['"][^>]*>[\s\S]*<\/ul>/gi, // #naviArea (icube-inc.co.jp) - 貪欲マッチでネスト対応
      /<[^>]*id=['"]navigation['"][^>]*>[\s\S]*?<\/[^>]+>/gi, // #navigation
      /<[^>]*id=['"]nav['"][^>]*>[\s\S]*?<\/[^>]+>/gi, // #nav
      /<div[^>]*class=['"][^'"]*\bnav\b[^'"]*['"][^>]*>[\s\S]*<\/div>/gi, // .navクラス - 貪欲マッチ
      /<nav[^>]*class=['"][^'"]*\bnavigation\b[^'"]*['"][^>]*>[\s\S]*<\/nav>/gi, // .navigationクラス - 貪欲マッチ
      /<ul[^>]*class=['"][^'"]*\bmenu\b[^'"]*['"][^>]*>[\s\S]*<\/ul>/gi // .menuクラス - 貪欲マッチ
    ];

    console.log('Searching in navigation with 9 selectors (including #naviArea, .nav, .navigation, .menu)...');

    let totalMatches = 0;
    let allCandidates: Array<{ url: string, keywords: string[], score: number, reasons: string[] }> = [];

    for (let i = 0; i < navigationSelectors.length; i++) {
      const regex = navigationSelectors[i];
      if (!regex) continue;

      const matches = html.match(regex) || [];
      console.log(`Navigation selector ${i+1}: Found ${matches.length} matches`);
      totalMatches += matches.length;

      for (let j = 0; j < matches.length; j++) {
        const match = matches[j];
        if (!match) continue;

        console.log(`Analyzing navigation match ${j+1} (${match.length} chars): ${match.substring(0, 100)}...`);

        // 新フロー: 全リンクを抽出してキーワードフィルタリング
        const candidates = this.extractAllContactLinks(match, baseUrl);
        allCandidates.push(...candidates);
        console.log(`Navigation match ${j+1} added ${candidates.length} candidates`);
      }
    }

    // 全リンクからキーワード含有リンクのみを選別
    const contactLinks = allCandidates.filter(candidate =>
      this.HIGH_PRIORITY_CONTACT_KEYWORDS.some(keyword =>
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

  // 200 OK URLsの評価（キーワード検出による問い合わせページ判定）
  private static evaluateValidUrls(baseUrl: string): ContactPageResult {
    console.log(`=== Evaluating ${this.validUrls.length} valid URLs with keyword detection ===`);

    if (this.validUrls.length === 0) {
      console.log('No valid URLs to evaluate');
      return {
        contactUrl: null,
        actualFormUrl: null,
        foundKeywords: [],
        searchMethod: 'no_valid_urls'
      };
    }

    // 優先順序でURLを評価（HIGH_PRIORITY_PATTERNS順）
    for (const urlInfo of this.validUrls) {
      console.log(`Evaluating URL: ${urlInfo.url} (pattern: ${urlInfo.pattern})`);

      try {
        // HTMLを再取得
        const response = this.fetchWithTimeout(urlInfo.url, 5000);
        if (response.getResponseCode() === 200) {
          const html = response.getContentText();
          console.log(`Re-fetched HTML for ${urlInfo.url}, length: ${html.length}`);

          // キーワード検出
          const keywordResult = this.detectContactKeywords(html);
          console.log(`Keyword detection result: ${keywordResult.matchCount} unique keywords found`);

          if (keywordResult.matchCount >= 3) {
            console.log(`✅ Contact page confirmed at ${urlInfo.url} (${keywordResult.matchCount} keywords: ${keywordResult.foundKeywords.join(',')})`);
            return {
              contactUrl: urlInfo.url,
              actualFormUrl: null,
              foundKeywords: [...keywordResult.foundKeywords, 'keyword_validation'],
              searchMethod: 'valid_url_keyword_detection'
            };
          } else {
            console.log(`❌ Insufficient keywords at ${urlInfo.url} (${keywordResult.matchCount}/3 required)`);
          }
        }
      } catch (error: any) {
        console.log(`Error evaluating ${urlInfo.url}: ${error.toString()}`);
        continue;
      }
    }

    console.log('No valid URLs passed keyword detection threshold');
    return {
      contactUrl: null,
      actualFormUrl: null,
      foundKeywords: ['valid_urls_insufficient_keywords'],
      searchMethod: 'valid_urls_failed'
    };
  }

  // URLが有効な問い合わせパターンを含んでいるかチェック（部分一致）
  private static hasValidContactPattern(url: string): boolean {
    const lowerUrl = url.toLowerCase();
    const validPatterns = [
      'contact', 'inquiry', 'form', 'お問い合わせ', '問い合わせ',
      'contact-form', 'inquiry-form', 'contact-us', 'contactus'
    ];

    const hasPattern = validPatterns.some(pattern => lowerUrl.includes(pattern));
    console.log(`URL pattern validation: ${url} -> ${hasPattern ? '✅ Valid' : '❌ Invalid'} contact pattern`);
    return hasPattern;
  }

  // HTMLからHIGH_PRIORITY_CONTACT_KEYWORDSを検出
  private static detectContactKeywords(html: string): { matchCount: number, foundKeywords: string[] } {
    const lowerHtml = html.toLowerCase();
    const foundKeywords: Set<string> = new Set();

    for (const keyword of this.HIGH_PRIORITY_CONTACT_KEYWORDS) {
      const lowerKeyword = keyword.toLowerCase();
      if (lowerHtml.includes(lowerKeyword)) {
        foundKeywords.add(keyword);
      }
    }

    const foundKeywordsArray = Array.from(foundKeywords);
    console.log(`Keyword detection: found ${foundKeywordsArray.length} unique keywords: ${foundKeywordsArray.join(',')}`);

    return {
      matchCount: foundKeywordsArray.length,
      foundKeywords: foundKeywordsArray
    };
  }

  private static searchInFooter(html: string, baseUrl: string): { url: string | null, keywords: string[], score: number, reasons: string[] } {
    const footerSelectors = [
      // 標準的なフッター
      /<footer[\s\S]*?<\/footer>/gi,
      // フッター系のクラス/ID
      /<[^>]*(?:class|id)=['"]*[^'" ]*(?:footer|bottom|site-footer|page-footer)[^'" ]*['"][^>]*>[\s\S]*?<\/[^>]+>/gi,
      // サイト下部のコンテンツエリア
      /<[^>]*(?:class|id)=['"]*[^'" ]*(?:site-info|contact-info|company-info)[^'" ]*['"][^>]*>[\s\S]*?<\/[^>]+>/gi,
      // 下部のナビゲーション
      /<[^>]*(?:class|id)=['"]*[^'" ]*(?:footer-nav|bottom-nav)[^'" ]*['"][^>]*>[\s\S]*?<\/[^>]+>/gi
    ];

    console.log('Searching in footer with comprehensive selectors...');

    for (const regex of footerSelectors) {
      const matches = html.match(regex) || [];
      console.log(`Found ${matches.length} matches for footer selector`);

      for (const match of matches) {
        const result = this.extractContactLinks(match, baseUrl, 'footer');
        if (result.url && result.score > 0) {
          console.log(`Footer search found: ${result.url} (score: ${result.score})`);
          return result;
        }
      }
    }

    return { url: null, keywords: [], score: 0, reasons: [] };
  }

  private static searchInSidebar(html: string, baseUrl: string): { url: string | null, keywords: string[], score: number, reasons: string[] } {
    const sidebarSelectors = [
      // サイドバー系のクラス/ID
      /<[^>]*(?:class|id)=['"]*[^'" ]*(?:sidebar|side-nav|aside|widget)[^'" ]*['"][^>]*>[\s\S]*?<\/[^>]+>/gi,
      // アサイド要素
      /<aside[\s\S]*?<\/aside>/gi,
      // サイドナビゲーション
      /<[^>]*(?:class|id)=['"]*[^'" ]*(?:side-menu|left-nav|right-nav)[^'" ]*['"][^>]*>[\s\S]*?<\/[^>]+>/gi
    ];

    console.log('Searching in sidebar with comprehensive selectors...');

    for (const regex of sidebarSelectors) {
      const matches = html.match(regex) || [];
      console.log(`Found ${matches.length} matches for sidebar selector`);

      for (const match of matches) {
        const result = this.extractContactLinks(match, baseUrl, 'sidebar');
        if (result.url && result.score > 0) {
          console.log(`Sidebar search found: ${result.url} (score: ${result.score})`);
          return result;
        }
      }
    }

    return { url: null, keywords: [], score: 0, reasons: [] };
  }

  private static searchInMobileMenu(html: string, baseUrl: string): { url: string | null, keywords: string[], score: number, reasons: string[] } {
    const mobileMenuSelectors = [
      // モバイルメニュー系
      /<[^>]*(?:class|id)=['"]*[^'" ]*(?:mobile-menu|mobile-nav|hamburger-menu)[^'" ]*['"][^>]*>[\s\S]*?<\/[^>]+>/gi,
      // レスポンシブメニュー
      /<[^>]*(?:class|id)=['"]*[^'" ]*(?:responsive-menu|toggle-menu|drawer)[^'" ]*['"][^>]*>[\s\S]*?<\/[^>]+>/gi,
      // オフキャンバス系
      /<[^>]*(?:class|id)=['"]*[^'" ]*(?:off-canvas|slide-menu|overlay-menu)[^'" ]*['"][^>]*>[\s\S]*?<\/[^>]+>/gi,
      // 非表示メニュー（CSS display:none等）
      /<[^>]*(?:style|class)=['"]*[^'" ]*(?:display:\s*none|hidden)[^'" ]*['"][^>]*>[\s\S]*?(?:menu|nav|contact)[\s\S]*?<\/[^>]+>/gi
    ];

    console.log('Searching in mobile menu with comprehensive selectors...');

    for (const regex of mobileMenuSelectors) {
      const matches = html.match(regex) || [];
      console.log(`Found ${matches.length} matches for mobile menu selector`);

      for (const match of matches) {
        const result = this.extractContactLinks(match, baseUrl, 'mobile_menu');
        if (result.url && result.score > 0) {
          console.log(`Mobile menu search found: ${result.url} (score: ${result.score})`);
          return result;
        }
      }
    }

    return { url: null, keywords: [], score: 0, reasons: [] };
  }

  private static searchInAllLinks(html: string, baseUrl: string): { url: string | null, keywords: string[], score: number, reasons: string[] } {
    return this.extractContactLinks(html, baseUrl, 'general');
  }

  // 文字化けデバッグ用ヘルパー
  private static toHexString(str: string): string {
    try {
      return Array.from(str).map(char =>
        char.charCodeAt(0).toString(16).padStart(2, '0')
      ).join(' ');
    } catch (e) {
      return `[hex conversion error: ${e}]`;
    }
  }

  // 🔥 文字化け解決: 複数エンコーディング試行
  private static getContentWithEncoding(response: any): string {
    const encodings = ['utf-8', 'shift_jis', 'euc-jp'];

    console.log(`Trying multiple encodings for content decoding...`);

    for (const encoding of encodings) {
      try {
        const content = response.getContentText(encoding);
        // 簡易文字化け検証
        if (this.isValidEncoding(content)) {
          console.log(`✅ Successfully decoded with ${encoding}`);
          return content;
        } else {
          console.log(`❌ ${encoding} produced garbled text`);
        }
      } catch (e) {
        console.log(`❌ ${encoding} decoding failed: ${e}`);
        continue;
      }
    }

    console.log(`⚠ All encodings failed, using default UTF-8`);
    return response.getContentText(); // 最終フォールバック
  }

  // エンコーディング有効性検証
  private static isValidEncoding(content: string): boolean {
    // 置換文字の割合が5%未満なら有効
    const replacementChars = (content.match(/�/g) || []).length;
    const isValid = (replacementChars / content.length) < 0.05;
    console.log(`Encoding validation: ${replacementChars} replacement chars out of ${content.length} (${(replacementChars/content.length*100).toFixed(2)}%) - ${isValid ? 'VALID' : 'INVALID'}`);
    return isValid;
  }

  // キーワード含有リンクを全て拽出（新フロー用）
  private static extractAllContactLinks(content: string, baseUrl: string): Array<{ url: string, keywords: string[], score: number, reasons: string[] }> {
    const candidates: Array<{ url: string, keywords: string[], score: number, reasons: string[] }> = [];
    const linkRegex = /<a[^>]*href=['"]([^'"]*?)['"][^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    let totalLinksFound = 0;

    console.log(`=== EXTRACTING ALL LINKS DEBUG ===`);
    console.log(`Input content length: ${content.length}`);
    console.log(`Input content preview: ${content.substring(0, 200)}...`);

    // 🔥 デバッグ: HIGH_PRIORITY_CONTACT_KEYWORDS の内容確認
    console.log(`HIGH_PRIORITY_CONTACT_KEYWORDS: ${JSON.stringify(this.HIGH_PRIORITY_CONTACT_KEYWORDS.slice(0, 10))}`);

    while ((match = linkRegex.exec(content)) !== null) {
      totalLinksFound++;
      const url = match[1];
      const linkText = match[2];

      // 🔥 デバッグ: 全リンクの詳細出力
      console.log(`--- Link ${totalLinksFound} RAW DATA ---`);
      console.log(`Raw URL: "${url}"`);
      console.log(`Raw linkText: "${linkText}"`);
      console.log(`Raw linkText hex: ${linkText ? this.toHexString(linkText) : 'undefined'}`);

      if (!url || !linkText) {
        console.log(`Skipped: empty url or linkText`);
        continue;
      }

      const cleanLinkText = linkText.replace(/<[^>]*>/g, '').trim();
      console.log(`Clean linkText: "${cleanLinkText}"`);
      console.log(`Clean linkText hex: ${this.toHexString(cleanLinkText)}`);

      // 非ウェブURLをスキップ
      if (url.startsWith('mailto:') || url.startsWith('javascript:') || url.startsWith('tel:')) {
        continue;
      }

      // 🔥 デバッグ: キーワードマッチング詳細
      console.log(`--- Keyword Matching Debug ---`);
      const urlLower = url.toLowerCase();
      const textLower = cleanLinkText.toLowerCase();
      console.log(`URL lower: "${urlLower}"`);
      console.log(`Text lower: "${textLower}"`);

      let matchedKeywords = [];
      for (const keyword of this.HIGH_PRIORITY_CONTACT_KEYWORDS) {
        const keywordLower = keyword.toLowerCase();
        const urlMatch = urlLower.includes(keywordLower);
        const textMatch = textLower.includes(keywordLower);
        if (urlMatch || textMatch) {
          matchedKeywords.push(`${keyword}(${urlMatch ? 'URL' : ''}${textMatch ? 'TEXT' : ''})`);
        }
      }

      console.log(`Matched keywords: ${matchedKeywords.join(', ')}`);

      const hasContactKeywords = matchedKeywords.length > 0;

      if (!hasContactKeywords) {
        console.log(`❌ Excluded: no contact keywords`);
        continue;
      }

      // 除外キーワードチェック
      const hasExcludedKeywords = this.EXCLUDED_KEYWORDS.some(keyword =>
        url.toLowerCase().includes(keyword.toLowerCase()) ||
        cleanLinkText.toLowerCase().includes(keyword.toLowerCase())
      );

      if (hasExcludedKeywords) {
        console.log(`❌ Excluded: has excluded keywords`);
        continue;
      }

      // スコア計算
      const purityResult = this.calculateContactPurity(url, cleanLinkText);
      const totalScore = purityResult.score + 5; // navigation context bonus

      if (totalScore > 0) {
        const fullUrl = this.resolveUrl(url, baseUrl);
        candidates.push({
          url: fullUrl,
          keywords: purityResult.reasons.map(r => r.split(':')[1] || r),
          score: totalScore,
          reasons: [...purityResult.reasons, 'navigation_context_bonus']
        });

        console.log(`✅ CONTACT LINK FOUND: "${cleanLinkText}" -> ${url} (score: ${totalScore})`);
      }
    }

    // スコア順でソート
    candidates.sort((a, b) => b.score - a.score);
    console.log(`=== EXTRACT SUMMARY ===`);
    console.log(`Total links found: ${totalLinksFound}`);
    console.log(`Keyword-containing links: ${candidates.length}`);
    console.log(`=== END EXTRACT DEBUG ===`);

    return candidates;
  }

  // 動的サイト用厳格キーワード検証
  private static calculateDynamicSiteKeywordScore(html: string): number {
    const lowerHtml = html.toLowerCase();
    let score = 0;

    // 高優先度キーワード（問い合わせ関連）
    const contactKeywords = [
      'お問い合わせ', '問い合わせ', 'contact', 'inquiry',
      'お問い合わせフォーム', 'contact form'
    ];

    for (const keyword of contactKeywords) {
      const matches = (lowerHtml.match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
      score += matches * 3; // 各マッチ3点
      if (matches > 0) {
        console.log(`Found ${matches} occurrences of "${keyword}"`);
      }
    }

    // 誘導文言
    const inductionPhrases = [
      'お気軽にご相談', 'お問い合わせはこちら',
      'get in touch', 'contact us', 'reach out'
    ];

    for (const phrase of inductionPhrases) {
      if (lowerHtml.includes(phrase.toLowerCase())) {
        score += 5; // 誘導文言は5点
        console.log(`Found induction phrase: "${phrase}"`);
      }
    }

    // フォーム関連ヒント
    const formHints = [
      'フォーム読み込み中', 'loading contact form',
      'form-container', 'contact-form-placeholder'
    ];

    for (const hint of formHints) {
      if (lowerHtml.includes(hint.toLowerCase())) {
        score += 4; // フォームヒントは4点
        console.log(`Found form hint: "${hint}"`);
      }
    }

    console.log(`Dynamic site keyword score calculated: ${score}`);
    return score;
  }

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
      const purityResult = this.calculateContactPurity(url, cleanLinkText);
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
        const fullUrl = this.resolveUrl(url, baseUrl);
        candidates.push({
          url: fullUrl,
          keywords: purityResult.reasons.map(r => r.split(':')[1] || r),
          score: totalScore,
          reasons: allReasons,
          linkText: cleanLinkText
        });

        console.log(`✓ Contact link candidate: "${cleanLinkText}" -> ${fullUrl} (score: ${totalScore}, reasons: ${allReasons.join(',')})`);

        // Early termination for high confidence candidates
        if (totalScore >= this.HIGH_CONFIDENCE_THRESHOLD) {
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

  private static resolveUrl(url: string, baseUrl: string): string {
    // Skip invalid or non-web URLs
    if (url.startsWith('mailto:') || url.startsWith('javascript:') || url.startsWith('tel:')) {
      return url; // Return as-is but these should be filtered out in calling code
    }

    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // Extract protocol and host from baseUrl manually
    const protocolMatch = baseUrl.match(/^https?:/);
    const hostMatch = baseUrl.match(/^https?:\/\/([^\/]+)/);

    if (!protocolMatch || !hostMatch) {
      return url;
    }

    const protocol = protocolMatch[0];
    const host = hostMatch[1];

    if (url.startsWith('/')) {
      return `${protocol}//${host}${url}`;
    }

    return `${protocol}//${host}/${url}`;
  }

  private static findActualForm(contactPageUrl: string): string | null {
    try {
      const response = this.fetchWithTimeout(contactPageUrl, 5000); // 5秒タイムアウト
      const html = response.getContentText();

      // 1. まず、Google Formsを最優先で検索
      const googleFormUrl = this.findGoogleFormUrlsOnly(html);
      if (googleFormUrl && googleFormUrl.startsWith('http')) {
        console.log(`Found Google Form in contact page: ${googleFormUrl}`);
        return googleFormUrl;
      }

      // 2. 埋め込みフォームの検出
      const embeddedForm = this.findEmbeddedHTMLForm(html);
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
    const formLinkPatterns = [
      // URL内のパターン（一般問い合わせのみ）
      'form', 'フォーム', 'submit', '送信',
      // 特定のフォームサービス
      'formzu', 'fc2', 'google.com/forms', 'forms.gle'
    ];

    // より具体的なテキストパターン（一般問い合わせ限定）
    const formTextPatterns = [
      'フォームはこちら', 'フォームへ', '問い合わせフォーム',
      '入力フォーム', '送信フォーム',
      'form here', 'click here', 'go to form'
    ];

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
      const negativeKeywords = ['recruit', 'career', 'job', 'hire', 'employment', '採用', '求人',
                               'request', 'download', 'material', '資料', '資料請求', 'brochure'];
      const hasNegativeKeyword = negativeKeywords.some(keyword =>
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
      for (const pattern of formLinkPatterns) {
        if (lowerUrl.includes(pattern.toLowerCase())) {
          score += 3; // URL内のパターンは高スコア
          reasons.push(`url_pattern:${pattern}`);
        }
      }

      // リンクテキスト内のフォームパターンをチェック
      for (const pattern of formTextPatterns) {
        if (cleanLinkText.includes(pattern.toLowerCase())) {
          score += 2; // テキストパターンは中スコア
          reasons.push(`text_pattern:${pattern}`);
        }
      }

      // 一般的なフォームキーワードもチェック（低スコア）
      for (const keyword of this.FORM_KEYWORDS) {
        if (cleanLinkText.includes(keyword.toLowerCase()) || lowerUrl.includes(keyword.toLowerCase())) {
          score += 1;
          reasons.push(`keyword:${keyword}`);
        }
      }

      // スコアが1以上の場合候補として追加
      if (score > 0) {
        const fullUrl = this.resolveUrl(url, contactPageUrl);
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
          const hasGoogleForm = this.findGoogleFormUrlsOnly(candidateHtml);
          const hasEmbeddedForm = this.findEmbeddedHTMLForm(candidateHtml);

          if (hasGoogleForm && hasGoogleForm.startsWith('http')) {
            console.log(`Validated: Google Form found at ${candidate.url} -> ${hasGoogleForm}`);
            return hasGoogleForm;
          }

          if (hasEmbeddedForm) {
            console.log(`Validated: Embedded form found at ${candidate.url}`);
            return candidate.url;
          }

          // より寛容な検証：フォーム関連コンテンツの存在確認
          const hasFormContent = this.hasSignificantFormContent(candidateHtml);
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

  // トップページURLかどうかを判定（２段階リンク検出での除外用）
  private static isHomepageUrl(url: string, baseUrl: string): boolean {
    // 相対URLを絶対URLに変換
    const fullUrl = this.resolveUrl(url, baseUrl);

    // ベースドメインを抽出
    const baseDomain = this.extractDomain(baseUrl);

    // トップページパターン
    const homepagePatterns = [
      baseDomain,                     // https://example.com/
      baseDomain.replace(/\/$/, ''),  // https://example.com
      baseDomain + 'index.html',
      baseDomain + 'index.htm',
      baseDomain + 'index.php',
      baseDomain + 'home/',
      baseDomain + 'home'
    ];

    // 完全一致チェック
    const isHomepage = homepagePatterns.some(pattern =>
      fullUrl.toLowerCase() === pattern.toLowerCase()
    );

    if (isHomepage) {
      console.log(`Detected homepage URL: ${fullUrl} matches pattern in ${homepagePatterns.join(',')}`);
    }

    return isHomepage;
  }

  // 統合フォーム解析：フォーム要素 + キーワード + 送信要素の3要素統合
  private static analyzeFormElements(html: string): { isValidForm: boolean, reasons: string[], keywords: string[] } {
    const lowerHtml = html.toLowerCase();
    const foundReasons: string[] = [];
    const foundKeywords: string[] = [];

    // A. 構造化フォーム解析（新規追加）
    const structuredFormAnalysis = this.analyzeStructuredForms(html);
    let hasStructuredForms = false;
    if (structuredFormAnalysis.formCount > 0) {
      hasStructuredForms = true;
      foundReasons.push(`structured_forms:${structuredFormAnalysis.formCount}`);
      foundReasons.push(`form_fields:${structuredFormAnalysis.totalFields}`);
      foundKeywords.push('structured_forms');
      console.log(`Structured forms detected: ${structuredFormAnalysis.formCount} forms, ${structuredFormAnalysis.totalFields} fields`);
    }

    // A-Legacy. フォーム関連コンテンツの検出（従来方式・併用）
    const formElements = [
      'お名前', 'メールアドレス', '電話番号', 'ご質問', 'お問い合わせ内容', '会社名',
      'name', 'email', 'phone', 'message', 'inquiry', 'company',
      '<input', '<textarea', '<select', 'type="text"', 'type="email"', 'type="tel"'
    ];

    let formElementCount = 0;
    for (const element of formElements) {
      if (lowerHtml.includes(element.toLowerCase())) {
        formElementCount++;
      }
    }

    const hasLegacyFormElements = formElementCount >= 3;
    if (hasLegacyFormElements) {
      foundReasons.push(`legacy_form_elements:${formElementCount}`);
      foundKeywords.push('legacy_form_elements');
    }

    // B. 問い合わせキーワードの検出
    const contactKeywords = [
      'お問い合わせ', '問い合わせ', 'お問合せ', '問合せ',
      'contact', 'inquiry', 'ご相談', '相談'
    ];

    const foundContactKeywords = contactKeywords.filter(keyword =>
      lowerHtml.includes(keyword.toLowerCase())
    );

    const hasContactKeywords = foundContactKeywords.length >= 1;
    // 問い合わせ純度チェック（直接的な問い合わせ意図の確認）
    const hasDirectContactIntent = this.HIGH_PRIORITY_CONTACT_KEYWORDS.some(keyword =>
      lowerHtml.includes(keyword.toLowerCase())
    );

    if (hasContactKeywords) {
      foundReasons.push(`contact_keywords:${foundContactKeywords.length}`);
      foundKeywords.push('contact_keywords');
    }

    // C. 新しいシンプルな問い合わせフォーム検証
    const isValidForm = this.isValidContactForm(html);

    if (isValidForm) {
      foundReasons.push(`valid_contact_form:confirmed`);
      foundKeywords.push('valid_contact_form');
    }

    // C-Legacy. 従来の送信要素検出（比較用・併用）
    const legacySubmitElements = [
      '<input type="submit"', '<button type="submit"', '<input[^>]*type=["\']submit',
      '送信', 'submit', '確認', 'confirm', '申し込み', 'apply', '送る', 'send',
      'onclick.*submit', 'onclick.*confirm'
    ];

    let legacySubmitCount = 0;
    for (const submitElement of legacySubmitElements) {
      if (lowerHtml.includes(submitElement.toLowerCase()) || lowerHtml.match(new RegExp(submitElement.toLowerCase()))) {
        legacySubmitCount++;
      }
    }

    const hasLegacySubmitElements = legacySubmitCount >= 1;
    if (hasLegacySubmitElements) {
      foundReasons.push(`legacy_submit_elements:${legacySubmitCount}`);
      foundKeywords.push('legacy_submit_elements');
    }

    // 新しいシンプルな判定ロジック
    let isValid = isValidForm;

    if (isValid) {
      foundReasons.push('simple_validation:form_with_submit_button');
    }

    console.log(`Form analysis - Valid:${isValid}, Method:simple_form_validation`);

    return {
      isValidForm: isValid,
      reasons: foundReasons,
      keywords: foundKeywords
    };
  }

  // 構造化フォーム解析：実際の<form>タグ内要素を解析
  private static analyzeStructuredForms(html: string): { formCount: number, totalFields: number, hasContactFields: boolean } {
    let formCount = 0;
    let totalFields = 0;
    let hasContactFields = false;

    // <form>タグとその内容を抽出
    const formRegex = /<form[^>]*>([\s\S]*?)<\/form>/gi;
    let formMatch;

    while ((formMatch = formRegex.exec(html)) !== null) {
      const formContent = formMatch[1];
      if (!formContent) continue;

      formCount++;
      console.log(`Analyzing form ${formCount}, content length: ${formContent.length}`);

      // フォーム内の入力要素をカウント
      const inputRegex = /<(?:input|textarea|select)[^>]*>/gi;
      const inputs = formContent.match(inputRegex) || [];

      let formFieldCount = 0;
      let hasContactSpecificFields = false;

      for (const input of inputs) {
        const lowerInput = input.toLowerCase();

        // 入力フィールドの種類を判定
        if (lowerInput.includes('type="hidden"') ||
            lowerInput.includes('type="button"') ||
            lowerInput.includes('type="submit"')) {
          continue; // カウント対象外
        }

        formFieldCount++;

        // 問い合わせ専用フィールドの検出
        const contactFieldPatterns = [
          'name="(?:.*(?:name|名前|氏名))"', 'name="(?:.*(?:email|メール))"',
          'name="(?:.*(?:phone|電話|tel))"', 'name="(?:.*(?:company|会社))"',
          'name="(?:.*(?:message|メッセージ|質問|問い合わせ|inquiry))"'
        ];

        for (const pattern of contactFieldPatterns) {
          if (lowerInput.match(new RegExp(pattern))) {
            hasContactSpecificFields = true;
            console.log(`Contact-specific field detected: ${pattern}`);
            break;
          }
        }
      }

      totalFields += formFieldCount;
      if (hasContactSpecificFields) {
        hasContactFields = true;
      }

      console.log(`Form ${formCount}: ${formFieldCount} fields, contact-specific: ${hasContactSpecificFields}`);
    }

    console.log(`Structured form analysis complete: ${formCount} forms, ${totalFields} total fields, contact fields: ${hasContactFields}`);

    return {
      formCount,
      totalFields,
      hasContactFields
    };
  }

  // 新しいシンプルな問い合わせフォーム判定

  private static isValidContactForm(html: string): boolean {
    console.log('Starting simple contact form validation...');

    // 条件1: <form> + 送信要素検出（既存ロジック）
    const formMatches = html.match(/<form[^>]*>[\s\S]*?<\/form>/gis);

    if (formMatches && formMatches.length > 0) {
      console.log(`Found ${formMatches.length} form(s), checking for submit buttons...`);

      // 各form要素内で送信系ボタンをチェック
      for (let i = 0; i < formMatches.length; i++) {
        const formHTML = formMatches[i];
        if (formHTML) {
          const hasSubmitButton = this.hasSubmitButtonInForm(formHTML);

          console.log(`Form ${i + 1}: ${hasSubmitButton ? 'Has submit button' : 'No submit button'}`);

          if (hasSubmitButton) {
            return true;
          }
        }
      }
    } else {
      console.log('No form elements found');
    }

    console.log('No forms with submit buttons found');
    
    // JavaScript フォーム検出: <script> + reCAPTCHA の組み合わせ
    console.log('Checking for JavaScript forms with reCAPTCHA...');
    if (this.hasScriptAndRecaptcha(html)) {
      console.log('✅ JavaScript form with reCAPTCHA detected');
      return true;
    }

    console.log('No valid forms found (standard or reCAPTCHA forms)');
    return false;
  }

  // JavaScript フォーム検出: <script>タグ + reCAPTCHA存在
  private static hasScriptAndRecaptcha(html: string): boolean {
    // <script>タグの存在チェック
    const hasScript = /<script[^>]*>[\s\S]*?<\/script>/gi.test(html) || /<script[^>]*src=[^>]*>/gi.test(html);
    
    if (!hasScript) {
      console.log('No script tags found');
      return false;
    }

    console.log('Script tags found, checking for reCAPTCHA...');

    // reCAPTCHA検出パターン
    const recaptchaPatterns = [
      // Google reCAPTCHA スクリプトURL
      /https:\/\/www\.google\.com\/recaptcha\/api\.js/gi,
      /recaptcha\/api\.js/gi,
      
      // reCAPTCHA HTML要素
      /<div[^>]*class=["|'][^"|']*g-recaptcha[^"|']*["|']/gi,
      /<div[^>]*id=["|'][^"|']*recaptcha[^"|']*["|']/gi,
      
      // reCAPTCHA データ属性
      /data-sitekey=["|'][^"|']*["|']/gi,
      
      // reCAPTCHA テキスト（日本語・英語）
      /私はロボットではありません/gi,
      /I'm not a robot/gi,
      /reCAPTCHA/gi
    ];

    console.log('Checking reCAPTCHA patterns...');
    
    for (let i = 0; i < recaptchaPatterns.length; i++) {
      const pattern = recaptchaPatterns[i];
      if (!pattern) continue;
      
      const matches = html.match(pattern);
      
      if (matches && matches.length > 0) {
        console.log(`✅ reCAPTCHA pattern ${i + 1} matched: ${matches[0].substring(0, 100)}`);
        return true;
      }
    }

    console.log('No reCAPTCHA patterns found');
    return false;
  }

  // form内の送信系ボタン検出
  private static hasSubmitButtonInForm(formHTML: string): boolean {
    // input[type="submit"], input[type="image"], button[type="submit"], button（type指定なし）を検索
    const submitButtonPatterns = [
      /<input[^>]*type=["|']submit["|'][^>]*>/gis,
      /<input[^>]*type=["|']image["|'][^>]*>/gis,  // 画像送信ボタン対応
      /<button[^>]*type=["|']submit["|'][^>]*>[\s\S]*?<\/button>/gis,
      /<button(?![^>]*type=)[^>]*>[\s\S]*?<\/button>/gis  // typeが指定されていないbutton
    ];

    for (const pattern of submitButtonPatterns) {
      const matches = formHTML.match(pattern);
      if (matches) {
        // 送信系キーワードをチェック
        for (const match of matches) {
          if (this.containsSubmitKeyword(match)) {
            console.log(`Submit button found: ${match.substring(0, 100)}...`);
            return true;
          }
        }
      }
    }

    return false;
  }

  // 送信系キーワードの存在確認
  private static containsSubmitKeyword(buttonHTML: string): boolean {
    const lowerHTML = buttonHTML.toLowerCase();

    for (const keyword of this.SUBMIT_BUTTON_KEYWORDS) {
      if (lowerHTML.includes(keyword.toLowerCase())) {
        console.log(`Submit keyword found: ${keyword}`);
        return true;
      }
    }

    return false;
  }

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
    const structuredAnalysis = this.analyzeStructuredForms(html);
    const formAnalysis = this.analyzeFormElements(html);

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

  // 候補スコア計算
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

  // 候補リストのリセット（新しい検索開始時）
  private static resetCandidates() {
    this.candidatePages = [];
    this.validUrls = [];
    this.successfulFormUrls = [];
    this.sameHtmlCache = {}; // Reset SPA detection cache
  }

  // 候補を活用したfallback処理
  private static fallbackWithCandidates(): ContactPageResult {
    console.log(`=== Candidate Fallback Analysis ===`);
    console.log(`Available candidates: ${this.candidatePages.length}`);

    if (this.candidatePages.length > 0) {
      // 候補ページから最高スコアを選択
      const sortedCandidates = this.candidatePages
        .sort((a, b) => b.score - a.score);

      const bestCandidate = sortedCandidates[0];

      if (bestCandidate) {
        console.log(`Candidate ranking:`);
        sortedCandidates.slice(0, 3).forEach((candidate, index) => {
          console.log(`  ${index + 1}. ${candidate.url} (score: ${candidate.score}, reason: ${candidate.reason})`);
        });

        console.log(`Using best candidate: ${bestCandidate.url} (score: ${bestCandidate.score}, reason: ${bestCandidate.reason})`);

        return {
          contactUrl: bestCandidate.url,
          actualFormUrl: bestCandidate.url, // 候補の場合は同じURLを返す
          foundKeywords: ['candidate_fallback', bestCandidate.reason, `score_${bestCandidate.score}`],
          searchMethod: 'candidate_fallback'
        };
      }
    }

    console.log('No candidates available - returning not found');
    return {
      contactUrl: null,
      actualFormUrl: null,
      foundKeywords: ['not_found'],
      searchMethod: 'not_found'
    };
  }

  // 従来のhasSignificantFormContentは統合版に置き換え済み（互換性のため残置）
  private static hasSignificantFormContent(html: string): boolean {
    const analysis = this.analyzeFormElements(html);
    return analysis.isValidForm;
  }

  // ページ内に問い合わせ関連のリンクが存在するかチェック（BtoB営業用途特化）
  private static hasContactRelatedLinks(html: string): { hasLinks: boolean, linkTexts: string[] } {
    const contactLinkKeywords = [
      'フォーム', 'form', 'お問い合わせフォーム', '問い合わせフォーム',
      'contact form', 'inquiry form', '送信', 'submit', '入力',
      'フォームへ', 'フォームはこちら', 'click here', 'こちらから', 'お進みください',
      // URL内のパターンも追加
      'contact', 'inquiry',
      // 日本語URLエンコード版
      '%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B', // お問い合わせ
      '%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B'  // 問い合わせ
    ];

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
      for (const keyword of contactLinkKeywords) {
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

  private static guessCommonContactUrls(baseUrl: string): { url: string | null, keywords: string[] } {
    // 高優先度パターンのみに限定（company, aboutを除外）
    const commonPaths = [
      '/contact/', '/contact', '/inquiry/', '/inquiry',
      '/support/', '/support',
      // 日本語URLエンコード版
      '/%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B/', // /お問い合わせ/
      '/%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B/' // /問い合わせ/
    ];

    for (const path of commonPaths) {
      try {
        const testUrl = this.resolveUrl(path, baseUrl);
        const response = this.fetchWithTimeout(testUrl, 5000); // 5秒タイムアウト

        if (response.getResponseCode() === 200) {
          const html = response.getContentText();

          // ページの有効性確認
          if (this.isValidContactPage(html)) {
            // フォーム要素の検証
            const formResult = this.validateContactPageContent(html, testUrl);
            if (formResult.actualFormUrl) {
              return { url: testUrl, keywords: [path.replace(/\//g, ''), ...formResult.keywords] };
            }
          }
        }
      } catch (error) {
        const detailedError = this.getDetailedNetworkError(error);
        console.log(`Error testing ${path}: ${detailedError}`);
        continue;
      }
    }

    return { url: null, keywords: [] };
  }

  // Google FormsのURLのみを検出（埋め込みフォーム検出は除外）
  private static findGoogleFormUrlsOnly(html: string): string | null {
    // Remove CSS and script content to focus on HTML
    const cleanHtml = html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');

    // Look for Google Forms URLs in various patterns
    const googleFormPatterns = [
      /https?:\/\/docs\.google\.com\/forms\/d\/[a-zA-Z0-9-_]+\/?[^"'\s)]+/gi,
      /https?:\/\/forms\.gle\/[^"'\s)]+/gi,
      /https?:\/\/goo\.gl\/forms\/[^"'\s)]+/gi,
      /docs\.google\.com\/forms\/d\/[^"'\s)]+/gi,
      /forms\.gle\/[^"'\s)]+/gi,
      /goo\.gl\/forms\/[^"'\s)]+/gi
    ];

    for (const pattern of googleFormPatterns) {
      const matches = cleanHtml.match(pattern);
      if (matches && matches.length > 0) {
        let url = matches[0];
        // Ensure URL has protocol
        if (!url.startsWith('http')) {
          url = 'https://' + url;
        }

        // Exclude formResponse URLs (submission completion URLs)
        if (url.includes('/formResponse')) {
          console.log(`Excluded formResponse URL (not an active form): ${url}`);
          continue;
        }

        // Only accept viewform URLs or ensure it's a valid form URL
        if (!url.includes('/viewform') && url.includes('/forms/d/')) {
          // Convert to viewform URL if it's a forms/d/ URL without viewform
          if (url.match(/\/forms\/d\/[^\/]+$/)) {
            url = url + '/viewform';
          } else if (!url.includes('/viewform')) {
            // If it's not clearly a viewform URL, try to extract form ID and create proper viewform URL
            const formIdMatch = url.match(/\/forms\/d\/([^\/\?&#]+)/);
            if (formIdMatch) {
              url = `https://docs.google.com/forms/d/${formIdMatch[1]}/viewform`;
            }
          }
        }

        console.log(`Valid Google Form URL found: ${url}`);
        return url;
      }
    }

    // Look for links with Google Form URLs
    const linkRegex = /<a[^>]*href=['"]([^'\"]*?)['"][^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = linkRegex.exec(cleanHtml)) !== null) {
      const url = match[1];
      const linkText = match[2];

      if (!url || !linkText) continue;

      // Check if URL contains Google Forms
      if (url.includes('docs.google.com/forms') || url.includes('forms.gle') || url.includes('goo.gl/forms')) {
        let formUrl = url.startsWith('http') ? url : 'https://' + url;

        // Exclude formResponse URLs
        if (formUrl.includes('/formResponse')) {
          console.log(`Excluded formResponse URL in link: ${formUrl}`);
          continue;
        }

        // Ensure it's a viewform URL
        if (!formUrl.includes('/viewform') && formUrl.includes('/forms/d/')) {
          const formIdMatch = url.match(/\/forms\/d\/([^\/\?&#]+)/);
          if (formIdMatch) {
            formUrl = `https://docs.google.com/forms/d/${formIdMatch[1]}/viewform`;
          }
        }

        console.log(`Valid Google Form URL found in link: ${formUrl}`);
        return formUrl;
      }
    }

    // Look for iframe embeds with Google Forms
    const iframeRegex = /<iframe[^>]*src=['"]([^'\"]*?)['"][^>]*>/gi;
    let iframeMatch;

    while ((iframeMatch = iframeRegex.exec(cleanHtml)) !== null) {
      const src = iframeMatch[1];

      if (src && (src.includes('docs.google.com/forms') || src.includes('forms.gle') || src.includes('goo.gl/forms'))) {
        let formUrl = src.startsWith('http') ? src : 'https://' + src;

        // Exclude formResponse URLs
        if (formUrl.includes('/formResponse')) {
          console.log(`Excluded formResponse URL in iframe: ${formUrl}`);
          continue;
        }

        // Ensure it's a viewform URL for iframe embeds
        if (!formUrl.includes('/viewform') && formUrl.includes('/forms/d/')) {
          const formIdMatch = src.match(/\/forms\/d\/([^\/\?&#]+)/);
          if (formIdMatch) {
            formUrl = `https://docs.google.com/forms/d/${formIdMatch[1]}/viewform`;
          }
        }

        console.log(`Valid Google Form URL found in iframe: ${formUrl}`);
        return formUrl;
      }
    }

    // Look for button onClick or data attributes with Google Forms
    const buttonRegex = /<(?:button|input|div)[^>]*(?:onclick|data-[^=]*|href)=['"]([^'\"]*?)['"][^>]*>/gi;
    let buttonMatch;

    while ((buttonMatch = buttonRegex.exec(cleanHtml)) !== null) {
      const attr = buttonMatch[1];

      if (attr && (attr.includes('docs.google.com/forms') || attr.includes('forms.gle') || attr.includes('goo.gl/forms'))) {
        // Extract URL from javascript or other contexts
        const urlMatch = attr.match(/https?:\/\/(?:docs\.google\.com\/forms|forms\.gle|goo\.gl\/forms)\/[^"'\s)]+/);
        if (urlMatch) {
          let formUrl = urlMatch[0];

          // Exclude formResponse URLs
          if (formUrl.includes('/formResponse')) {
            console.log(`Excluded formResponse URL in button: ${formUrl}`);
            continue;
          }

          // Ensure it's a viewform URL
          if (!formUrl.includes('/viewform') && formUrl.includes('/forms/d/')) {
            const formIdMatch = formUrl.match(/\/forms\/d\/([^\/\?&#]+)/);
            if (formIdMatch) {
              formUrl = `https://docs.google.com/forms/d/${formIdMatch[1]}/viewform`;
            }
          }

          console.log(`Valid Google Form URL found in button: ${formUrl}`);
          return formUrl;
        }
      }
    }

    return null;
  }


  private static findEmbeddedHTMLForm(html: string): boolean {
    // Look for HTML form elements with contact-related fields
    const formRegex = /<form([^>]*?)>([\s\S]*?)<\/form>/gi;
    let formMatch;

    while ((formMatch = formRegex.exec(html)) !== null) {
      const formTag = formMatch[1];
      const formContent = formMatch[2];

      if (!formContent) continue;

      // Phase 1: 明確な除外パターンをチェック
      const excludeResult = this.shouldExcludeForm(formTag || '', formContent, html, formMatch.index);
      if (excludeResult.shouldExclude) {
        console.log(`Form excluded: ${excludeResult.reason}`);
        continue;
      }

      // Contact form keywords that indicate this is a contact form
      const contactFieldKeywords = [
        '御社名', 'お名前', 'メールアドレス', '電話番号', 'ご質問',
        'company', 'name', 'email', 'phone', 'message', 'inquiry',
        '会社名', '名前', 'メール', '問い合わせ', '質問',
        '送信', 'submit', '送る', 'send', '確認', 'confirm'
      ];

      // Check if form contains multiple contact-related fields
      const matchingKeywords = contactFieldKeywords.filter(keyword =>
        formContent.toLowerCase().includes(keyword.toLowerCase())
      );

      console.log(`Form content keywords found: ${matchingKeywords.join(', ')} (${matchingKeywords.length} total)`);

      // If form contains 2 or more contact-related keywords, consider it a contact form
      if (matchingKeywords.length >= 2) {
        console.log(`Valid contact form detected (priority: ${excludeResult.priority})`);
        return true; // Fix: Return boolean instead of placeholder string
      }
    }

    return false;
  }

  // フォーム除外判定の新メソッド
  private static shouldExcludeForm(formTag: string, formContent: string, html: string, formIndex: number): { shouldExclude: boolean, reason: string, priority: string } {
    const lowerFormTag = formTag.toLowerCase();
    const lowerFormContent = formContent.toLowerCase();

    // Method属性を抽出
    const methodMatch = lowerFormTag.match(/method\s*=\s*['"]([^'\"]*)['"]/);
    const method = methodMatch ? methodMatch[1] : null;

    // Action属性を抽出
    const actionMatch = lowerFormTag.match(/action\s*=\s*['"]([^'\"]*)['"]/);
    const action = actionMatch ? actionMatch[1] : null;

    // 1. GET method + 検索系キーワードで除外
    if (method === 'get') {
      const searchKeywords = ['search', 'filter', 'sort', '検索', 'フィルター', 'ソート', 'find', 'query'];
      const hasSearchKeyword = searchKeywords.some(keyword =>
        lowerFormContent.includes(keyword) || (action && action.toLowerCase().includes(keyword))
      );

      if (hasSearchKeyword) {
        return { shouldExclude: true, reason: 'GET method with search keywords', priority: 'exclude' };
      }
    }

    // 2. Action属性で明確な非問い合わせURLを除外
    if (action) {
      const excludeActions = [
        '/search', '/filter', '/sort',
        '?search', '?q=', '?query=',
        '/newsletter', '/subscribe', '/download', '/signup',
        '/login', '/register', '/member',
        // Google Forms formResponse URLs (submission completion URLs)
        '/formresponse', 'formresponse'
      ];

      const hasExcludeAction = excludeActions.some(pattern => action.toLowerCase().includes(pattern));
      if (hasExcludeAction) {
        return { shouldExclude: true, reason: `Excluded action: ${action}`, priority: 'exclude' };
      }
    }

    // 3. フォーム周辺コンテキストでの除外キーワード（前後500文字を確認）
    const contextStart = Math.max(0, formIndex - 500);
    const contextEnd = Math.min(html.length, formIndex + formContent.length + 500);
    const context = html.substring(contextStart, contextEnd).toLowerCase();

    const excludeContextKeywords = [
      'newsletter', 'subscribe', 'メルマガ', 'ニュースレター',
      'download', 'ダウンロード', '資料請求', '資料ダウンロード',
      'survey', 'questionnaire', 'アンケート', 'feedback',
      'search', 'filter', '検索', 'フィルター'
    ];

    const foundExcludeKeywords = excludeContextKeywords.filter(keyword => context.includes(keyword));
    if (foundExcludeKeywords.length > 0) {
      return { shouldExclude: true, reason: `Context keywords: ${foundExcludeKeywords.join(', ')}`, priority: 'exclude' };
    }

    // 4. 優先度の決定（除外されない場合）
    let priority = 'medium';

    if (method === 'post') {
      priority = 'high';
    } else if (!method) {
      // method未指定の場合、問い合わせコンテキストがあるかチェック
      const contactContextKeywords = ['contact', 'inquiry', 'お問い合わせ', '問い合わせ', 'ご相談'];
      const hasContactContext = contactContextKeywords.some(keyword => context.includes(keyword));
      priority = hasContactContext ? 'medium' : 'low';
    }

    return { shouldExclude: false, reason: `Valid form (method: ${method || 'unspecified'}, action: ${action || 'unspecified'})`, priority };
  }

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

  private static searchWithPriorityPatterns(domainUrl: string, startTime: number): ContactPageResult {
    // 200 OK URLリストをリセット
    this.validUrls = [];
    const maxTotalTime = this.getMaxTotalTime();
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

        const response = this.fetchWithTimeout(testUrl, 5000); // 5秒タイムアウト

        if (response.getResponseCode() === 200) {
          const html = response.getContentText();
          console.log(`Got HTML content for ${testUrl}, length: ${html.length}`);
          
          // **SPA OPTIMIZATION: Detect same HTML pattern and apply anchor analysis**
          testedUrls.push(testUrl);
          htmlResponses.push(html);
          
          // Check for SPA pattern after 2nd URL
          if (testedUrls.length >= 2 && this.detectSameHtmlPattern(testedUrls, html)) {
            console.log('Single Page Application detected: same HTML returned for multiple URLs');
            console.log('Executing anchor-based analysis to optimize remaining URL tests');
            
            // Try anchor analysis on the current HTML (represents the homepage content)
            const anchorResult = this.executeSPAAnalysis(html, domainUrl);
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
            const isContactForm = this.isValidContactForm(html);
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
        const detailedError = this.getDetailedNetworkError(error);
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

  private static validateContactPageContent(html: string, pageUrl: string): { actualFormUrl: string | null, keywords: string[] } {
    // 1. 埋め込みHTMLフォーム検索（最優先）
    const embeddedForm = this.findEmbeddedHTMLForm(html);
    if (embeddedForm) {
      return { actualFormUrl: pageUrl, keywords: ['embedded_form'] };
    }

    // 2. 統合検証：フォーム関連コンテンツ + キーワード + 送信要素
    const formAnalysis = this.analyzeFormElements(html);
    if (formAnalysis.isValidForm) {
      console.log(`Integrated form validation successful: ${formAnalysis.reasons.join(',')}`);
      return { actualFormUrl: pageUrl, keywords: formAnalysis.keywords };
    }

    // 4. Google Forms検索（検証付き - 優先度を下げる）
    const googleFormUrl = this.findGoogleFormUrlsOnly(html);
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

  // Google Formの内容を検証して問い合わせフォームかどうか判定
  private static validateGoogleFormContent(html: string, googleFormUrl: string): boolean {
    // 除外すべきキーワード（BtoB営業用途に関係ないフォーム）
    const excludeKeywords = [
      'ライター', 'writer', '募集', 'recruit', 'recruitment', 'career', 'job', 'hire', 'employment',
      '採用', '求人', '応募', 'apply', 'application',
      '資料請求', 'download', 'material', 'brochure', 'request',
      'アンケート', 'survey', 'questionnaire', 'feedback',
      'セミナー', 'seminar', 'webinar', 'event', 'workshop',
      'メルマガ', 'newsletter', 'subscription', 'subscribe'
    ];

    // 問い合わせ関連キーワード
    const contactKeywords = [
      'お問い合わせ', '問い合わせ', 'お問合せ', '問合せ',
      'contact', 'inquiry', 'ご相談', '相談', 'support',
      'business inquiry', 'general inquiry'
    ];

    const lowerHtml = html.toLowerCase();

    // Google Formの周辺コンテキストを抽出（フォームURLの前後1000文字）
    const formUrlIndex = html.indexOf(googleFormUrl);
    const contextStart = Math.max(0, formUrlIndex - 1000);
    const contextEnd = Math.min(html.length, formUrlIndex + googleFormUrl.length + 1000);
    const context = html.substring(contextStart, contextEnd).toLowerCase();

    // 除外キーワードが含まれているかチェック
    const hasExcludeKeyword = excludeKeywords.some(keyword =>
      context.includes(keyword.toLowerCase())
    );

    if (hasExcludeKeyword) {
      console.log(`Google Form excluded due to keywords: ${excludeKeywords.filter(k => context.includes(k.toLowerCase())).join(',')}`);
      return false;
    }

    // 問い合わせ関連キーワードの存在確認
    const hasContactKeyword = contactKeywords.some(keyword =>
      context.includes(keyword.toLowerCase())
    );

    if (hasContactKeyword) {
      console.log(`Google Form validated with contact keywords: ${contactKeywords.filter(k => context.includes(k.toLowerCase())).join(',')}`);
      return true;
    }

    // コンテキストが不明な場合は、より広範囲でチェック
    const hasPageLevelContactKeyword = contactKeywords.some(keyword =>
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

  private static getDetailedNetworkError(error: any): string {
    const errorString = String(error);

    // DNS関連エラー
    if (errorString.includes('DNS') || errorString.includes('NXDOMAIN') || errorString.includes('Name or service not known')) {
      return 'DNS解決失敗: ドメインが存在しません';
    }

    // タイムアウトエラー
    if (errorString.includes('timeout') || errorString.includes('Timeout')) {
      return 'タイムアウト: サーバーからの応答が遅すぎます';
    }

    // 接続拒否エラー
    if (errorString.includes('Connection refused') || errorString.includes('ECONNREFUSED')) {
      return '接続拒否: サーバーが接続を拒否しました';
    }

    // SSL/TLS関連エラー
    if (errorString.includes('SSL') || errorString.includes('TLS') || errorString.includes('certificate')) {
      return 'SSL/TLS証明書エラー: セキュア接続に失敗';
    }

    // ネットワーク到達不可
    if (errorString.includes('Network is unreachable') || errorString.includes('ENETUNREACH')) {
      return 'ネットワーク到達不可: サーバーに到達できません';
    }

    // ホスト到達不可
    if (errorString.includes('No route to host') || errorString.includes('EHOSTUNREACH')) {
      return 'ホスト到達不可: 指定されたホストに到達できません';
    }

    // GAS固有エラー（Address unavailable等）
    if (errorString.includes('Address unavailable') ||
        errorString.includes('Exception:') ||
        errorString.includes('Request failed') ||
        errorString.includes('Service unavailable')) {
      return 'GASエラー: アクセスに失敗しました';
    }

    // その他のネットワークエラー
    if (errorString.includes('Failed to fetch') || errorString.includes('Network error')) {
      return 'ネットワークエラー: 通信に失敗しました';
    }

    // 不明なエラー
    return `不明なエラー: ${errorString}`;
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

  private static isSNSPage(url: string): boolean {
    const snsPatterns = [
      'facebook.com',
      'twitter.com',
      'x.com',
      'instagram.com',
      'linkedin.com',
      'youtube.com',
      'tiktok.com',
      'line.me',
      'ameba.jp',
      'note.com',
      'qiita.com'
    ];

    const lowerUrl = url.toLowerCase();
    return snsPatterns.some(pattern => lowerUrl.includes(pattern));
  }

  private static extractDomain(url: string): string {
    // Extract protocol and host from URL
    const protocolMatch = url.match(/^https?:/);
    const hostMatch = url.match(/^https?:\/\/([^\/]+)/);

    if (!protocolMatch || !hostMatch) {
      return url;
    }

    const protocol = protocolMatch[0];
    const host = hostMatch[1];

    return `${protocol}//${host}/`;
  }


}

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

function main() {
  // Test URL for improved fallback processing
  const testUrl = 'https://www.alleyoop.co.jp/';

  console.log(`\n=== Testing improved fallback processing: ${testUrl} ===`);
  const result = findContactPage(testUrl);

  console.log('=== Contact Page Finder Results (Improved) ===');
  console.log(`Target URL: ${testUrl}`);
  console.log(`Contact URL: ${result.contactUrl}`);
  console.log(`Actual Form URL: ${result.actualFormUrl}`);
  console.log(`Found Keywords: ${result.foundKeywords.join(',')}`);
  console.log(`Search Method: ${result.searchMethod}`);
  console.log('Expected URL: https://www.alleyoop.co.jp/contact/');
  console.log(`Success: ${result.contactUrl === 'https://www.alleyoop.co.jp/contact/' ? '✅ PASS' : '❌ FAIL'}`);
  console.log('=====================================');
}

// 新しいform検証のテスト関数
function testFormValidation() {
  console.log('=== Form Validation Test ===');

  // テスト用HTMLサンプル
  const testHtmlWithForm = `
    <html>
      <body>
        <form action="/contact" method="post">
          <input type="text" name="name" placeholder="お名前">
          <input type="email" name="email" placeholder="メールアドレス">
          <textarea name="message" placeholder="お問い合わせ内容"></textarea>
          <input type="submit" value="送信">
        </form>
      </body>
    </html>
  `;

  const testHtmlWithoutForm = `
    <html>
      <body>
        <div>
          <input type="text" name="search">
          <button onclick="search()">検索</button>
        </div>
      </body>
    </html>
  `;

  const testHtmlWithGoogleForms = `
    <html>
      <body>
        <h1>お問い合わせ</h1>
        <p>下記のフォームからお問い合わせください。</p>
        <iframe src="https://docs.google.com/forms/d/1A2B3C4D5E6F/viewform" width="640" height="800"></iframe>
      </body>
    </html>
  `;

  // プライベートメソッドを呼ぶためのテスト
  try {
    const result1 = (ContactPageFinder as any).isValidContactForm(testHtmlWithForm);
    const result2 = (ContactPageFinder as any).isValidContactForm(testHtmlWithoutForm);
    const googleResult = (ContactPageFinder as any).detectGoogleForms(testHtmlWithGoogleForms);

    console.log(`Test 1 (with form): ${result1 ? 'PASS' : 'FAIL'}`);
    console.log(`Test 2 (without form): ${result2 ? 'FAIL (should be false)' : 'PASS'}`);
    console.log(`Test 3 (Google Forms): ${googleResult.found ? 'PASS' : 'FAIL'} - URL: ${googleResult.url}`);
  } catch (error) {
    console.error(`Test error: ${error}`);
  }

  console.log('=== Form Validation Test End ===');
}
