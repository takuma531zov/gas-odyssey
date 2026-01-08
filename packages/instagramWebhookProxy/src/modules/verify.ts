// 機能: Instagram Webhook 検証 (GET)
// - hub.mode, hub.verify_token, hub.challenge を検証し、正であればchallengeを返却

import { INSTAGRAM_VERIFY_TOKEN } from "../env";

type TextOutput = GoogleAppsScript.Content.TextOutput;

const text = (body: string): TextOutput =>
  ContentService.createTextOutput(body).setMimeType(
    ContentService.MimeType.TEXT,
  );

/**
 * Instagram Webhook 検証
 * @param e DoGetイベント
 * @returns TextOutput
 */
export const handleDoGet = (e: GoogleAppsScript.Events.DoGet): TextOutput => {
  try {
    const params = e.parameter;
    const mode = params["hub.mode"];
    const token = params["hub.verify_token"];
    const challenge = params["hub.challenge"];

    Logger.log("[IG Verify] request received");
    Logger.log(`mode=${mode}`);

    if (mode === "subscribe" && token === INSTAGRAM_VERIFY_TOKEN) {
      Logger.log("[IG Verify] success");
      return text(challenge);
    }

    Logger.log("[IG Verify] forbidden: token mismatch or invalid mode");
    return text("Forbidden");
  } catch (err) {
    Logger.log(`[IG Verify] error: ${String(err)}`);
    return text("Error");
  }
};

