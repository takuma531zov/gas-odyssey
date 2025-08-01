import { Logger } from '../utils/logger';
import { DEFAULT_CONFIG, CONTACT_KEYWORDS, RATE_LIMIT_CONFIG } from '../utils/constants';

/**
 * Step2: キーワード付きURL順次アクセスサービス
 * 目的: 問い合わせページの直接アクセス試行
 * 技術: UrlFetchApp.fetch()
 * アクセスパターン: {ホームURL}/{キーワード}
 * 
 * 処理内容:
 * - ホームURLの末尾`/`の有無を統一処理
 * - 各キーワードでHTTP GETリクエスト実行
 * - レスポンスが200の場合: 即座にループを抜けてStep3へ
 * - 200以外の場合: 次のキーワードで継続
 * - 全キーワードで200が取れない場合: Step4へ
 */
export class Step2KeywordAccessService {
  private readonly config = {
    timeout: DEFAULT_CONFIG.TIMEOUT,
    retryCount: DEFAULT_CONFIG.RETRY_COUNT,
    userAgent: DEFAULT_CONFIG.USER_AGENT
  };

  /**
   * Step2実行: キーワード付きURL順次アクセス
   */
  async execute(homeUrl: string): Promise<{ success: boolean; url?: string; html?: string; shouldCheckGoogleForm?: boolean }> {
    Logger.debug(`Step2開始: キーワード付きURL順次アクセス - ${homeUrl}`);
    
    // ホームURLの末尾`/`の有無を統一処理
    const baseUrl = homeUrl.endsWith('/') ? homeUrl.slice(0, -1) : homeUrl;
    
    for (const keyword of CONTACT_KEYWORDS) {
      // スラッシュなしとありの両方をテスト
      const testUrls = [
        `${baseUrl}/${keyword}`,     // スラッシュなし
        `${baseUrl}/${keyword}/`     // スラッシュあり
      ];
      
      for (const testUrl of testUrls) {
        Logger.debug(`キーワードURL試行: ${testUrl}`);
        
        try {
          const response = UrlFetchApp.fetch(testUrl, {
            method: 'get',
            headers: {
              'User-Agent': this.config.userAgent,
              'Accept-Language': 'ja,ja-JP;q=0.9,en;q=0.8'
            },
            muteHttpExceptions: true,
            followRedirects: true
          });

          // レスポンスが200の場合: 即座にループを抜けてStep3へ
          if (response.getResponseCode() === 200) {
            const html = response.getContentText();
            Logger.info(`Step2成功: HTTP 200取得 - ${testUrl}`);
            
            // Googleフォームリンクを優先検出
            const googleFormPatterns = [
              'docs.google.com/forms', 'forms.google.com', 'forms.gle', 'goo.gl/forms' // Googleフォーム
            ];
            
            const hasGoogleForm = googleFormPatterns.some(pattern => html.includes(pattern));
            if (hasGoogleForm) {
              Logger.info(`Step2でGoogleフォームリンクを発見: ${testUrl}`);
              return { 
                success: false, 
                url: testUrl, 
                html,
                shouldCheckGoogleForm: true
              };
            }
            
            return { 
              success: true, 
              url: testUrl, 
              html 
            };
          } else {
            Logger.debug(`HTTP ${response.getResponseCode()}: ${testUrl}`);
          }
        } catch (error) {
          Logger.debug(`アクセスエラー: ${testUrl}`, error);
        }
        
        // レート制限対策（動的待機時間）
        Utilities.sleep(RATE_LIMIT_CONFIG.KEYWORD_ACCESS_DELAY);
      }
    }
    
    // 全キーワードで200が取れない場合: Step4へ
    Logger.info('Step2失敗: 全キーワードでHTTP 200が取得できませんでした');
    return { success: false };
  }
}