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
        return 'DNS resolution failed - ドメイン名が解決できません';
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
}