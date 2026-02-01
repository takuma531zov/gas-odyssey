// スプレッドシートログ出力モジュール
// 処理結果をスプレッドシートに記録

import { getSheet } from "../../../../common/src/spreadsheet";
import { getCurrentDate } from "../../../../common/src/utils";
import { logError, logInfo } from "../../../../common/src/logger";
import { LOG_SHEET_NAME } from "../../env";
import type { ProcessResult } from "../../types";
import { formatProcessStatus } from "../../utils/statusMessages";

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
		const status = formatProcessStatus(result.status);
		const details = result.details || result.error || "";
		const mediaUrls = result.mediaUrls?.join(", ") || "";

		// スプレッドシートに追記
		// 列構成：タイムスタンプ | 送信者ID | 送信者名 | ユーザー名 | メッセージ | ステータス | 詳細 | メディアURL
		sheet.appendRow([
			timestamp,
			senderId,
			senderName,
			username,
			messageText,
			status,
			details,
			mediaUrls,
		]);

		logInfo("Log written successfully");
	} catch (error) {
		logError("Failed to write log to spreadsheet", error);
	}
};
