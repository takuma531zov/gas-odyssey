/**
 * フォーム検出ドメイン関数群
 * 統合フォーム検証ロジックの関数型実装
 */

import { FormDetectionResult, FormAnalysisResult } from '../../data/types/interfaces';

// 型定義
type FormDetectionConfig = {
  enableGoogleForms: boolean;
  enableRecaptcha: boolean;
  enableEmbedded: boolean;
  minConfidence: number;
};

// 純粋関数群

/**
 * HTMLフォーム検証（純粋関数）
 */
export const detectHtmlForm = (html: string): boolean => {
  console.log('Starting simple contact form validation...');

  const formMatches = html.match(/<form[^>]*>[\s\S]*?<\/form>/gis);

  if (formMatches && formMatches.length > 0) {
    console.log(`Found ${formMatches.length} form(s), checking for submit buttons...`);

    for (let i = 0; i < formMatches.length; i++) {
      const formHTML = formMatches[i];
      if (formHTML && hasSubmitButtonInForm(formHTML)) {
        console.log(`Form ${i + 1}: Has submit button`);
        return true;
      }
    }
  } else {
    console.log('No form elements found');
  }

  console.log('No forms with submit buttons found');
  console.log('Checking for JavaScript forms with reCAPTCHA...');
  return hasScriptAndRecaptcha(html);
};

/**
 * Google Forms検証（純粋関数）
 */
export const detectGoogleForms = (html: string): { found: boolean, url?: string } => {
  const cleanHtml = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

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
};

/**
 * reCAPTCHA検証（純粋関数）
 */
export const detectRecaptchaForm = (html: string): boolean => {
  return hasScriptAndRecaptcha(html);
};

/**
 * 埋め込みフォーム検証（純粋関数）
 */
export const detectEmbeddedForm = (html: string): boolean => {
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
};

/**
 * フォーム内送信ボタン検証（純粋関数）
 */
export const hasSubmitButtonInForm = (formHtml: string): boolean => {
  const submitPatterns = [
    /<input[^>]*type\s*=\s*['"]submit['"][^>]*>/i,
    /<input[^>]*type\s*=\s*['"]image['"][^>]*>/i,
    /<button[^>]*type\s*=\s*['"]submit['"][^>]*>/i,
    /<button(?![^>]*type\s*=)[^>]*>/i,
    /<input[^>]*value\s*=\s*['"][^'"]*送信[^'"]*['"][^>]*>/i,
    /<input[^>]*value\s*=\s*['"][^'"]*submit[^'"]*['"][^>]*>/i
  ];

  return submitPatterns.some(pattern => pattern.test(formHtml));
};

/**
 * JavaScript + reCAPTCHA組み合わせチェック（純粋関数）
 */
export const hasScriptAndRecaptcha = (html: string): boolean => {
  const hasScript = /<script[^>]*>[\s\S]*?<\/script>/i.test(html);
  const hasRecaptcha = /recaptcha/i.test(html);

  const result = hasScript && hasRecaptcha;
  console.log(`JavaScript forms check: script=${hasScript}, recaptcha=${hasRecaptcha}, result=${result}`);
  
  return result;
};

/**
 * フォーム要素分析（純粋関数）
 */
export const analyzeFormElements = (html: string): FormAnalysisResult => {
  let score = 0;
  const reasons: string[] = [];
  let structuredForms = 0;

  const formMatches = html.match(/<form[^>]*>[\s\S]*?<\/form>/gis) || [];
  if (formMatches.length > 0) {
    score += 10;
    reasons.push(`found_${formMatches.length}_forms`);
    structuredForms = formMatches.length;
  }

  const inputMatches = html.match(/<input[^>]*>/gi) || [];
  if (inputMatches.length > 0) {
    score += Math.min(inputMatches.length * 2, 10);
    reasons.push(`found_${inputMatches.length}_inputs`);
  }

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
};

// 高階関数とコンビネータ

/**
 * フォーム検証パイプライン生成（高階関数）
 */
export const createFormDetectionPipeline = (config: FormDetectionConfig) => 
  (html: string): FormDetectionResult => {
    const detectors = [
      { name: 'html', detect: detectHtmlForm, confidence: 90, enabled: true },
      { name: 'google_forms', detect: detectGoogleForms, confidence: 95, enabled: config.enableGoogleForms },
      { name: 'recaptcha', detect: detectRecaptchaForm, confidence: 70, enabled: config.enableRecaptcha },
      { name: 'embedded', detect: detectEmbeddedForm, confidence: 60, enabled: config.enableEmbedded }
    ];

    for (const detector of detectors) {
      if (!detector.enabled || detector.confidence < config.minConfidence) continue;
      
      const result = detector.detect(html);
      if (result === true || (typeof result === 'object' && result.found)) {
        console.log(`✅ ${detector.name} form detected`);
        return {
          found: true,
          formType: detector.name as any,
          confidence: detector.confidence,
          ...(typeof result === 'object' && result.url && { formUrl: result.url })
        };
      }
    }

    console.log('❌ No forms detected');
    return {
      found: false,
      formType: 'html',
      confidence: 0
    };
  };

/**
 * フォーム検証フィルタ（カリー化）
 */
export const createFormFilter = (minScore: number) =>
  (analysis: FormAnalysisResult): boolean =>
    analysis.isValidForm && analysis.score >= minScore;

/**
 * フォーム検証コンポーザ（関数合成）
 */
export const composeFormValidators = (...validators: Array<(html: string) => boolean>) =>
  (html: string): boolean =>
    validators.every(validator => validator(html));

/**
 * 総合フォーム検出関数（メインAPI）
 */
export const detectAnyForm = (html: string): FormDetectionResult => {
  console.log('Starting comprehensive form detection...');

  const defaultConfig: FormDetectionConfig = {
    enableGoogleForms: true,
    enableRecaptcha: true,
    enableEmbedded: true,
    minConfidence: 0
  };

  return createFormDetectionPipeline(defaultConfig)(html);
};

// 後方互換性のためのクラス（段階的移行用）
export class FormDetector {
  static detectAnyForm = detectAnyForm;
  static analyzeFormElements = analyzeFormElements;
  
  // 旧来のprivateメソッドも互換性のためエクスポート
  static detectHtmlForm = detectHtmlForm;
  static detectGoogleForms = detectGoogleForms;
  static detectRecaptchaForm = detectRecaptchaForm;
  static detectEmbeddedForm = detectEmbeddedForm;
  static hasSubmitButtonInForm = hasSubmitButtonInForm;
  static hasScriptAndRecaptcha = hasScriptAndRecaptcha;
}