/**
 * フォーム検出の統合クラス
 * Step1とStep2のフォーム検証ロジックを統一
 */

import { FormDetectionResult, FormAnalysisResult } from '../../data/types/interfaces';

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
   * フォーム要素の詳細分析
   * @param html HTML文字列
   * @returns フォーム分析結果
   */
  static analyzeFormElements(html: string): FormAnalysisResult {
    let score = 0;
    const reasons: string[] = [];
    let structuredForms = 0;

    // 基本フォーム要素の検出
    const formMatches = html.match(/<form[^>]*>[\s\S]*?<\/form>/gis) || [];
    if (formMatches.length > 0) {
      score += 10;
      reasons.push(`found_${formMatches.length}_forms`);
      structuredForms = formMatches.length;
    }

    // 入力フィールドの検出
    const inputMatches = html.match(/<input[^>]*>/gi) || [];
    if (inputMatches.length > 0) {
      score += Math.min(inputMatches.length * 2, 10);
      reasons.push(`found_${inputMatches.length}_inputs`);
    }

    // 送信ボタンの検出
    const submitPatterns = [
      /<input[^>]*type\s*=\s*['"]submit['"][^>]*>/gi,
      /<button[^>]*type\s*=\s*['"]submit['"][^>]*>/gi,
      /<input[^>]*value\s*=\s*['"][^'"]*送信[^'"]*['"][^>]*>/gi
    ];
    
    let submitButtonCount = 0;
    submitPatterns.forEach(pattern => {
      submitButtonCount += (html.match(pattern) || []).length;
    });
    
    if (submitButtonCount > 0) {
      score += 5;
      reasons.push(`found_${submitButtonCount}_submit_buttons`);
    }

    const isValidForm = score >= 10 && structuredForms > 0;

    return {
      isValidForm,
      score,
      reasons,
      structuredForms
    };
  }
}