/**
 * URL処理ユーティリティ
 * 純粋関数として実装し、副作用を排除
 */

import { UrlResolutionResult } from '../types/interfaces';

export class UrlUtils {
  
  /**
   * 相対URLを絶対URLに解決
   * @param url 対象URL（相対または絶対）
   * @param baseUrl ベースURL
   * @returns 解決されたURL
   */
  static resolveUrl(url: string, baseUrl: string): string {
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
  }

  /**
   * URLからドメイン部分を抽出
   * @param url 対象URL
   * @returns ドメインURL（プロトコル + ホスト + /）
   */
  static extractDomain(url: string): string {
    // Extract protocol and host from URL
    const protocolMatch = url.match(/^https?:/);
    const hostMatch = url.match(/^https?:\/\/([^\/]+)/);

    if (!protocolMatch || !hostMatch) {
      return url;
    }

    const protocol = protocolMatch[0];
    const host = hostMatch[1];

    return `${protocol}//${host}/`;
  }

  /**
   * URLの妥当性チェック
   * @param url チェック対象URL
   * @returns 妥当性結果
   */
  static validateUrl(url: string): UrlResolutionResult {
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
  }

  /**
   * URLを正規化（末尾スラッシュの統一等）
   * @param url 対象URL
   * @returns 正規化されたURL
   */
  static normalizeUrl(url: string): string {
    if (!url) return '';
    
    // Remove trailing slash except for domain root
    if (url.endsWith('/') && url.match(/^https?:\/\/[^\/]+\/$/)) {
      return url; // Keep trailing slash for domain root
    }
    
    return url.replace(/\/$/, '');
  }

  /**
   * 同一ドメインかチェック
   * @param url1 比較URL1
   * @param url2 比較URL2
   * @returns 同一ドメインかどうか
   */
  static isSameDomain(url1: string, url2: string): boolean {
    const domain1 = this.extractDomain(url1);
    const domain2 = this.extractDomain(url2);
    return domain1 === domain2;
  }
}