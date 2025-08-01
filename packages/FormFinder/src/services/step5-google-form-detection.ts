import { Logger } from '../utils/logger';
import { DEFAULT_CONFIG, GOOGLE_FORM_REGEX_PATTERNS } from '../utils/constants';

/**
 * Step5: Googleフォーム専用検出・抽出サービス  
 * 目的: トップページ内のGoogleフォームリンクを検出し、GoogleフォームHTMLを取得・解析
 * 
 * 検出対象:
 * - https://docs.google.com/forms/d/...
 * - https://forms.google.com/...
 * - https://forms.gle/...
 * 
 * 処理フロー:
 * 1. トップページHTMLからGoogleフォームURLを検索
 * 2. 検出したGoogleフォームURLにアクセス
 * 3. GoogleフォームページのHTMLを取得・解析
 * 4. 解析結果をStep3に渡してスプレッドシート出力
 */
export class Step5GoogleFormDetectionService {
  private readonly config = {
    timeout: DEFAULT_CONFIG.TIMEOUT,
    retryCount: DEFAULT_CONFIG.RETRY_COUNT,
    userAgent: DEFAULT_CONFIG.USER_AGENT
  };

  /**
   * トップページHTMLからGoogleフォームURLを検索・抽出
   */
  extractGoogleFormUrls(html: string): string[] {
    Logger.debug('GoogleフォームURL抽出開始');
    
    if (!html) {
      Logger.warn('HTMLが空です');
      return [];
    }

    // HTMLエンティティをデコード
    html = html.replace(/&amp;/g, '&')
               .replace(/&quot;/g, '"')
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>');

    const googleFormUrls = new Set<string>();

    // 直接検索アプローチ: HTML内でGoogleフォームURLを探す
    Logger.debug('HTML内でGoogleフォームURLを直接検索中...');
    
    // 事前コンパイル済み正規表現を使用（パフォーマンス向上）
    for (const pattern of GOOGLE_FORM_REGEX_PATTERNS) {
      // 正規表現をコピーしてglobalフラグをリセット
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;
      while ((match = regex.exec(html)) !== null) {
        const url = match[0];
        Logger.info(`直接検索でGoogleフォーム発見: ${url}`);
        googleFormUrls.add(url);
      }
    }

    const results = Array.from(googleFormUrls);  
    Logger.info(`GoogleフォームURL抽出完了: ${results.length}件検出`);
    
    if (results.length > 0) {
      Logger.info(`検出されたGoogleフォームURL: ${results.join(', ')}`);
    }
    
    return results;
  }

  /**
   * 検出したGoogleフォームURLからHTMLを取得・解析用
   */
  async fetchGoogleFormHtml(url: string): Promise<{ success: boolean; html?: string }> {
    Logger.debug(`GoogleフォームHTML取得: ${url}`);
    
    try {
      const response = UrlFetchApp.fetch(url, {
        method: 'get',
        headers: {
          'User-Agent': this.config.userAgent,
          'Accept-Language': 'ja,ja-JP;q=0.9,en;q=0.8'
        },
        muteHttpExceptions: true,
        followRedirects: true
      });

      if (response.getResponseCode() === 200) {
        const html = response.getContentText();
        Logger.info(`GoogleフォームHTML取得成功: ${url} (${html.length}文字)`);
        return { success: true, html };
      } else {
        Logger.warn(`GoogleフォームHTML取得失敗: HTTP ${response.getResponseCode()} - ${url}`);
        return { success: false };
      }
    } catch (error) {
      Logger.error(`GoogleフォームHTML取得エラー: ${url}`, error);
      return { success: false };
    }
  }

  // =====================================================
  // 未使用メソッド削除完了
  // =====================================================
}