// Slack送信モジュール
// Slack Incoming Webhookへのメッセージ送信（Block Kit対応）

import { logError, logInfo } from "../../../../common/src/logger";
import { SLACK_WEBHOOK_URL } from "../../env";
import type { SlackPayload } from "./formatter";

/**
 * Slackにメッセージを送信（テキストのみ、後方互換用）
 * @param message 送信するメッセージ
 * @returns 成功時true、失敗時false
 */
export const sendToSlack = (
	message: string,
): { success: boolean; error?: string } => {
	return sendToSlackWithPayload({ text: message });
};

/**
 * Slackにペイロードを送信（Block Kit対応）
 * @param payload Slackペイロード（text, blocks含む）
 * @returns 成功時true、失敗時false
 */
export const sendToSlackWithPayload = (
	payload: SlackPayload,
): { success: boolean; error?: string } => {
	try {
		logInfo("Sending message to Slack");

		const webhookUrl = SLACK_WEBHOOK_URL;
		if (!webhookUrl) {
			const error = "Slack Webhook URL not found";
			logError("Slack send failed", error);
			return { success: false, error };
		}

		// Slack Incoming Webhook送信
		const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
			method: "post",
			contentType: "application/json",
			payload: JSON.stringify(payload),
			muteHttpExceptions: true,
		};

		const response = UrlFetchApp.fetch(webhookUrl, options);
		const statusCode = response.getResponseCode();

		// 成功判定（200-299）
		if (statusCode >= 200 && statusCode < 300) {
			logInfo("Message sent to Slack successfully");
			return { success: true };
		}

		// エラー
		const error = `Slack Webhook failed (status: ${statusCode})`;
		logError("Slack send failed", { statusCode });
		return { success: false, error };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logError("Slack send exception", error);
		return { success: false, error: errorMessage };
	}
};
