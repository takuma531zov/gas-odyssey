/**
 * 🔧 前処理フロー統合モジュール
 * 
 * URLFinderの事前検証処理を統合実行
 * SNS判定とドメイン可用性チェックを一元化
 */

import { NetworkUtils } from '../../functions/network/fetch';
import type { ContactPageResult } from '../../data/types/interfaces';

/**
 * SNSページ判定実行
 * @param baseUrl 判定対象URL
 * @returns SNSページの場合は結果オブジェクト、それ以外はnull
 */
export function snsCheck(baseUrl: string): ContactPageResult | null {
  if (NetworkUtils.isSNSPage(baseUrl)) {
    return { 
      contactUrl: null, 
      actualFormUrl: null, 
      foundKeywords: ['sns_page'], 
      searchMethod: 'sns_not_supported' 
    };
  }
  return null;
}

/**
 * ドメイン可用性チェック実行
 * @param baseUrl チェック対象URL
 * @returns アクセス不可の場合は結果オブジェクト、正常アクセス可能の場合はnull
 */
export function domainCheck(baseUrl: string): ContactPageResult | null {
  const domainCheckResult = NetworkUtils.checkDomainAvailability(baseUrl);
  
  if (!domainCheckResult.available) {
    const errorMessage = domainCheckResult.error || 'サイトが閉鎖されています';
    
    // エラー分類ロジック（既存ロジック完全維持）
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
    
    return { 
      contactUrl: null, 
      actualFormUrl: null, 
      foundKeywords: [errorMessage], 
      searchMethod 
    };
  }
  
  return null;
}