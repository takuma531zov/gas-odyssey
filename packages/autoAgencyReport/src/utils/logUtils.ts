import { getSheet } from "../../../common/src/spreadsheet";
import type { SendResult } from "../types";
import { SHEET_LOG_NAME } from "../env";
import { formatDate } from "./dateUtils";
import { LOG_DATE_FORMAT } from "../config/constants";

/**
 * 送信ログをスプレッドシートに出力
 * @param result 送信結果
 */
export const writeLog = (result: SendResult): void => {
  const logSheet = getSheet(SHEET_LOG_NAME);

  const logRow = [
    formatDate(result.timestamp, LOG_DATE_FORMAT), // 送信日時
    result.agency.companyName, // 会社名
    result.agency.platform, // 送信媒体
    result.success ? "成功" : "失敗", // ステータス
    result.errorMessage || "", // エラーメッセージ
    result.attachmentFileId || "", // 添付ファイルID
    result.diffSummary || "", // 差分サマリー
  ];

  // 最終行に追記
  logSheet.appendRow(logRow);
};

/**
 * エラーログを出力
 * @param companyName 会社名
 * @param errorMessage エラーメッセージ
 */
export const writeErrorLog = (
  companyName: string,
  errorMessage: string,
): void => {
  const logSheet = getSheet(SHEET_LOG_NAME);

  const logRow = [
    formatDate(new Date(), LOG_DATE_FORMAT), // 送信日時
    companyName, // 会社名
    "", // 送信媒体
    "エラー", // ステータス
    errorMessage, // エラーメッセージ
    "", // 添付ファイルID
    "", // 差分サマリー
  ];

  logSheet.appendRow(logRow);
};
