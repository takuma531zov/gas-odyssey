// LINE通知モジュール
// システムエラー発生時のLINE通知

import { fetchData } from "../../../../common/src/utils";
import { logError, logInfo } from "../../../../common/src/logger";
import { LINE_API_TOKEN, LINE_BOT_ID } from "../../env";

/**
 * LINEにエラー通知を送信
 * @param errorType エラーの種別
 * @param errorMessage エラーメッセージ
 * @param details 詳細情報（オプション）
 */
export const sendErrorNotification = (
	errorType: string,
	errorMessage: string,
	details?: string,
): void => {
	try {
		logInfo("Sending error notification to LINE", { errorType });

		const apiToken = LINE_API_TOKEN;
		const botId = LINE_BOT_ID;

		if (!apiToken || !botId) {
			logError("LINE API credentials not found");
			return;
		}

		// LINE通知メッセージを作成
		const detailsText = details ? `\n詳細: ${details}` : "";
		const messageText = `⚠️ Instagram DM Webhook エラー\n\nエラー種別: ${errorType}\nエラー: ${errorMessage}${detailsText}`;

		// LINE Messaging API: Push Message
		const url = "https://api.line.me/v2/bot/message/push";
		const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
			method: "post",
			headers: {
				Authorization: `Bearer ${apiToken}`,
				"Content-Type": "application/json",
			},
			payload: JSON.stringify({
				to: botId,
				messages: [
					{
						type: "text",
						text: messageText,
					},
				],
			}),
			muteHttpExceptions: true,
		};

		const { statusCode } = fetchData(url, options);

		if (statusCode >= 200 && statusCode < 300) {
			logInfo("Error notification sent to LINE successfully");
		} else {
			logError("LINE notification failed", { statusCode });
		}
	} catch (error) {
		logError("LINE notification exception", error);
	}
};
