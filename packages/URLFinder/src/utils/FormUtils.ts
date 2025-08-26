import { FormUtils as CustomFormUtils } from './FormUtils';
import { HtmlUtils } from './HtmlUtils';
import { NetworkUtils } from './NetworkUtils';
import { StringUtils } from './StringUtils';
import type { ContactPageResult } from '../types/interfaces';
import { SearchState } from '../core/SearchState';
import { Environment } from '../env';

export class FormUtils {
  static readonly SUBMIT_BUTTON_KEYWORDS = [
    '送信', '送る', 'submit', 'send',
    'お問い合わせ', '問い合わせ', 'お問合せ', '問合せ',
    'ご相談', '相談', 'contact', 'inquiry'
  ];

  static containsSubmitKeyword(buttonHTML: string): boolean {
    const lowerHTML = buttonHTML.toLowerCase();
    return this.SUBMIT_BUTTON_KEYWORDS.some(keyword => lowerHTML.includes(keyword.toLowerCase()));
  }

  static hasScriptAndRecaptcha(html: string): boolean {
    const hasScript = /<script[^>]*>[\s\S]*?<\/script>/gi.test(html) || /<script[^>]*src=[^>]*>/gi.test(html);
    if (!hasScript) return false;

    const recaptchaPatterns = [
      /https:\/\/www\.google\.com\/recaptcha\/api\.js/gi,
      /recaptcha\/api\.js/gi,
      /<div[^>]*class=["|'][^"|']*g-recaptcha[^"|']*["|']/gi,
      /<div[^>]*id=["|'][^"|']*recaptcha[^"|']*["|']/gi,
      /data-sitekey=["|'][^"|']*["|']/gi,
      /私はロボットではありません/gi,
      /I'm not a robot/gi,
      /reCAPTCHA/gi
    ];

    return recaptchaPatterns.some(pattern => pattern.test(html));
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

    const formElements = [
      'お名前', 'メールアドレス', '電話番号', 'ご質問', 'お問い合わせ内容', '会社名',
      'name', 'email', 'phone', 'message', 'inquiry', 'company',
      '<input', '<textarea', '<select', 'type="text"', 'type="email"', 'type="tel"'
    ];

    const formElementCount = formElements.filter(element => lowerHtml.includes(element.toLowerCase())).length;
    if (formElementCount >= 3) {
      foundReasons.push(`legacy_form_elements:${formElementCount}`);
      foundKeywords.push('legacy_form_elements');
    }

    const contactKeywords = [
      'お問い合わせ', '問い合わせ', 'お問合せ', '問合せ',
      'contact', 'inquiry', 'ご相談', '相談'
    ];

    const foundContactKeywords = contactKeywords.filter(keyword => lowerHtml.includes(keyword.toLowerCase()));
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
        const contactFieldPatterns = [
          'name="(?:.*(?:name|名前|氏名))"', 'name="(?:.*(?:email|メール))"',
          'name="(?:.*(?:phone|電話|tel))"', 'name="(?:.*(?:company|会社))"',
          'name="(?:.*(?:message|メッセージ|質問|問い合わせ|inquiry))"'
        ];
        if (contactFieldPatterns.some(pattern => lowerInput.match(new RegExp(pattern)))) {
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

      const contactFieldKeywords = [
        '御社名', 'お名前', 'メールアドレス', '電話番号', 'ご質問',
        'company', 'name', 'email', 'phone', 'message', 'inquiry',
        '会社名', '名前', 'メール', '問い合わせ', '質問',
        '送信', 'submit', '送る', 'send', '確認', 'confirm'
      ];
      const matchingKeywords = contactFieldKeywords.filter(keyword => formContent.toLowerCase().includes(keyword.toLowerCase()));
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
      const searchKeywords = ['search', 'filter', 'sort', '検索', 'フィルター', 'ソート', 'find', 'query'];
      if (searchKeywords.some(keyword => lowerFormContent.includes(keyword) || (action && action.toLowerCase().includes(keyword)))) {
        return { shouldExclude: true, reason: 'GET method with search keywords', priority: 'exclude' };
      }
    }

    if (action) {
      const excludeActions = ['/search', '/filter', '/sort', '?search', '?q=', '?query=', '/newsletter', '/subscribe', '/download', '/signup', '/login', '/register', '/member', '/formresponse', 'formresponse'];
      if (excludeActions.some(pattern => action.toLowerCase().includes(pattern))) {
        return { shouldExclude: true, reason: `Excluded action: ${action}`, priority: 'exclude' };
      }
    }

    const contextStart = Math.max(0, formIndex - 500);
    const contextEnd = Math.min(html.length, formIndex + formContent.length + 500);
    const context = html.substring(contextStart, contextEnd).toLowerCase();
    const excludeContextKeywords = ['newsletter', 'subscribe', 'メルマガ', 'ニュースレター', 'download', 'ダウンロード', '資料請求', '資料ダウンロード', 'survey', 'questionnaire', 'アンケート', 'feedback', 'search', 'filter', '検索', 'フィルター'];
    const foundExcludeKeywords = excludeContextKeywords.filter(keyword => context.includes(keyword));
    if (foundExcludeKeywords.length > 0) {
      return { shouldExclude: true, reason: `Context keywords: ${foundExcludeKeywords.join(', ')}`, priority: 'exclude' };
    }

    let priority = 'medium';
    if (method === 'post') {
      priority = 'high';
    } else if (!method) {
      const contactContextKeywords = ['contact', 'inquiry', 'お問い合わせ', '問い合わせ', 'ご相談'];
      priority = contactContextKeywords.some(keyword => context.includes(keyword)) ? 'medium' : 'low';
    }

    return { shouldExclude: false, reason: `Valid form (method: ${method || 'unspecified'}, action: ${action || 'unspecified'})`, priority };
  }

  static hasSignificantFormContent(html: string): boolean {
    return this.analyzeFormElements(html).isValidForm;
  }

  static validateGoogleFormContent(html: string, googleFormUrl: string): boolean {
    const excludeKeywords = ['ライター', 'writer', '募集', 'recruit', 'recruitment', 'career', 'job', 'hire', 'employment', '採用', '求人', '応募', 'apply', 'application', '資料請求', 'download', 'material', 'brochure', 'request', 'アンケート', 'survey', 'questionnaire', 'feedback', 'セミナー', 'seminar', 'webinar', 'event', 'workshop', 'メルマガ', 'newsletter', 'subscription', 'subscribe'];
    const contactKeywords = ['お問い合わせ', '問い合わせ', 'お問合せ', '問合せ', 'contact', 'inquiry', 'ご相談', '相談', 'support', 'business inquiry', 'general inquiry'];
    const lowerHtml = html.toLowerCase();
    const formUrlIndex = html.indexOf(googleFormUrl);
    const contextStart = Math.max(0, formUrlIndex - 1000);
    const contextEnd = Math.min(html.length, formUrlIndex + googleFormUrl.length + 1000);
    const context = html.substring(contextStart, contextEnd).toLowerCase();

    if (excludeKeywords.some(keyword => context.includes(keyword.toLowerCase()))) {
      return false;
    }
    if (contactKeywords.some(keyword => context.includes(keyword.toLowerCase()))) {
      return true;
    }
    if (contactKeywords.some(keyword => lowerHtml.includes(keyword.toLowerCase()))) {
      return true;
    }
    return false;
  }
}
