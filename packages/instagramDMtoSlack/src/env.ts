import { getScriptPropertyValue } from "../../common/src/spreadsheet";

export const SCRIPT_PROPERTIES = {
  INSTAGRAM_VERIFY_TOKEN: "INSTAGRAM_VERIFY_TOKEN", //Instagram Verify Token
  SLACK_WEBHOOK_URL: "SLACK_WEBHOOK_URL", //Slack Webhook URL
  INSTAGRAM_API_TOKEN: "INSTAGRAM_API_TOKEN", //Instagram API Token
  LOG_SHEET_NAME: "LOG_SHEET_NAME", //Log Sheet Name
  LINE_API_TOKEN: "LINE_API_TOKEN", // Line API Token
  LINE_BOT_ID: "LINE_BOT_ID", // Line Bot User ID
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
