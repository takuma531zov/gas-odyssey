
import type { ContactPageResult } from './data/types/interfaces';
import { SearchState } from './pipelines/state';
import { NetworkUtils } from './functions/network/fetch';
import { executeSearchStrategies } from './pipelines/strategies';

export class ContactPageFinder {
  static findContactPage(baseUrl: string): ContactPageResult {
    const searchState = new SearchState();

    if (NetworkUtils.isSNSPage(baseUrl)) {
      return { contactUrl: null, actualFormUrl: null, foundKeywords: ['sns_page'], searchMethod: 'sns_not_supported' };
    }

    const domainCheck = NetworkUtils.checkDomainAvailability(baseUrl);
    if (!domainCheck.available) {
      const errorMessage = domainCheck.error || 'サイトが閉鎖されています';
      let searchMethod = 'site_closed';
      if (errorMessage.includes('DNS')) {
        searchMethod = 'dns_error';
      } else if (errorMessage.includes('bot') || errorMessage.includes('Bot') || errorMessage.includes('403') || errorMessage.includes('501')) {
        searchMethod = 'bot_blocked';
      } else if (errorMessage.includes('timeout') || errorMessage.includes('タイムアウト')) {
        searchMethod = 'timeout_error';
      } else if (errorMessage === 'サイトが閉鎖されています') {
        searchMethod = 'site_closed';
      } else {
        searchMethod = 'error';
      }
      return { contactUrl: null, actualFormUrl: null, foundKeywords: [errorMessage], searchMethod };
    }

    const domainUrl = NetworkUtils.extractDomain(baseUrl);

    try {
      const result = executeSearchStrategies(domainUrl, searchState);
      if (result) {
        if (result.contactUrl) {
          console.log(`✅ Found contact form: ${result.contactUrl}`);
        } else {
          console.log(`Search completed with result: ${result.searchMethod}`);
        }
        return result;
      }
    } catch (error) {
      console.error('Error in search strategies:', error);
    }

    return { contactUrl: null, actualFormUrl: null, foundKeywords: [], searchMethod: 'not_found' };
  }
}
