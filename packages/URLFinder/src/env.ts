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
  TARGET_COLUMN: "L",
  OUTPUT_COLUMN: "AP",
  CHECK_COLUMN: "AQ",
} as const;

// 空文字列を含むすべてのfalsy値（"", 0, false, null, undefined）の時デフォルト値が格納
export const maxTotalTime =
  Number(getScriptPropertyValue(SCRIPT_PROPERTIES.MAX_TOTAL_TIME)) ||
  DEFAULT_VALUES.MAX_TOTAL_TIME;

export const sheetName =
  getScriptPropertyValue(SCRIPT_PROPERTIES.SHEET) || DEFAULT_VALUES.SHEET;

export const maxCount =
  Number(getScriptPropertyValue(SCRIPT_PROPERTIES.MAX_COUNT)) ||
  DEFAULT_VALUES.MAX_COUNT;

export const headerRow =
  Number(getScriptPropertyValue(SCRIPT_PROPERTIES.HEADER_ROW)) ||
  DEFAULT_VALUES.HEADER_ROW;

export const batchSize =
  Number(getScriptPropertyValue(SCRIPT_PROPERTIES.BATCH_SIZE)) ||
  DEFAULT_VALUES.BATCH_SIZE;

export const targetColumn = columnNameToNumber(
  getScriptPropertyValue(SCRIPT_PROPERTIES.TARGET_COLUMN) ||
    DEFAULT_VALUES.TARGET_COLUMN,
);

export const outputColumn = columnNameToNumber(
  getScriptPropertyValue(SCRIPT_PROPERTIES.OUTPUT_COLUMN) ||
    DEFAULT_VALUES.OUTPUT_COLUMN,
);

export const checkColumn = columnNameToNumber(
  getScriptPropertyValue(SCRIPT_PROPERTIES.CHECK_COLUMN) ||
    DEFAULT_VALUES.CHECK_COLUMN,
);
// // ----------------------
// // 環境設定オブジェクト
// // ----------------------
// export const Environment = {
//   // 数値系プロパティ
//   getMaxTotalTime: () =>
//     getNumberProperty(
//       SCRIPT_PROPERTIES.MAX_TOTAL_TIME,
//       DEFAULT_VALUES.MAX_TOTAL_TIME,
//     ),
//   getMaxCount: () => getNumberProperty(SCRIPT_PROPERTIES.MAX_COUNT, null),
//   getHeaderRow: () =>
//     getNumberProperty(SCRIPT_PROPERTIES.HEADER_ROW, DEFAULT_VALUES.HEADER_ROW),
//   getBatchSize: () =>
//     getNumberProperty(SCRIPT_PROPERTIES.BATCH_SIZE, DEFAULT_VALUES.BATCH_SIZE),

//   // 文字列プロパティ
//   getSheetName: () =>
//     getOptionalProperty(
//       SCRIPT_PROPERTIES.SHEET,
//       (v) => v,
//       DEFAULT_VALUES.SHEET,
//     ),

//   // 列番号系
//   getTargetColumn: () => {
//     const value = getScriptPropertyValue(SCRIPT_PROPERTIES.TARGET_COLUMN);
//     return value ? columnNameToNumber(value) : DEFAULT_VALUES.TARGET_COLUMN;
//   },
//   getOutputColumn: () => {
//     const value = getScriptPropertyValue(SCRIPT_PROPERTIES.OUTPUT_COLUMN);
//     return value ? columnNameToNumber(value) : DEFAULT_VALUES.OUTPUT_COLUMN;
//   },
//   getCheckColumn: () => {
//     const value = getScriptPropertyValue(SCRIPT_PROPERTIES.CHECK_COLUMN);
//     return value ? columnNameToNumber(value) : DEFAULT_VALUES.CHECK_COLUMN;
//   },
// } as const;
