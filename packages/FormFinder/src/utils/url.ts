export class UrlUtils {
  static isValidUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }
    
    // GAS環境では URL コンストラクタが使えないため、正規表現でチェック
    const urlPattern = /^https?:\/\/[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*(:\d+)?(\/[^\s]*)?$/;
    return urlPattern.test(url.trim());
  }

  static resolveUrl(baseUrl: string, relativeUrl: string): string {
    if (!baseUrl || !relativeUrl) {
      return relativeUrl;
    }
    
    // 絶対URLの場合はそのまま返す
    if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
      return relativeUrl;
    }
    
    // 相対URLを絶対URLに変換
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    
    if (relativeUrl.startsWith('/')) {
      // ルート相対パス
      const protocolAndHost = cleanBaseUrl.match(/^https?:\/\/[^\/]+/);
      return protocolAndHost ? protocolAndHost[0] + relativeUrl : relativeUrl;
    } else {
      // 相対パス
      return cleanBaseUrl + '/' + relativeUrl;
    }
  }

  static normalizeUrl(url: string): string {
    if (!url) return '';
    
    // Remove trailing slash
    url = url.replace(/\/$/, '');
    
    // Ensure https protocol
    if (url.startsWith('//')) {
      url = 'https:' + url;
    } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    return url;
  }

  static extractDomain(url: string): string {
    if (!url || typeof url !== 'string') {
      return '';
    }
    
    // プロトコルを除去してドメイン部分を抽出
    const match = url.match(/^https?:\/\/([^\/\?#:]+)/);
    return match ? match[1]! : '';
  }

  static isSameDomain(url1: string, url2: string): boolean {
    return this.extractDomain(url1) === this.extractDomain(url2);
  }
}