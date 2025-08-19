/**
 * 環境設定管理クラス
 * スクリプトプロパティから設定値を取得
 * アプリケーション設定はデフォルト値付き、GAS設定は必須
 */
export class Environment {
  
  // ==========================================
  // 【アプリケーション設定】
  // デフォルト値付きの設定項目
  // ==========================================
  
  /**
   * 最大処理時間を取得
   * @returns 最大処理時間（ミリ秒）
   */
  static getMaxTotalTime(): number {
    const properties = PropertiesService.getScriptProperties();
    const maxTimeStr = properties.getProperty('MAX_TOTAL_TIME');
    if (!maxTimeStr || isNaN(parseInt(maxTimeStr))) {
      return 30000; // デフォルト: 30秒
    }
    return parseInt(maxTimeStr);
  }
  
  /**
   * HTTP通信タイムアウト時間を取得
   * @returns タイムアウト時間（ミリ秒）
   */
  static getFetchTimeout(): number {
    const properties = PropertiesService.getScriptProperties();
    const timeoutStr = properties.getProperty('FETCH_TIMEOUT');
    if (!timeoutStr || isNaN(parseInt(timeoutStr))) {
      return 7000; // デフォルト: 7秒
    }
    return parseInt(timeoutStr);
  }
  
  /**
   * 高信頼度閾値を取得
   * @returns 閾値スコア
   */
  static getHighConfidenceThreshold(): number {
    const properties = PropertiesService.getScriptProperties();
    const thresholdStr = properties.getProperty('HIGH_CONFIDENCE_THRESHOLD');
    if (!thresholdStr || isNaN(parseInt(thresholdStr))) {
      return 80; // デフォルト: 80点
    }
    return parseInt(thresholdStr);
  }
  
  /**
   * 中信頼度閾値を取得
   * @returns 閾値スコア
   */
  static getMediumConfidenceThreshold(): number {
    const properties = PropertiesService.getScriptProperties();
    const thresholdStr = properties.getProperty('MEDIUM_CONFIDENCE_THRESHOLD');
    if (!thresholdStr || isNaN(parseInt(thresholdStr))) {
      return 60; // デフォルト: 60点
    }
    return parseInt(thresholdStr);
  }
  
  /**
   * 最小許容閾値を取得
   * @returns 閾値スコア
   */
  static getMinimumAcceptableThreshold(): number {
    const properties = PropertiesService.getScriptProperties();
    const thresholdStr = properties.getProperty('MINIMUM_ACCEPTABLE_THRESHOLD');
    if (!thresholdStr || isNaN(parseInt(thresholdStr))) {
      return 40; // デフォルト: 40点
    }
    return parseInt(thresholdStr);
  }

  // ==========================================
  // 【GASスプレッドシート設定】
  // 必須設定項目（未設定時はエラー）
  // ==========================================

  /**
   * 対象シート名を取得
   * @returns シート名
   * @throws プロパティが未設定の場合
   */
  static getSheetName(): string {
    const properties = PropertiesService.getScriptProperties();
    const sheetName = properties.getProperty('SHEET');
    if (!sheetName) {
      throw new Error('SHEET プロパティが設定されていません');
    }
    return sheetName;
  }

  /**
   * 最大処理件数を取得
   * @returns 最大処理件数
   * @throws プロパティが未設定または無効な値の場合
   */
  static getMaxCount(): number {
    const properties = PropertiesService.getScriptProperties();
    const maxCountStr = properties.getProperty('MAX_COUNT');
    if (!maxCountStr || isNaN(parseInt(maxCountStr))) {
      throw new Error('MAX_COUNT プロパティが設定されていません');
    }
    return parseInt(maxCountStr);
  }

  /**
   * ヘッダー行番号を取得
   * @returns ヘッダー行番号
   * @throws プロパティが未設定または無効な値の場合
   */
  static getHeaderRow(): number {
    const properties = PropertiesService.getScriptProperties();
    const headerRowStr = properties.getProperty('HEADER_ROW');
    if (!headerRowStr || isNaN(parseInt(headerRowStr))) {
      throw new Error('HEADER_ROW プロパティが設定されていません');
    }
    return parseInt(headerRowStr);
  }

  /**
   * 対象列番号を取得（URL取得元列）
   * @returns 列番号（1ベース）
   * @throws プロパティが未設定または無効な値の場合
   */
  static getTargetColumn(): number {
    const properties = PropertiesService.getScriptProperties();
    const columnStr = properties.getProperty('TARGET_COLUMN');
    if (!columnStr || isNaN(parseInt(columnStr))) {
      throw new Error('TARGET_COLUMN プロパティが設定されていません（例：L列=12）');
    }
    return parseInt(columnStr);
  }

  /**
   * 出力列番号を取得（結果出力先列）
   * @returns 列番号（1ベース）
   * @throws プロパティが未設定または無効な値の場合
   */
  static getOutputColumn(): number {
    const properties = PropertiesService.getScriptProperties();
    const columnStr = properties.getProperty('OUTPUT_COLUMN');
    if (!columnStr || isNaN(parseInt(columnStr))) {
      throw new Error('OUTPUT_COLUMN プロパティが設定されていません（例：AP列=42）');
    }
    return parseInt(columnStr);
  }

  /**
   * チェック列番号を取得（チェックボックス列）
   * @returns 列番号（1ベース）
   * @throws プロパティが未設定または無効な値の場合
   */
  static getCheckColumn(): number {
    const properties = PropertiesService.getScriptProperties();
    const columnStr = properties.getProperty('CHECK_COLUMN');
    if (!columnStr || isNaN(parseInt(columnStr))) {
      throw new Error('CHECK_COLUMN プロパティが設定されていません（例：AQ列=43）');
    }
    return parseInt(columnStr);
  }
}