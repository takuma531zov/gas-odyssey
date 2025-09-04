import type { ContactPageResult, StrategyResult } from '../../common/types';
import type { SearchStateData } from '../../common/types';
import { isSuccessfulFormUrl } from '../../common/state';
import { fetchWithTimeout, getDetailedNetworkError } from '../../common/network/fetch';
import { FormUtils } from './extractor';
import { getContentWithEncoding, searchInNavigation, analyzeAnchorSection, findSecondStageFormLink } from './parser';
import { isAnchorLink } from '../../common/network/validation';

/**
 * HTML Analysis 検索戦略
 */
export const htmlAnalysisSearch = (baseUrl: string, searchState: SearchStateData): StrategyResult => {
  let response;
  try {
    response = fetchWithTimeout(baseUrl, 7000);
  } catch (homepageError) {
    return { result: handleNetworkError(homepageError), newState: searchState };
  }

  if (response instanceof Error) {
    return { result: handleNetworkError(response), newState: searchState };
  }

  const html = getContentWithEncoding(response);

  const googleFormUrls = FormUtils.findGoogleFormUrlsOnly(html);
  if (googleFormUrls) {
    return { result: { contactUrl: baseUrl, actualFormUrl: googleFormUrls, foundKeywords: ['homepage_google_form'], searchMethod: 'homepage_google_form_fallback' }, newState: searchState };
  }

  const { result, newState } = analyzeHtmlContent(html, baseUrl, searchState);
  if (result && result.contactUrl) {
    const formUrl = findActualForm(result.contactUrl);
    result.actualFormUrl = formUrl;
    result.searchMethod = 'homepage_link_fallback';

    if (result.actualFormUrl && result.actualFormUrl.startsWith('http')) {
      return { result, newState };
    }

    if (result.actualFormUrl === 'embedded_contact_form_on_page') {
      result.actualFormUrl = result.contactUrl;
      return { result, newState };
    }

    return { result, newState };
  }

  const embeddedFormResult = FormUtils.findEmbeddedHTMLForm(html);
  if (embeddedFormResult) {
    return { result: { contactUrl: baseUrl, actualFormUrl: baseUrl, foundKeywords: ['homepage_embedded_form'], searchMethod: 'homepage_embedded_fallback' }, newState };
  }

  return { result: null, newState };
};

/**
 * ネットワークエラー処理
 */
const handleNetworkError = (error: Error | unknown): ContactPageResult => {
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
 * HTMLコンテンツ分析
 */
const analyzeHtmlContent = (html: string, baseUrl: string, searchState: SearchStateData): StrategyResult => {
  const navResult = searchInNavigation(html, baseUrl);

  if (!navResult.url || navResult.score <= 0) {
    return { result: null, newState: searchState };
  }

  if (isSuccessfulFormUrl(searchState, navResult.url)) {
    return { result: null, newState: searchState };
  }

  if (isAnchorLink(navResult.url)) {
    const anchorSectionResult = analyzeAnchorSection(html, navResult.url, baseUrl);
    if (anchorSectionResult.contactUrl) {
      return { result: anchorSectionResult, newState: searchState };
    }
  }

  let response;
  try {
    response = fetchWithTimeout(navResult.url, 5000);
  } catch (error) {
    return { result: handleNetworkError(error), newState: searchState };
  }

  if (response instanceof Error) {
    return { result: handleNetworkError(response), newState: searchState };
  }

  if (response.getResponseCode() !== 200) {
    return { result: null, newState: searchState };
  }

  const candidateHtml = response.getContentText();

  if (FormUtils.isValidContactForm(candidateHtml)) {
    return { result: { contactUrl: navResult.url, actualFormUrl: navResult.url, foundKeywords: [...navResult.keywords, 'form_validation_success'], searchMethod: 'homepage_navigation_form' }, newState: searchState };
  }

  const googleFormsResult = FormUtils.detectGoogleForms(candidateHtml);
  if (googleFormsResult.found && googleFormsResult.url) {
    return { result: { contactUrl: navResult.url, actualFormUrl: googleFormsResult.url, foundKeywords: [...navResult.keywords, 'google_forms', googleFormsResult.type], searchMethod: 'homepage_navigation_google_forms' }, newState: searchState };
  }

  if (navResult.score >= 15) {
    return { result: { contactUrl: navResult.url, actualFormUrl: navResult.url, foundKeywords: [...navResult.keywords, 'keyword_based_validation'], searchMethod: 'homepage_navigation_keyword_based' }, newState: searchState };
  }

  return { result: null, newState: searchState };
};

/**
 * 実際のフォーム検索
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
    return findSecondStageFormLink(html, contactPageUrl);
  } catch (error) {
    console.error(`Error fetching contact page ${contactPageUrl}:`, error);
    return null;
  }
};
