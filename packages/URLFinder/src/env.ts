/**
 * スクリプトプロパティの値を取得する
 * @param key プロパティキー
 * @returns プロパティ値（未設定の場合は空文字）
 */
const getScriptPropertyValue = (key: string): string => {
  return PropertiesService.getScriptProperties().getProperty(key) || "";
};

/**
 * 列名（A, B, C, ... Z, AA, AB, ...）を列番号（1, 2, 3, ...）に変換
 * @param columnName 列名（例: "A", "Z", "AA", "AP"）
 * @returns 列番号（1から始まる）
 */
const columnNameToNumber = (columnName: string): number => {
  const upperColumnName = columnName.toUpperCase();
  let result = 0;
  
  for (let i = 0; i < upperColumnName.length; i++) {
    const charCode = upperColumnName.charCodeAt(i) - 'A'.charCodeAt(0) + 1;
    result = result * 26 + charCode;
  }
  
  return result;
};

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
    const maxTimeStr = getScriptPropertyValue('MAX_TOTAL_TIME');
    if (!maxTimeStr || isNaN(parseInt(maxTimeStr))) {
      throw new Error('MAX_TOTAL_TIME プロパティが設定されていません');
    }
    return parseInt(maxTimeStr);
  }


  /**
   * シート名を取得
   * @returns シート名
   * @throws プロパティが未設定の場合
   */
  static getSheetName(): string {
    const sheetName = getScriptPropertyValue('SHEET');
    if (!sheetName) {
      throw new Error('スクリプトプロパティ「SHEET」が設定されていません');
    }
    return sheetName;
  }

  /**
   * 最大処理件数を取得
   * @returns 最大処理件数（未設定の場合はnull）
   */
  static getMaxCount(): number | null {
    const maxCountStr = getScriptPropertyValue('MAX_COUNT');
    if (!maxCountStr) {
      return null; // 未設定の場合は制限なし
    }
    const maxCount = parseInt(maxCountStr, 10);
    if (isNaN(maxCount)) {
      throw new Error('スクリプトプロパティ「MAX_COUNT」は数値で設定してください');
    }
    return maxCount;
  }

  /**
   * ヘッダー行を取得
   * @returns ヘッダー行番号（未設定の場合は1）
   */
  static getHeaderRow(): number {
    const headerRowStr = getScriptPropertyValue('HEADER_ROW');
    if (!headerRowStr) {
      return 1; // デフォルト値
    }
    const headerRow = parseInt(headerRowStr, 10);
    if (isNaN(headerRow)) {
      throw new Error('スクリプトプロパティ「HEADER_ROW」は数値で設定してください');
    }
    return headerRow;
  }

  /**
   * バッチサイズを取得
   * @returns バッチサイズ（デフォルト10）
   */
  static getBatchSize(): number {
    const batchSizeStr = getScriptPropertyValue('BATCH_SIZE');
    if (!batchSizeStr || isNaN(parseInt(batchSizeStr))) {
      return 10; // デフォルト値
    }
    return parseInt(batchSizeStr);
  }

  /**
   * 対象URL列番号を取得
   * @returns 列番号（デフォルト12="L"）
   */
  static getTargetColumn(): number {
    const columnName = getScriptPropertyValue('TARGET_COLUMN');
    if (!columnName) {
      return 12; // デフォルト値（L列）
    }
    return columnNameToNumber(columnName);
  }

  /**
   * 結果出力列番号を取得
   * @returns 列番号（デフォルト42="AP"）
   */
  static getOutputColumn(): number {
    const columnName = getScriptPropertyValue('OUTPUT_COLUMN');
    if (!columnName) {
      return 42; // デフォルト値（AP列）
    }
    return columnNameToNumber(columnName);
  }

  /**
   * チェックボックス列番号を取得
   * @returns 列番号（デフォルト43="AQ"）
   */
  static getCheckColumn(): number {
    const columnName = getScriptPropertyValue('CHECK_COLUMN');
    if (!columnName) {
      return 43; // デフォルト値（AQ列）
    }
    return columnNameToNumber(columnName);
  }
}
