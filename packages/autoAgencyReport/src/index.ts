import { processDailyReport } from "./services/reportProcessor";

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

// GASから呼び出せるようにグローバル関数として公開
declare const global: {
  dailySendReport: typeof dailySendReport;
  setupDailyTrigger: typeof setupDailyTrigger;
};

global.dailySendReport = dailySendReport;
global.setupDailyTrigger = setupDailyTrigger;
