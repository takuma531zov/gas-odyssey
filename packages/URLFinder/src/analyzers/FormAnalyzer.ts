/**
 * フォーム解析専用ユーティリティ
 * 元のContactPageFinderクラスから分離（ロジック変更なし）
 */

import { SUBMIT_BUTTON_KEYWORDS, HIGH_PRIORITY_CONTACT_KEYWORDS, FORM_KEYWORDS } from '../constants/ContactConstants';

/**
 * Google Forms検出結果
 */
export interface GoogleFormsDetectionResult {
  found: boolean;
  url: string | null;
  type: string;
}

/**
 * 構造化フォーム解析結果
 */
export interface StructuredFormAnalysisResult {
  formCount: number;
  totalFields: number;
  hasContactFields: boolean;
}

/**
 * フォーム要素解析結果
 */
export interface FormElementAnalysisResult {
  isValidForm: boolean;
  reasons: string[];
  keywords: string[];
}

/**
 * フォーム除外判定結果
 */
export interface FormExclusionResult {
  shouldExclude: boolean;
  reason: string;
  priority: string;
}

export class FormAnalyzer {
  
  /**
   * HTMLからGoogle Formsを検出
   * @param html 解析対象のHTML
   * @returns Google Forms検出結果
   */
  static detectGoogleForms(html: string): GoogleFormsDetectionResult {
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
   * フォーム内に送信ボタンが存在するかチェック
   * @param formHTML フォームのHTML
   * @returns 送信ボタンが存在する場合true
   */
  static hasSubmitButtonInForm(formHTML: string): boolean {
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

  /**
   * ボタンHTMLに送信キーワードが含まれているかチェック
   * @param buttonHTML ボタンのHTML
   * @returns 送信キーワードが含まれている場合true
   */
  static containsSubmitKeyword(buttonHTML: string): boolean {
    const lowerHTML = buttonHTML.toLowerCase();

    for (const keyword of SUBMIT_BUTTON_KEYWORDS) {
      if (lowerHTML.includes(keyword.toLowerCase())) {
        console.log(`Submit keyword found: ${keyword}`);
        return true;
      }
    }

    return false;
  }

  /**
   * HTMLに有効な問い合わせフォームが存在するかチェック
   * @param html 検証対象のHTML
   * @returns 有効なフォームが存在する場合true
   */
  static isValidContactForm(html: string): boolean {
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

  /**
   * HTMLにJavaScriptとreCAPTCHAの組み合わせが存在するかチェック
   * @param html 検証対象のHTML
   * @returns JavaScriptフォームの場合true
   */
  static hasScriptAndRecaptcha(html: string): boolean {
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

  /**
   * HTMLからGoogle FormsのURLのみを抽出
   * @param html 検索対象のHTML
   * @returns Google FormsのURL、見つからない場合はnull
   */
  static findGoogleFormUrlsOnly(html: string): string | null {
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

  /**
   * HTMLの構造化フォームを解析
   * @param html 解析対象のHTML
   * @returns 構造化フォーム解析結果
   */
  static analyzeStructuredForms(html: string): StructuredFormAnalysisResult {
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

  /**
   * フォーム要素を詳細解析
   * @param html 解析対象のHTML
   * @returns フォーム要素解析結果
   */
  static analyzeFormElements(html: string): FormElementAnalysisResult {
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
    const hasDirectContactIntent = HIGH_PRIORITY_CONTACT_KEYWORDS.some(keyword =>
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

  /**
   * HTMLに埋め込まれたフォームを検出
   * @param html 検索対象のHTML
   * @returns 埋め込みフォームが存在する場合true
   */
  static findEmbeddedHTMLForm(html: string): boolean {
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

  /**
   * フォーム除外判定
   * @param formTag フォームタグの属性部分
   * @param formContent フォームの内容
   * @param html 全体のHTML
   * @param formIndex フォームの位置
   * @returns 除外判定結果
   */
  static shouldExcludeForm(formTag: string, formContent: string, html: string, formIndex: number): FormExclusionResult {
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
}