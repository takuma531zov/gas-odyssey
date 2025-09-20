import { Logger } from '../utils/logger';
import { DEFAULT_CONFIG } from '../utils/constants';
import { UrlUtils } from '../utils/url';

/**
 * Step4: トップページHTML取得・解析サービス
 * 目的: キーワードアクセスで見つからない場合のフォールバック
 * 処理内容:
 * - ホームURL（トップページ）のHTML取得
 * - <form>要素の抽出を試行
 * - フォームが見つかった場合: Step3と同様の出力処理
 * - フォームが見つからない場合: Step5へ
 */
export class Step4TopPageAnalysisService {
  private readonly config = {
    timeout: DEFAULT_CONFIG.TIMEOUT,
    retryCount: DEFAULT_CONFIG.RETRY_COUNT,
    userAgent: DEFAULT_CONFIG.USER_AGENT
  };

  /**
   * Step4実行: トップページHTML取得・解析
   */
  async execute(homeUrl: string): Promise<{ success: boolean; html?: string; errorDetail?: string }> {
    Logger.debug(`Step4開始: トップページHTML取得・解析 - ${homeUrl}`);

    const normalizedUrl = UrlUtils.normalizeUrl(homeUrl);

    if (!UrlUtils.isValidUrl(normalizedUrl)) {
      Logger.error(`無効なURL: ${homeUrl}`);
      return { success: false, errorDetail: "無効なURL形式です" };
    }

    try {
      const response = UrlFetchApp.fetch(normalizedUrl, {
        method: 'get',
        headers: {
          'User-Agent': this.config.userAgent,
          'Accept-Language': 'ja,ja-JP;q=0.9,en;q=0.8'
        },
        muteHttpExceptions: true,
        followRedirects: true
      });

      const statusCode = response.getResponseCode();

      if (statusCode === 200) {
        const html = response.getContentText();
        Logger.info(`Step4成功: トップページHTML取得 - ${normalizedUrl} (${html.length}文字)`);

        return { success: true, html };
      }
      
      const errorDetail = this.getHttpErrorMessage(statusCode);
      Logger.warn(`Step4失敗: HTTP ${statusCode} - ${normalizedUrl}`);
      return { success: false, errorDetail };
    } catch (error) {
      const errorDetail = this.getNetworkErrorMessage(error);
      Logger.error(`Step4エラー: トップページHTML取得失敗 - ${normalizedUrl}`, error);
      return { success: false, errorDetail };
    }
  }

  /**
   * HTTPステータスコードから詳細エラーメッセージを生成
   */
  private getHttpErrorMessage(statusCode: number): string {
    switch (statusCode) {
      case 404:
        return "HTTP 404: ページが存在しません";
      case 403:
        return "HTTP 403: アクセス拒否";
      case 500:
        return "HTTP 500: サーバーエラー";
      case 501:
        return "HTTP 501: Bot対策によりブロック";
      case 502:
        return "HTTP 502: ゲートウェイエラー";
      case 503:
        return "HTTP 503: メンテナンス中の可能性";
      case 504:
        return "HTTP 504: ゲートウェイタイムアウト";
      case 401:
        return "HTTP 401: 認証が必要です";
      case 406:
        return "HTTP 406: リクエスト拒否";
      case 418:
        return "HTTP 418: アクセス制限中";
      case 429:
        return "HTTP 429: アクセス制限中";
      case 451:
        return "HTTP 451: アクセス制限";
      default:
        return `HTTP ${statusCode}: アクセスエラー`;
    }
  }

  /**
   * ネットワークエラーから詳細エラーメッセージを生成
   */
  private getNetworkErrorMessage(error: unknown): string {
    const errorStr = String(error).toLowerCase();

    if (errorStr.includes('timeout') || errorStr.includes('timed out')) {
      return "接続タイムアウト: サーバー応答なし";
    }
    if (errorStr.includes('ssl') || errorStr.includes('certificate')) {
      return "SSL証明書エラー";
    }
    if (errorStr.includes('dns') || errorStr.includes('name resolution')) {
      return "DNS解決失敗: ドメインが存在しません";
    }
    if (errorStr.includes('connection refused')) {
      return "接続拒否: サーバーが接続を拒否";
    }
    if (errorStr.includes('host') || errorStr.includes('unreachable')) {
      return "ホスト到達不可: サーバーに接続できません";
    }
    return "ネットワークエラー: 接続に失敗";
  }
}
