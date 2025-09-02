/**
 * URL処理純粋関数群
 * 副作用なし、入力→出力の関数型実装
 */

import { UrlResolutionResult } from '../types/types';

/**
 * 相対URLを絶対URLに解決（カリー化対応）
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
 * URLからドメイン部分を抽出
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
 * URLの妥当性チェック
 */
export const validateUrl = (url: string): UrlResolutionResult => {
  if (!url) {
    return {
      resolvedUrl: '',
      isValid: false,
      error: 'URL is empty'
    };
  }

  // Skip non-web URLs
  if (url.startsWith('mailto:') || url.startsWith('javascript:') || url.startsWith('tel:')) {
    return {
      resolvedUrl: url,
      isValid: false,
      error: 'Non-web URL'
    };
  }

  // Check for valid HTTP/HTTPS URLs
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return {
      resolvedUrl: url,
      isValid: true
    };
  }

  return {
    resolvedUrl: url,
    isValid: false,
    error: 'Invalid URL format'
  };
};

/**
 * URLを正規化（末尾スラッシュの統一等）
 */
export const normalizeUrl = (url: string): string => {
  if (!url) return '';

  // Remove trailing slash except for domain root
  if (url.endsWith('/') && url.match(/^https?:\/\/[^\/]+\/$/)) {
    return url; // Keep trailing slash for domain root
  }

  return url.replace(/\/$/, '');
};

/**
 * 同一ドメインかチェック（カリー化対応）
 */
export const isSameDomain = (url1: string) => (url2: string): boolean => {
  const domain1 = extractDomain(url1);
  const domain2 = extractDomain(url2);
  return domain1 === domain2;
};

// 非カリー化版（2引数）
export const isSameDomainBinary = (url1: string, url2: string): boolean =>
  isSameDomain(url1)(url2);

// 後方互換性のためのクラス（段階的移行用）
export class UrlUtils {
  static resolveUrl = (url: string, baseUrl: string) => resolveUrl(baseUrl)(url);
  static extractDomain = extractDomain;
  static validateUrl = validateUrl;
  static normalizeUrl = normalizeUrl;
  static isSameDomain = isSameDomainBinary;
}
