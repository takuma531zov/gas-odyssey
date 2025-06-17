import { getScriptPropertyValue } from "../../common/src/spreadsheet";

export const SCRIPT_PROPERTIES = {
  OCR_FOLDER_ID: "OCR_FOLDER_ID",
  CLOUD_VISION_API_KEY: "CLOUD_VISION_API_KEY",
  DONE_OCR_FOLDER_ID: "DONE_OCR_FOLDER_ID",
  OPEN_AI_API_KEY: "OPEN_AI_API_KEY",
  OPEN_AI_MODEL: "OPEN_AI_MODEL",
} as const;

export const CLOUD_VISION_API_KEY = getScriptPropertyValue(
  SCRIPT_PROPERTIES.CLOUD_VISION_API_KEY,
);
export const OCR_FOLDER_ID = getScriptPropertyValue(
  SCRIPT_PROPERTIES.OCR_FOLDER_ID,
);

export const DONE_OCR_FOLDER_ID = getScriptPropertyValue(
  SCRIPT_PROPERTIES.DONE_OCR_FOLDER_ID,
);

export const OPEN_AI_API_KEY = getScriptPropertyValue(
  SCRIPT_PROPERTIES.OPEN_AI_API_KEY,
);
export const OPEN_AI_MODEL = getScriptPropertyValue(
  SCRIPT_PROPERTIES.OPEN_AI_MODEL,
);
