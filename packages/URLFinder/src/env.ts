import { getScriptPropertyValue, columnNameToNumber } from "../../common/src/spreadsheet";

/** スクリプトプロパティ名 */
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

/** デフォルト値 */
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

/** プロパティ型 */
type PropertyType = number | string | null;

/**
 * スクリプトプロパティ取得（型安全・キャスト不要）
 */
function getOptionalProperty<T extends PropertyType>(
  key: string,
  parser: (v: string) => T,
  defaultValue: T
): T {
  const value = getScriptPropertyValue(key);
  if (value == null || value === '') return defaultValue;

  try {
    return parser(value);
  } catch {
    throw new Error(`スクリプトプロパティ「${key}」が不正です`);
  }
}

/**
 * 列番号取得（デフォルト対応）
 */
function getColumnNumber(key: string, defaultValue: number): number {
  const value = getScriptPropertyValue(key);
  return value ? columnNameToNumber(value) : defaultValue;
}

/** 環境設定オブジェクト */
export const Environment = {
  getMaxTotalTime: () =>
    getOptionalProperty(SCRIPT_PROPERTIES.MAX_TOTAL_TIME, v => {
      const n = parseInt(v, 10);
      if (isNaN(n)) throw new Error();
      return n;
    }, DEFAULT_VALUES.MAX_TOTAL_TIME),

  getSheetName: () =>
    getOptionalProperty(SCRIPT_PROPERTIES.SHEET, v => v, DEFAULT_VALUES.SHEET),

  getMaxCount: () =>
    getOptionalProperty(SCRIPT_PROPERTIES.MAX_COUNT, v => {
      const n = parseInt(v, 10);
      if (isNaN(n)) return null;
      return n;
    }, null),

  getHeaderRow: () =>
    getOptionalProperty(SCRIPT_PROPERTIES.HEADER_ROW, v => {
      const n = parseInt(v, 10);
      if (isNaN(n)) throw new Error();
      return n;
    }, DEFAULT_VALUES.HEADER_ROW),

  getBatchSize: () =>
    getOptionalProperty(SCRIPT_PROPERTIES.BATCH_SIZE, v => {
      const n = parseInt(v, 10);
      if (isNaN(n)) throw new Error();
      return n;
    }, DEFAULT_VALUES.BATCH_SIZE),

  getTargetColumn: () => getColumnNumber(SCRIPT_PROPERTIES.TARGET_COLUMN, DEFAULT_VALUES.TARGET_COLUMN),
  getOutputColumn: () => getColumnNumber(SCRIPT_PROPERTIES.OUTPUT_COLUMN, DEFAULT_VALUES.OUTPUT_COLUMN),
  getCheckColumn: () => getColumnNumber(SCRIPT_PROPERTIES.CHECK_COLUMN, DEFAULT_VALUES.CHECK_COLUMN),
} as const;
