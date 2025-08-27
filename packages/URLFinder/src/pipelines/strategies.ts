/**
 * 検索戦略純粋関数群
 * Strategy パターンの関数型実装
 */

import type { ContactPageResult, SearchStrategy } from '../data/types/interfaces';
import { SearchState } from './state';
import { Environment } from '../env';
import { fetchWithTimeout, getDetailedNetworkError, getDetailedErrorMessage } from '../functions/network/fetch';
import { FormUtils } from '../functions/html/extractor';
import { HtmlUtils } from '../functions/html/parser';
import { StringUtils } from '../functions/network/validation';
import { HIGH_PRIORITY_PATTERNS } from '../data/constants/patterns';
import { pipe, maybe } from '../functions/utils/compose';

// 型定義
type StrategyResult = ContactPageResult | null;
type StrategyFunction = (baseUrl: string, searchState: SearchState) => StrategyResult;

// 純粋関数群

/**
 * URL Pattern 検索戦略（純粋関数）
 */
export const executeUrlPatternStrategy = (baseUrl: string, searchState: SearchState): StrategyResult => {
  const startTime = Date.now();
  const maxTotalTime = Environment.getMaxTotalTime();
  const testedUrls: string[] = [];

  for (const pattern of HIGH_PRIORITY_PATTERNS) {
    if (Date.now() - startTime > maxTotalTime) {
      console.log('Timeout during priority search');
      break;
    }

    try {
      const testUrl = baseUrl.replace(/\/$/, '') + pattern;
      testedUrls.push(testUrl);

      const response = fetchWithTimeout(testUrl, 5000);
      if (response instanceof Error) {
        const detailedError = getDetailedNetworkError(response);
        if (detailedError.includes('DNS解決失敗')) {
          return { contactUrl: null, actualFormUrl: null, foundKeywords: [detailedError], searchMethod: 'dns_error' };
        }
        continue;
      }

      if (response.getResponseCode() === 200) {
        const html = response.getContentText();

        if (testedUrls.length >= 2 && HtmlUtils.detectSameHtmlPattern(testedUrls, html, searchState)) {
          const anchorResult = HtmlUtils.executeSPAAnalysis(html, baseUrl);
          if (anchorResult.contactUrl) return anchorResult;
        }

        if (HtmlUtils.isValidContactPage(html)) {
          searchState.addValidUrl(testUrl, pattern);
          if (FormUtils.isValidContactForm(html)) {
            searchState.addSuccessfulFormUrl(testUrl);
            return { contactUrl: testUrl, actualFormUrl: testUrl, foundKeywords: [pattern.replace(/\//g, ''), 'contact_form_confirmed'], searchMethod: 'contact_form_priority_search' };
          }
          const googleFormsResult = FormUtils.detectGoogleForms(html);
          if (googleFormsResult.found && googleFormsResult.url) {
            searchState.addSuccessfulFormUrl(testUrl);
            return { contactUrl: testUrl, actualFormUrl: googleFormsResult.url, foundKeywords: [pattern.replace(/\//g, ''), 'google_forms', googleFormsResult.type], searchMethod: 'google_forms_priority_search' };
          }
          searchState.addCandidate(testUrl, 'no_contact_form', html);
        }
      } else {
        const statusCode = response.getResponseCode();
        if (statusCode === 403 || statusCode === 501) {
          return { contactUrl: null, actualFormUrl: null, foundKeywords: [getDetailedErrorMessage(statusCode)], searchMethod: 'bot_blocked' };
        }
      }
    } catch (error) {
      const detailedError = getDetailedNetworkError(error);
      if (detailedError.includes('DNS解決失敗')) {
        return { contactUrl: null, actualFormUrl: null, foundKeywords: [detailedError], searchMethod: 'dns_error' };
      }
    }
  }
  return null;
};

/**
 * HTML Analysis 検索戦略（純粋関数）
 */
export const executeHtmlAnalysisStrategy = (baseUrl: string, searchState: SearchState): StrategyResult => {
  try {
    const response = fetchWithTimeout(baseUrl, 7000);
    if (response instanceof Error) {
      return handleNetworkError(response);
    }

    const html = HtmlUtils.getContentWithEncoding(response);

    const googleFormUrls = FormUtils.findGoogleFormUrlsOnly(html);
    if (googleFormUrls) {
      return { contactUrl: baseUrl, actualFormUrl: googleFormUrls, foundKeywords: ['homepage_google_form'], searchMethod: 'homepage_google_form_fallback' };
    }

    const result = analyzeHtmlContent(html, baseUrl, searchState);
    if (result && result.contactUrl) {
      const formUrl = findActualForm(result.contactUrl);
      result.actualFormUrl = formUrl;
      result.searchMethod = 'homepage_link_fallback';

      if (result.actualFormUrl && result.actualFormUrl.startsWith('http')) {
        return result;
      } else if (result.actualFormUrl === 'embedded_contact_form_on_page') {
        result.actualFormUrl = result.contactUrl;
        return result;
      }
      return result;
    }

    const embeddedFormResult = FormUtils.findEmbeddedHTMLForm(html);
    if (embeddedFormResult) {
      return { contactUrl: baseUrl, actualFormUrl: baseUrl, foundKeywords: ['homepage_embedded_form'], searchMethod: 'homepage_embedded_fallback' };
    }
  } catch (homepageError) {
    return handleNetworkError(homepageError);
  }
  return null;
};

/**
 * ネットワークエラー処理（純粋関数）
 */
const handleNetworkError = (error: any): ContactPageResult => {
  const detailedError = getDetailedNetworkError(error);
  console.log(`Error in homepage analysis fallback: ${detailedError}`);

  let searchMethod: string;
  if (detailedError.includes('DNS解決失敗')) {
    searchMethod = 'dns_error';
  } else if (detailedError.includes('timeout')) {
    searchMethod = 'timeout_error';
  } else if (detailedError.includes('403') || detailedError.includes('501') || detailedError.includes('Access forbidden')) {
    searchMethod = 'bot_blocked';
  } else {
    searchMethod = 'error';
  }
  return { contactUrl: null, actualFormUrl: null, foundKeywords: [detailedError], searchMethod: searchMethod };
};

/**
 * HTMLコンテンツ分析（純粋関数）
 */
const analyzeHtmlContent = (html: string, baseUrl: string, searchState: SearchState): ContactPageResult | null => {
  const navResult = HtmlUtils.searchInNavigation(html, baseUrl);
  if (navResult.url && navResult.score > 0) {
    if (searchState.isSuccessfulFormUrl(navResult.url)) {
      return null;
    }

    if (StringUtils.isAnchorLink(navResult.url)) {
      const anchorSectionResult = HtmlUtils.analyzeAnchorSection(html, navResult.url, baseUrl);
      if (anchorSectionResult.contactUrl) {
        return anchorSectionResult;
      }
    }

    try {
      const response = fetchWithTimeout(navResult.url, 5000);
      if (response instanceof Error) {
        return handleNetworkError(response);
      }

      if (response.getResponseCode() === 200) {
        const candidateHtml = response.getContentText();
        if (FormUtils.isValidContactForm(candidateHtml)) {
          return { contactUrl: navResult.url, actualFormUrl: navResult.url, foundKeywords: [...navResult.keywords, 'form_validation_success'], searchMethod: 'homepage_navigation_form' };
        }
        const googleFormsResult = FormUtils.detectGoogleForms(candidateHtml);
        if (googleFormsResult.found && googleFormsResult.url) {
          return { contactUrl: navResult.url, actualFormUrl: googleFormsResult.url, foundKeywords: [...navResult.keywords, 'google_forms', googleFormsResult.type], searchMethod: 'homepage_navigation_google_forms' };
        }
        if (navResult.score >= 15) {
          return { contactUrl: navResult.url, actualFormUrl: navResult.url, foundKeywords: [...navResult.keywords, 'keyword_based_validation'], searchMethod: 'homepage_navigation_keyword_based' };
        }
      }
    } catch (error) {
      return handleNetworkError(error);
    }
  }
  return null;
};

/**
 * 実際のフォーム検索（純粋関数）
 */
const findActualForm = (contactPageUrl: string): string | null => {
  try {
    const response = fetchWithTimeout(contactPageUrl, 5000);
    if (response instanceof Error) {
      console.error(`Error fetching contact page ${contactPageUrl}:`, response);
      return null;
    }

    const html = response.getContentText();
    const googleFormUrl = FormUtils.findGoogleFormUrlsOnly(html);
    if (googleFormUrl && googleFormUrl.startsWith('http')) {
      return googleFormUrl;
    }
    if (FormUtils.findEmbeddedHTMLForm(html)) {
      return contactPageUrl;
    }
    return HtmlUtils.findSecondStageFormLink(html, contactPageUrl);
  } catch (error) {
    console.error(`Error fetching contact page ${contactPageUrl}:`, error);
    return null;
  }
};

// 高階関数とコンビネータ

/**
 * 戦略実行パイプライン生成（高階関数）
 */
export const createSearchPipeline = (strategies: StrategyFunction[]) =>
  (baseUrl: string, searchState: SearchState): StrategyResult => {
    for (const strategy of strategies) {
      const result = strategy(baseUrl, searchState);
      if (result) return result;
    }
    return null;
  };

/**
 * 戦略コンディション生成（高階関数）
 */
export const createConditionalStrategy = (condition: (baseUrl: string) => boolean, strategy: StrategyFunction) =>
  (baseUrl: string, searchState: SearchState): StrategyResult => {
    if (condition(baseUrl)) {
      return strategy(baseUrl, searchState);
    }
    return null;
  };

/**
 * 戦略タイムアウト制御（高階関数）
 */
export const createTimeoutStrategy = (timeoutMs: number, strategy: StrategyFunction) =>
  (baseUrl: string, searchState: SearchState): StrategyResult => {
    const startTime = Date.now();
    const result = strategy(baseUrl, searchState);
    const elapsed = Date.now() - startTime;
    
    if (elapsed > timeoutMs) {
      console.log(`Strategy timeout after ${elapsed}ms`);
      return { contactUrl: null, actualFormUrl: null, foundKeywords: ['strategy_timeout'], searchMethod: 'timeout_error' };
    }
    
    return result;
  };

/**
 * 戦略チェーン合成（関数合成）
 */
export const composeStrategies = (...strategies: StrategyFunction[]) =>
  createSearchPipeline(strategies);

/**
 * メイン検索実行（統合API）
 */
export const executeSearchStrategies = (baseUrl: string, searchState: SearchState): StrategyResult => {
  const strategies = [
    executeUrlPatternStrategy,
    executeHtmlAnalysisStrategy
  ];

  return createSearchPipeline(strategies)(baseUrl, searchState);
};

// 後方互換性のためのクラス（段階的移行用）
export class UrlPatternStrategy implements SearchStrategy {
  public getStrategyName(): string {
    return 'URL Pattern Search';
  }

  public search(baseUrl: string, searchState: SearchState): ContactPageResult | null {
    return executeUrlPatternStrategy(baseUrl, searchState);
  }
}

export class HtmlAnalysisStrategy implements SearchStrategy {
  public getStrategyName(): string {
    return 'HTML Content Analysis';
  }

  public search(baseUrl: string, searchState: SearchState): ContactPageResult | null {
    return executeHtmlAnalysisStrategy(baseUrl, searchState);
  }
}