import type { ContactPageResult, SearchStrategy } from '../types/interfaces';
import { SearchState } from '../core/SearchState';
import { Environment } from '../env';
import { NetworkUtils } from '../utils/NetworkUtils';
import { FormUtils } from '../utils/FormUtils';
import { HtmlUtils } from '../utils/HtmlUtils';

export class UrlPatternStrategy implements SearchStrategy {
  private readonly HIGH_PRIORITY_PATTERNS = [
    '/contact/', '/contact', '/contact.php', '/inquiry/', '/inquiry', '/inquiry.php', '/form', '/form/', '/form.php', '/contact-us/', '/contact-us',
    '/%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B/', // お問い合わせ
    '/%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B/', // 問い合わせ
  ];

  public getStrategyName(): string {
    return 'URL Pattern Search';
  }

  public search(baseUrl: string, searchState: SearchState): ContactPageResult | null {
    const startTime = Date.now();
    const maxTotalTime = Environment.getMaxTotalTime();
    const testedUrls: string[] = [];

    for (const pattern of this.HIGH_PRIORITY_PATTERNS) {
      if (Date.now() - startTime > maxTotalTime) {
        console.log('Timeout during priority search');
        break;
      }

      try {
        const testUrl = baseUrl.replace(/\/$/, '') + pattern;
        testedUrls.push(testUrl);

        const response = NetworkUtils.fetchWithTimeout(testUrl, 5000);
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
            return { contactUrl: null, actualFormUrl: null, foundKeywords: [NetworkUtils.getDetailedErrorMessage(statusCode)], searchMethod: 'bot_blocked' };
          }
        }
      } catch (error) {
        const detailedError = NetworkUtils.getDetailedNetworkError(error);
        if (detailedError.includes('DNS解決失敗')) {
          return { contactUrl: null, actualFormUrl: null, foundKeywords: [detailedError], searchMethod: 'dns_error' };
        }
      }
    }
    return null; // 該当なし
  }
}