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
    const errorString = String(error);

    // DNS関連エラー
    if (errorString.includes('DNS') || errorString.includes('NXDOMAIN') || errorString.includes('Name or service not known')) {
      return 'DNS解決失敗: ドメインが存在しません';
    }

    // タイムアウトエラー
    if (errorString.includes('timeout') || errorString.includes('Timeout')) {
      return 'タイムアウト: サーバーからの応答が遅すぎます';
    }

    // 接続拒否エラー
    if (errorString.includes('Connection refused') || errorString.includes('ECONNREFUSED')) {
      return '接続拒否: サーバーが接続を拒否しました';
    }

    // SSL/TLS関連エラー
    if (errorString.includes('SSL') || errorString.includes('TLS') || errorString.includes('certificate')) {
      return 'SSL/TLS証明書エラー: セキュア接続に失敗';
    }

    // ネットワーク到達不可
    if (errorString.includes('Network is unreachable') || errorString.includes('ENETUNREACH')) {
      return 'ネットワーク到達不可: サーバーに到達できません';
    }

    // ホスト到達不可
    if (errorString.includes('No route to host') || errorString.includes('EHOSTUNREACH')) {
      return 'ホスト到達不可: 指定されたホストに到達できません';
    }

    // GAS固有エラー（Address unavailable等）
    if (errorString.includes('Address unavailable') ||
        errorString.includes('Exception:') ||
        errorString.includes('Request failed') ||
        errorString.includes('Service unavailable')) {
      return 'GASエラー: アクセスに失敗しました';
    }

    // その他のネットワークエラー
    if (errorString.includes('Failed to fetch') || errorString.includes('Network error')) {
      return 'ネットワークエラー: 通信に失敗しました';
    }

    // 不明なエラー
    return `不明なエラー: ${errorString}`;
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
   * エンコーディング対応コンテンツ取得（index.tsから移植・最適版完全移植）
   */
  static getContentWithEncoding(response: GoogleAppsScript.URL_Fetch.HTTPResponse): string {
    const headers = response.getHeaders();
    const contentTypeHeader = headers['Content-Type'] || headers['content-type'] || '';
    
    console.log(`Content-Type header: ${contentTypeHeader}`);

    // Content-Typeヘッダーから文字エンコーディングを抽出
    const charsetMatch = contentTypeHeader.match(/charset=([^;\s]+)/i);
    const declaredCharset = charsetMatch ? charsetMatch[1].toLowerCase() : null;
    
    console.log(`Declared charset: ${declaredCharset}`);

    // エンコーディング候補を優先順位付きで定義（日本語サイト対応）
    const encodingCandidates = [
      declaredCharset, // 宣言された文字コード（最優先）
      'utf-8',         // UTF-8（標準）
      'shift_jis',     // Shift_JIS（日本語サイト）
      'euc-jp',        // EUC-JP（日本語サイト）
      'iso-2022-jp'    // ISO-2022-JP（日本語メール等）
    ].filter(Boolean) as string[]; // nullを除外

    console.log(`Encoding candidates: ${encodingCandidates.join(', ')}`);

    // 各エンコーディングを試行
    for (const encoding of encodingCandidates) {
      try {
        console.log(`Trying encoding: ${encoding}`);
        const content = response.getContentText(encoding);
        
        if (this.isValidEncoding(content)) {
          console.log(`✅ Valid encoding found: ${encoding}`);
          return content;
        } else {
          console.log(`❌ Invalid encoding: ${encoding} (too many replacement chars)`);
        }
      } catch (error) {
        console.log(`❌ Encoding failed: ${encoding} - ${error}`);
        continue;
      }
    }

    console.log(`⚠ All encodings failed, using default UTF-8`);
    return response.getContentText(); // 最終フォールバック
  }

  /**
   * エンコーディング有効性検証（index.tsから移植・最適版完全移植）
   */
  private static isValidEncoding(content: string): boolean {
    // 置換文字の割合が5%未満なら有効
    const replacementChars = (content.match(/�/g) || []).length;
    const isValid = (replacementChars / content.length) < 0.05;
    console.log(`Encoding validation: ${replacementChars} replacement chars out of ${content.length} (${(replacementChars/content.length*100).toFixed(2)}%) - ${isValid ? 'VALID' : 'INVALID'}`);
    return isValid;
  }

  /**
   * Google Forms検出（index.tsから移植・最適版完全移植）
   */
  static findGoogleFormUrlsOnly(html: string): string | null {
    // Remove CSS and script content to focus on HTML
    const cleanHtml = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

    console.log(`Searching for Google Forms in ${cleanHtml.length} chars of clean HTML`);

    // Google Forms patterns
    const googleFormPatterns = [
      /https:\/\/docs\.google\.com\/forms\/d\/([a-zA-Z0-9-_]+)/g,
      /docs\.google\.com\/forms\/d\/([a-zA-Z0-9-_]+)/g,
      /forms\.gle\/([a-zA-Z0-9-_]+)/g
    ];

    for (const pattern of googleFormPatterns) {
      const matches = Array.from(cleanHtml.matchAll(pattern));
      if (matches.length > 0 && matches[0] && matches[0][0]) {
        const fullUrl = matches[0][0].startsWith('http') 
          ? matches[0][0] 
          : `https://${matches[0][0]}`;
        
        console.log(`Google Form URL found: ${fullUrl}`);
        return fullUrl;
      }
    }

    console.log('No Google Form URLs found');
    return null;
  }

  /**
   * 埋め込みHTMLフォーム検出（index.tsから移植・最適版完全移植）
   */
  static findEmbeddedHTMLForm(html: string): boolean {
    const lowerHtml = html.toLowerCase();
    
    // より包括的なHTMLフォーム検証
    const hasFormTag = lowerHtml.includes('<form');
    const hasInput = lowerHtml.includes('<input') || lowerHtml.includes('<textarea');
    
    console.log(`HTML form validation: form tag=${hasFormTag}, input=${hasInput}`);
    
    if (!hasFormTag || !hasInput) return false;
    
    // 必須要素の確認（送信ボタンまたはaction属性）
    const hasSubmit = lowerHtml.includes('type="submit"') || 
                     lowerHtml.includes('<button') ||
                     lowerHtml.includes('action=');
    
    console.log(`HTML form submit validation: ${hasSubmit}`);
    return hasSubmit;
  }

  /**
   * ドメイン生存確認（index.tsから移植・最適版完全移植）
   */
  static checkDomainAvailability(baseUrl: string): { available: boolean, error?: string } {
    console.log(`Checking domain availability for: ${baseUrl}`);
    try {
      // HEAD リクエストで軽量チェック
      const response = this.fetchWithTimeout(baseUrl, 8000);
      const statusCode = response.getResponseCode();
      console.log(`Domain check status: ${statusCode}`);
      
      // 200-299, 300-399 は利用可能と判定
      if (statusCode >= 200 && statusCode < 400) {
        return { available: true };
      } else if (statusCode === 404) {
        return { available: false, error: 'サイトが見つかりません(404)' };
      } else if (statusCode === 403) {
        return { available: false, error: 'アクセスが拒否されました(403)' };
      } else if (statusCode === 501) {
        return { available: false, error: 'Not Implemented - Bot対策によりブロック' };
      } else if (statusCode >= 500) {
        return { available: false, error: 'サーバーエラーが発生しています' };
      } else {
        return { available: false, error: `HTTP ${statusCode}` };
      }
    } catch (error) {
      const detailedError = this.getDetailedNetworkError(error);
      console.log(`Domain check failed: ${detailedError}`);
      return { available: false, error: detailedError };
    }
  }

  /**
   * SNSページ判定（index.tsから移植・最適版完全移植）
   */
  static isSNSPage(url: string): boolean {
    const snsPatterns = [
      'facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com',
      'youtube.com', 'tiktok.com', 'line.me', 'note.com'
    ];
    
    const lowerUrl = url.toLowerCase();
    const isSNS = snsPatterns.some(pattern => lowerUrl.includes(pattern));
    
    console.log(`SNS page check: ${url} -> ${isSNS}`);
    return isSNS;
  }

  /**
   * ドメイン抽出（index.tsから移植・最適版完全移植）
   */
  static extractDomain(url: string): string {
    try {
      // プロトコルの正規化
      let normalizedUrl = url;
      if (!url.match(/^https?:\/\//)) {
        normalizedUrl = `https://${url}`;
      }
      
      const urlObj = new URL(normalizedUrl);
      const protocol = urlObj.protocol;
      const host = urlObj.host;
      
      const domain = `${protocol}//${host}`;
      console.log(`Domain extracted: ${url} -> ${domain}`);
      return domain;
    } catch (error) {
      console.log(`Domain extraction failed: ${error}, returning original URL`);
      return url;
    }
  }

  /**
   * 2段階フォームリンク検出（index.tsから移植・最適版完全移植）
   */
  static findSecondStageFormLink(html: string, contactPageUrl: string): string | null {
    console.log('Searching for second-stage form links...');
    
    // より詳細なフォームリンクパターン
    const formLinkPatterns = [
      /<a[^>]*href=['"]([^'\"]*?form[^'\"]*?)['"][^>]*>/gi,
      /<a[^>]*href=['"]([^'\"]*?inquiry[^'\"]*?)['"][^>]*>/gi,
      /<a[^>]*href=['"]([^'\"]*?contact[^'\"]*?)['"][^>]*>/gi,
      /<a[^>]*href=['"]([^'\"]*?\u304a\u554f\u3044\u5408\u308f\u305b[^'\"]*?)['"][^>]*>/gi // お問い合わせ
    ];
    
    const candidates: string[] = [];
    
    for (const pattern of formLinkPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        if (match[1]) {
          const candidateUrl = match[1];
          
          // 相対URLを絶対URLに変換
          const fullUrl = this.resolveUrl(candidateUrl, contactPageUrl);
          
          // 自己参照や無効URLを除外
          if (fullUrl !== contactPageUrl && 
              !fullUrl.startsWith('mailto:') && 
              !fullUrl.startsWith('javascript:')) {
            candidates.push(fullUrl);
          }
        }
      }
    }
    
    if (candidates.length > 0) {
      // 最初の候補を返す（通常最も関連性が高い）
      const selectedUrl = candidates[0];
      console.log(`Second-stage form URL found: ${selectedUrl}`);
      return selectedUrl;
    }
    
    console.log('No second-stage form links found');
    return null;
  }

  /**
   * URL解決（相対→絶対変換）（index.tsから移植・最適版完全移植）
   */
  private static resolveUrl(url: string, baseUrl: string): string {
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
}