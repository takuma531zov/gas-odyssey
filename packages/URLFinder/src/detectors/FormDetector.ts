/**
 * フォーム検出の統合クラス
 * Step1とStep2のフォーム検証ロジックを統一
 */

import { FormDetectionResult, FormAnalysisResult } from '../types/interfaces';

export class FormDetector {
  
  /**
   * 任意のフォーム検出（HTML/Google Forms/reCAPTCHA）
   * @param html HTML文字列
   * @returns フォーム検出結果
   */
  static detectAnyForm(html: string): FormDetectionResult {
    console.log('Starting comprehensive form detection...');

    // 1. HTMLフォーム検証（最優先）
    if (this.detectHtmlForm(html)) {
      console.log('✅ HTML form detected');
      return {
        found: true,
        formType: 'html',
        confidence: 90
      };
    }

    // 2. Google Forms検証
    const googleFormResult = this.detectGoogleForms(html);
    if (googleFormResult.found && googleFormResult.url) {
      console.log('✅ Google Forms detected');
      return {
        found: true,
        formUrl: googleFormResult.url,
        formType: 'google_forms',
        confidence: 95
      };
    }

    // 3. reCAPTCHA検証（JavaScript動的フォーム）
    if (this.detectRecaptchaForm(html)) {
      console.log('✅ reCAPTCHA form detected');
      return {
        found: true,
        formType: 'recaptcha',
        confidence: 70
      };
    }

    // 4. 埋め込みフォーム検証
    if (this.detectEmbeddedForm(html)) {
      console.log('✅ Embedded form detected');
      return {
        found: true,
        formType: 'embedded',
        confidence: 60
      };
    }

    console.log('❌ No forms detected');
    return {
      found: false,
      formType: 'html',
      confidence: 0
    };
  }

  /**
   * HTMLフォーム検証（構造化フォーム）
   * @param html HTML文字列
   * @returns HTMLフォームが存在するか
   */
  private static detectHtmlForm(html: string): boolean {
    console.log('Starting simple contact form validation...');

    // 条件1: <form> + 送信要素検出
    const formMatches = html.match(/<form[^>]*>[\s\S]*?<\/form>/gis);

    if (formMatches && formMatches.length > 0) {
      console.log(`Found ${formMatches.length} form(s), checking for submit buttons...`);

      // 各form要素内で送信系ボタンをチェック
      for (let i = 0; i < formMatches.length; i++) {
        const formHTML = formMatches[i];
        if (formHTML && this.hasSubmitButtonInForm(formHTML)) {
          console.log(`Form ${i + 1}: Has submit button`);
          return true;
        }
      }
    } else {
      console.log('No form elements found');
    }

    console.log('No forms with submit buttons found');
    
    // JavaScript フォーム検出: <script> + reCAPTCHA の組み合わせ
    console.log('Checking for JavaScript forms with reCAPTCHA...');
    return this.hasScriptAndRecaptcha(html);
  }

  /**
   * Google Forms検証
   * @param html HTML文字列
   * @returns Google Forms検出結果
   */
  private static detectGoogleForms(html: string): { found: boolean, url?: string } {
    // Remove CSS and script content to focus on HTML
    const cleanHtml = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

    // Google Forms patterns
    const googleFormPatterns = [
      /https:\/\/docs\.google\.com\/forms\/d\/([a-zA-Z0-9-_]+)/g,
      /docs\.google\.com\/forms\/d\/([a-zA-Z0-9-_]+)/g,
      /forms\.gle\/([a-zA-Z0-9-_]+)/g
    ];

    for (const pattern of googleFormPatterns) {
      const matches = Array.from(cleanHtml.matchAll(pattern));
      if (matches.length > 0 && matches[0] && matches[0][0]) {
        const fullUrl = matches[0][0].startsWith('http') 
          ? matches[0][0] 
          : `https://${matches[0][0]}`;
        
        console.log(`Google Form URL found: ${fullUrl}`);
        return { found: true, url: fullUrl };
      }
    }

    return { found: false };
  }

  /**
   * reCAPTCHA検証（JavaScript動的フォーム）
   * @param html HTML文字列
   * @returns reCAPTCHAフォームが存在するか
   */
  private static detectRecaptchaForm(html: string): boolean {
    return this.hasScriptAndRecaptcha(html);
  }

  /**
   * 埋め込みフォーム検証
   * @param html HTML文字列
   * @returns 埋め込みフォームが存在するか
   */
  private static detectEmbeddedForm(html: string): boolean {
    // 外部フォームサービスのパターン
    const embeddedFormPatterns = [
      /form\.run/i,
      /typeform\.com/i,
      /hubspot\.com.*form/i,
      /wufoo\.com/i,
      /jotform\.com/i,
      /formstack\.com/i,
      /ninja-forms/i,
      /contact-form-7/i
    ];

    const lowerHtml = html.toLowerCase();
    return embeddedFormPatterns.some(pattern => pattern.test(lowerHtml));
  }

  /**
   * フォーム内に送信ボタンがあるかチェック
   * @param formHtml フォームのHTML
   * @returns 送信ボタンが存在するか
   */
  private static hasSubmitButtonInForm(formHtml: string): boolean {
    const submitPatterns = [
      /<input[^>]*type\s*=\s*['"]submit['"][^>]*>/i,
      /<input[^>]*type\s*=\s*['"]image['"][^>]*>/i,
      /<button[^>]*type\s*=\s*['"]submit['"][^>]*>/i,
      /<button(?![^>]*type\s*=)[^>]*>/i, // buttonタグでtype未指定（デフォルトsubmit）
      /<input[^>]*value\s*=\s*['"][^'"]*送信[^'"]*['"][^>]*>/i,
      /<input[^>]*value\s*=\s*['"][^'"]*submit[^'"]*['"][^>]*>/i
    ];

    return submitPatterns.some(pattern => pattern.test(formHtml));
  }

  /**
   * JavaScript + reCAPTCHA の組み合わせチェック
   * @param html HTML文字列
   * @returns JavaScript + reCAPTCHAが存在するか
   */
  private static hasScriptAndRecaptcha(html: string): boolean {
    const hasScript = /<script[^>]*>[\s\S]*?<\/script>/i.test(html);
    const hasRecaptcha = /recaptcha/i.test(html);

    const result = hasScript && hasRecaptcha;
    console.log(`JavaScript forms check: script=${hasScript}, recaptcha=${hasRecaptcha}, result=${result}`);
    
    return result;
  }

  /**
   * フォーム要素の詳細分析（index.tsから移植・最適版完全移植）
   * @param html HTML文字列
   * @returns フォーム分析結果
   */
  static analyzeFormElements(html: string): { isValidForm: boolean, reasons: string[], keywords: string[] } {
    const lowerHtml = html.toLowerCase();
    const foundReasons: string[] = [];
    const foundKeywords: string[] = [];

    // A. 構造化フォーム解析（新規追加）
    const structuredFormAnalysis = this.analyzeStructuredForms(html);
    if (structuredFormAnalysis.formCount > 0) {
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
      '送信', 'submit', 'send', 'button', 'input type="submit"'
    ];

    let submitElementCount = 0;
    for (const element of legacySubmitElements) {
      if (lowerHtml.includes(element.toLowerCase())) {
        submitElementCount++;
      }
    }

    const hasSubmitElements = submitElementCount >= 1;
    if (hasSubmitElements) {
      foundReasons.push(`submit_elements:${submitElementCount}`);
      foundKeywords.push('submit_elements');
    }

    // D. スクリプト系フォーム検証（新規追加）
    const hasScript = this.hasScriptAndRecaptcha(html);
    if (hasScript) {
      foundReasons.push('script_recaptcha_detected');
      foundKeywords.push('script_form');
    }

    // 最終判定（新しい統合ロジック）
    const hasMinimumStructure = structuredFormAnalysis.formCount > 0 || hasLegacyFormElements;
    const hasInteraction = hasSubmitElements || hasScript;
    const hasContactIntent = hasContactKeywords || isValidForm;

    const isValidFormPage = hasMinimumStructure && hasInteraction && hasContactIntent;

    console.log(`Form analysis: structure=${hasMinimumStructure}, interaction=${hasInteraction}, intent=${hasContactIntent} -> valid=${isValidFormPage}`);
    console.log(`Form analysis reasons: ${foundReasons.join(',')}`);

    return {
      isValidForm: isValidFormPage,
      reasons: foundReasons,
      keywords: foundKeywords
    };
  }

  /**
   * 構造化フォーム分析（index.tsから移植・最適版完全移植）
   * @param html HTML文字列
   * @returns 構造化フォーム分析結果
   */
  private static analyzeStructuredForms(html: string): { formCount: number, totalFields: number, hasContactFields: boolean } {
    console.log('Analyzing structured forms in HTML content');
    
    const formMatches = html.match(/<form[^>]*>[\s\S]*?<\/form>/gi) || [];
    console.log(`Found ${formMatches.length} form tags`);

    let totalFields = 0;
    let hasContactFields = false;

    for (const form of formMatches) {
      // Input fields
      const inputMatches = form.match(/<input[^>]*>/gi) || [];
      const textareaMatches = form.match(/<textarea[^>]*>/gi) || [];
      const selectMatches = form.match(/<select[^>]*>/gi) || [];
      
      const formFieldCount = inputMatches.length + textareaMatches.length + selectMatches.length;
      totalFields += formFieldCount;

      // Contact field detection
      const contactPatterns = [
        /name/i, /email/i, /phone/i, /tel/i, /message/i, /inquiry/i,
        /お名前/i, /メール/i, /電話/i, /問い合わせ/i, /メッセージ/i
      ];

      for (const pattern of contactPatterns) {
        if (pattern.test(form)) {
          hasContactFields = true;
          break;
        }
      }

      console.log(`Form analysis: ${formFieldCount} fields, contact fields: ${hasContactFields}`);
    }

    return {
      formCount: formMatches.length,
      totalFields,
      hasContactFields
    };
  }

  /**
   * 有効な問い合わせフォーム判定（index.tsから移植・最適版完全移植）
   * @param html HTML文字列
   * @returns 有効な問い合わせフォームかどうか
   */
  static isValidContactForm(html: string): boolean {
    console.log('Validating contact form with enhanced criteria');
    
    const lowerHtml = html.toLowerCase();
    
    // 1. フォーム要素の存在確認
    const hasFormTag = lowerHtml.includes('<form');
    const hasInput = lowerHtml.includes('<input') || lowerHtml.includes('<textarea');
    
    if (!hasFormTag || !hasInput) {
      console.log('Missing basic form elements');
      return false;
    }
    
    // 2. 問い合わせ関連フィールドの確認
    const contactFields = [
      'name', 'email', 'phone', 'message', 'inquiry',
      'お名前', 'メール', '電話', 'メッセージ', '問い合わせ', '件名'
    ];
    
    let contactFieldCount = 0;
    for (const field of contactFields) {
      if (lowerHtml.includes(field)) {
        contactFieldCount++;
      }
    }
    
    // 3. 送信ボタンの確認
    const hasSubmitButton = this.hasSubmitButtonInForm(html);
    
    // 4. 最終判定
    const isValid = contactFieldCount >= 2 && hasSubmitButton;
    
    console.log(`Contact form validation: fields=${contactFieldCount}, submit=${hasSubmitButton} -> valid=${isValid}`);
    return isValid;
  }

  /**
   * Google Formsの内容を検証（index.tsから移植・最適版完全移植）
   * @param html HTML文字列
   * @param googleFormUrl Google FormsのURL
   * @returns 問い合わせフォームかどうか
   */
  static validateGoogleFormContent(html: string, googleFormUrl: string): boolean {
    // 除外すべきキーワード（BtoB営業用途に関係ないフォーム）
    const excludeKeywords = [
      'ライター', 'writer', '募集', 'recruit', 'recruitment', 'career', 'job', 'hire', 'employment',
      'アンケート', 'survey', 'questionnaire', 'poll', 'vote', 'voting',
      'セミナー', 'seminar', 'webinar', 'workshop', 'training', 'course',
      'イベント', 'event', 'conference', 'meeting', 'registration', '参加登録',
      'newsletter', 'subscription', 'メルマガ', 'ニュースレター'
    ];

    const combinedContent = `${html} ${googleFormUrl}`.toLowerCase();

    // 除外キーワードチェック
    for (const keyword of excludeKeywords) {
      if (combinedContent.includes(keyword.toLowerCase())) {
        console.log(`Google Form excluded due to keyword: ${keyword}`);
        return false;
      }
    }

    // 問い合わせ関連キーワードの存在確認
    const contactKeywords = [
      'お問い合わせ', '問い合わせ', 'contact', 'inquiry', 'enquiry',
      'ご相談', '相談', 'consultation', 'request', 'quote'
    ];

    let contactKeywordCount = 0;
    for (const keyword of contactKeywords) {
      if (combinedContent.includes(keyword.toLowerCase())) {
        contactKeywordCount++;
      }
    }

    const isValidContactForm = contactKeywordCount > 0;
    console.log(`Google Form validation: contact keywords found: ${contactKeywordCount}, valid: ${isValidContactForm}`);
    
    return isValidContactForm;
  }
}