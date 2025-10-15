import {
  getScriptPropertyValue,
  columnNameToNumber,
} from "../../common/src/spreadsheet";

// スクリプトプロパティ名
export const SCRIPT_PROPERTIES = {
  PARENT_FOLDER_ID: "PARENT_FOLDER_ID", //rootフォルダID
  SENDER_NAME: "SENDER_NAME", //メッセージ送信者名
  SHEET_AGENCY_LIST_NAME: "SHEET_AGENCY_LIST_NAME", //代理店リストシート名
  SHEET_LOG_NAME: "SHEET_LOG_NAME", //ログシート名
  MAIL_BODY_SOURCE_COLUMN: "MAIL_BODY_SOURCE_COLUMN", //メール本文ソース列
} as const;

// スクリプトプロパティの値を取得
export const PARENT_FOLDER_ID = getScriptPropertyValue(
  SCRIPT_PROPERTIES.PARENT_FOLDER_ID,
);
export const SENDER_NAME = getScriptPropertyValue(
  SCRIPT_PROPERTIES.SENDER_NAME,
);
export const SHEET_AGENCY_LIST_NAME = getScriptPropertyValue(
  SCRIPT_PROPERTIES.SHEET_AGENCY_LIST_NAME,
);
export const SHEET_LOG_NAME = getScriptPropertyValue(
  SCRIPT_PROPERTIES.SHEET_LOG_NAME,
);
export const MAIL_BODY_SOURCE_COLUMN = columnNameToNumber(
  getScriptPropertyValue(SCRIPT_PROPERTIES.MAIL_BODY_SOURCE_COLUMN),
);
