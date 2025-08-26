import type { ContactPageResult, SearchStrategy } from '../types/interfaces';
import { SearchState } from '../core/SearchState';
import { NetworkUtils } from '../utils/NetworkUtils';
import { FormUtils } from '../utils/FormUtils';
import { HtmlUtils } from '../utils/HtmlUtils';
import { StringUtils } from '../utils/StringUtils';

export class HtmlAnalysisStrategy implements SearchStrategy {
  public getStrategyName(): string {
    return 'HTML Content Analysis';
  }

  public search(baseUrl: string, searchState: SearchState): ContactPageResult | null {
    try {
      const response = NetworkUtils.fetchWithTimeout(baseUrl, 7000);
      const html = HtmlUtils.getContentWithEncoding(response);

      const googleFormUrls = FormUtils.findGoogleFormUrlsOnly(html);
      if (googleFormUrls) {
        return { contactUrl: baseUrl, actualFormUrl: googleFormUrls, foundKeywords: ['homepage_google_form'], searchMethod: 'homepage_google_form_fallback' };
      }

      const result = this.analyzeHtmlContent(html, baseUrl, searchState);
      if (result && result.contactUrl) {
        const formUrl = this.findActualForm(result.contactUrl);
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
      const detailedError = NetworkUtils.getDetailedNetworkError(homepageError);
      console.log(`Error in homepage analysis fallback: ${detailedError}`);

      let searchMethod: string;
      if (detailedError.includes('DNS解決失敗')) {
        searchMethod = 'dns_error';
      } else if (detailedError.includes('timeout')) {
        searchMethod = 'timeout_error';
      } else if (detailedError.includes('403') || detailedError.includes('501') || detailedError.includes('Access forbidden')) {
        searchMethod = 'bot_blocked';
      } else {
        searchMethod = 'error'; // Generic error for other network issues
      }
      return { contactUrl: null, actualFormUrl: null, foundKeywords: [detailedError], searchMethod: searchMethod };
    }
    return null;
  }

  private analyzeHtmlContent(html: string, baseUrl: string, searchState: SearchState): ContactPageResult | null {
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
        const response = NetworkUtils.fetchWithTimeout(navResult.url, 5000);
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
        const detailedError = NetworkUtils.getDetailedNetworkError(error);
        console.log(`❌ Error accessing navigation result: ${detailedError}`);

        let searchMethod: string;
        if (detailedError.includes('DNS解決失敗')) {
          searchMethod = 'dns_error';
        } else if (detailedError.includes('timeout')) {
          searchMethod = 'timeout_error';
        } else if (detailedError.includes('403') || detailedError.includes('501') || detailedError.includes('Access forbidden')) {
          searchMethod = 'bot_blocked';
        } else {
          searchMethod = 'error'; // Generic error for other network issues
        }
        // Return the error result here, as this is a sub-fetch within a strategy
        return { contactUrl: null, actualFormUrl: null, foundKeywords: [detailedError], searchMethod: searchMethod };
      }
    }
    return null;
  }

  private findActualForm(contactPageUrl: string): string | null {
    try {
      const response = NetworkUtils.fetchWithTimeout(contactPageUrl, 5000);
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
  }
}