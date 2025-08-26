import { Environment } from './env';
import type { ContactPageResult } from './types/interfaces';
import { SearchState } from './core/SearchState';
import { NetworkUtils } from './utils/NetworkUtils';
import { UrlPatternStrategy } from './strategies/UrlPatternStrategy';
import { HtmlAnalysisStrategy } from './strategies/HtmlAnalysisStrategy';
import { FallbackStrategy } from './strategies/FallbackStrategy';

export class ContactPageFinder {
  static findContactPage(baseUrl: string): ContactPageResult {
    const searchState = new SearchState();
    const strategies = [
      new UrlPatternStrategy(),
      new HtmlAnalysisStrategy(),
      new FallbackStrategy(),
    ];

    if (NetworkUtils.isSNSPage(baseUrl)) {
      return { contactUrl: null, actualFormUrl: null, foundKeywords: ['sns_page'], searchMethod: 'sns_not_supported' };
    }

    const domainCheck = NetworkUtils.checkDomainAvailability(baseUrl);
    if (!domainCheck.available) {
      const errorMessage = domainCheck.error || 'サイトが閉鎖されています';
      const searchMethod = errorMessage.includes('DNS') ? 'dns_error' : 'site_closed';
      return { contactUrl: null, actualFormUrl: null, foundKeywords: [errorMessage], searchMethod };
    }

    const domainUrl = NetworkUtils.extractDomain(baseUrl);

    for (const strategy of strategies) {
      try {
        const result = strategy.search(domainUrl, searchState);
        if (result) {
          if (result.contactUrl) {
            console.log(`✅ Found via ${strategy.getStrategyName()}: ${result.contactUrl}`);
          } else {
            console.log(`Strategy ${strategy.getStrategyName()} returned a terminal result: ${result.searchMethod}`);
          }
          return result;
        }
      } catch (error) {
        console.error(`Error in strategy ${strategy.getStrategyName()}:`, error);
      }
    }

    return { contactUrl: null, actualFormUrl: null, foundKeywords: [], searchMethod: 'not_found' };
  }
}