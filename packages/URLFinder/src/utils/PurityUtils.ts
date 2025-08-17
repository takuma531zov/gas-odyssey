/**
 * 純粋関数ユーティリティ
 * 副作用がなく、テスト容易な関数群
 */

import { SEARCH_PATTERNS, CONFIDENCE_LEVELS, HOMEPAGE_PATTERNS } from '../constants/SearchConstants';
import { UrlUtils } from './UrlUtils';

/**
 * URL品質評価結果
 */
export interface UrlQualityResult {
  confidence: number;
  keywords: string[];
}

/**
 * HTML検証結果
 */
export interface HtmlValidationResult {
  isValid: boolean;
  hasInvalidContent: boolean;
  hasMinimumContent: boolean;
  contentLength: number;
  matchedInvalidPattern?: string;
}

/**
 * エラーメッセージマッピング
 */
export interface ErrorMessageMapping {
  [statusCode: number]: string;
}

export class PurityUtils {

  /**
   * フォールバックURL品質評価
   * URLパターンと信頼度を計算する純粋関数
   * @param url 評価対象URL
   * @param pattern マッチしたパターン
   * @returns 信頼度とキーワード配列
   */
  static evaluateUrlQuality(url: string, pattern: string): UrlQualityResult {
    let confidence = CONFIDENCE_LEVELS.BASE; // ベーススコア
    const keywords: string[] = [];

    // 高信頼度パターン（contact/inquiry系）
    if (SEARCH_PATTERNS.HIGH_CONFIDENCE.includes(pattern)) {
      confidence += CONFIDENCE_LEVELS.HIGH_BONUS;
      keywords.push('high_confidence_pattern');
    }

    // 中信頼度パターン（form系）
    if (SEARCH_PATTERNS.MEDIUM_CONFIDENCE.includes(pattern)) {
      confidence += CONFIDENCE_LEVELS.MEDIUM_BONUS;
      keywords.push('medium_confidence_pattern');
    }

    // URL内のcontactキーワードチェック（ドメイン除外）
    const urlPath = url.replace(/https?:\/\/[^/]+/, ''); // ドメインを除外
    
    for (const keyword of SEARCH_PATTERNS.CONTACT_KEYWORDS) {
      if (urlPath.toLowerCase().includes(keyword.toLowerCase())) {
        confidence += CONFIDENCE_LEVELS.KEYWORD_BONUS;
        keywords.push(`path_contains_${keyword}`);
      }
    }

    // 信頼度を上限で制限
    confidence = Math.min(confidence, 1.0);

    console.log(`URL quality evaluation for ${url}: confidence=${confidence.toFixed(2)}, keywords=[${keywords.join(', ')}]`);
    return { confidence, keywords };
  }

  /**
   * ホームページURL判定
   * URLがホームページかどうかを判定する純粋関数
   * @param url 判定対象URL
   * @param baseUrl ベースURL
   * @returns トップページの場合true
   */
  static isHomepageUrl(url: string, baseUrl: string): boolean {
    // 相対URLを絶対URLに変換
    const fullUrl = UrlUtils.resolveUrl(url, baseUrl);

    // ベースドメインを抽出
    const baseDomain = UrlUtils.extractDomain(baseUrl);

    // トップページパターン
    const fullDomainPatterns = [
      baseDomain,                     // https://example.com/
      baseDomain.replace(/\/$/, ''),  // https://example.com
      baseDomain + 'index.html',
      baseDomain + 'index.htm',
      baseDomain + 'index.php',
      baseDomain + 'home/',
      baseDomain + 'home'
    ];

    // 完全一致チェック
    const isHomepage = fullDomainPatterns.some(pattern =>
      fullUrl.toLowerCase() === pattern.toLowerCase()
    );

    if (isHomepage) {
      console.log(`Detected homepage URL: ${fullUrl} matches pattern in ${fullDomainPatterns.join(',')}`);
    }

    return isHomepage;
  }

  /**
   * HTTPステータスコード詳細エラーメッセージ取得
   * ステータスコードから詳細なエラーメッセージを取得する純粋関数
   * @param statusCode HTTPステータスコード
   * @returns 詳細エラーメッセージ
   */
  static getDetailedErrorMessage(statusCode: number): string {
    const errorMessages: ErrorMessageMapping = {
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
   * ネットワークエラー詳細解析
   * エラーオブジェクトから詳細なネットワークエラーメッセージを取得する純粋関数
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
        errorString.includes('Address not available') ||
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
   * 問い合わせページ内容純度計算
   * HTMLからcontact関連の純度を計算する純粋関数
   * @param linkText リンクテキスト
   * @param url リンクURL
   * @param contextType コンテキストタイプ
   * @returns 純度スコア（0-1）
   */
  static calculateContactPurity(linkText: string, url: string, contextType: string = 'general'): number {
    let score = 0;
    const lowerText = linkText.toLowerCase();
    const lowerUrl = url.toLowerCase();

    // 基本的な問い合わせキーワード
    const directContactKeywords = ['contact', 'inquiry', 'お問い合わせ', '問い合わせ'];
    for (const keyword of directContactKeywords) {
      if (lowerText.includes(keyword.toLowerCase()) || lowerUrl.includes(keyword.toLowerCase())) {
        score += 0.3;
        break;
      }
    }

    // フォーム関連キーワード
    const formKeywords = ['form', 'フォーム', 'submit', '送信'];
    for (const keyword of formKeywords) {
      if (lowerText.includes(keyword.toLowerCase()) || lowerUrl.includes(keyword.toLowerCase())) {
        score += 0.2;
        break;
      }
    }

    // コンテキストボーナス
    switch (contextType) {
      case 'navigation':
        score += 0.2;
        break;
      case 'footer':
        score += 0.1;
        break;
      case 'mobile_menu':
        score += 0.2;
        break;
    }

    // 上限制限
    return Math.min(score, 1.0);
  }

  /**
   * 候補スコア計算
   * 複数の要因からスコアを計算する純粋関数
   * @param factors スコア要因の配列
   * @returns 正規化されたスコア（0-100）
   */
  static calculateCandidateScore(factors: { factor: string, value: number, weight: number }[]): number {
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const factor of factors) {
      totalWeightedScore += factor.value * factor.weight;
      totalWeight += factor.weight;
    }

    // 重み付き平均を計算
    const averageScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
    
    // 0-100スケールに正規化
    return Math.min(Math.max(averageScore * 100, 0), 100);
  }
}