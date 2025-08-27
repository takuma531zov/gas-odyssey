/**
 * 検索処理パイプライン
 * 関数合成による検索戦略の実行
 */

import type { ContactPageResult } from '../data/types/interfaces';
import { SearchState } from './state';
import { pipe, orElse, tap, maybe } from '../functions/utils/compose';
import { NetworkUtils } from '../functions/network/fetch';

// 検索戦略関数の型定義
type SearchFunction = (baseUrl: string, searchState: SearchState) => ContactPageResult | null;

/**
 * 検索戦略を関数として定義
 */
export const urlPatternSearch: SearchFunction = (baseUrl, searchState) => {
  // UrlPatternStrategy の処理を関数として実装
  // 現在は簡易実装
  console.log('Executing URL pattern search...');
  return null;
};

export const htmlAnalysisSearch: SearchFunction = (baseUrl, searchState) => {
  // HtmlAnalysisStrategy の処理を関数として実装
  // 現在は簡易実装
  console.log('Executing HTML analysis search...');
  return null;
};

export const fallbackSearch: SearchFunction = (baseUrl, searchState) => {
  // FallbackStrategy の処理を関数として実装
  // 現在は簡易実装
  console.log('Executing fallback search...');
  return { 
    contactUrl: null, 
    actualFormUrl: null, 
    foundKeywords: [], 
    searchMethod: 'not_found' 
  };
};

/**
 * 検索結果の検証
 */
const validateResult = (result: ContactPageResult | null): ContactPageResult | null =>
  result && result.contactUrl ? result : null;

/**
 * 検索戦略の失敗時処理
 */
const onSearchFailure = (strategyName: string) => 
  tap<ContactPageResult | null>((result) => {
    if (!result) {
      console.log(`Strategy ${strategyName} returned no result`);
    }
  });

/**
 * 検索戦略の成功時処理
 */
const onSearchSuccess = (strategyName: string) =>
  tap<ContactPageResult | null>((result) => {
    if (result?.contactUrl) {
      console.log(`✅ Found via ${strategyName}: ${result.contactUrl}`);
    }
  });

/**
 * 検索戦略実行パイプライン
 */
export const executeSearchStrategy = (strategy: SearchFunction, strategyName: string) =>
  (baseUrl: string, searchState: SearchState): ContactPageResult | null =>
    pipe(
      () => strategy(baseUrl, searchState),
      maybe(validateResult),
      onSearchSuccess(strategyName),
      onSearchFailure(strategyName)
    )();

/**
 * メイン検索パイプライン
 */
export const executeContactSearch = (baseUrl: string): ContactPageResult => {
  const searchState = new SearchState();
  
  // SNSページチェック
  if (NetworkUtils.isSNSPage(baseUrl)) {
    return { 
      contactUrl: null, 
      actualFormUrl: null, 
      foundKeywords: ['sns_page'], 
      searchMethod: 'sns_not_supported' 
    };
  }

  // ドメイン可用性チェック
  const domainCheck = NetworkUtils.checkDomainAvailability(baseUrl);
  if (!domainCheck.available) {
    const errorMessage = domainCheck.error || 'サイトが閉鎖されています';
    // エラーメッセージを直接searchMethodに反映
    let searchMethod = 'site_closed'; // デフォルト
    if (errorMessage.includes('DNS')) {
      searchMethod = 'dns_error';
    } else if (errorMessage.includes('bot') || errorMessage.includes('Bot') || errorMessage.includes('403') || errorMessage.includes('501')) {
      searchMethod = 'bot_blocked';
    } else if (errorMessage.includes('timeout') || errorMessage.includes('タイムアウト')) {
      searchMethod = 'timeout_error';
    } else if (errorMessage === 'サイトが閉鎖されています') {
      searchMethod = 'site_closed';
    } else {
      // 詳細エラーメッセージがある場合はerrorとして扱う
      searchMethod = 'error';
    }
    return { 
      contactUrl: null, 
      actualFormUrl: null, 
      foundKeywords: [errorMessage], 
      searchMethod 
    };
  }

  const domainUrl = NetworkUtils.extractDomain(baseUrl);

  // 検索戦略パイプライン：順次実行し、最初に成功した結果を返す
  const searchPipeline = pipe(
    (url: string) => executeSearchStrategy(urlPatternSearch, 'URL Pattern Search')(url, searchState),
    orElse(() => executeSearchStrategy(htmlAnalysisSearch, 'HTML Analysis Search')(domainUrl, searchState)),
    orElse(() => executeSearchStrategy(fallbackSearch, 'Fallback Search')(domainUrl, searchState)),
    orElse(() => ({ 
      contactUrl: null, 
      actualFormUrl: null, 
      foundKeywords: [], 
      searchMethod: 'not_found' as const
    }))
  );

  return searchPipeline(domainUrl);
};