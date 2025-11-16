import type { Agency } from "../types";
import { getTodayTargetAgencies } from "./agencyService";
import { getTemplate, generateMessage } from "./templateService";
import { getAttachmentFile, moveFileToSentFolder } from "./fileService";
import { sendMessage } from "./messageSender";
import { writeLog, writeErrorLog } from "../utils/logUtils";

/**
 * 個別代理店の報告処理
 * @param agency 代理店情報
 */
const processAgencyReport = (agency: Agency): void => {
  try {
    // 添付ファイルを取得
    const attachment = getAttachmentFile(agency.companyName);

    if (!attachment) {
      writeErrorLog(agency.companyName, "添付対象ファイルが見つかりません");
      Logger.log(`[${agency.companyName}] 添付ファイルなし - スキップ`);
      return;
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
      moveFileToSentFolder(agency.companyName, attachment.file);
      Logger.log(`[${agency.companyName}] 送信成功`);
    } else {
      Logger.log(`[${agency.companyName}] 送信失敗: ${result.errorMessage}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    writeErrorLog(agency.companyName, errorMessage);
    Logger.log(`[${agency.companyName}] エラー: ${errorMessage}`);
  }
};

/**
 * 日次報告処理のメインロジック
 * 本日対象の代理店に進捗報告を送信
 */
export const processDailyReport = (): void => {
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
      processAgencyReport(agency);
    }

    Logger.log("日次送信処理が完了しました");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    Logger.log(`日次送信処理でエラーが発生しました: ${errorMessage}`);
  }
};
