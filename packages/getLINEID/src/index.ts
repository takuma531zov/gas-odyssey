import { initSheet, writeToSheet } from "./services/sheetService";
import { processWebhookEvents } from "./services/webhookService";
import { getGroupInfo as getGroupInfoService } from "./services/lineService";

/**
 * WebhookからのPOSTリクエストを受け取る
 * LINEからのメッセージイベントを処理してグループIDを取得
 */
function doPost(e: GoogleAppsScript.Events.DoPost) {
  const sheet = initSheet();

  try {
    const data = JSON.parse(e.postData.contents);
    processWebhookEvents(sheet, data);

    return ContentService.createTextOutput(
      JSON.stringify({ status: "ok" }),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    const errorMsg = `エラー: ${error}`;
    writeToSheet(sheet, errorMsg);
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: String(error) }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 指定したグループの詳細情報を取得
 * @param groupId グループID
 */
function getGroupInfo(groupId: string) {
  return getGroupInfoService(groupId);
}

// GASから呼び出せるようにグローバル関数として公開
declare const global: {
  doPost: typeof doPost;
  getGroupInfo: typeof getGroupInfo;
};

global.doPost = doPost;
global.getGroupInfo = getGroupInfo;
