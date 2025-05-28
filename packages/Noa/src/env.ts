import { getScriptPropertyValue } from "../../common/src/spreadsheet";

export const SCRIPT_PROPERTIES = {
  FOLDER_ID: "FOLDER_ID",
  CLOUD_VISION_API_KEY: "CLOUD_VISION_API_KEY",
} as const;

export const CLOUD_VISION_API_KEY = getScriptPropertyValue(
  SCRIPT_PROPERTIES.CLOUD_VISION_API_KEY,
);
