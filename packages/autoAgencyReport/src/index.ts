import { processDailyReport } from "./services/reportProcessor";
import { initSheet, writeToSheet } from "./services/lineSheetService";
import { processWebhookEvents } from "./services/lineWebhookService";
import { getGroupInfo as getGroupInfoService } from "./services/lineApiService";

/**
 * 日次実行のメイン処理
 * 本日対象の代理店に進捗報告を送信
 */
function dailySendReport() {
  processDailyReport();
}

/**
 * トリガー設定用の関数
 * この関数を実行してトリガーを設定
 */
function setupDailyTrigger() {
  // 既存のトリガーを削除
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === "dailySendReport") {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  // 新しいトリガーを設定（毎日午前9時に実行）
  ScriptApp.newTrigger("dailySendReport")
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  Logger.log("トリガーを設定しました: 毎日午前9時に実行");
}

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
  dailySendReport: typeof dailySendReport;
  setupDailyTrigger: typeof setupDailyTrigger;
  doPost: typeof doPost;
  getGroupInfo: typeof getGroupInfo;
};

global.dailySendReport = dailySendReport;
global.setupDailyTrigger = setupDailyTrigger;
global.doPost = doPost;
global.getGroupInfo = getGroupInfo;
