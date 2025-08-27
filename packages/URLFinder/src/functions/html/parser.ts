import type { ContactPageResult, PurityResult, HtmlSearchResult } from '../../data/types/interfaces';
import { hashString, isAnchorLink, isValidEncoding } from '../network/validation';
import { resolveUrl, isHomepageUrl, fetchWithTimeout } from '../network/fetch';
import { FormUtils } from './extractor';
import { SearchState } from '../../pipelines/state';
import {
  FORM_LINK_PATTERNS,
  FORM_TEXT_PATTERNS
} from '../../data/constants/html_patterns';
import {
  ANCHOR_SECTION_CONTACT_KEYWORDS,
  HTML_HIGH_PRIORITY_CONTACT_KEYWORDS,
  HTML_MEDIUM_PRIORITY_CONTACT_KEYWORDS,
  HTML_EXCLUDED_KEYWORDS,
  FORM_LINK_NEGATIVE_KEYWORDS
} from '../../data/constants/html_keywords';

// 純粋関数版の主要関数

/**
 * 同じHTMLパターンを検出（関数型）
 */
export const detectSameHtmlPattern = (urls: string[], htmlContent: string, searchState: SearchState): boolean => {
  const contentHash = hashString(htmlContent);
  let sameCount = 0;

  for (const url of urls) {
    const cachedHash = searchState.getHtmlCache(url);
    if (cachedHash === contentHash) {
      sameCount++;
    } else {
      searchState.setHtmlCache(url, contentHash);
    }
  }
  return sameCount >= 2;
};

/**
 * SPA分析実行（関数型）
 */
export const executeSPAAnalysis = (html: string, baseUrl: string): ContactPageResult => {
  try {
    const navResult = searchInNavigation(html, baseUrl);
    if (navResult.url && isAnchorLink(navResult.url)) {
      const anchorSectionResult = analyzeAnchorSection(html, navResult.url, baseUrl);
      if (anchorSectionResult.contactUrl) {
        anchorSectionResult.searchMethod = 'spa_anchor_analysis';
        anchorSectionResult.foundKeywords.push('spa_detected');
        return anchorSectionResult;
      }
    }
    return { contactUrl: null, actualFormUrl: null, foundKeywords: ['spa_detected', 'anchor_analysis_failed'], searchMethod: 'spa_analysis_failed' };
  } catch (error) {
    return { contactUrl: null, actualFormUrl: null, foundKeywords: ['spa_detected', 'spa_analysis_error'], searchMethod: 'spa_analysis_error' };
  }
};

/**
 * 問い合わせ純度計算（関数型）
 */
export const calculateContactPurity = (url: string, linkText: string): PurityResult => {
  let score = 0;
  const reasons: string[] = [];
  const foundKeywords = new Set<string>();

  const lowerUrl = url.toLowerCase();
  const lowerLinkText = linkText.toLowerCase();

  // 除外キーワードチェック（関数型）
  const excludedMatch = HTML_EXCLUDED_KEYWORDS.find(keyword =>
    lowerUrl.includes(keyword.toLowerCase()) || lowerLinkText.includes(keyword.toLowerCase())
  );

  if (excludedMatch) {
    score -= 15;
    reasons.push(`excluded:${excludedMatch}`);
    return { score, reasons };
  }

  // 高優先度キーワードチェック（関数型）
  HTML_HIGH_PRIORITY_CONTACT_KEYWORDS
    .filter(keyword => {
      const normalizedKeyword = keyword.toLowerCase();
      return (lowerLinkText.includes(normalizedKeyword) || lowerUrl.includes(normalizedKeyword))
        && !foundKeywords.has(normalizedKeyword);
    })
    .forEach(keyword => {
      const normalizedKeyword = keyword.toLowerCase();
      if (lowerLinkText.includes(normalizedKeyword)) {
        score += 10;
        reasons.push(`high_priority_text:${keyword}`);
      } else if (lowerUrl.includes(normalizedKeyword)) {
        score += 8;
        reasons.push(`high_priority_url:${keyword}`);
      }
      foundKeywords.add(normalizedKeyword);
    });

  // 中優先度キーワードチェック（関数型）
  HTML_MEDIUM_PRIORITY_CONTACT_KEYWORDS
    .filter(keyword => {
      const normalizedKeyword = keyword.toLowerCase();
      return (lowerLinkText.includes(normalizedKeyword) || lowerUrl.includes(normalizedKeyword))
        && !foundKeywords.has(normalizedKeyword);
    })
    .forEach(keyword => {
      const normalizedKeyword = keyword.toLowerCase();
      if (lowerLinkText.includes(normalizedKeyword)) {
        score += 3;
        reasons.push(`medium_priority_text:${keyword}`);
      } else if (lowerUrl.includes(normalizedKeyword)) {
        score += 2;
        reasons.push(`medium_priority_url:${keyword}`);
      }
      foundKeywords.add(normalizedKeyword);
    });

  // URLパターンボーナス（関数型）
  const contactUrlPatterns = [
    '/contact/', '/inquiry/', '/sales-contact/', '/business-contact/',
    '/contact-us/', '/get-in-touch/', '/reach-out/', '/問い合わせ/', '/お問い合わせ/'
  ];

  const urlPattern = contactUrlPatterns.find(pattern => lowerUrl.includes(pattern));
  if (urlPattern) {
    score += 15;
    reasons.push(`strong_contact_url_structure:${urlPattern}`);
  }

  // URLペナルティ（関数型）
  if (lowerUrl.includes('/service/')) {
    score -= 10;
    reasons.push('service_url_penalty');
  } else if (lowerUrl.includes('/about/') || lowerUrl.includes('/company/') || lowerUrl.includes('/info/')) {
    score -= 5;
    reasons.push('impure_url_structure');
  }

  return { score, reasons };
};

// 残りの関数は元のクラス内で実装し、段階的に移行
export const searchInNavigation = (html: string, baseUrl: string): HtmlSearchResult => {
  const navigationSelectors = [
    /<nav[\s\S]*?<\/nav>/gi,
    /<[^>]*id=['"]menu['"][^>]*>[\s\S]*?<\/[^>]+>/gi,
    /<footer[\s\S]*?<\/footer>/gi,
    /<ul[^>]*id=['"]naviArea['"][^>]*>[\s\S]*<\/ul>/gi,
    /<[^>]*id=['"]navigation['"][^>]*>[\s\S]*?<\/[^>]+>/gi,
    /<[^>]*id=['"]nav['"][^>]*>[\s\S]*?<\/[^>]+>/gi,
    /<div[^>]*class=['"][^'"\\]*\bnav\b[^'"\\]*['"][^>]*>[\s\S]*<\/div>/gi,
    /<nav[^>]*class=['"][^'"\\]*\bnavigation\b[^'"\\]*['"][^>]*>[\s\S]*<\/nav>/gi,
    /<ul[^>]*class=['"][^'"\\]*\bmenu\b[^'"\\]*['"][^>]*>[\s\S]*<\/ul>/gi
  ];

  let allCandidates: HtmlSearchResult[] = [];

  for (const regex of navigationSelectors) {
    const matches = html.match(regex) || [];
    for (const match of matches) {
      const candidates = extractAllContactLinks(match, baseUrl, 'navigation');
      allCandidates.push(...candidates);
    }
  }

  const contactLinks = allCandidates.filter(candidate =>
    HTML_HIGH_PRIORITY_CONTACT_KEYWORDS.some(keyword =>
      candidate.url?.toLowerCase().includes(keyword.toLowerCase()) ||
      candidate.keywords.some(k => k.toLowerCase().includes(keyword.toLowerCase()))
    )
  );

  if (contactLinks.length > 0) {
    return contactLinks.reduce((max, current) => current.score > max.score ? current : max);
  }

  return { url: null, keywords: [], score: 0, reasons: [], linkText: '', context: 'general' };
};

export const extractAllContactLinks = (content: string, baseUrl: string, context: HtmlSearchResult['context']): HtmlSearchResult[] => {
  const candidates: HtmlSearchResult[] = [];
  const linkRegex = /<a[^>]*href=['"]([^'"\\]*?)['"][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    const url = match[1];
    const linkText = match[2];

    if (!url || !linkText) continue;

    const cleanLinkText = linkText.replace(/<[^>]*>/g, '').trim();
    if (url.startsWith('mailto:') || url.startsWith('javascript:') || url.startsWith('tel:')) continue;

    const hasContactKeywords = HTML_HIGH_PRIORITY_CONTACT_KEYWORDS.some(keyword =>
      url.toLowerCase().includes(keyword.toLowerCase()) ||
      cleanLinkText.toLowerCase().includes(keyword.toLowerCase())
    );

    if (!hasContactKeywords) continue;

    const hasExcludedKeywords = HTML_EXCLUDED_KEYWORDS.some(keyword =>
      url.toLowerCase().includes(keyword.toLowerCase()) ||
      cleanLinkText.toLowerCase().includes(keyword.toLowerCase())
    );

    if (hasExcludedKeywords) continue;

    const purityResult = calculateContactPurity(url, cleanLinkText);
    const totalScore = purityResult.score + 5; // navigation context bonus

    if (totalScore > 0) {
      const fullUrl = resolveUrl(baseUrl)(url);
      candidates.push({
        url: fullUrl,
        keywords: purityResult.reasons.map(r => r.split(':')[1] || r),
        score: totalScore,
        reasons: [...purityResult.reasons, 'navigation_context_bonus'],
        linkText: cleanLinkText,
        context
      });
    }
  }
  return candidates.sort((a, b) => b.score - a.score);
};

export const isValidContactPage = (html: string): boolean => {
  const invalidPatterns = [
    'page not found', 'ページが見つかりません', '404 not found',
    'under construction', '工事中', 'site under construction',
    'coming soon'
  ];
  const lowerHtml = html.toLowerCase();
  const hasInvalidContent = invalidPatterns.some(pattern => lowerHtml.includes(pattern.toLowerCase()));
  return !hasInvalidContent && html.length > 500;
};

export const getContentWithEncoding = (response: GoogleAppsScript.URL_Fetch.HTTPResponse): string => {
  const encodings = ['utf-8', 'shift_jis', 'euc-jp'];
  for (const encoding of encodings) {
    try {
      const content = response.getContentText(encoding);
      if (isValidEncoding(content)) {
        return content;
      }
    } catch (e) {
      continue;
    }
  }
  return response.getContentText();
};

export const analyzeAnchorSection = (html: string, anchorUrl: string, baseUrl: string): ContactPageResult => {
  try {
    const anchorMatch = anchorUrl.match(/#(.+)$/);
    if (!anchorMatch) {
      return { contactUrl: null, actualFormUrl: null, foundKeywords: [], searchMethod: 'anchor_parse_failed' };
    }
    const anchorId = anchorMatch[1];
    const sectionPatterns = [
      new RegExp(`<[^>]+id=[\"']${anchorId}[\"'][^>]*>[\s\S]*?(?=<[^>]+id=[\"']|$)`, 'i'),
      new RegExp(`<[^>]+name=[\"']${anchorId}[\"'][^>]*>[\s\S]*?(?=<[^>]+name=[\"']|$)`, 'i'),
      new RegExp(`<section[^>]*>[\s\S]*?${anchorId}[\s\S]*?<\/section>`, 'i'),
      new RegExp(`<div[^>]*contact[^>]*>[\s\S]*?<\/div>`, 'i')
    ];
    let sectionContent = '';
    for (const pattern of sectionPatterns) {
      const match = html.match(pattern);
      if (match) {
        sectionContent = match[0];
        break;
      }
    }
    if (!sectionContent) {
      for (const keyword of ANCHOR_SECTION_CONTACT_KEYWORDS) {
        const keywordIndex = html.toLowerCase().indexOf(keyword);
        if (keywordIndex !== -1) {
          const start = Math.max(0, keywordIndex - 1000);
          const end = Math.min(html.length, keywordIndex + 1000);
          sectionContent = html.substring(start, end);
          break;
        }
      }
    }
    if (sectionContent) {
      const hasForm = FormUtils.isValidContactForm(sectionContent);
      const googleForms = FormUtils.detectGoogleForms(sectionContent);
      if (hasForm || googleForms.found) {
        return {
          contactUrl: baseUrl,
          actualFormUrl: googleForms.found ? googleForms.url : baseUrl,
          foundKeywords: ['anchor_section_detected', hasForm ? 'html_form_found' : 'google_forms_found'],
          searchMethod: 'anchor_section_analysis'
        };
      }
    }
    return { contactUrl: null, actualFormUrl: null, foundKeywords: [], searchMethod: 'anchor_section_insufficient' };
  } catch (error) {
    return { contactUrl: null, actualFormUrl: null, foundKeywords: [], searchMethod: 'anchor_section_error' };
  }
};

// 後方互換性のためのクラス（段階的移行用）
export class HtmlUtils {



  static detectSameHtmlPattern(urls: string[], htmlContent: string, searchState: SearchState): boolean {
    const contentHash = hashString(htmlContent);
    let sameCount = 0;

    for (const url of urls) {
      const cachedHash = searchState.getHtmlCache(url);
      if (cachedHash === contentHash) {
        sameCount++;
      } else {
        searchState.setHtmlCache(url, contentHash);
      }
    }
    return sameCount >= 2;
  }

  static executeSPAAnalysis(html: string, baseUrl: string): ContactPageResult {
    try {
      const navResult = this.searchInNavigation(html, baseUrl);
      if (navResult.url && isAnchorLink(navResult.url)) {
        const anchorSectionResult = this.analyzeAnchorSection(html, navResult.url, baseUrl);
        if (anchorSectionResult.contactUrl) {
          anchorSectionResult.searchMethod = 'spa_anchor_analysis';
          anchorSectionResult.foundKeywords.push('spa_detected');
          return anchorSectionResult;
        }
      }
      return { contactUrl: null, actualFormUrl: null, foundKeywords: ['spa_detected', 'anchor_analysis_failed'], searchMethod: 'spa_analysis_failed' };
    } catch (error) {
      return { contactUrl: null, actualFormUrl: null, foundKeywords: ['spa_detected', 'spa_analysis_error'], searchMethod: 'spa_analysis_error' };
    }
  }

  static calculateContactPurity(url: string, linkText: string): PurityResult {
    let score = 0;
    const reasons: string[] = [];
    const foundKeywords = new Set<string>();

    const lowerUrl = url.toLowerCase();
    const lowerLinkText = linkText.toLowerCase();

    for (const excludedKeyword of HTML_EXCLUDED_KEYWORDS) {
      if (lowerUrl.includes(excludedKeyword.toLowerCase()) ||
          lowerLinkText.includes(excludedKeyword.toLowerCase())) {
        score -= 15;
        reasons.push(`excluded:${excludedKeyword}`);
        break;
      }
    }

    for (const keyword of HTML_HIGH_PRIORITY_CONTACT_KEYWORDS) {
      const normalizedKeyword = keyword.toLowerCase();
      if (lowerLinkText.includes(normalizedKeyword) && !foundKeywords.has(normalizedKeyword)) {
        score += 10;
        reasons.push(`high_priority_text:${keyword}`);
        foundKeywords.add(normalizedKeyword);
      } else if (lowerUrl.includes(normalizedKeyword) && !foundKeywords.has(normalizedKeyword)) {
        score += 8;
        reasons.push(`high_priority_url:${keyword}`);
        foundKeywords.add(normalizedKeyword);
      }
    }

    for (const keyword of HTML_MEDIUM_PRIORITY_CONTACT_KEYWORDS) {
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

    const contactUrlPatterns = [
      '/contact/', '/inquiry/', '/sales-contact/', '/business-contact/',
      '/contact-us/', '/get-in-touch/', '/reach-out/', '/問い合わせ/', '/お問い合わせ/'
    ];

    for (const pattern of contactUrlPatterns) {
      if (lowerUrl.includes(pattern)) {
        score += 15;
        reasons.push(`strong_contact_url_structure:${pattern}`);
        break;
      }
    }

    if (lowerUrl.includes('/service/')) {
      score -= 10;
      reasons.push('service_url_penalty');
    } else if (lowerUrl.includes('/about/') || lowerUrl.includes('/company/') || lowerUrl.includes('/info/')) {
      score -= 5;
      reasons.push('impure_url_structure');
    }

    return { score, reasons };
  }

  static searchInNavigation(html: string, baseUrl: string): HtmlSearchResult {
    const navigationSelectors = [
      /<nav[\s\S]*?<\/nav>/gi,
      /<[^>]*id=['"]menu['"][^>]*>[\s\S]*?<\/[^>]+>/gi,
      /<footer[\s\S]*?<\/footer>/gi,
      /<ul[^>]*id=['"]naviArea['"][^>]*>[\s\S]*<\/ul>/gi,
      /<[^>]*id=['"]navigation['"][^>]*>[\s\S]*?<\/[^>]+>/gi,
      /<[^>]*id=['"]nav['"][^>]*>[\s\S]*?<\/[^>]+>/gi,
      /<div[^>]*class=['"][^'"\\]*\bnav\b[^'"\\]*['"][^>]*>[\s\S]*<\/div>/gi,
      /<nav[^>]*class=['"][^'"\\]*\bnavigation\b[^'"\\]*['"][^>]*>[\s\S]*<\/nav>/gi,
      /<ul[^>]*class=['"][^'"\\]*\bmenu\b[^'"\\]*['"][^>]*>[\s\S]*<\/ul>/gi
    ];

    let allCandidates: HtmlSearchResult[] = [];

    for (const regex of navigationSelectors) {
      const matches = html.match(regex) || [];
      for (const match of matches) {
        const candidates = this.extractAllContactLinks(match, baseUrl, 'navigation');
        allCandidates.push(...candidates);
      }
    }

    const contactLinks = allCandidates.filter(candidate =>
      HTML_HIGH_PRIORITY_CONTACT_KEYWORDS.some(keyword =>
        candidate.url?.toLowerCase().includes(keyword.toLowerCase()) ||
        candidate.keywords.some(k => k.toLowerCase().includes(keyword.toLowerCase()))
      )
    );

    if (contactLinks.length > 0) {
      return contactLinks.reduce((max, current) => current.score > max.score ? current : max);
    }

    return { url: null, keywords: [], score: 0, reasons: [], linkText: '', context: 'general' };
  }

  static extractAllContactLinks(content: string, baseUrl: string, context: HtmlSearchResult['context']): HtmlSearchResult[] {
    const candidates: HtmlSearchResult[] = [];
    const linkRegex = /<a[^>]*href=['"]([^'"\\]*?)['"][^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      const url = match[1];
      const linkText = match[2];

      if (!url || !linkText) continue;

      const cleanLinkText = linkText.replace(/<[^>]*>/g, '').trim();
      if (url.startsWith('mailto:') || url.startsWith('javascript:') || url.startsWith('tel:')) continue;

      const hasContactKeywords = HTML_HIGH_PRIORITY_CONTACT_KEYWORDS.some(keyword =>
        url.toLowerCase().includes(keyword.toLowerCase()) ||
        cleanLinkText.toLowerCase().includes(keyword.toLowerCase())
      );

      if (!hasContactKeywords) continue;

      const hasExcludedKeywords = HTML_EXCLUDED_KEYWORDS.some(keyword =>
        url.toLowerCase().includes(keyword.toLowerCase()) ||
        cleanLinkText.toLowerCase().includes(keyword.toLowerCase())
      );

      if (hasExcludedKeywords) continue;

      const purityResult = this.calculateContactPurity(url, cleanLinkText);
      const totalScore = purityResult.score + 5; // navigation context bonus

      if (totalScore > 0) {
        const fullUrl = resolveUrl(baseUrl)(url);
        candidates.push({
          url: fullUrl,
          keywords: purityResult.reasons.map(r => r.split(':')[1] || r),
          score: totalScore,
          reasons: [...purityResult.reasons, 'navigation_context_bonus'],
          linkText: cleanLinkText,
          context
        });
      }
    }
    return candidates.sort((a, b) => b.score - a.score);
  }

  static isValidContactPage(html: string): boolean {
    const invalidPatterns = [
      'page not found', 'ページが見つかりません', '404 not found',
      'under construction', '工事中', 'site under construction',
      'coming soon'
    ];
    const lowerHtml = html.toLowerCase();
    const hasInvalidContent = invalidPatterns.some(pattern => lowerHtml.includes(pattern.toLowerCase()));
    return !hasInvalidContent && html.length > 500;
  }

  static getContentWithEncoding(response: GoogleAppsScript.URL_Fetch.HTTPResponse): string {
    const encodings = ['utf-8', 'shift_jis', 'euc-jp'];
    for (const encoding of encodings) {
      try {
        const content = response.getContentText(encoding);
        if (isValidEncoding(content)) {
          return content;
        }
      } catch (e) {
        continue;
      }
    }
    return response.getContentText();
  }

  static analyzeAnchorSection(html: string, anchorUrl: string, baseUrl: string): ContactPageResult {
    try {
      const anchorMatch = anchorUrl.match(/#(.+)$/);
      if (!anchorMatch) {
        return { contactUrl: null, actualFormUrl: null, foundKeywords: [], searchMethod: 'anchor_parse_failed' };
      }
      const anchorId = anchorMatch[1];
      const sectionPatterns = [
        new RegExp(`<[^>]+id=[\"']${anchorId}[\"'][^>]*>[\s\S]*?(?=<[^>]+id=[\"']|$)`, 'i'),
        new RegExp(`<[^>]+name=[\"']${anchorId}[\"'][^>]*>[\s\S]*?(?=<[^>]+name=[\"']|$)`, 'i'),
        new RegExp(`<section[^>]*>[\s\S]*?${anchorId}[\s\S]*?<\/section>`, 'i'),
        new RegExp(`<div[^>]*contact[^>]*>[\s\S]*?<\/div>`, 'i')
      ];
      let sectionContent = '';
      for (const pattern of sectionPatterns) {
        const match = html.match(pattern);
        if (match) {
          sectionContent = match[0];
          break;
        }
      }
      if (!sectionContent) {
        for (const keyword of ANCHOR_SECTION_CONTACT_KEYWORDS) {
          const keywordIndex = html.toLowerCase().indexOf(keyword);
          if (keywordIndex !== -1) {
            const start = Math.max(0, keywordIndex - 1000);
            const end = Math.min(html.length, keywordIndex + 1000);
            sectionContent = html.substring(start, end);
            break;
          }
        }
      }
      if (sectionContent) {
        const hasForm = FormUtils.isValidContactForm(sectionContent);
        const googleForms = FormUtils.detectGoogleForms(sectionContent);
        if (hasForm || googleForms.found) {
          return {
            contactUrl: baseUrl,
            actualFormUrl: googleForms.found ? googleForms.url : baseUrl,
            foundKeywords: ['anchor_section_detected', hasForm ? 'html_form_found' : 'google_forms_found'],
            searchMethod: 'anchor_section_analysis'
          };
        }
      }
      return { contactUrl: null, actualFormUrl: null, foundKeywords: [], searchMethod: 'anchor_section_insufficient' };
    } catch (error) {
      return { contactUrl: null, actualFormUrl: null, foundKeywords: [], searchMethod: 'anchor_section_error' };
    }
  }

  static findSecondStageFormLink(html: string, contactPageUrl: string): string | null {
    const linkRegex = /<a[^>]*href=['"]([^'"\\]*?)['"][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    const candidateLinks: Array<{url: string, score: number}> = [];

    while ((match = linkRegex.exec(html)) !== null) {
      const url = match[1];
      const linkText = match[2];
      if (!url || !linkText) continue;
      if (url.startsWith('mailto:') || url.startsWith('javascript:') || url.startsWith('tel:')) continue;

      const cleanLinkText = linkText.replace(/<[^>]*>/g, '').trim().toLowerCase();
      const lowerUrl = url.toLowerCase();
      let score = 0;

      if (FORM_LINK_NEGATIVE_KEYWORDS.some(keyword => lowerUrl.includes(keyword) || cleanLinkText.includes(keyword))) continue;
      if (isHomepageUrl(contactPageUrl)(url)) continue;

      if (FORM_LINK_PATTERNS.some(pattern => lowerUrl.includes(pattern))) score += 3;
      if (FORM_TEXT_PATTERNS.some(pattern => cleanLinkText.includes(pattern))) score += 2;

      if (score > 0) {
        candidateLinks.push({ url: resolveUrl(contactPageUrl)(url), score });
      }
    }

    if (candidateLinks.length === 0) return null;

    candidateLinks.sort((a, b) => b.score - a.score);

    for (const candidate of candidateLinks.slice(0, 3)) {
      try {
        const response = fetchWithTimeout(candidate.url, 3000);
        if (response instanceof Error) {
          console.log(`Failed to fetch ${candidate.url}: ${response.message}`);
          continue;
        }
        if (response.getResponseCode() === 200) {
          const candidateHtml = response.getContentText();
          const hasGoogleForm = FormUtils.findGoogleFormUrlsOnly(candidateHtml);
          if (hasGoogleForm) return hasGoogleForm;
          if (FormUtils.findEmbeddedHTMLForm(candidateHtml)) return candidate.url;
          if (FormUtils.hasSignificantFormContent(candidateHtml)) return candidate.url;
        }
      } catch (error) {
        continue;
      }
    }
    return null;
  }
}
