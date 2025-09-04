/**
 * ネットワーク処理純粋関数群
 * HTTP通信とエラーハンドリングの関数型実装
 */

import { HTTP_ERROR_MESSAGES, SNS_PATTERNS } from '../constants/network';
import { HOMEPAGE_FILE_PATTERNS } from '../constants/patterns';

// 型定義
type NetworkResult<T> = T | Error;
type HttpResponse = GoogleAppsScript.URL_Fetch.HTTPResponse;

/**
 * タイムアウト付きHTTP通信（純粋関数）
 */
export const fetchWithTimeout = (url: string, timeoutMs: number = 5000): NetworkResult<HttpResponse> => {
  try {
    // GASのfetchは内部的にタイムアウト管理されるため、パラメータは保持するが実装は標準fetch
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true
    });

    return response;
  } catch (error) {
    const detailedError = getDetailedNetworkError(error);
    console.log(`Network error for ${url}: ${detailedError}`);
    return error instanceof Error ? error : new Error(String(error));
  }
};

/**
 * ネットワークエラーの詳細情報を取得（純粋関数）
 */
export const getDetailedNetworkError = (error: Error | unknown): string => {
  if (!error) {
    return 'Unknown error';
  }

  // 文字列エラーの場合
  if (typeof error === 'string') {
    return error;
  }

  // GASのエラーオブジェクトの場合
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message: string }).message.toLowerCase();

    switch (true) {
      case message.includes('timeout'):
        return 'Network timeout - サーバーの応答が遅すぎます';
      case message.includes('dns') || message.includes('name resolution'):
        return 'DNS解決失敗: ドメインが存在しません';
      case message.includes('connection refused') || message.includes('connect'):
        return 'Connection refused - サーバーに接続できません';
      case message.includes('ssl') || message.includes('certificate'):
        return 'SSL certificate error - 証明書エラー';
      case message.includes('host'):
        return 'Host unreachable - ホストに到達できません';
      case message.includes('forbidden') || message.includes('403'):
        return 'Access forbidden (403) - アクセスが拒否されました';
      case message.includes('not found') || message.includes('404'):
        return 'Page not found (404) - ページが見つかりません';
      case message.includes('500'):
        return 'Server error (500) - サーバー内部エラー';
      default:
        return 'GASエラー: アクセスに失敗しました';
    }
  }

  return `Unknown network error: ${error.toString()}`;
};

/**
 * 詳細エラーメッセージ取得（純粋関数）
 */
export const getDetailedErrorMessage = (statusCode: number): string =>
  HTTP_ERROR_MESSAGES[statusCode] || `HTTP Error ${statusCode} - 不明なエラー`;

/**
 * SNSページ判定（純粋関数）
 */
export const isSNSPage = (url: string): boolean => {
  const lowerUrl = url.toLowerCase();
  return SNS_PATTERNS.some(pattern => lowerUrl.includes(pattern));
};

/**
 * URLからドメイン部分を抽出（純粋関数）
 */
export const extractDomain = (url: string): string => {
  // Extract protocol and host from URL
  const protocolMatch = url.match(/^https?:/);
  const hostMatch = url.match(/^https?:\/\/([^\/]+)/);

  if (!protocolMatch || !hostMatch) {
    return url;
  }

  const protocol = protocolMatch[0];
  const host = hostMatch[1];

  return `${protocol}//${host}/`;
};

/**
 * 相対URLを絶対URLに変換（カリー化対応）
 */
export const resolveUrl = (baseUrl: string) => (url: string): string => {
  // Skip invalid or non-web URLs
  if (url.startsWith('mailto:') || url.startsWith('javascript:') || url.startsWith('tel:')) {
    return url; // Return as-is but these should be filtered out in calling code
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Extract protocol and host from baseUrl manually
  const protocolMatch = baseUrl.match(/^https?:/);
  const hostMatch = baseUrl.match(/^https?:\/\/([^\/]+)/);

  if (!protocolMatch || !hostMatch) {
    return url;
  }

  const protocol = protocolMatch[0];
  const host = hostMatch[1];

  if (url.startsWith('/')) {
    return `${protocol}//${host}${url}`;
  }

  return `${protocol}//${host}/${url}`;
};

/**
 * トップページURLかどうかを判定（カリー化対応）
 */
export const isHomepageUrl = (baseUrl: string) => (url: string): boolean => {
  // 相対URLを絶対URLに変換
  const fullUrl = resolveUrl(baseUrl)(url);

  // ベースドメインを抽出
  const baseDomain = extractDomain(baseUrl);

  // トップページパターン
  const homepagePatterns = [
    baseDomain,                     // https://example.com/
    baseDomain.replace(/\/$/, ''),  // https://example.com
    ...HOMEPAGE_FILE_PATTERNS.map(pattern => baseDomain + pattern)
  ];

  // 完全一致チェック
  const isHomepage = homepagePatterns.some(pattern =>
    fullUrl.toLowerCase() === pattern.toLowerCase()
  );

  return isHomepage;
};

/**
 * ドメイン可用性チェック（Either モナド使用）
 */
export const checkDomainAvailability = (baseUrl: string): { available: boolean, error?: string } => {
  try {
    console.log(`Testing domain availability: ${baseUrl}`);
    const response = fetchWithTimeout(baseUrl, 3000); // 3秒タイムアウト

    if (response instanceof Error) {
      const detailedError = getDetailedNetworkError(response);
      console.log(`Domain check error: ${detailedError}`);
      return { available: false, error: detailedError };
    }

    const statusCode = response.getResponseCode();
    console.log(`Domain check status: ${statusCode}`);

    if (statusCode >= 200 && statusCode < 400) {
      return { available: true };
    }
    // 404を含む、200-399以外のすべてのステータスコードをエラーとして扱う
    return { available: false, error: getDetailedErrorMessage(statusCode) };
  } catch (error) {
    const detailedError = getDetailedNetworkError(error);
    console.log(`Domain check error: ${detailedError}`);
    // catchしたエラーはすべて利用不可とする
    return { available: false, error: detailedError };
  }
};
