/**
 * HTTP通信・エラーハンドリングシステムモジュール
 * HTTP通信の実行とエラー処理を統一管理する機能
 * 
 * 【処理内容】
 * - タイムアウト付きHTTP取得
 * - 詳細ネットワークエラー解析
 * - HTTP ステータスコード詳細解析
 */

import { PurityUtils } from '../../utils/PurityUtils';

// GAS専用インポート（ESBuildでは無視される）
declare const UrlFetchApp: any;

/**
 * タイムアウト付きHTTP取得
 * GAS環境でのHTTPリクエスト実行（タイムアウト管理）
 * @param url 取得対象URL
 * @param _timeoutMs タイムアウト時間（ms）※GASでは利用不可
 * @returns HTTPレスポンス
 */
export function fetchWithTimeout(url: string, _timeoutMs: number = 5000) {
  try {
    // GASのUrlFetchAppはtimeoutオプションをサポートしていないため、
    // デフォルトのタイムアウト（約20-30秒）が適用される
    return UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
  } catch (error) {
    const detailedError = getDetailedNetworkError(error);
    console.error(`Error fetching ${url}: ${detailedError}`);
    throw error;
  }
}

/**
 * HTTP ステータスコード詳細解析
 * ステータスコードから詳細なエラーメッセージを生成
 * @param statusCode HTTPステータスコード
 * @returns 詳細エラーメッセージ
 */
export function getDetailedErrorMessage(statusCode: number): string {
  return PurityUtils.getDetailedErrorMessage(statusCode);
}

/**
 * 詳細ネットワークエラー解析
 * エラーオブジェクトから詳細なエラー原因を特定
 * @param error エラーオブジェクト
 * @returns 詳細エラーメッセージ
 */
export function getDetailedNetworkError(error: any): string {
  return PurityUtils.getDetailedNetworkError(error);
}