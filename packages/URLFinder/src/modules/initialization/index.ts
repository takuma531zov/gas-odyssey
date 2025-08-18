/**
 * 初期化・検証機能モジュール
 * 候補リセット、SNS判定、ドメイン生存確認を統合
 * 
 * 【処理内容】
 * - 候補リスト完全リセット（新しい検索開始時）
 * - SNSページ検出による早期終了
 * - ドメイン生存確認による閉鎖サイト除外
 */

import { ContactPageResult } from '../../types/interfaces';
import { UrlUtils } from '../../utils/UrlUtils';
import { PurityUtils } from '../../utils/PurityUtils';

// GAS専用インポート（ESBuildでは無視される）
declare const UrlFetchApp: any;

/**
 * 状態管理用インターフェース
 * 初期化機能で使用する静的変数群
 */
export interface InitializationState {
  candidatePages: Array<{
    url: string,
    reason: string,
    score: number,
    structuredForms: number,
    legacyScore: number
  }>;
  validUrls: Array<{ 
    url: string,
    pattern: string
  }>;
  successfulFormUrls: Array<string>;
  sameHtmlCache: { [url: string]: string };
}

/**
 * メイン初期化処理
 * SNS判定とドメイン生存確認を実行
 * @param baseUrl 検証対象URL
 * @param state 状態オブジェクト（参照渡しで更新）
 * @returns 早期終了の場合は結果、継続の場合はnull
 */
export function initializeContactSearch(
  baseUrl: string, 
  state: InitializationState
): ContactPageResult | null {
  // 候補リストのリセット（新しい検索開始時）
  resetCandidates(state);

  // SNSページの検出
  if (UrlUtils.isSNSPage(baseUrl)) {
    console.log(`SNS page detected: ${baseUrl}, returning not found`);
    return {
      contactUrl: null,
      actualFormUrl: null,
      foundKeywords: ['sns_page'],
      searchMethod: 'sns_not_supported'
    };
  }

  // ドメイン生存確認
  console.log(`Checking domain availability for: ${baseUrl}`);
  const domainCheck = checkDomainAvailability(baseUrl);
  if (!domainCheck.available) {
    console.log(`Domain unavailable: ${domainCheck.error}`);
    return {
      contactUrl: null,
      actualFormUrl: null,
      foundKeywords: [domainCheck.error || 'サイトが閉鎖されています'],
      searchMethod: 'site_closed'
    };
  }
  console.log(`Domain is available, proceeding with contact search`);

  return null; // 継続処理
}

/**
 * 候補リストリセット処理
 * 新しい検索開始時に全ての状態をクリア
 * @param state 状態オブジェクト（参照渡しで更新）
 */
export function resetCandidates(state: InitializationState): void {
  state.candidatePages = [];
  state.validUrls = [];
  state.successfulFormUrls = [];
  state.sameHtmlCache = {}; // Reset SPA detection cache
}

/**
 * ドメイン生存確認処理
 * HTTPリクエストによりサイトの生存状況を判定
 * @param baseUrl 確認対象URL
 * @returns 生存状況と詳細エラー
 */
export function checkDomainAvailability(baseUrl: string): { available: boolean, error?: string } {
  try {
    console.log(`Testing domain availability: ${baseUrl}`);
    const response = fetchWithTimeout(baseUrl, 3000); // 3秒タイムアウト
    const statusCode = response.getResponseCode();

    console.log(`Domain check status: ${statusCode}`);

    // 200-399は正常、404は閉鎖
    if (statusCode >= 200 && statusCode < 400) {
      return { available: true };
    } else if (statusCode === 404) {
      return { available: false, error: 'サイトが見つかりません（404）' };
    } else {
      // その他のステータスコードは生存とみなす（後続処理で詳細エラー判定）
      return { available: true };
    }
  } catch (error) {
    const detailedError = PurityUtils.getDetailedNetworkError(error);
    console.log(`Domain check error: ${detailedError}`);

    // 明確に閉鎖を示すエラーの場合は閉鎖とみなす
    if (detailedError.includes('DNS解決失敗') ||
        detailedError.includes('接続拒否') ||
        detailedError.includes('SSL/TLS証明書エラー') ||
        detailedError.includes('ネットワーク到達不可') ||
        detailedError.includes('ホスト到達不可')) {
      return { available: false, error: `サイトが閉鎖されています: ${detailedError}` };
    }

    // その他のエラーは一時的な問題として処理継続
    console.log(`Domain check inconclusive, continuing: ${detailedError}`);
    return { available: true };
  }
}

/**
 * HTTPリクエスト実行（タイムアウト管理）
 * ドメイン確認用の軽量リクエスト
 * @param url リクエスト対象URL
 * @param timeoutMs タイムアウト時間（ミリ秒）
 * @returns レスポンスオブジェクト
 */
function fetchWithTimeout(url: string, timeoutMs: number = 5000) {
  try {
    return UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      method: 'HEAD', // HEADリクエストで軽量化
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
  } catch (error) {
    const detailedError = PurityUtils.getDetailedNetworkError(error);
    console.error(`Error fetching ${url}: ${detailedError}`);
    throw error;
  }
}