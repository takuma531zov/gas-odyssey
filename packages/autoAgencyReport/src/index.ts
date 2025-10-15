import { getTodayTargetAgencies } from "./services/agencyService";
import { getTemplate, generateMessage } from "./services/templateService";
import { getAttachmentFile, moveFileToSentFolder } from "./services/fileService";
import { sendMessage } from "./services/messageSender";
import { writeLog, writeErrorLog } from "./utils/logUtils";

/**
 * 日次実行のメイン処理
 * 本日対象の代理店に進捗報告を送信
 */
function dailySendReport() {
  try {
    // 本日送信対象の代理店を取得
    const targetAgencies = getTodayTargetAgencies();

    if (targetAgencies.length === 0) {
      Logger.log("本日送信対象の代理店はありません");
      return;
    }

    Logger.log(`本日の送信対象: ${targetAgencies.length}件`);

    // 各代理店に対して処理を実行
    for (const agency of targetAgencies) {
      try {
        // 添付ファイルを取得
        const attachment = getAttachmentFile(agency.companyName);

        if (!attachment) {
          writeErrorLog(
            agency.companyName,
            "添付対象ファイルが見つかりません",
          );
          Logger.log(`[${agency.companyName}] 添付ファイルなし - スキップ`);
          continue;
        }

        // テンプレートを取得
        const template = getTemplate(agency.templateName);

        // メッセージを生成
        const message = generateMessage(template, agency);

        // メッセージを送信
        const result = sendMessage(
          agency,
          message.subject,
          message.body,
          attachment,
        );

        // ログを出力
        writeLog(result);

        // 送信成功時は添付ファイルを送信済みフォルダに移動
        if (result.success) {
          // テスト用にファイル移動をコメントアウト
          // moveFileToSentFolder(agency.companyName, attachment.file);
          Logger.log(`[${agency.companyName}] 送信成功`);
        } else {
          Logger.log(
            `[${agency.companyName}] 送信失敗: ${result.errorMessage}`,
          );
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        writeErrorLog(agency.companyName, errorMessage);
        Logger.log(`[${agency.companyName}] エラー: ${errorMessage}`);
      }
    }

    Logger.log("日次送信処理が完了しました");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    Logger.log(`日次送信処理でエラーが発生しました: ${errorMessage}`);
  }
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
