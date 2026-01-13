// 処理フローのオーケストレーション
// Instagram DM受信からSlack通知までの処理フロー制御

import { logError, logInfo, logWarn } from "../../../../common/src/logger";
import type { ProcessResult } from "../../types";
import { parseWebhook } from "./parser";
import { getUserInfo } from "./instagram";
import { refreshToken } from "../../utils/tokenManager";
import { formatSlackMessage, formatTimestamp } from "./formatter";
import { sendToSlack } from "./slack";
import { writeLog } from "./sheetLogger";
import { sendErrorNotification } from "./notifier";

type TextOutput = GoogleAppsScript.Content.TextOutput;

const json = (data: unknown): TextOutput =>
	ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
		ContentService.MimeType.JSON,
	);

/**
 * Instagram WebhookイベントをGASで処理（Dify不要）
 * @param e DoPostイベント
 * @returns TextOutput(JSON)
 */
export const handleDoPost = (
	e: GoogleAppsScript.Events.DoPost,
): TextOutput => {
	try {
		const payload = e.postData.contents;
		logInfo("Instagram Webhook event received");

		// 1. Webhook解析
		const parseResult = parseWebhook(payload);

		if (!parseResult.success) {
			// スキップケース（エコー・既読）
			if (parseResult.reason === "skip") {
				logWarn("Event skipped", { reason: parseResult.error });
				return json({ success: true, message: "Event skipped" });
			}

			// 解析エラー
			logError("Webhook parse failed", parseResult.error);
			const errorResult: ProcessResult = {
				success: false,
				status: "error_parse",
				error: parseResult.error,
				details: parseResult.error,
			};
			sendErrorNotification("Webhook解析失敗", parseResult.error);
			writeLog(errorResult);
			return json({ success: false, error: parseResult.error });
		}

		const { senderId, messageText, timestamp } = parseResult.data;

		// 2. Instagram API呼び出し（ユーザー情報取得）
		let userInfoResult = getUserInfo(senderId);

		// 認証エラーの場合、トークン更新して再試行
		if (!userInfoResult.success && userInfoResult.isAuthError) {
			logWarn("Auth error detected, refreshing token");
			const tokenRefreshResult = refreshToken();

			if (!tokenRefreshResult.success) {
				// トークン更新失敗
				logError("Token refresh failed", tokenRefreshResult.error);
				const errorResult: ProcessResult = {
					success: false,
					senderId,
					messageText,
					timestamp: formatTimestamp(timestamp),
					status: "error_api",
					error: "Token refresh failed",
					details: tokenRefreshResult.error,
				};
				sendErrorNotification(
					"トークン更新失敗",
					tokenRefreshResult.error || "Unknown error",
				);
				writeLog(errorResult);
				return json({ success: false, error: tokenRefreshResult.error });
			}

			// トークン更新成功、再試行
			logInfo("Token refreshed successfully, retrying getUserInfo");
			userInfoResult = getUserInfo(senderId);
		}

		// API失敗（再試行後も失敗）
		if (!userInfoResult.success) {
			logError("Instagram API failed", userInfoResult.error);
			const errorResult: ProcessResult = {
				success: false,
				senderId,
				messageText,
				timestamp: formatTimestamp(timestamp),
				status: "error_api",
				error: userInfoResult.error,
				details: userInfoResult.error,
			};
			sendErrorNotification("Instagram API失敗", userInfoResult.error);
			writeLog(errorResult);
			return json({ success: false, error: userInfoResult.error });
		}

		const userInfo = userInfoResult.data;

		// 3. Slackメッセージ整形
		const slackMessage = formatSlackMessage(userInfo, messageText, timestamp);

		// 4. Slack送信
		const slackResult = sendToSlack(slackMessage);

		if (!slackResult.success) {
			logError("Slack send failed", slackResult.error);
			const errorResult: ProcessResult = {
				success: false,
				senderId,
				senderName: userInfo.name,
				username: userInfo.username,
				messageText,
				timestamp: formatTimestamp(timestamp),
				status: "error_slack",
				error: slackResult.error,
				details: slackResult.error,
			};
			sendErrorNotification(
				"Slack送信失敗",
				slackResult.error || "Unknown error",
			);
			writeLog(errorResult);
			return json({ success: false, error: slackResult.error });
		}

		// 5. 成功ログ出力
		const successResult: ProcessResult = {
			success: true,
			senderId,
			senderName: userInfo.name,
			username: userInfo.username,
			messageText,
			timestamp: formatTimestamp(timestamp),
			status: "success",
			details: "DM successfully forwarded to Slack",
		};
		writeLog(successResult);

		logInfo("Instagram DM successfully forwarded to Slack", {
			senderId,
			username: userInfo.username,
		});

		return json({ success: true });
	} catch (err) {
		logError("Unexpected error in handleDoPost", err);
		sendErrorNotification(
			"予期しないエラー",
			err instanceof Error ? err.message : String(err),
		);
		return json({ success: false, error: String(err) });
	}
};
