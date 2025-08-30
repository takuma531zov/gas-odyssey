/**
 * フォーム抽出処理純粋関数群
 * HTML解析とフォーム検証の関数型実装
 */

import { pipe } from '../../../common/utils/compose';
import {
  SUBMIT_BUTTON_KEYWORDS,
  RECAPTCHA_PATTERNS,
  FORM_ELEMENT_KEYWORDS,
  CONTACT_KEYWORDS,
  CONTACT_FIELD_PATTERNS,
  EMBEDDED_FORM_CONTACT_FIELD_KEYWORDS,
  FORM_EXCLUDE_SEARCH_KEYWORDS,
  FORM_EXCLUDE_ACTIONS,
  FORM_EXCLUDE_CONTEXT_KEYWORDS,
  FORM_CONTEXT_CONTACT_KEYWORDS,
  GOOGLE_FORM_EXCLUDE_KEYWORDS,
  GOOGLE_FORM_CONTACT_KEYWORDS
} from './constants';
import type { ExtractorFormAnalysisResult as FormAnalysisResult, StructuredFormResult, ExtractorGoogleFormResult as GoogleFormResult, FormExclusionResult } from '../../../common/types';

// 純粋関数群

/**
 * ボタンHTMLが送信キーワードを含むかチェック（純粋関数）
 */
export const containsSubmitKeyword = (buttonHTML: string): boolean => {
  const lowerHTML = buttonHTML.toLowerCase();
  return SUBMIT_BUTTON_KEYWORDS.some(keyword => lowerHTML.includes(keyword.toLowerCase()));
};

/**
 * スクリプトとreCAPTCHAの存在確認（純粋関数）
 */
export const hasScriptAndRecaptcha = (html: string): boolean => {
  const hasScript = /<script[^>]*>[\s\S]*?<\/script>/gi.test(html) || /<script[^>]*src=[^>]*>/gi.test(html);
  if (!hasScript) return false;

  return RECAPTCHA_PATTERNS.some(pattern => pattern.test(html));
};

/**
 * 構造化フォーム分析（純粋関数）
 */
export const analyzeStructuredForms = (html: string): StructuredFormResult => {
  let formCount = 0;
  let totalFields = 0;
  let hasContactFields = false;
  const formRegex = /<form[^>]*>([\s\S]*?)<\/form>/gi;
  let formMatch;

  while ((formMatch = formRegex.exec(html)) !== null) {
    const formContent = formMatch[1];
    if (!formContent) continue;
    formCount++;

    const inputRegex = /<(?:input|textarea|select)[^>]*>/gi;
    const inputs = formContent.match(inputRegex) || [];
    let formFieldCount = 0;
    let hasContactSpecificFieldsInForm = false;

    for (const input of inputs) {
      const lowerInput = input.toLowerCase();
      if (lowerInput.includes('type="hidden"') || lowerInput.includes('type="button"') || lowerInput.includes('type="submit"')) {
        continue;
      }
      formFieldCount++;
      if (CONTACT_FIELD_PATTERNS.some(pattern => lowerInput.match(new RegExp(pattern)))) {
        hasContactSpecificFieldsInForm = true;
      }
    }
    totalFields += formFieldCount;
    if (hasContactSpecificFieldsInForm) {
      hasContactFields = true;
    }
  }
  return { formCount, totalFields, hasContactFields };
};

/**
 * フォーム要素分析（純粋関数）
 */
export const analyzeFormElements = (html: string): FormAnalysisResult => {
  const lowerHtml = html.toLowerCase();
  const foundReasons: string[] = [];
  const foundKeywords: string[] = [];

  const structuredFormAnalysis = analyzeStructuredForms(html);
  if (structuredFormAnalysis.formCount > 0) {
    foundReasons.push(`structured_forms:${structuredFormAnalysis.formCount}`);
    foundReasons.push(`form_fields:${structuredFormAnalysis.totalFields}`);
    foundKeywords.push('structured_forms');
  }

  const formElementCount = FORM_ELEMENT_KEYWORDS.filter(element => lowerHtml.includes(element.toLowerCase())).length;
  if (formElementCount >= 3) {
    foundReasons.push(`legacy_form_elements:${formElementCount}`);
    foundKeywords.push('legacy_form_elements');
  }

  const foundContactKeywords = CONTACT_KEYWORDS.filter(keyword => lowerHtml.includes(keyword.toLowerCase()));
  if (foundContactKeywords.length >= 1) {
    foundReasons.push(`contact_keywords:${foundContactKeywords.length}`);
    foundKeywords.push('contact_keywords');
  }

  const isValidForm = isValidContactForm(html);
  if (isValidForm) {
    foundReasons.push('simple_validation:form_with_submit_button');
  }

  return { isValidForm, reasons: foundReasons, keywords: foundKeywords };
};

/**
 * フォーム内の送信ボタン確認（純粋関数）
 */
export const hasSubmitButtonInForm = (formHTML: string): boolean => {
  const submitButtonPatterns = [
    /<input[^>]*type=["|']submit["|'][^>]*>/gis,
    /<input[^>]*type=["|']image["|'][^>]*>/gis,
    /<button[^>]*type=["|']submit["|'][\s\S]*?<\/button>/gis,
    /<button(?![^>]*type=)[^>]*>[\s\S]*?<\/button>/gis
  ];
  return submitButtonPatterns.some(pattern => {
    const matches = formHTML.match(pattern);
    return matches ? matches.some(match => containsSubmitKeyword(match)) : false;
  });
};

/**
 * 有効なコンタクトフォーム判定（純粋関数）
 */
export const isValidContactForm = (html: string): boolean => {
  const formMatches = html.match(/<form[^>]*>[\s\S]*?<\/form>/gis);
  if (formMatches?.some(formHTML => hasSubmitButtonInForm(formHTML))) {
    return true;
  }
  return hasScriptAndRecaptcha(html);
};

/**
 * Googleフォーム検出（純粋関数）
 */
export const detectGoogleForms = (html: string): GoogleFormResult => {
  const googleFormsPatterns = [
    /<a[^>]*href=['']([^'"]*docs\.google\.com\/forms\/d\/[a-zA-Z0-9-_]+\/?[^"'\s\)\]]*)['"][^>]*>/gi,
    /<iframe[^>]*src=['"]([^'"]*docs\.google\.com\/forms\/d\/[a-zA-Z0-9-_]+\/?[^"'\s\)\]]*)['"][^>]*>/gi
  ];

  for (const pattern of googleFormsPatterns) {
    const matches = html.match(pattern);
    if (matches) {
      for (const match of matches) {
        const urlMatch = match.match(/(['"])(.*docs\.google\.com\/forms\/d\/[a-zA-Z0-9-_]+\/?[^"'\s\)]*?)\1/);
        if (urlMatch && urlMatch[2]) {
          return { found: true, url: urlMatch[2], type: pattern.source.includes('<a') ? 'direct_link' : 'iframe_embed' };
        }
      }
    }
  }
  return { found: false, url: null, type: 'none' };
};

/**
 * GoogleフォームURL抽出（純粋関数）
 */
export const findGoogleFormUrlsOnly = (html: string): string | null => {
  const cleanHtml = html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const googleFormPatterns = [
    /https?:\/\/docs\.google\.com\/forms\/d\/[a-zA-Z0-9-_]+\/?[^"'\s\)]+/gi,
    /https?:\/\/forms\.gle\/[^"'\s\)]+/gi,
    /https?:\/\/goo\.gl\/forms\/[^"'\s\)]+/gi
  ];

  for (const pattern of googleFormPatterns) {
    const matches = cleanHtml.match(pattern);
    if (matches) {
      let url = matches[0];
      if (!url.startsWith('http')) url = 'https://' + url;
      if (url.includes('/formResponse')) continue;
      if (!url.includes('/viewform') && url.includes('/forms/d/')) {
        const formIdMatch = url.match(/\/forms\/d\/([^\/\?&#]+)/);
        if (formIdMatch) url = `https:\/\/docs\.google\.com\/forms\/d\/${formIdMatch[1]}\/viewform`;
      }
      return url;
    }
  }
  return null;
};

/**
 * 組み込みHTMLフォーム検出（純粋関数）
 */
export const findEmbeddedHTMLForm = (html: string): boolean => {
  const formRegex = /<form([^>]*?)>([\s\S]*?)<\/form>/gi;
  let formMatch;
  while ((formMatch = formRegex.exec(html)) !== null) {
    const formTag = formMatch[1] || '';
    const formContent = formMatch[2] || '';
    const excludeResult = shouldExcludeForm(formTag, formContent, html, formMatch.index);
    if (excludeResult.shouldExclude) continue;

    const matchingKeywords = EMBEDDED_FORM_CONTACT_FIELD_KEYWORDS.filter(keyword => formContent.toLowerCase().includes(keyword.toLowerCase()));
    if (matchingKeywords.length >= 2) return true;
  }
  return false;
};

/**
 * フォーム除外判定（純粋関数）
 */
export const shouldExcludeForm = (formTag: string, formContent: string, html: string, formIndex: number): FormExclusionResult => {
  const lowerFormTag = formTag.toLowerCase();
  const lowerFormContent = formContent.toLowerCase();
  const method = (lowerFormTag.match(/method\s*=\s*['"]([^'"]*)['"]/) || [])[1];
  const action = (lowerFormTag.match(/action\s*=\s*['"]([^'"]*)['"]/) || [])[1];

  if (method === 'get') {
    if (FORM_EXCLUDE_SEARCH_KEYWORDS.some(keyword => lowerFormContent.includes(keyword) || (action && action.toLowerCase().includes(keyword)))) {
      return { shouldExclude: true, reason: 'GET method with search keywords', priority: 'exclude' };
    }
  }

  if (action) {
    if (FORM_EXCLUDE_ACTIONS.some(pattern => action.toLowerCase().includes(pattern))) {
      return { shouldExclude: true, reason: `Excluded action: ${action}`, priority: 'exclude' };
    }
  }

  const contextStart = Math.max(0, formIndex - 500);
  const contextEnd = Math.min(html.length, formIndex + formContent.length + 500);
  const context = html.substring(contextStart, contextEnd).toLowerCase();
  const foundExcludeKeywords = FORM_EXCLUDE_CONTEXT_KEYWORDS.filter(keyword => context.includes(keyword));
  if (foundExcludeKeywords.length > 0) {
    return { shouldExclude: true, reason: `Context keywords: ${foundExcludeKeywords.join(', ')}`, priority: 'exclude' };
  }

  let priority = 'medium';
  if (method === 'post') {
    priority = 'high';
  } else if (!method) {
    priority = FORM_CONTEXT_CONTACT_KEYWORDS.some(keyword => context.includes(keyword)) ? 'medium' : 'low';
  }

  return { shouldExclude: false, reason: `Valid form (method: ${method || 'unspecified'}, action: ${action || 'unspecified'})`, priority };
};

/**
 * 有意なフォームコンテンツ判定（純粋関数）
 */
export const hasSignificantFormContent = (html: string): boolean => {
  return analyzeFormElements(html).isValidForm;
};

/**
 * GoogleフォームコンテンツValidation（純粋関数）
 */
export const validateGoogleFormContent = (html: string, googleFormUrl: string): boolean => {
  const lowerHtml = html.toLowerCase();
  const formUrlIndex = html.indexOf(googleFormUrl);
  const contextStart = Math.max(0, formUrlIndex - 1000);
  const contextEnd = Math.min(html.length, formUrlIndex + googleFormUrl.length + 1000);
  const context = html.substring(contextStart, contextEnd).toLowerCase();

  if (GOOGLE_FORM_EXCLUDE_KEYWORDS.some(keyword => context.includes(keyword.toLowerCase()))) {
    return false;
  }
  if (GOOGLE_FORM_CONTACT_KEYWORDS.some(keyword => context.includes(keyword.toLowerCase()))) {
    return true;
  }
  if (GOOGLE_FORM_CONTACT_KEYWORDS.some(keyword => lowerHtml.includes(keyword.toLowerCase()))) {
    return true;
  }
  return false;
};

// 高階関数とコンビネータ

/**
 * フォーム分析パイプライン生成（高階関数）
 */
export const createFormAnalysisPipeline = () => 
  pipe(
    analyzeStructuredForms as any,
    (structured: any) => ({ structured, elements: analyzeFormElements }),
    (analysis: any) => ({
      ...analysis,
      isValid: analysis.elements && isValidContactForm
    })
  );

/**
 * フォーム検証フィルタ生成（高階関数）
 */
export const createFormValidator = (validationRules: Array<(html: string) => boolean>) =>
  (html: string): boolean => 
    validationRules.every(rule => rule(html));

/**
 * Google Forms抽出器（カリー化）
 */
export const createGoogleFormExtractor = (patterns: RegExp[]) => 
  (html: string): GoogleFormResult => {
    for (const pattern of patterns) {
      const matches = html.match(pattern);
      if (matches) {
        return detectGoogleForms(html);
      }
    }
    return { found: false, url: null, type: 'none' };
  };

// 後方互換性のためのクラス（段階的移行用）
export class FormUtils {
  static containsSubmitKeyword = containsSubmitKeyword;
  static hasScriptAndRecaptcha = hasScriptAndRecaptcha;
  static analyzeFormElements = analyzeFormElements;
  static analyzeStructuredForms = analyzeStructuredForms;
  static isValidContactForm = isValidContactForm;
  static hasSubmitButtonInForm = hasSubmitButtonInForm;
  static detectGoogleForms = detectGoogleForms;
  static findGoogleFormUrlsOnly = findGoogleFormUrlsOnly;
  static findEmbeddedHTMLForm = findEmbeddedHTMLForm;
  static shouldExcludeForm = shouldExcludeForm;
  static hasSignificantFormContent = hasSignificantFormContent;
  static validateGoogleFormContent = validateGoogleFormContent;
}