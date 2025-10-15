import { getScriptPropertyValue } from "../../common/src/spreadsheet";

export const SCRIPT_PROPERTIES = {
  LINE_BOT_TOKEN: "LINE_BOT_TOKEN", //LINE Bot Token
} as const;

export const LINE_BOT_TOKEN = getScriptPropertyValue(
  SCRIPT_PROPERTIES.LINE_BOT_TOKEN,
);
