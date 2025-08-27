/**
 * 環境設定管理クラス
 * スクリプトプロパティから設定値を取得
 * デフォルト値は設定せず、プロパティ未設定時はエラーとして扱う
 */
export class Environment {

  /**
   * 最大処理時間を取得
   * @returns 最大処理時間（ミリ秒）
   * @throws プロパティが未設定または無効な値の場合
   */
  static getMaxTotalTime(): number {
    const properties = PropertiesService.getScriptProperties();
    const maxTimeStr = properties.getProperty('MAX_TOTAL_TIME');
    if (!maxTimeStr || isNaN(parseInt(maxTimeStr))) {
      throw new Error('MAX_TOTAL_TIME プロパティが設定されていません');
    }
    return parseInt(maxTimeStr);
  }

  /**
   * HTTP通信タイムアウト時間を取得
   * @returns タイムアウト時間（ミリ秒）
   * @throws プロパティが未設定または無効な値の場合
   */
  static getFetchTimeout(): number {
    const properties = PropertiesService.getScriptProperties();
    const timeoutStr = properties.getProperty('FETCH_TIMEOUT');
    if (!timeoutStr || isNaN(parseInt(timeoutStr))) {
      throw new Error('FETCH_TIMEOUT プロパティが設定されていません');
    }
    return parseInt(timeoutStr);
  }

  /**
   * 高信頼度閾値を取得
   * @returns 閾値スコア
   * @throws プロパティが未設定または無効な値の場合
   */
  static getHighConfidenceThreshold(): number {
    const properties = PropertiesService.getScriptProperties();
    const thresholdStr = properties.getProperty('HIGH_CONFIDENCE_THRESHOLD');
    if (!thresholdStr || isNaN(parseInt(thresholdStr))) {
      throw new Error('HIGH_CONFIDENCE_THRESHOLD プロパティが設定されていません');
    }
    return parseInt(thresholdStr);
  }

  /**
   * 中信頼度閾値を取得
   * @returns 閾値スコア
   * @throws プロパティが未設定または無効な値の場合
   */
  static getMediumConfidenceThreshold(): number {
    const properties = PropertiesService.getScriptProperties();
    const thresholdStr = properties.getProperty('MEDIUM_CONFIDENCE_THRESHOLD');
    if (!thresholdStr || isNaN(parseInt(thresholdStr))) {
      throw new Error('MEDIUM_CONFIDENCE_THRESHOLD プロパティが設定されていません');
    }
    return parseInt(thresholdStr);
  }

  /**
   * 最小許容閾値を取得
   * @returns 閾値スコア
   * @throws プロパティが未設定または無効な値の場合
   */
  static getMinimumAcceptableThreshold(): number {
    const properties = PropertiesService.getScriptProperties();
    const thresholdStr = properties.getProperty('MINIMUM_ACCEPTABLE_THRESHOLD');
    if (!thresholdStr || isNaN(parseInt(thresholdStr))) {
      throw new Error('MINIMUM_ACCEPTABLE_THRESHOLD プロパティが設定されていません');
    }
    return parseInt(thresholdStr);
  }
}
