// 環境変数・スクリプトプロパティ管理
// GASスクリプトプロパティからの設定値取得

import { getScriptPropertyValue } from "../../common/src/spreadsheet";

export const SCRIPT_PROPERTIES = {
  INSTAGRAM_VERIFY_TOKEN: "INSTAGRAM_VERIFY_TOKEN", // Instagram Verify Token
  SLACK_WEBHOOK_URL: "SLACK_WEBHOOK_URL", // Slack Webhook URL
  INSTAGRAM_API_TOKEN: "INSTAGRAM_API_TOKEN", // Instagram API Token
  LOG_SHEET_NAME: "LOG_SHEET_NAME", // Log Sheet Name
  LINE_API_TOKEN: "LINE_API_TOKEN", // Line API Token
  LINE_BOT_ID: "LINE_BOT_ID", // Line Bot User ID
  // Slack返信機能用
  SLACK_BOT_TOKEN: "SLACK_BOT_TOKEN", // Slack Web API認証用
  SLACK_CHANNEL_ID: "SLACK_CHANNEL_ID", // 通知先チャンネル
  INSTAGRAM_PAGE_ID: "INSTAGRAM_PAGE_ID", // Instagram DM送信元ID
  REPLY_LOG_SHEET_NAME: "REPLY_LOG_SHEET_NAME", // 返信ログシート名
  //画像保存用GoogleドライブフォルダID
  IMAGE_TEMP_FOLDER_ID: "IMAGE_TEMP_FOLDER_ID",
} as const;

export const INSTAGRAM_VERIFY_TOKEN = getScriptPropertyValue(
  SCRIPT_PROPERTIES.INSTAGRAM_VERIFY_TOKEN,
);
export const SLACK_WEBHOOK_URL = getScriptPropertyValue(
  SCRIPT_PROPERTIES.SLACK_WEBHOOK_URL,
);
export const INSTAGRAM_API_TOKEN = getScriptPropertyValue(
  SCRIPT_PROPERTIES.INSTAGRAM_API_TOKEN,
);
export const LOG_SHEET_NAME = getScriptPropertyValue(
  SCRIPT_PROPERTIES.LOG_SHEET_NAME,
);
export const LINE_API_TOKEN = getScriptPropertyValue(
  SCRIPT_PROPERTIES.LINE_API_TOKEN,
);
export const LINE_BOT_ID = getScriptPropertyValue(
  SCRIPT_PROPERTIES.LINE_BOT_ID,
);

// Slack返信機能用
export const SLACK_BOT_TOKEN = getScriptPropertyValue(
  SCRIPT_PROPERTIES.SLACK_BOT_TOKEN,
);
export const SLACK_CHANNEL_ID = getScriptPropertyValue(
  SCRIPT_PROPERTIES.SLACK_CHANNEL_ID,
);
export const INSTAGRAM_PAGE_ID = getScriptPropertyValue(
  SCRIPT_PROPERTIES.INSTAGRAM_PAGE_ID,
);
export const REPLY_LOG_SHEET_NAME = getScriptPropertyValue(
  SCRIPT_PROPERTIES.REPLY_LOG_SHEET_NAME,
);
// 画像保存用GoogleドライブフォルダID
export const IMAGE_TEMP_FOLDER_ID = getScriptPropertyValue(
  SCRIPT_PROPERTIES.IMAGE_TEMP_FOLDER_ID,
);
