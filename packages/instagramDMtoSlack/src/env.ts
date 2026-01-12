import { getScriptPropertyValue } from "../../common/src/spreadsheet";

export const SCRIPT_PROPERTIES = {
  INSTAGRAM_VERIFY_TOKEN: "INSTAGRAM_VERIFY_TOKEN", //Instagram Verify Token
  DIFY_WEBHOOK_URL: "DIFY_WEBHOOK_URL", //Dify Webhook URL
} as const;

export const INSTAGRAM_VERIFY_TOKEN = getScriptPropertyValue(
  SCRIPT_PROPERTIES.INSTAGRAM_VERIFY_TOKEN,
);
export const DIFY_WEBHOOK_URL = getScriptPropertyValue(
  SCRIPT_PROPERTIES.DIFY_WEBHOOK_URL,
);
