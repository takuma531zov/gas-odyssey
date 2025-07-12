import { getScriptPropertyValue } from "../../common/src/spreadsheet";

export const SCRIPT_PROPERTIES = {
  SHEET_NAME: "SHEET_NAME",
  HEADER_ROWS: "HEADER_ROWS"
} as const;

export const SHEET_NAME = getScriptPropertyValue(SCRIPT_PROPERTIES.SHEET_NAME) || "請求一覧";
export const HEADER_ROWS = parseInt(getScriptPropertyValue(SCRIPT_PROPERTIES.HEADER_ROWS) || "4");

export const COLUMN_MAPPING = {
  請求日: 13,    // M列
  請求書番号: 12, // L列
  住所: 7,       // G列
  入金締切日: 14, // N列
  備考: 16       // P列
} as const;
