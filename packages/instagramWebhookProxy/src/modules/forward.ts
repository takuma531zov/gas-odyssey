// 機能: Instagram Webhook イベントのDify転送 (POST)
// - 受け取ったJSONペイロードをDifyのWebhookへ転送し、処理結果をJSONで返却

import { DIFY_WEBHOOK_URL } from "../env";

type TextOutput = GoogleAppsScript.Content.TextOutput;

const json = (data: unknown): TextOutput =>
  ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );

/**
 * Dify へWebhookイベントを転送
 * @param e DoPostイベント
 * @returns TextOutput(JSON)
 */
export const handleDoPost = (
  e: GoogleAppsScript.Events.DoPost,
): TextOutput => {
  try {
    const payload = e.postData.contents;
    Logger.log("[IG Webhook] event received");

    const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
      method: "post",
      contentType: "application/json",
      payload,
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(DIFY_WEBHOOK_URL, options);
    const statusCode = response.getResponseCode();
    Logger.log(`[IG Webhook] forwarded to Dify status=${statusCode}`);

    return json({ success: true });
  } catch (err) {
    Logger.log(`[IG Webhook] error: ${String(err)}`);
    // Instagram 側でリトライされないように成功レスポンス形式を維持
    return json({ success: false, error: String(err) });
  }
};

