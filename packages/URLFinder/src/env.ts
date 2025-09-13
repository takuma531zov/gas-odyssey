import {
  getScriptPropertyValue,
  columnNameToNumber,
} from "../../common/src/spreadsheet";

// スクリプトプロパティ名
export const SCRIPT_PROPERTIES = {
  MAX_TOTAL_TIME: "MAX_TOTAL_TIME",
  SHEET: "SHEET",
  MAX_COUNT: "MAX_COUNT",
  HEADER_ROW: "HEADER_ROW",
  BATCH_SIZE: "BATCH_SIZE",
  TARGET_COLUMN: "TARGET_COLUMN",
  OUTPUT_COLUMN: "OUTPUT_COLUMN",
  CHECK_COLUMN: "CHECK_COLUMN",
} as const;

// デフォルト値
export const DEFAULT_VALUES = {
  MAX_TOTAL_TIME: 60000,
  SHEET: "リスト",
  MAX_COUNT: 30,
  HEADER_ROW: 3,
  BATCH_SIZE: 10,
  TARGET_COLUMN: columnNameToNumber("L"),
  OUTPUT_COLUMN: columnNameToNumber("AP"),
  CHECK_COLUMN: columnNameToNumber("AQ"),
} as const;

// ----------------------
// 共通取得関数
// ----------------------

/**
 * 任意の型に変換して取得（文字列・数値・null）
 */
function getOptionalProperty<T extends number | string | null>(
  key: string,
  parser: (v: string) => T,
  defaultValue: T,
): T {
  const value = getScriptPropertyValue(key);
  if (value == null || value === "") return defaultValue;

  try {
    return parser(value);
  } catch {
    throw new Error(`スクリプトプロパティ「${key}」の値が不正です: ${value}`);
  }
}

/**
 * 数値取得用の共通関数（null 許可可）
 */
function getNumberProperty(
  key: string,
  defaultValue: number | null,
): number | null {
  return getOptionalProperty<number | null>(
    key,
    (v) => {
      const n = Number.parseInt(v, 10);
      if (Number.isNaN(n)) return null;
      return n;
    },
    defaultValue,
  );
}

// ----------------------
// 環境設定オブジェクト
// ----------------------
export const Environment = {
  // 数値系プロパティ
  getMaxTotalTime: () =>
    getNumberProperty(
      SCRIPT_PROPERTIES.MAX_TOTAL_TIME,
      DEFAULT_VALUES.MAX_TOTAL_TIME,
    ),
  getMaxCount: () => getNumberProperty(SCRIPT_PROPERTIES.MAX_COUNT, null),
  getHeaderRow: () =>
    getNumberProperty(SCRIPT_PROPERTIES.HEADER_ROW, DEFAULT_VALUES.HEADER_ROW),
  getBatchSize: () =>
    getNumberProperty(SCRIPT_PROPERTIES.BATCH_SIZE, DEFAULT_VALUES.BATCH_SIZE),

  // 文字列プロパティ
  getSheetName: () =>
    getOptionalProperty(
      SCRIPT_PROPERTIES.SHEET,
      (v) => v,
      DEFAULT_VALUES.SHEET,
    ),

  // 列番号系
  getTargetColumn: () => {
    const value = getScriptPropertyValue(SCRIPT_PROPERTIES.TARGET_COLUMN);
    return value ? columnNameToNumber(value) : DEFAULT_VALUES.TARGET_COLUMN;
  },
  getOutputColumn: () => {
    const value = getScriptPropertyValue(SCRIPT_PROPERTIES.OUTPUT_COLUMN);
    return value ? columnNameToNumber(value) : DEFAULT_VALUES.OUTPUT_COLUMN;
  },
  getCheckColumn: () => {
    const value = getScriptPropertyValue(SCRIPT_PROPERTIES.CHECK_COLUMN);
    return value ? columnNameToNumber(value) : DEFAULT_VALUES.CHECK_COLUMN;
  },
} as const;
