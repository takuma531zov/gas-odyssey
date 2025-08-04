interface ContactPageResult {
  contactUrl: string | null;
  actualFormUrl: string | null;
  foundKeywords: string[];
  searchMethod: string;
}

class ContactPageFinder {
// リンクテキスト検索 & URL内検索用キーワード（BtoB営業用途特化）
private static readonly CONTACT_KEYWORDS = [
  // 英語キーワード
  'contact', 'contact us', 'inquiry', 'support',
  // 日本語キーワード（リンクテキスト用）
  'お問い合わせ', '問い合わせ', 'お問合せ', '問合せ', 'ご相談', '相談', 'お客様窓口',
  // フォーム関連
  'form', 'フォーム',
  // URL内検索用（日本語エンコード版）
  '%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B', // お問い合わせ
  '%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B', // 問い合わせ
  '%E3%81%8A%E5%95%8F%E5%90%88%E3%81%9B', // お問合せ
  '%E5%95%8F%E5%90%88%E3%81%9B' // 問合せ
];
  // URL推測専用パターン（URL推測でテストするパス）
  private static readonly HIGH_PRIORITY_PATTERNS = [

    '/contact/', '/contact', '/inquiry/', '/form','/form/', '/inquiry', '/contact-us/', '/contact-us',
    '/%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B/', // お問い合わせ
    '/%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B',
    '/%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B/', // 問い合わせ
    '/%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B',

  ];



  // タイムアウト設定（ミリ秒）
  private static readonly MAX_TOTAL_TIME = 30000;  // 全体で30秒

  private static readonly FORM_KEYWORDS = [
    'フォーム', 'form', '入力', '送信',
    'googleフォーム', 'google form', 'submit'
  ];


  static findContactPage(baseUrl: string): ContactPageResult {
    const startTime = Date.now();

    try {
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

      // STEP 1: URL pattern guessing (HIGHEST PRIORITY - Fast & Accurate)
      console.log('Step 1: URL pattern guessing (primary strategy)');
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
      if (Date.now() - startTime > this.MAX_TOTAL_TIME) {
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
        const html = response.getContentText();

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
            actualFormUrl: 'embedded_contact_form_on_page',
            foundKeywords: ['homepage_embedded_form'],
            searchMethod: 'homepage_embedded_fallback'
          };
        }

        console.log('HTML analysis fallback found nothing');

      } catch (homepageError) {
        const detailedError = this.getDetailedNetworkError(homepageError);
        console.log(`Error in homepage analysis fallback: ${detailedError}`);
      }

      console.log('All search methods failed - no contact page found');
      return {
        contactUrl: null,
        actualFormUrl: null,
        foundKeywords: ['not_found'],
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
    const foundKeywords: string[] = [];

    // ナビゲーションメニューの検索
    const navResult = this.searchInNavigation(html, baseUrl);
    if (navResult.url) {
      return {
        contactUrl: navResult.url,
        actualFormUrl: null,
        foundKeywords: navResult.keywords,
        searchMethod: 'navigation'
      };
    }
    foundKeywords.push(...navResult.keywords);

    // フッターの検索
    const footerResult = this.searchInFooter(html, baseUrl);
    if (footerResult.url) {
      return {
        contactUrl: footerResult.url,
        actualFormUrl: null,
        foundKeywords: [...foundKeywords, ...footerResult.keywords],
        searchMethod: 'footer'
      };
    }
    foundKeywords.push(...footerResult.keywords);

    // 全体のリンク検索
    const linkResult = this.searchInAllLinks(html, baseUrl);
    if (linkResult.url) {
      return {
        contactUrl: linkResult.url,
        actualFormUrl: null,
        foundKeywords: [...foundKeywords, ...linkResult.keywords],
        searchMethod: 'general_links'
      };
    }
    foundKeywords.push(...linkResult.keywords);


    // 共通URLパターンで推測検索
    const guessResult = this.guessCommonContactUrls(baseUrl);
    if (guessResult.url) {
      return {
        contactUrl: guessResult.url,
        actualFormUrl: null,
        foundKeywords: [...foundKeywords, ...guessResult.keywords],
        searchMethod: 'url_pattern_guess'
      };
    }

    return {
      contactUrl: null,
      actualFormUrl: null,
      foundKeywords: foundKeywords,
      searchMethod: 'not_found'
    };
  }

  private static searchInNavigation(html: string, baseUrl: string): { url: string | null, keywords: string[] } {
    const navRegex = /<nav[\s\S]*?<\/nav>/gi;
    const navMatches = html.match(navRegex) || [];

    for (const nav of navMatches) {
      const result = this.extractContactLinks(nav, baseUrl);
      if (result.url) return result;
    }

    return { url: null, keywords: [] };
  }

  private static searchInFooter(html: string, baseUrl: string): { url: string | null, keywords: string[] } {
    const footerRegex = /<footer[\s\S]*?<\/footer>/gi;
    const footerMatches = html.match(footerRegex) || [];

    for (const footer of footerMatches) {
      const result = this.extractContactLinks(footer, baseUrl);
      if (result.url) return result;
    }

    return { url: null, keywords: [] };
  }

  private static searchInAllLinks(html: string, baseUrl: string): { url: string | null, keywords: string[] } {
    return this.extractContactLinks(html, baseUrl);
  }

  private static extractContactLinks(content: string, baseUrl: string): { url: string | null, keywords: string[] } {
    const foundKeywords: string[] = [];
    const linkRegex = /<a[^>]*href=['"]([^'"]*?)['"][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    let linksProcessed = 0;

    console.log('Starting link extraction from HTML content');

    while ((match = linkRegex.exec(content)) !== null) {
      const url = match[1];
      const linkText = match[2];
      linksProcessed++;

      if (!url || !linkText) continue;

      const cleanLinkText = linkText.replace(/<[^>]*>/g, '').trim().toLowerCase();
      console.log(`Processing link ${linksProcessed}: "${cleanLinkText}" -> ${url}`);

      // Check text content keywords (skip non-web URLs)
      if (!url.startsWith('mailto:') && !url.startsWith('javascript:') && !url.startsWith('tel:')) {
        for (const keyword of this.CONTACT_KEYWORDS) {
          if (cleanLinkText.includes(keyword.toLowerCase())) {
            foundKeywords.push(keyword);
            const fullUrl = this.resolveUrl(url, baseUrl);
            console.log(`✅ Found contact link by TEXT keyword "${keyword}": ${fullUrl}`);
            return { url: fullUrl, keywords: foundKeywords };
          }
        }
      }

      // Check URL patterns (skip non-web URLs)
      if (!url.startsWith('mailto:') && !url.startsWith('javascript:') && !url.startsWith('tel:')) {
        for (const pattern of this.CONTACT_KEYWORDS) {
          if (url.toLowerCase().includes(pattern.toLowerCase())) {
            foundKeywords.push(pattern);
            const fullUrl = this.resolveUrl(url, baseUrl);
            console.log(`✅ Found contact link by URL pattern "${pattern}": ${fullUrl}`);
            return { url: fullUrl, keywords: foundKeywords };
          }
        }
      }
    }

    console.log(`Link extraction completed: processed ${linksProcessed} links, no contact links found`);
    return { url: null, keywords: foundKeywords };
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
        return 'embedded_contact_form_on_page';
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

    const linkRegex = /<a[^>]*href=['"]([^'"]*?)['"][^>]*>([\s\S]*?)<\/a>/gi;
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
      baseDomain + 'index.html',      // https://example.com/index.html  
      baseDomain + 'index.htm',       // https://example.com/index.htm
      baseDomain + 'index.php',       // https://example.com/index.php
      baseDomain + 'home/',           // https://example.com/home/
      baseDomain + 'home'             // https://example.com/home
    ];
    
    // 完全一致チェック
    const isHomepage = homepagePatterns.some(pattern => 
      fullUrl.toLowerCase() === pattern.toLowerCase()
    );
    
    if (isHomepage) {
      console.log(`Detected homepage URL: ${fullUrl} matches pattern in ${homepagePatterns.join(', ')}`);
    }
    
    return isHomepage;
  }

  // フォーム関連コンテンツの存在を確認
  private static hasSignificantFormContent(html: string): boolean {
    const formIndicators = [
      'お名前', 'メールアドレス', '電話番号', 'ご質問', 'お問い合わせ内容',
      'name', 'email', 'phone', 'message', 'inquiry',
      '<input', '<textarea', '<select', 'type="text"', 'type="email"',
      '送信', 'submit', '確認', 'confirm', '申し込み', 'apply'
    ];

    const lowerHtml = html.toLowerCase();
    let foundCount = 0;

    for (const indicator of formIndicators) {
      if (lowerHtml.includes(indicator.toLowerCase())) {
        foundCount++;
      }
    }

    // 3つ以上のフォーム関連要素が見つかった場合、有効なフォームページとみなす
    console.log(`Form content indicators found: ${foundCount}`);
    return foundCount >= 3;
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

    const linkRegex = /<a[^>]*href=['"]([^'"]*?)['"][^>]*>([\s\S]*?)<\/a>/gi;
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
      /https?:\/\/docs\.google\.com\/forms\/d\/[^"'\s)]+/gi,
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
    const linkRegex = /<a[^>]*href=['"]([^'"]*?)['"][^>]*>([\s\S]*?)<\/a>/gi;
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
          const formIdMatch = formUrl.match(/\/forms\/d\/([^\/\?&#]+)/);
          if (formIdMatch) {
            formUrl = `https://docs.google.com/forms/d/${formIdMatch[1]}/viewform`;
          }
        }
        
        console.log(`Valid Google Form URL found in link: ${formUrl}`);
        return formUrl;
      }
    }

    // Look for iframe embeds with Google Forms
    const iframeRegex = /<iframe[^>]*src=['"]([^'"]*?)['"][^>]*>/gi;
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
          const formIdMatch = formUrl.match(/\/forms\/d\/([^\/\?&#]+)/);
          if (formIdMatch) {
            formUrl = `https://docs.google.com/forms/d/${formIdMatch[1]}/viewform`;
          }
        }
        
        console.log(`Valid Google Form URL found in iframe: ${formUrl}`);
        return formUrl;
      }
    }

    // Look for button onClick or data attributes with Google Forms
    const buttonRegex = /<(?:button|input|div)[^>]*(?:onclick|data-[^=]*|href)=['"]([^'"]*?)['"][^>]*>/gi;
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


  private static findEmbeddedHTMLForm(html: string): string | null {
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
        return 'embedded_contact_form_on_page';
      }
    }

    return null;
  }

  // フォーム除外判定の新メソッド
  private static shouldExcludeForm(formTag: string, formContent: string, html: string, formIndex: number): { shouldExclude: boolean, reason: string, priority: string } {
    const lowerFormTag = formTag.toLowerCase();
    const lowerFormContent = formContent.toLowerCase();
    
    // Method属性を抽出
    const methodMatch = lowerFormTag.match(/method\s*=\s*['"]([^'"]*)['"]/);
    const method = methodMatch ? methodMatch[1] : null;
    
    // Action属性を抽出
    const actionMatch = lowerFormTag.match(/action\s*=\s*['"]([^'"]*)['"]/);
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
    console.log('Starting priority-based URL pattern search');

    // 優先度順にパターンをテスト
    const allPatterns = [
      ...this.HIGH_PRIORITY_PATTERNS,
    ];

    for (const pattern of allPatterns) {
      // タイムアウトチェック
      if (Date.now() - startTime > this.MAX_TOTAL_TIME) {
        console.log('Timeout during priority search');
        break;
      }

      try {
        const testUrl = domainUrl.replace(/\/$/, '') + pattern;
        console.log(`Testing: ${testUrl}`);

        const response = this.fetchWithTimeout(testUrl, 5000); // 5秒タイムアウト

        if (response.getResponseCode() === 200) {
          const html = response.getContentText();
          console.log(`Got HTML content for ${testUrl}, length: ${html.length}`);

          // ページの有効性を確認
          if (this.isValidContactPage(html)) {
            console.log(`${testUrl} passed validity check`);
            // 新しいフォーム検証ロジック
            const formResult = this.validateContactPageContent(html, testUrl);
            console.log(`Form validation for ${testUrl}: actualFormUrl=${formResult.actualFormUrl}, keywords=${formResult.keywords.join(',')}`);

            // フォーム要素またはワードが見つかった場合成功として返す
            if (formResult.actualFormUrl) {
              return {
                contactUrl: testUrl,
                actualFormUrl: formResult.actualFormUrl,
                foundKeywords: [pattern.replace(/\//g, ''), ...formResult.keywords],
                searchMethod: 'priority_pattern_search'
              };
            } else {
              // フォーム要素もワードも見つからない場合、即座にfallbackに移行
              console.log(`No form elements or contact keywords found at ${testUrl}, moving to fallback analysis`);
              break;
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

    return {
      contactUrl: null,
      actualFormUrl: null,
      foundKeywords: [],
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

    // 2. フォーム関連コンテンツ検証（自ページ優先）
    const hasSignificantFormContent = this.hasSignificantFormContent(html);
    if (hasSignificantFormContent) {
      return { actualFormUrl: pageUrl, keywords: ['form_content'] };
    }

    // 3. 問い合わせワードチェック（キーワード検出）
    const contactPageKeywords = [
      'お問い合わせ', '問い合わせ', 'お問合せ', '問合せ',
      'contact', 'inquiry', 'ご相談', '相談'
    ];

    const lowerHtml = html.toLowerCase();
    const foundKeywords = contactPageKeywords.filter(keyword =>
      lowerHtml.includes(keyword.toLowerCase())
    );

    console.log(`Contact page keywords found: ${foundKeywords.join(', ')} (${foundKeywords.length} total)`);

    // より厳しい条件：2つ以上のキーワード、または特定の重要キーワード
    const primaryContactKeywords = ['お問い合わせ', '問い合わせ', 'contact', 'inquiry'];
    const hasPrimaryKeyword = primaryContactKeywords.some(keyword => 
      lowerHtml.includes(keyword.toLowerCase())
    );

    if (foundKeywords.length >= 2 || hasPrimaryKeyword) {
      return { actualFormUrl: pageUrl, keywords: ['contact_keywords', ...foundKeywords] };
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
      console.log(`Contact-related links found: ${hasContactLinks.linkTexts.join(', ')}`);
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
      console.log(`Google Form excluded due to keywords: ${excludeKeywords.filter(k => context.includes(k.toLowerCase())).join(', ')}`);
      return false;
    }

    // 問い合わせ関連キーワードの存在確認
    const hasContactKeyword = contactKeywords.some(keyword => 
      context.includes(keyword.toLowerCase())
    );

    if (hasContactKeyword) {
      console.log(`Google Form validated with contact keywords: ${contactKeywords.filter(k => context.includes(k.toLowerCase())).join(', ')}`);
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
  // Test URLs for hybrid strategy validation
  const urls = [
    // Standard /contact patterns (should work with URL guessing)
    'https://www.inclusive.co.jp/',    // 期待: /contact
    'https://www.3kaku.co.jp/',        // 期待: /sales-contact
    'https://www.maxmouse.co.jp/',     // 期待: /contact/other

    // Special patterns (should work with enhanced URL patterns)
    'https://www.ye-p.co.jp/',         // /form/contact パターン
    'https://www.mode2.co.jp/',        // 2段階リンク構造（フォールバック）

    // Other test cases
    'https://www.mstage-cmc.jp/',
    'https://www.coresept.co.jp/',
    'https://crossmedia.co.jp/',
    'https://fullout.jp/',
    'https://hallucigenia.co.jp/',
    'https://cijidas.jp/',
    'https://moltsinc.co.jp/company/staut/'
  ];

  urls.forEach(targetUrl => {
    console.log(`\n=== Testing: ${targetUrl} ===`);
    const result = findContactPage(targetUrl);

    console.log('=== Contact Page Finder Results ===');
    console.log(`Target URL: ${targetUrl}`);
    console.log(`Contact URL: ${result.contactUrl}`);
    console.log(`Actual Form URL: ${result.actualFormUrl}`);
    console.log(`Found Keywords: ${result.foundKeywords.join(', ')}`);
    console.log(`Search Method: ${result.searchMethod}`);
    console.log('=====================================');
  });
}
