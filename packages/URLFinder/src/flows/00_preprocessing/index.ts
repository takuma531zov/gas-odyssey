/**
 * 🔧 前処理フロー統合モジュール
 * 
 * URLFinderの事前検証処理を統合実行
 * SNS判定とドメイン可用性チェックを一元化
 */

import { isSNSPage, checkDomainAvailability } from '../../common/network/fetch';
import type { ContactPageResult } from '../../common/types';

/**
 * SNSページ判定実行
 * @param baseUrl 判定対象URL
 * @returns SNSページの場合は結果オブジェクト、それ以外はnull
 */
export function snsCheck(baseUrl: string): ContactPageResult | null {
  if (isSNSPage(baseUrl)) {
    return { 
      contactUrl: null, 
      actualFormUrl: null, 
      foundKeywords: ['sns_page'], 
      searchMethod: 'sns_not_supported' 
    };
  }
  return null;
}

function getSearchMethod(errorMessage: string): string {
  const rules: { test: (msg: string) => boolean; value: string }[] = [
    { test: msg => msg.includes("DNS"), value: "dns_error" },
    { test: msg => /bot|Bot|403|501/.test(msg), value: "bot_blocked" },
    { test: msg => msg.includes("timeout") || msg.includes("タイムアウト"), value: "timeout_error" },
    { test: msg => msg === "サイトが閉鎖されています", value: "site_closed" },
  ];

  const rule = rules.find(r => r.test(errorMessage));
  return rule ? rule.value : "error";
}

/**
 * ドメイン可用性チェック実行
 * @param baseUrl チェック対象URL
 * @returns アクセス不可の場合は結果オブジェクト、正常アクセス可能の場合はnull
 */
export function domainCheck(baseUrl: string): ContactPageResult | null {
  const domainCheckResult = checkDomainAvailability(baseUrl);
  
  if (!domainCheckResult.available) {
    const errorMessage = domainCheckResult.error || 'サイトが閉鎖されています';
    
    const searchMethod = getSearchMethod(errorMessage);
    
    return { 
      contactUrl: null, 
      actualFormUrl: null, 
      foundKeywords: [errorMessage], 
      searchMethod 
    };
  }
  
  return null;
}