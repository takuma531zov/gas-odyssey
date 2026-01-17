// 返信ログ出力モジュール
// 返信処理結果をスプレッドシートに記録

import { getSheet } from "../../../../common/src/spreadsheet";
import { getCurrentDate } from "../../../../common/src/utils";
import { logError, logInfo } from "../../../../common/src/logger";
import { REPLY_LOG_SHEET_NAME } from "../../env";
import type { ReplyResult } from "../../types";
import { formatReplyStatus } from "../../utils/statusMessages";

/**
 * スプレッドシートに返信ログを出力
 * @param result 処理結果
 */
export const writeReplyLog = (result: ReplyResult): void => {
	try {
		logInfo("Writing reply log to spreadsheet", { status: result.status });

		const sheetName = REPLY_LOG_SHEET_NAME;
		if (!sheetName) {
			logError("Reply log sheet name not found in script properties");
			return;
		}

		const sheet = getSheet(sheetName);
		if (!sheet) {
			logError("Reply log sheet not found", { sheetName });
			return;
		}

		// ログエントリを作成
		const timestamp = getCurrentDate();
		const instagramUserId = result.instagramUserId ?? "";
		const replyText = result.replyText ?? "";
		const status = formatReplyStatus(result.status);
		const details = result.details ?? result.error ?? "";

		// スプレッドシートに追記
		// 列構成：タイムスタンプ | Instagram送信先ID | 返信内容 | ステータス | 詳細
		sheet.appendRow([timestamp, instagramUserId, replyText, status, details]);

		logInfo("Reply log written successfully");
	} catch (error) {
		logError("Failed to write reply log to spreadsheet", error);
	}
};
