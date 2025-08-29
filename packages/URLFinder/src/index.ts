
/**
 * 📋 URLFinder - GAS関数エントリーポイント
 *
 * Google Apps Scriptで使用する関数の純粋な呼び出し専用ファイル
 * ビジネスロジックは含まず、各機能への振り分けのみ行う
 *
 * 利用可能な関数:
 * - processContactPageFinder: スプレッドシート一括処理
 * - executeUrlFinderWithUI: UI選択型処理（通常処理/チェック行処理の分岐）
 *
 * デバッグ用関数:
 * - debug.tsのfindContactPageWithVisibility (別ファイルで提供)
 */

import { processContactPageFinder } from './adapters/gas/triggers';
import { executeUrlFinderWithUI } from './adapters/gas/ui';
import { findContactPageWithVisibility } from './debug';
import type { ContactPageResult } from './data/types/interfaces';
import { SearchState } from './pipelines/state';
import { NetworkUtils } from './functions/network/fetch';
import { executeSearchStrategies } from './pipelines/strategies';

/**
 * 🎯 URLFinder コア検索関数
 * 
 * ContactPageFinderクラスから移植した純粋な検索ロジック
 * 既存の処理フローを完全維持
 * 
 * @param baseUrl 検索対象のURL
 * @returns 検索結果
 */
export function findContactPage(baseUrl: string): ContactPageResult {
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

// GASのグローバル空間に関数を登録
declare const global: {
  processContactPageFinder: typeof processContactPageFinder;
  executeUrlFinderWithUI: typeof executeUrlFinderWithUI;
  findContactPageWithVisibility: typeof findContactPageWithVisibility;
};

global.processContactPageFinder = processContactPageFinder;
global.executeUrlFinderWithUI = executeUrlFinderWithUI;
global.findContactPageWithVisibility = findContactPageWithVisibility;
