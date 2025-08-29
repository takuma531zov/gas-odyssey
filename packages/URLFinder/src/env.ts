import { getScriptPropertyValue, columnNameToNumber } from "../../common/src/spreadsheet";

// スクリプトプロパティ名の定数
export const SCRIPT_PROPERTIES = {
  MAX_TOTAL_TIME: 'MAX_TOTAL_TIME',
  SHEET: 'SHEET',
  MAX_COUNT: 'MAX_COUNT',
  HEADER_ROW: 'HEADER_ROW',
  BATCH_SIZE: 'BATCH_SIZE',
  TARGET_COLUMN: 'TARGET_COLUMN',
  OUTPUT_COLUMN: 'OUTPUT_COLUMN',
  CHECK_COLUMN: 'CHECK_COLUMN',
} as const;

// デフォルト値の定数
export const DEFAULT_VALUES = {
  MAX_TOTAL_TIME: 60000, // 60秒
  SHEET: 'リスト',
  MAX_COUNT: 30,
  HEADER_ROW: 3,
  BATCH_SIZE: 10,
  TARGET_COLUMN: columnNameToNumber('L'),  // L列 = 12
  OUTPUT_COLUMN: columnNameToNumber('AP'), // AP列 = 42
  CHECK_COLUMN: columnNameToNumber('AQ'),  // AQ列 = 43
} as const;

// エラーメッセージの定数
const ERROR_MESSAGES = {
  MISSING_MAX_TOTAL_TIME: 'MAX_TOTAL_TIME プロパティが設定されていません',
  MISSING_SHEET: 'スクリプトプロパティ「SHEET」が設定されていません',
  INVALID_MAX_COUNT: 'スクリプトプロパティ「MAX_COUNT」は数値で設定してください',
  INVALID_HEADER_ROW: 'スクリプトプロパティ「HEADER_ROW」は数値で設定してください',
} as const;

/**
 * オプションの文字列プロパティを取得
 */
const getOptionalStringProperty = (key: string, defaultValue: string): string => {
  const value = getScriptPropertyValue(key);
  return value || defaultValue;
};

/**
 * オプションの数値プロパティを取得
 */
const getOptionalNumberProperty = (key: string, defaultValue: number): number => {
  const value = getScriptPropertyValue(key);
  if (!value) {
    return defaultValue;
  }

  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`スクリプトプロパティ「${key}」は数値で設定してください`);
  }
  return parsed;
};

/**
 * オプションの数値プロパティを取得（null許可）
 */
const getOptionalNumberPropertyNullable = (key: string): number | null => {
  const value = getScriptPropertyValue(key);
  if (!value) return null;

  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`スクリプトプロパティ「${key}」は数値で設定してください`);
  }
  return parsed;
};

/**
 * 列名から列番号を取得（デフォルト値対応）
 */
const getColumnNumber = (key: string, defaultValue: number): number => {
  const columnName = getScriptPropertyValue(key);
  return columnName ? columnNameToNumber(columnName) : defaultValue;
};

/**
 * 環境設定管理オブジェクト
 * スクリプトプロパティから設定値を取得する関数群
 */
export const Environment = {
  /**
   * 最大処理時間を取得
   * @returns 最大処理時間（ミリ秒、デフォルト60秒）
   */
  getMaxTotalTime: (): number =>
    getOptionalNumberProperty(SCRIPT_PROPERTIES.MAX_TOTAL_TIME, DEFAULT_VALUES.MAX_TOTAL_TIME),

  /**
   * シート名を取得
   * @returns シート名（デフォルト'Sheet1'）
   */
  getSheetName: (): string =>
    getOptionalStringProperty(SCRIPT_PROPERTIES.SHEET, DEFAULT_VALUES.SHEET),

  /**
   * 最大処理件数を取得
   * @returns 最大処理件数（未設定の場合はnull、無制限）
   */
  getMaxCount: (): number | null =>
    getOptionalNumberPropertyNullable(SCRIPT_PROPERTIES.MAX_COUNT),

  /**
   * ヘッダー行を取得
   * @returns ヘッダー行番号（デフォルト1）
   */
  getHeaderRow: (): number =>
    getOptionalNumberProperty(SCRIPT_PROPERTIES.HEADER_ROW, DEFAULT_VALUES.HEADER_ROW),

  /**
   * バッチサイズを取得
   * @returns バッチサイズ（デフォルト10）
   */
  getBatchSize: (): number =>
    getOptionalNumberProperty(SCRIPT_PROPERTIES.BATCH_SIZE, DEFAULT_VALUES.BATCH_SIZE),

  /**
   * 対象URL列番号を取得
   * @returns 列番号（デフォルトL列）
   */
  getTargetColumn: (): number =>
    getColumnNumber(SCRIPT_PROPERTIES.TARGET_COLUMN, DEFAULT_VALUES.TARGET_COLUMN),

  /**
   * 結果出力列番号を取得
   * @returns 列番号（デフォルトAP列）
   */
  getOutputColumn: (): number =>
    getColumnNumber(SCRIPT_PROPERTIES.OUTPUT_COLUMN, DEFAULT_VALUES.OUTPUT_COLUMN),

  /**
   * チェックボックス列番号を取得
   * @returns 列番号（デフォルトAQ列）
   */
  getCheckColumn: (): number =>
    getColumnNumber(SCRIPT_PROPERTIES.CHECK_COLUMN, DEFAULT_VALUES.CHECK_COLUMN),
} as const;
