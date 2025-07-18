import { getScriptPropertyValue } from "../../common/src/spreadsheet";

export const SCRIPT_PROPERTIES = {
  SHEET_NAME: "SHEET_NAME",
  HEADER_ROWS: "HEADER_ROWS"
} as const;

export const SHEET_NAME = getScriptPropertyValue(SCRIPT_PROPERTIES.SHEET_NAME) ;
export const HEADER_ROWS = parseInt(getScriptPropertyValue(SCRIPT_PROPERTIES.HEADER_ROWS));

export const COLUMN_MAPPING = {
  請求日: 13,    // M列
  請求書番号: 12, // L列
  入金締切日: 14, // N列
  備考: 16,      // P列
  ステータス: 24, // X列
  摘要: 25,      // Y列
  数量: 26,      // Z列
  単価: 27       // AA列
} as const;
