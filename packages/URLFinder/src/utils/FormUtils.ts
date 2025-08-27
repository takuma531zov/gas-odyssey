import { FormUtils as CustomFormUtils } from './FormUtils';
import { HtmlUtils } from './HtmlUtils';
import { NetworkUtils } from './NetworkUtils';
import { StringUtils } from './StringUtils';
import type { ContactPageResult } from '../types/interfaces';
import { SearchState } from '../core/SearchState';
import { Environment } from '../env';
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
} from '../constants/form_constants';

export class FormUtils {

  static containsSubmitKeyword(buttonHTML: string): boolean {
    const lowerHTML = buttonHTML.toLowerCase();
    return SUBMIT_BUTTON_KEYWORDS.some(keyword => lowerHTML.includes(keyword.toLowerCase()));
  }

  static hasScriptAndRecaptcha(html: string): boolean {
    const hasScript = /<script[^>]*>[\s\S]*?<\/script>/gi.test(html) || /<script[^>]*src=[^>]*>/gi.test(html);
    if (!hasScript) return false;

    return RECAPTCHA_PATTERNS.some(pattern => pattern.test(html));
  }

  static analyzeFormElements(html: string): { isValidForm: boolean, reasons: string[], keywords: string[] } {
    const lowerHtml = html.toLowerCase();
    const foundReasons: string[] = [];
    const foundKeywords: string[] = [];

    const structuredFormAnalysis = this.analyzeStructuredForms(html);
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

    const isValidForm = this.isValidContactForm(html);
    if (isValidForm) {
      foundReasons.push('simple_validation:form_with_submit_button');
    }

    return { isValidForm, reasons: foundReasons, keywords: foundKeywords };
  }

  static analyzeStructuredForms(html: string): { formCount: number, totalFields: number, hasContactFields: boolean } {
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
  }

  static isValidContactForm(html: string): boolean {
    const formMatches = html.match(/<form[^>]*>[\s\S]*?<\/form>/gis);
    if (formMatches?.some(formHTML => this.hasSubmitButtonInForm(formHTML))) {
      return true;
    }
    return this.hasScriptAndRecaptcha(html);
  }

  static hasSubmitButtonInForm(formHTML: string): boolean {
    const submitButtonPatterns = [
      /<input[^>]*type=["|']submit["|'][^>]*>/gis,
      /<input[^>]*type=["|']image["|'][^>]*>/gis,
      /<button[^>]*type=["|']submit["|'][\s\S]*?<\/button>/gis,
      /<button(?![^>]*type=)[^>]*>[\s\S]*?<\/button>/gis
    ];
    return submitButtonPatterns.some(pattern => {
      const matches = formHTML.match(pattern);
      return matches ? matches.some(match => this.containsSubmitKeyword(match)) : false;
    });
  }

  static detectGoogleForms(html: string): { found: boolean; url: string | null; type: string } {
    const googleFormsPatterns = [
  /<a[^>]*href=['"]([^'"']*docs\.google\.com\/forms\/d\/[a-zA-Z0-9-_]+\/?[^"'\s\)\]]*)['"][^>]*>/gi,
  /<iframe[^>]*src=['"]([^'"']*docs\.google\.com\/forms\/d\/[a-zA-Z0-9-_]+\/?[^"'\s\)\]]*)['"][^>]*>/gi
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
  }

  static findGoogleFormUrlsOnly(html: string): string | null {
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
  }

  static findEmbeddedHTMLForm(html: string): boolean {
    const formRegex = /<form([^>]*?)>([\s\S]*?)<\/form>/gi;
    let formMatch;
    while ((formMatch = formRegex.exec(html)) !== null) {
      const formTag = formMatch[1] || '';
      const formContent = formMatch[2] || '';
      const excludeResult = this.shouldExcludeForm(formTag, formContent, html, formMatch.index);
      if (excludeResult.shouldExclude) continue;

      const matchingKeywords = EMBEDDED_FORM_CONTACT_FIELD_KEYWORDS.filter(keyword => formContent.toLowerCase().includes(keyword.toLowerCase()));
      if (matchingKeywords.length >= 2) return true;
    }
    return false;
  }

  static shouldExcludeForm(formTag: string, formContent: string, html: string, formIndex: number): { shouldExclude: boolean, reason: string, priority: string } {
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
  }

  static hasSignificantFormContent(html: string): boolean {
    return this.analyzeFormElements(html).isValidForm;
  }

  static validateGoogleFormContent(html: string, googleFormUrl: string): boolean {
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
  }
}
