// スプレッドシートログ出力モジュール
// 処理結果をスプレッドシートに記録

import { getSheet } from "../../../../common/src/spreadsheet";
import { getCurrentDate } from "../../../../common/src/utils";
import { logError, logInfo } from "../../../../common/src/logger";
import { LOG_SHEET_NAME } from "../../env";
import type { ProcessResult } from "../../types";

/**
 * ProcessStatusをステータス文字列に変換
 */
const formatStatus = (status: ProcessResult["status"]): string => {
	switch (status) {
		case "success":
			return "成功";
		case "skipped_echo":
			return "スキップ（エコー）";
		case "skipped_read":
			return "スキップ（既読）";
		case "error_parse":
			return "エラー（解析失敗）";
		case "error_api":
			return "エラー（API失敗）";
		case "error_slack":
			return "エラー（Slack送信失敗）";
		case "error_log":
			return "エラー（ログ出力失敗）";
		default:
			return "不明";
	}
};

/**
 * スプレッドシートにログを出力
 * @param result 処理結果
 */
export const writeLog = (result: ProcessResult): void => {
	try {
		logInfo("Writing log to spreadsheet", { status: result.status });

		const sheetName = LOG_SHEET_NAME;
		if (!sheetName) {
			logError("Log sheet name not found in script properties");
			return;
		}

		const sheet = getSheet(sheetName);
		if (!sheet) {
			logError("Log sheet not found", { sheetName });
			return;
		}

		// ログエントリを作成
		const timestamp = getCurrentDate();
		const senderId = result.senderId || "";
		const senderName = result.senderName || "";
		const username = result.username || "";
		const messageText = result.messageText || "";
		const status = formatStatus(result.status);
		const details = result.details || result.error || "";

		// スプレッドシートに追記
		// 列構成：タイムスタンプ | 送信者ID | 送信者名 | ユーザー名 | メッセージ | ステータス | 詳細
		sheet.appendRow([
			timestamp,
			senderId,
			senderName,
			username,
			messageText,
			status,
			details,
		]);

		logInfo("Log written successfully");
	} catch (error) {
		logError("Failed to write log to spreadsheet", error);
	}
};
