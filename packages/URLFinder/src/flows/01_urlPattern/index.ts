import type { ContactPageResult, StrategyResult, SearchStateData } from '../../common/types/types';
import { addValidUrl, addSuccessfulFormUrl, addCandidate } from '../../common/state';
import { Environment } from '../../env';
import { fetchWithTimeout, getDetailedNetworkError, getDetailedErrorMessage } from '../../common/network/fetch';
import { FormUtils } from '../02_htmlAnalysis/extractor';
import { detectSameHtmlPattern, isValidContactPage, executeSPAAnalysis } from '../02_htmlAnalysis/parser';
import { HIGH_PRIORITY_PATTERNS } from './constants';

export const urlPatternSearch = (baseUrl: string, searchState: SearchStateData): StrategyResult => {
  const { getMaxTotalTime } = Environment;
  const startTime = Date.now();
  const maxTotalTime = getMaxTotalTime();
  const testedUrls: string[] = [];
  let currentState = searchState;

  for (const pattern of HIGH_PRIORITY_PATTERNS) {
    if (Date.now() - startTime > maxTotalTime) {
      console.log('Timeout during priority search');
      break;
    }

    const testUrl = baseUrl.replace(/\/$/, '') + pattern;
    testedUrls.push(testUrl);

    let response;
    try {
      response = fetchWithTimeout(testUrl, 5000);
    } catch (error) {
      const detailedError = getDetailedNetworkError(error);
      if (detailedError.includes('DNS解決失敗')) {
        return { result: { contactUrl: null, actualFormUrl: null, foundKeywords: [detailedError], searchMethod: 'dns_error' }, newState: currentState };
      }
      continue;
    }

    if (response instanceof Error) {
      const detailedError = getDetailedNetworkError(response);
      if (detailedError.includes('DNS解決失敗')) {
        return { result: { contactUrl: null, actualFormUrl: null, foundKeywords: [detailedError], searchMethod: 'dns_error' }, newState: currentState };
      }
      continue;
    }

    if (response.getResponseCode() !== 200) {
      const statusCode = response.getResponseCode();
      if (statusCode === 403 || statusCode === 501) {
        return { result: { contactUrl: null, actualFormUrl: null, foundKeywords: [getDetailedErrorMessage(statusCode)], searchMethod: 'bot_blocked' }, newState: currentState };
      }
      continue;
    }

    const html = response.getContentText();

    if (testedUrls.length >= 2) {
        const { isSame, newState: nextState } = detectSameHtmlPattern(testedUrls, html, currentState);
        currentState = nextState;
        if (isSame) {
            const anchorResult = executeSPAAnalysis(html, baseUrl);
            if (anchorResult.contactUrl) return { result: anchorResult, newState: currentState };
        }
    }

    if (!isValidContactPage(html)) continue;

    currentState = addValidUrl(currentState, testUrl, pattern);

    if (FormUtils.isValidContactForm(html)) {
      currentState = addSuccessfulFormUrl(currentState, testUrl);
      return { result: { contactUrl: testUrl, actualFormUrl: testUrl, foundKeywords: [pattern.replace(/\//g, ''), 'contact_form_confirmed'], searchMethod: 'contact_form_priority_search' }, newState: currentState };
    }

    const googleFormsResult = FormUtils.detectGoogleForms(html);
    if (googleFormsResult.found && googleFormsResult.url) {
      currentState = addSuccessfulFormUrl(currentState, testUrl);
      return { result: { contactUrl: testUrl, actualFormUrl: googleFormsResult.url, foundKeywords: [pattern.replace(/\//g, ''), 'google_forms', googleFormsResult.type], searchMethod: 'google_forms_priority_search' }, newState: currentState };
    }

    currentState = addCandidate(currentState, testUrl, 'no_contact_form', html);
  }

  return { result: null, newState: currentState };
};
