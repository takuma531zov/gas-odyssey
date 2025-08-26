/**
 * ネットワーク処理ユーティリティ
 * HTTP通信とエラーハンドリングを管理
 */

export class NetworkUtils {

  /**
   * タイムアウト付きHTTP通信
   * @param url 通信先URL
   * @param timeoutMs タイムアウト時間（ミリ秒）
   * @returns HTTPResponse
   * @throws ネットワークエラー時
   */
  static fetchWithTimeout(url: string, _timeoutMs: number = 5000): GoogleAppsScript.URL_Fetch.HTTPResponse {
    try {
      // GASのfetchは内部的にタイムアウト管理されるため、パラメータは保持するが実装は標準fetch
      const response = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        followRedirects: true
      });

      return response;
    } catch (error) {
      const detailedError = this.getDetailedNetworkError(error);
      console.log(`Network error for ${url}: ${detailedError}`);
      throw error;
    }
  }

  /**
   * ネットワークエラーの詳細情報を取得
   * @param error エラーオブジェクト
   * @returns 詳細エラーメッセージ
   */
  static getDetailedNetworkError(error: any): string {
    if (!error) {
      return 'Unknown error';
    }

    // GASのエラーオブジェクトの場合
    if (error.message) {
      const message = error.message.toLowerCase();

      if (message.includes('timeout')) {
        return 'Network timeout - サーバーの応答が遅すぎます';
      } else if (message.includes('dns') || message.includes('name resolution')) {
        return 'DNS解決失敗: ドメインが存在しません';
      } else if (message.includes('connection refused') || message.includes('connect')) {
        return 'Connection refused - サーバーに接続できません';
      } else if (message.includes('ssl') || message.includes('certificate')) {
        return 'SSL certificate error - 証明書エラー';
      } else if (message.includes('host')) {
        return 'Host unreachable - ホストに到達できません';
      } else if (message.includes('forbidden') || message.includes('403')) {
        return 'Access forbidden (403) - アクセスが拒否されました';
      } else if (message.includes('not found') || message.includes('404')) {
        return 'Page not found (404) - ページが見つかりません';
      } else if (message.includes('500')) {
        return 'Server error (500) - サーバー内部エラー';
      }

      return `Network error: ${error.message}`;
    }

    // 文字列エラーの場合
    if (typeof error === 'string') {
      return error;
    }

    return `Unknown network error: ${error.toString()}`;
  }

  /**
   * URL生存確認
   * @param url 確認対象URL
   * @param timeoutMs タイムアウト時間
   * @returns 生存しているかどうか
   */
  static isUrlAlive(url: string, timeoutMs: number = 5000): boolean {
    try {
      const response = this.fetchWithTimeout(url, timeoutMs);
      const statusCode = response.getResponseCode();

      // 200-299, 300-399 (redirects) are considered alive
      return statusCode >= 200 && statusCode < 400;
    } catch (error) {
      console.log(`URL alive check failed for ${url}: ${this.getDetailedNetworkError(error)}`);
      return false;
    }
  }

  /**
   * レスポンスコードの分類
   * @param statusCode HTTPステータスコード
   * @returns ステータス分類
   */
  static categorizeStatusCode(statusCode: number): 'success' | 'redirect' | 'client_error' | 'server_error' | 'unknown' {
    if (statusCode >= 200 && statusCode < 300) {
      return 'success';
    } else if (statusCode >= 300 && statusCode < 400) {
      return 'redirect';
    } else if (statusCode >= 400 && statusCode < 500) {
      return 'client_error';
    } else if (statusCode >= 500 && statusCode < 600) {
      return 'server_error';
    }
    return 'unknown';
  }

  /**
   * 詳細エラーメッセージ取得
   * @param statusCode HTTPステータスコード
   * @returns 詳細なエラーメッセージ
   */
  static getDetailedErrorMessage(statusCode: number): string {
    const errorMessages: { [key: number]: string } = {
      400: 'Bad Request - 不正なリクエスト',
      401: 'Unauthorized - 認証が必要',
      403: 'Forbidden - アクセス拒否（Bot対策またはアクセス制限）',
      404: 'Not Found - ページが存在しません',
      405: 'Method Not Allowed - 許可されていないHTTPメソッド',
      408: 'Request Timeout - リクエストタイムアウト',
      429: 'Too Many Requests - レート制限（アクセス過多）',
      500: 'Internal Server Error - サーバー内部エラー',
      501: 'Not Implemented - Bot対策によりブロック',
      502: 'Bad Gateway - ゲートウェイエラー',
      503: 'Service Unavailable - サービス利用不可（メンテナンス中）',
      504: 'Gateway Timeout - ゲートウェイタイムアウト',
      520: 'Web Server Error - Webサーバーエラー（Cloudflare）',
      521: 'Web Server Down - Webサーバーダウン（Cloudflare）',
      522: 'Connection Timed Out - 接続タイムアウト（Cloudflare）',
      523: 'Origin Unreachable - オリジンサーバー到達不可（Cloudflare）',
      524: 'A Timeout Occurred - タイムアウト発生（Cloudflare）'
    };

    return errorMessages[statusCode] || `HTTP Error ${statusCode} - 不明なエラー`;
  }

  /**
   * SNSページ判定
   * @param url 判定対象URL
   * @returns SNSページかどうか
   */
  static isSNSPage(url: string): boolean {
    const snsPatterns = [
      'facebook.com',
      'twitter.com',
      'x.com',
      'instagram.com',
      'linkedin.com',
      'youtube.com',
      'tiktok.com',
      'line.me',
      'ameba.jp',
      'note.com',
      'qiita.com'
    ];

    const lowerUrl = url.toLowerCase();
    return snsPatterns.some(pattern => lowerUrl.includes(pattern));
  }

  /**
   * URLからドメイン部分を抽出
   * @param url 対象URL
   * @returns ドメイン部分（protocol://host/形式）
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
   * 相対URLを絶対URLに変換
   * @param url 変換対象URL
   * @param baseUrl ベースURL
   * @returns 絶対URL
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
   * トップページURLかどうかを判定
   * @param url 判定対象URL
   * @param baseUrl ベースURL
   * @returns トップページかどうか
   */
  static isHomepageUrl(url: string, baseUrl: string): boolean {
    // 相対URLを絶対URLに変換
    const fullUrl = this.resolveUrl(url, baseUrl);

    // ベースドメインを抽出
    const baseDomain = this.extractDomain(baseUrl);

    // トップページパターン
    const homepagePatterns = [
      baseDomain,                     // https://example.com/
      baseDomain.replace(/\/$/, ''),  // https://example.com
      baseDomain + 'index.html',
      baseDomain + 'index.htm',
      baseDomain + 'index.php',
      baseDomain + 'home/',
      baseDomain + 'home'
    ];

    // 完全一致チェック
    const isHomepage = homepagePatterns.some(pattern =>
      fullUrl.toLowerCase() === pattern.toLowerCase()
    );

    return isHomepage;
  }

  /**
   * フォールバックURLの品質評価
   * @param url 評価対象URL
   * @param pattern マッチしたURLパターン
   * @returns 信頼度スコアとキーワード
   */
  static evaluateFallbackUrlQuality(url: string, pattern: string): { confidence: number, keywords: string[] } {
    let confidence = 0.5; // ベーススコア
    const keywords: string[] = [];

    // 高信頼度パターン
    const highConfidencePatterns = ['/contact/', '/contact', '/inquiry/', '/inquiry'];
    if (highConfidencePatterns.includes(pattern)) {
      confidence += 0.3;
      keywords.push('high_confidence_pattern');
    }

    // 中信頼度パターン
    const mediumConfidencePatterns = ['/form/', '/form'];
    if (mediumConfidencePatterns.includes(pattern)) {
      confidence += 0.1;
      keywords.push('medium_confidence_pattern');
    }

    // URL内のcontactキーワードチェック（ドメイン除外）
    const urlPath = url.replace(/https?:\/\/[^/]+/, ''); // ドメインを除外
    const contactKeywords = ['contact', 'inquiry', 'form', 'お問い合わせ', '問い合わせ'];

    for (const keyword of contactKeywords) {
      if (urlPath.toLowerCase().includes(keyword.toLowerCase())) {
        confidence += 0.1;
        keywords.push(`path_contains_${keyword}`);
      }
    }

    // 信頼度を上限で制限
    confidence = Math.min(confidence, 1.0);

    console.log(`URL quality evaluation for ${url}: confidence=${confidence.toFixed(2)}, keywords=[${keywords.join(', ')}]`);
    return { confidence, keywords };
  }

  static checkDomainAvailability(baseUrl: string): { available: boolean, error?: string } {
    try {
      console.log(`Testing domain availability: ${baseUrl}`);
      const response = this.fetchWithTimeout(baseUrl, 3000); // 3秒タイムアウト
      const statusCode = response.getResponseCode();

      console.log(`Domain check status: ${statusCode}`);

      if (statusCode >= 200 && statusCode < 400) {
        return { available: true };
      }
      // 404を含む、200-399以外のすべてのステータスコードをエラーとして扱う
      return { available: false, error: `サイトにアクセスできません (コード: ${statusCode})` };
    } catch (error) {
      const detailedError = this.getDetailedNetworkError(error);
      console.log(`Domain check error: ${detailedError}`);
      // catchしたエラーはすべて利用不可とする
      return { available: false, error: detailedError };
    }
  }
}
